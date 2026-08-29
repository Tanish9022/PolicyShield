import { describe, it, expect, vi } from 'vitest';
import { getDb } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import { processIntent, checkoutAction } from '../gateway/orchestrator';
import * as reasoning from '../agent/reasoning';
import * as negotiation from '../agent/negotiation';
import * as discovery from '../agent/discovery';
import * as comparison from '../agent/comparison';
import * as razorpay from '../execution/razorpay';
import { IntentRequest } from '@policyshield/shared';

describe('AI Buyer E2E Flow', () => {
  const merchantId = 'merchant_1'; // assuming policy exists for merchant_1

  it('Full Flow: DISCOVER -> COMPARE -> NEGOTIATE -> POLICY_REJECT -> ADAPT -> READY_FOR_CHECKOUT -> CONFIRM -> JIT -> IDEMPOTENCY -> RAZORPAY -> VERIFY', async () => {
    const db = getDb();
    const requestId = uuidv4();
    const intentId = `eval_gemini_${uuidv4()}`;
    const buyerInput = 'I want airpods and a student discount';

    const intent: IntentRequest = {
      request_id: requestId as any,
      intent_id: intentId as any,
      merchant_id: merchantId as any,
      buyer_input: buyerInput,
      received_at: new Date().toISOString()
    };

    const discoverySpy = vi.spyOn(discovery, 'discoverCandidates').mockResolvedValue([
      { product_id: 'prod_airpods', name: 'AirPods Pro', base_price: 24900, currency: 'INR', available_promotions: [] } as any
    ]);

    const compareSpy = vi.spyOn(comparison, 'compareCandidates').mockResolvedValue({
      decision: 'SELECT',
      selected_product_id: 'prod_airpods',
      reasoning_evidence: ['Selected airpods']
    });

    // Mock negotiation to first propose an invalid discount, then adapt to a valid one
    let callCount = 0;
    const reasoningSpy = vi.spyOn(negotiation, 'proposeAction').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // Attempt 1: Malicious / Too high discount
        return {
          proposed_action: {
            type: 'CREATE_ORDER',
            product_id: 'prod_airpods',
            amount: 10,
            currency: 'INR',
            applied_promotions: ['PROMO_STUDENT', 'PROMO_EMPLOYEE'] // Too many promos
          },
          reasoning: 'I applied all promos'
        };
      } else {
        // Attempt 2: Adapted valid request
        return {
          proposed_action: {
            type: 'CREATE_ORDER',
            product_id: 'prod_airpods',
            amount: 24900,
            currency: 'INR',
            applied_promotions: []
          },
          reasoning: 'I removed the invalid promos'
        };
      }
    });

    const razorpaySpy = vi.spyOn(razorpay.RazorpayAdapter, 'createOrder').mockImplementation(async (amount: number, currency: string, receipt: string) => {
      return { id: `order_${uuidv4()}`, receipt, status: 'created' };
    });

    // 1. Process Intent (DISCOVER -> COMPARE -> NEGOTIATE -> POLICY_REJECT -> ADAPT -> READY_FOR_CHECKOUT)
    const processResult = await processIntent(intent);
    
    expect(processResult.gate_decision).toBe('APPROVE');
    expect(processResult.action.state).toBe('VALIDATED');
    expect(callCount).toBeGreaterThanOrEqual(2); // Should have retried at least once

    const agentRun = db.prepare('SELECT * FROM agent_runs WHERE intent_id = ?').get(intentId) as any;
    expect(agentRun.state).toBe('READY_FOR_CHECKOUT');
    expect(agentRun.current_step).toBe('CHECKOUT_PENDING');
    expect(agentRun.adaptation_count).toBeGreaterThan(0);

    // 2. Checkout Action (CONFIRM -> JIT -> IDEMPOTENCY -> RAZORPAY -> VERIFY)
    const checkoutResult = await checkoutAction(intentId);

    expect(checkoutResult.state).toBe('VERIFIED_SUCCESS');
    expect(checkoutResult.external_receipt).toBeDefined();
    expect(checkoutResult.external_receipt.startsWith('ps_')).toBe(true);

    const agentRunFinal = db.prepare('SELECT * FROM agent_runs WHERE intent_id = ?').get(intentId) as any;
    expect(agentRunFinal.state).toBe('COMPLETED');
    expect(agentRunFinal.current_step).toBe('VERIFIED');

    // Restore Mocks
    discoverySpy.mockRestore();
    compareSpy.mockRestore();
    reasoningSpy.mockRestore();
    razorpaySpy.mockRestore();
  });
});
