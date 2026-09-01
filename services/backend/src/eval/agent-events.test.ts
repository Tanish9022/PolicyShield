import { describe, it, expect, vi } from 'vitest';
import { getDb } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import { processIntent, checkoutAction } from '../gateway/orchestrator';
import * as negotiation from '../agent/negotiation';
import * as discovery from '../agent/discovery';
import * as comparison from '../agent/comparison';
import * as razorpay from '../execution/razorpay';
import { IntentRequest } from '@policyshield/shared';
import { getAgentEvents } from '../agent/events';

describe('Agent Events Trace (Event-Driven Architecture)', () => {
  const merchantId = 'merchant_1'; 

  it('proves the backend persists an immutable, sequential event stream for the UI', async () => {
    const db = getDb();
    const requestId = uuidv4();
    const intentId = `eval_events_${uuidv4()}`;
    const buyerInput = 'I want a phone with a small discount';

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

    let callCount = 0;
    const reasoningSpy = vi.spyOn(negotiation, 'proposeAction').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // Attempt 1: Too high discount -> triggers POLICY_REJECT -> ADAPT
        return {
          proposed_action: {
            type: 'CREATE_ORDER',
            product_id: 'prod_airpods',
            amount: 10,
            currency: 'INR',
            applied_promotions: ['PROMO_EXCESSIVE'] 
          },
          reasoning: 'I applied all promos'
        };
      } else {
        // Attempt 2: Valid
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
      return { id: `order_${uuidv4()}`, amount, currency, receipt };
    });

    // 1. Process Intent
    const runId = uuidv4();
    const processResult = await processIntent(intent, runId);
    
    expect(processResult.gate_decision).toBe('APPROVE');
    
    // 2. Checkout
    await checkoutAction(intentId);

    // 3. Verify event stream
    const events = await getAgentEvents(runId, 0);
    
    expect(events.length).toBeGreaterThan(0);
    
    // Check sequential integrity
    events.forEach((e: any, idx: number) => {
      expect(e.sequence).toBe(idx + 1); // No gaps
      expect(e.run_id).toBe(runId);
    });

    const eventTypes = events.map((e: any) => e.event_type);
    
    // We expect a full trace
    expect(eventTypes).toEqual([
      'INTENT_RECEIVED',
      'DISCOVER',
      'COMPARE',
      'PROPOSE',
      'POLICY_REJECT',
      'ADAPT',
      'PROPOSE',
      'POLICY_APPROVE',
      'JIT_VALIDATE',
      'PAYMENT_CREATE',
      'VERIFIED_SUCCESS'
    ]);
    
    // Verify payload of POLICY_REJECT
    const rejectEvent = events.find((e: any) => e.event_type === 'POLICY_REJECT') as any;
    const rejectPayload = JSON.parse(rejectEvent.payload_json);
    expect(rejectPayload.proposal).toBeDefined();
    expect(rejectPayload.reasons).toBeDefined();

    // Restore Mocks
    discoverySpy.mockRestore();
    compareSpy.mockRestore();
    reasoningSpy.mockRestore();
    razorpaySpy.mockRestore();
  });
});
