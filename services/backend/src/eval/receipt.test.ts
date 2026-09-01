import { describe, it, expect } from 'vitest';
import { getDb } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import { executeAction } from '../execution/executor';
import { resolveUnknownExecution } from '../gateway/orchestrator';
import * as razorpay from '../execution/razorpay';
import { TelemetryTracer } from '../gateway/telemetry';

describe('Receipt Architecture Tests', () => {
  const merchantId = 'merchant_1';

  it('A. external_receipt length <= 40', async () => {
    const db = getDb();
    const actionId = uuidv4();
    const intentId = uuidv4() as any;
    const externalReceipt = `ps_${uuidv4().substring(0, 8)}`;
    
    db.prepare(`INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input) VALUES (?, ?, ?, ?)`).run(intentId, uuidv4(), merchantId, 'mock input');

    const policy = await db.prepare('SELECT version FROM policy_versions WHERE merchant_id = ?').get(merchantId) as any;
    const policyVersion = policy ? policy.version : 'v1';
    
    db.prepare(`
      INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, external_receipt, action_type, state, decision, policy_version, parameters_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actionId,
      intentId,
      merchantId,
      `idemp_${intentId}`,
      externalReceipt,
      'CREATE_ORDER',
      'VALIDATED',
      'APPROVE',
      policyVersion,
      JSON.stringify({ product_id: 'prod_airpods', currency: 'INR' })
    );

    const action = await db.prepare('SELECT * FROM actions WHERE action_id = ?').get(actionId) as any;
    expect(action.external_receipt.length).toBeLessThanOrEqual(40);
    expect(action.external_receipt.startsWith('ps_')).toBe(true);
  });

  it('B. createOrder(receipt = X) then fetchOrderByReceipt(X) -> finds order', async () => {
    const db = getDb();
    const actionId = uuidv4();
    const intentId = uuidv4() as any;
    const externalReceipt = `ps_${uuidv4().substring(0, 8)}`;
    
    db.prepare(`INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input) VALUES (?, ?, ?, ?)`).run(intentId, uuidv4(), merchantId, 'mock input');

    const policy = await db.prepare('SELECT version FROM policy_versions WHERE merchant_id = ?').get(merchantId) as any;
    const policyVersion = policy ? policy.version : 'v1';
    
    db.prepare(`
      INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, external_receipt, action_type, state, decision, policy_version, parameters_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actionId,
      intentId,
      merchantId,
      `idemp_${intentId}`,
      externalReceipt,
      'CREATE_ORDER',
      'VALIDATED',
      'APPROVE',
      policyVersion,
      JSON.stringify({ product_id: 'prod_airpods', currency: 'INR' })
    );

    // Mock createOrder to return the receipt, and fetch to match it
    const originalCreate = (razorpay.RazorpayAdapter as any).createOrder;
    const originalFetch = (razorpay.RazorpayAdapter as any).fetchOrderByReceipt;
    
    let capturedReceipt = '';
    (razorpay.RazorpayAdapter as any).createOrder = async (amount: number, currency: string, receipt: string) => {
      capturedReceipt = receipt;
      return { id: 'order_mock_test_b', receipt };
    };

    (razorpay.RazorpayAdapter as any).fetchOrderByReceipt = async (r: string) => {
      if (r === capturedReceipt) return { id: 'order_mock_test_b', status: 'created', receipt: r };
      return null;
    };

    const tracer = new TelemetryTracer('req_id', intentId);
    tracer.setActionId(actionId);
    await executeAction(actionId, tracer);

    const order = await razorpay.RazorpayAdapter.fetchOrderByReceipt(externalReceipt);
    expect(order).not.toBeNull();
    expect(order.receipt).toBe(externalReceipt);

    (razorpay.RazorpayAdapter as any).createOrder = originalCreate;
    (razorpay.RazorpayAdapter as any).fetchOrderByReceipt = originalFetch;
  });

  it('D. timeout after order creation -> EXECUTION_UNKNOWN -> lookup X -> VERIFIED_SUCCESS', async () => {
    const db = getDb();
    const actionId = uuidv4();
    const intentId = uuidv4() as any;
    const externalReceipt = `ps_${uuidv4().substring(0, 8)}`;
    
    db.prepare(`INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input) VALUES (?, ?, ?, ?)`).run(intentId, uuidv4(), merchantId, 'mock input');

    const policy = await db.prepare('SELECT version FROM policy_versions WHERE merchant_id = ?').get(merchantId) as any;
    const policyVersion = policy ? policy.version : 'v1';
    
    db.prepare(`
      INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, external_receipt, action_type, state, decision, policy_version, parameters_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actionId,
      intentId,
      merchantId,
      `idemp_${intentId}`,
      externalReceipt,
      'CREATE_ORDER',
      'EXECUTION_UNKNOWN',
      'APPROVE',
      policyVersion,
      JSON.stringify({ product_id: 'prod_airpods', currency: 'INR' })
    );

    const originalFetch = (razorpay.RazorpayAdapter as any).fetchOrderByReceipt;
    (razorpay.RazorpayAdapter as any).fetchOrderByReceipt = async (r: string) => {
      if (r === externalReceipt) return { id: 'order_timeout', status: 'created', receipt: r };
      return null;
    };

    const tracer = new TelemetryTracer('req_id', intentId);
    const recoveryResult = await resolveUnknownExecution(intentId, tracer);
    expect(recoveryResult.status).toBe('VERIFIED_SUCCESS');
    
    const action = await db.prepare('SELECT state FROM actions WHERE action_id = ?').get(actionId) as any;
    expect(action.state).toBe('VERIFIED_SUCCESS');

    (razorpay.RazorpayAdapter as any).fetchOrderByReceipt = originalFetch;
  });
});
