import { describe, it, expect } from 'vitest';
import { processIntent, checkoutAction } from '../gateway/orchestrator';
import { IntentRequest } from '@policyshield/shared';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/client';
import * as razorpay from '../execution/razorpay';

describe('JIT Re-validation Tests', () => {
  const merchantId = 'merchant_1';

  it('Test: Mutate price after approval -> JIT blocks execution', async () => {
    // 1. Initial Approval
    const intent: IntentRequest = {
      request_id: uuidv4() as any,
      intent_id: uuidv4() as any,
      merchant_id: merchantId as any,
      buyer_input: 'I want to buy the AirPods Pro at full price',
      received_at: new Date().toISOString()
    };
    
    const result = await processIntent(intent);
    expect(result.gate_decision).toBe('APPROVE');
    const actionId = result.action.action_id;

    const db = getDb();
    await db.prepare("UPDATE actions SET state = 'VALIDATED' WHERE action_id = ?").run(actionId);

    // 2. Mutate state (change price to trigger approval threshold or policy mismatch)
    // Actually, if we just change price, the original parameters say price was X. 
    // JIT fetches current context. We will change price to 200000.
    await db.prepare("UPDATE products SET price = 200000 WHERE product_id = 'prod_airpods'").run();

    // 3. Checkout
    await expect(checkoutAction(intent.intent_id)).rejects.toThrow(/JIT/);
  });
});
