import { describe, it, expect } from 'vitest';
import { resolveUnknownExecution } from '../gateway/orchestrator';
import { getDb } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import * as razorpay from '../execution/razorpay';

describe('Execution Recovery Tests', () => {
  const merchantId = 'merchant_1';

  it('Test B: Order created, Client timeout occurs -> Recovered', async () => {
    const db = getDb();
    const intentId = uuidv4() as any;
    const actionId = uuidv4();
    const receipt = `rec_${uuidv4()}`;
    
    // Simulate intent and action in DB
    db.prepare(`INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input) VALUES (?, ?, ?, ?)`).run(intentId, uuidv4(), merchantId, 'mock input');
    db.prepare(`INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, external_receipt, action_type, state, decision, policy_version, parameters_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(actionId, intentId, merchantId, `idemp_${intentId}`, receipt, 'CREATE_ORDER', 'EXECUTION_UNKNOWN', 'APPROVE', 'v1', JSON.stringify({ receipt }));

    // Mock Razorpay API so fetchOrderByReceipt returns success
    const originalFetch = (razorpay.RazorpayAdapter as any).fetchOrderByReceipt;
    (razorpay.RazorpayAdapter as any).fetchOrderByReceipt = async (r: string) => {
      if (r === receipt) return { id: 'order_mock', status: 'created', receipt: r };
      return null;
    };

    const recoveryResult = await resolveUnknownExecution(intentId);
    
    expect(recoveryResult.status).toBe('VERIFIED_SUCCESS');
    
    const action = db.prepare('SELECT state FROM actions WHERE action_id = ?').get(actionId) as any;
    expect(action.state).toBe('VERIFIED_SUCCESS');

    // Restore original mock
    (razorpay.RazorpayAdapter as any).fetchOrderByReceipt = originalFetch;
  });

  it('Test C: Order NOT created, timeout occurs -> Failed', async () => {
    const db = getDb();
    const intentId = uuidv4() as any;
    const actionId = uuidv4();
    const receipt = `rec_fail_${uuidv4()}`;
    
    db.prepare(`INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input) VALUES (?, ?, ?, ?)`).run(intentId, uuidv4(), merchantId, 'mock input');
    db.prepare(`INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, external_receipt, action_type, state, decision, policy_version, parameters_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(actionId, intentId, merchantId, `idemp_${intentId}`, receipt, 'CREATE_ORDER', 'EXECUTION_UNKNOWN', 'APPROVE', 'v1', JSON.stringify({ receipt }));

    // Mock Razorpay API so fetchOrderByReceipt returns null
    const originalFetch = (razorpay.RazorpayAdapter as any).fetchOrderByReceipt;
    (razorpay.RazorpayAdapter as any).fetchOrderByReceipt = async () => null;

    const recoveryResult = await resolveUnknownExecution(intentId);
    
    expect(recoveryResult.status).toBe('VERIFIED_FAILURE');
    
    const action = db.prepare('SELECT state FROM actions WHERE action_id = ?').get(actionId) as any;
    expect(action.state).toBe('VERIFIED_FAILURE');

    (razorpay.RazorpayAdapter as any).fetchOrderByReceipt = originalFetch;
  });
  
  it('Correlation ID Test: fetchOrderByReceipt strictly correlates', async () => {
    // This is essentially Test B, but we assert that if a DIFFERENT receipt is passed, it returns NOT_FOUND (VERIFIED_FAILURE)
    const db = getDb();
    const intentId = uuidv4() as any;
    const actionId = uuidv4();
    const receipt = `rec_${uuidv4()}`;
    
    db.prepare(`INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input) VALUES (?, ?, ?, ?)`).run(intentId, uuidv4(), merchantId, 'mock input');
    db.prepare(`INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, external_receipt, action_type, state, decision, policy_version, parameters_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(actionId, intentId, merchantId, `idemp_${intentId}`, receipt, 'CREATE_ORDER', 'EXECUTION_UNKNOWN', 'APPROVE', 'v1', JSON.stringify({ receipt }));

    // Mock Razorpay API so fetchOrderByReceipt only returns for specific receipt
    const originalFetch = (razorpay.RazorpayAdapter as any).fetchOrderByReceipt;
    (razorpay.RazorpayAdapter as any).fetchOrderByReceipt = async (r: string) => {
      // Intentionally look for a WRONG receipt
      if (r === 'wrong_receipt') return { id: 'order_mock', status: 'created', receipt: 'wrong_receipt' };
      return null;
    };

    const recoveryResult = await resolveUnknownExecution(intentId);
    
    expect(recoveryResult.status).toBe('VERIFIED_FAILURE');
    
    (razorpay.RazorpayAdapter as any).fetchOrderByReceipt = originalFetch;
  });
});
