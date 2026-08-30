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
  try {
    const db = getDb();
    const intentId = `intent_test_recovery_${randomUUID().substring(0, 8)}`;
    const actionId = `action_test_recovery_${randomUUID().substring(0, 8)}`;
    const idempotencyKey = `idemp_${intentId}`;
    
    // Use a real receipt from a previously created order or create a new one first
    // Since we don't have a known receipt right now that hasn't been recovered,
    // let's create one via real Razorpay API first.
    console.log("Creating a real Razorpay order to simulate a lost execution response...");
    const { RazorpayAdapter } = await import('../execution/razorpay');
    
    const receipt = `receipt_test_rec_${randomUUID().substring(0, 8)}`;
    const order = await RazorpayAdapter.createOrder(5000, 'INR', receipt);
    console.log(`Created order in Razorpay: ${order.id} with receipt ${receipt}`);

    // Manually inject a pending execution into the DB
    console.log(`Injecting intent & action into DB as EXECUTION_UNKNOWN...`);
    db.prepare(`
      INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input, received_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(intentId, 'req_test', 'MERCH_1', 'test input', new Date().toISOString());

    db.prepare(`
      INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, external_receipt, action_type, state, decision, policy_version, parameters_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(actionId, intentId, 'MERCH_1', idempotencyKey, receipt, 'CREATE_ORDER', 'EXECUTION_UNKNOWN', 'APPROVE', 'v1', JSON.stringify({ product_id: 'prod_1' }));

    // Now run recovery
    console.log("Waiting for Razorpay to index the new receipt...");
    let result: any = null;
    const maxRetries = 10;
    
    for (let i = 0; i < maxRetries; i++) {
       console.log(`Triggering resolveUnknownExecution() - Attempt ${i+1}...`);
       
       // Reset state so orchestrator finds it
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

    console.log(JSON.stringify(result, null, 2));

    // Verify DB state
    const actionRow = db.prepare('SELECT state, razorpay_order_id FROM actions WHERE action_id = ?').get(actionId) as any;
    console.log(`Final DB Action State: ${actionRow.state}`);
    console.log(`Final DB Razorpay Order ID: ${actionRow.razorpay_order_id}`);

    if (actionRow.state === 'VERIFIED_SUCCESS' && actionRow.razorpay_order_id === order.id) {
      console.log("=== TEST COMPLETED SUCCESSFULLY ===");
    } else {
      console.error("=== TEST FAILED: State mismatch ===");
    }
  } catch (error) {
    console.error("=== TEST FAILED WITH ERROR ===");
    console.error(error);
  }
}

run();
