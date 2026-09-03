import dotenv from 'dotenv';
dotenv.config();

process.env.USE_SQLITE = 'true';
process.env.NODE_ENV = 'test';
process.env.STUB_RAZORPAY = '';
process.env.STUB_AI = '';

import { getDb } from '../db/client';
import { resolveUnknownExecution } from '../gateway/orchestrator';
import { randomUUID } from 'crypto';

async function run5xRecovery() {
  console.log("==================================================");
  console.log("REAL RAZORPAY TEST-MODE 5X RECOVERY VERIFICATION");
  console.log("==================================================");
  
  const { RazorpayAdapter } = await import('../execution/razorpay');
  const db = getDb();
  let passCount = 0;
  const totalRuns = 5;

  for (let i = 1; i <= totalRuns; i++) {
    console.log(`\n--- RUN ${i}/${totalRuns} ---`);
    try {
      const intentId = `intent_real_rec_${randomUUID().substring(0, 8)}`;
      const actionId = `action_real_rec_${randomUUID().substring(0, 8)}`;
      const idempotencyKey = `idemp_${intentId}`;
      const receipt = `rec_${randomUUID().substring(0, 8)}`;
      
      console.log(`[Run ${i}] Calling Razorpay Test API to create live test order...`);
      const order = await RazorpayAdapter.createOrder(1500, 'INR', receipt);
      console.log(`[Run ${i}] Created real test-mode order: ${order.id} with receipt: ${receipt}`);

      console.log(`[Run ${i}] Simulating mid-flight transport timeout -> DB state=EXECUTION_UNKNOWN (order_id=NULL)...`);
      db.prepare(`
        INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input, received_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(intentId, `req_${i}`, 'merchant_1', 'MacBook test buy', new Date().toISOString());

      db.prepare(`
        INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, external_receipt, razorpay_order_id, action_type, state, decision, policy_version, parameters_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(actionId, intentId, 'merchant_1', idempotencyKey, receipt, null, 'CREATE_ORDER', 'EXECUTION_UNKNOWN', 'APPROVE', 'v1', JSON.stringify({ product_id: 'prod_macbook' }));

      console.log(`[Run ${i}] Calling resolveUnknownExecution() to test receipt fallback query...`);
      let result: any = null;
      for (let attempt = 1; attempt <= 10; attempt++) {
        await db.prepare(`UPDATE actions SET state = 'EXECUTION_UNKNOWN' WHERE action_id = ?`).run(actionId);
        result = await resolveUnknownExecution(intentId);
        if (result.status === 'VERIFIED_SUCCESS') {
          break;
        }
        await new Promise(r => setTimeout(r, 1000));
      }

      const actionRow = await db.prepare('SELECT state, razorpay_order_id FROM actions WHERE action_id = ?').get(actionId) as any;
      if (actionRow.state === 'VERIFIED_SUCCESS' && actionRow.razorpay_order_id === order.id) {
        console.log(`[Run ${i}] PASS: Recovered Order ID ${actionRow.razorpay_order_id} -> Final State: ${actionRow.state}`);
        passCount++;
      } else {
        console.error(`[Run ${i}] FAIL: Mismatch state=${actionRow.state}, expected order=${order.id}, got=${actionRow.razorpay_order_id}`);
      }
    } catch (err: any) {
      console.error(`[Run ${i}] FAIL: Error during live recovery:`, err.message || err);
    }
  }

  console.log("\n==================================================");
  console.log(`SUMMARY: ${passCount}/${totalRuns} Real Razorpay Recovery Tests Passed`);
  console.log("==================================================");
  
  if (passCount === totalRuns) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run5xRecovery().catch(err => {
  console.error("Fatal 5x recovery error:", err);
  process.exit(1);
});
