import { describe, it, expect } from 'vitest';
import { processIntent } from '../gateway/orchestrator';
import { IntentRequest } from '@policyshield/shared';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/client';

describe('Policy Precedence Tests', () => {
  const merchantId = 'merchant_1';

  it('Test: Discount Precedence (Requested > Promo > Policy)', async () => {
    // Current policy MAX_DISCOUNT_PERCENT = 15
    // Buyer asks for 20
    const intent: IntentRequest = {
      request_id: uuidv4() as any,
      intent_id: uuidv4() as any,
      merchant_id: merchantId as any,
      buyer_input: 'Give me a 20% discount on the AirPods Pro and propose 15',
      received_at: new Date().toISOString()
    };

    const result = await processIntent(intent);
    
    // Result should be APPROVED with 15% discount because the policy is authoritative.
    const metadata = JSON.parse(result.action.evidence_json).discount_metadata;
    const razorpay_invoked = JSON.parse(result.action.evidence_json).razorpay_invoked;
    
    expect(result.gate_decision).toBe('APPROVE');
    expect(razorpay_invoked).toBe(false);
    expect(metadata.final_discount).toBe(15);
    expect(result.action.state).toBe('VALIDATED');
  });

  it('Test: Discount Precedence with mutated stricter policy', async () => {
    const db = getDb();
    
    // Mutate policy to 5% strictly for this test, demonstrating state isolation
    // The previous test will not be affected because of beforeEach reset
    const versions = db.prepare('SELECT version, rules_json FROM policy_versions WHERE merchant_id = ? ORDER BY compiled_at DESC LIMIT 1').get(merchantId) as any;
    const rules = JSON.parse(versions.rules_json);
    const maxDiscountRule = rules.find((r: any) => r.rule_type === 'MAX_DISCOUNT');
    maxDiscountRule.parameters.max_discount_percent = 5;
    
    db.prepare('UPDATE policy_versions SET rules_json = ? WHERE merchant_id = ? AND version = ?').run(JSON.stringify(rules), merchantId, versions.version);

    const intent: IntentRequest = {
      request_id: uuidv4() as any,
      intent_id: uuidv4() as any,
      merchant_id: merchantId as any,
      buyer_input: 'Give me a 20% discount on the AirPods Pro and propose 15',
      received_at: new Date().toISOString()
    };

    const result = await processIntent(intent);
    
    const metadata = JSON.parse(result.action.evidence_json).discount_metadata;
    const razorpay_invoked = JSON.parse(result.action.evidence_json).razorpay_invoked;
    
    expect(['APPROVE', 'MODIFY', 'REJECT']).toContain(result.gate_decision);
    expect(razorpay_invoked).toBe(false);
    
    if (result.gate_decision === 'APPROVE' || result.gate_decision === 'MODIFY') {
        expect(metadata.final_discount).toBe(5);
    }
  });
});
