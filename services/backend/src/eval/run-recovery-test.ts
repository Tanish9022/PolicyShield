import dotenv from 'dotenv';
dotenv.config();

// Ensure STUB_RAZORPAY is disabled
process.env.STUB_RAZORPAY = '';
process.env.STUB_AI = '';

import { getDb } from '../db/client';
import { resolveUnknownExecution } from '../gateway/orchestrator';
import { randomUUID } from 'crypto';

async function run() {
  console.log("=== STARTING EXECUTION_UNKNOWN RECOVERY TEST ===");
  const db = getDb();
  const { RazorpayAdapter } = await import('../execution/razorpay');

  // --- TEST CASE 1: Primary Order ID Lookup ---
  console.log("\n--- TEST CASE 1: Primary Order ID Lookup ---");
  try {
    const intentId = `intent_test_recovery_id_${randomUUID().substring(0, 8)}`;
    const actionId = `action_test_recovery_id_${randomUUID().substring(0, 8)}`;
    const idempotencyKey = `idemp_${intentId}`;
    
    console.log("Creating a real Razorpay order...");
    const receipt = `receipt_test_rec_${randomUUID().substring(0, 8)}`;
    const order = await RazorpayAdapter.createOrder(5000, 'INR', receipt);
    console.log(`Created order: ${order.id}`);

    console.log(`Injecting into DB with state=EXECUTION_UNKNOWN and razorpay_order_id=${order.id}...`);
    db.prepare(`
      INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input, received_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(intentId, 'req_test', 'MERCH_1', 'test input', new Date().toISOString());

    db.prepare(`
      INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, external_receipt, razorpay_order_id, action_type, state, decision, policy_version, parameters_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(actionId, intentId, 'MERCH_1', idempotencyKey, receipt, order.id, 'CREATE_ORDER', 'EXECUTION_UNKNOWN', 'APPROVE', 'v1', JSON.stringify({ product_id: 'prod_1' }));

    console.log(`Triggering resolveUnknownExecution()...`);
    const start = performance.now();
    const result = await resolveUnknownExecution(intentId);
    const end = performance.now();
    console.log(`[RES] Recovery completed in ${(end - start).toFixed(2)}ms`);
    console.log("Result:", JSON.stringify(result, null, 2));

    const actionRow = db.prepare('SELECT state, razorpay_order_id FROM actions WHERE action_id = ?').get(actionId) as any;
    if (actionRow.state === 'VERIFIED_SUCCESS' && actionRow.razorpay_order_id === order.id) {
      console.log("=== TEST CASE 1 SUCCESS ===");
    } else {
      throw new Error(`State mismatch: state=${actionRow.state}, order_id=${actionRow.razorpay_order_id}`);
    }
  } catch (error: any) {
    console.error("=== TEST CASE 1 FAILED ===", error.message || error);
    process.exit(1);
  }

  // --- TEST CASE 2: Fallback Receipt-based Lookup ---
  console.log("\n--- TEST CASE 2: Fallback Receipt-based Lookup ---");
  try {
    const intentId = `intent_test_recovery_rec_${randomUUID().substring(0, 8)}`;
    const actionId = `action_test_recovery_rec_${randomUUID().substring(0, 8)}`;
    const idempotencyKey = `idemp_${intentId}`;
    
    console.log("Creating a real Razorpay order...");
    const receipt = `receipt_test_rec_${randomUUID().substring(0, 8)}`;
    const order = await RazorpayAdapter.createOrder(5000, 'INR', receipt);
    console.log(`Created order: ${order.id} with receipt ${receipt}`);

    console.log(`Injecting into DB with state=EXECUTION_UNKNOWN and razorpay_order_id=NULL...`);
    db.prepare(`
      INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input, received_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(intentId, 'req_test', 'MERCH_1', 'test input', new Date().toISOString());

    db.prepare(`
      INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, external_receipt, razorpay_order_id, action_type, state, decision, policy_version, parameters_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(actionId, intentId, 'MERCH_1', idempotencyKey, receipt, null, 'CREATE_ORDER', 'EXECUTION_UNKNOWN', 'APPROVE', 'v1', JSON.stringify({ product_id: 'prod_1' }));

    console.log("Waiting for Razorpay to index receipt...");
    let result: any = null;
    const maxRetries = 10;
    
    for (let i = 0; i < maxRetries; i++) {
       console.log(`Triggering resolveUnknownExecution() - Attempt ${i+1}...`);
       db.prepare(`UPDATE actions SET state = 'EXECUTION_UNKNOWN' WHERE action_id = ?`).run(actionId);
       
       const start = performance.now();
       result = await resolveUnknownExecution(intentId);
       const end = performance.now();
       console.log(`[RES] Recovery attempt completed in ${(end - start).toFixed(2)}ms`);
       
       if (result.status === 'VERIFIED_SUCCESS') {
         break;
       }
       await new Promise(r => setTimeout(r, 2000));
    }

    console.log("Result:", JSON.stringify(result, null, 2));

    const actionRow = db.prepare('SELECT state, razorpay_order_id FROM actions WHERE action_id = ?').get(actionId) as any;
    if (actionRow.state === 'VERIFIED_SUCCESS' && actionRow.razorpay_order_id === order.id) {
      console.log("=== TEST CASE 2 SUCCESS ===");
      console.log("=== ALL RECOVERY TESTS COMPLETED SUCCESSFULLY ===");
    } else {
      throw new Error(`State mismatch: state=${actionRow.state}, order_id=${actionRow.razorpay_order_id}`);
    }
  } catch (error: any) {
    console.error("=== TEST CASE 2 FAILED ===", error.message || error);
    process.exit(1);
  }
}

run();
