import dotenv from 'dotenv';
dotenv.config();

process.env.USE_SQLITE = 'true';
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';

import { getDb } from '../db/client';
import { seed } from '../db/seed';
import { processIntent, checkoutAction } from '../gateway/orchestrator';
import { executeAction } from '../execution/executor';
import { IntentRequest } from '@policyshield/shared';
import { v4 as uuidv4 } from 'uuid';
import { storePolicies } from '../policy-graph/graph';

async function runLiveSmokeTest() {
  const hasLiveGemini = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  const hasLiveRazorpay = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_KEY_ID.trim() !== '' && process.env.RAZORPAY_KEY_SECRET.trim() !== '');

  console.log("=== STARTING SMOKE TEST ===");
  console.log(`- Gemini Mode:   ${hasLiveGemini ? 'LIVE (Real Gemini API)' : 'STUB (Simulated AI Reasoning)'}`);
  console.log(`- Razorpay Mode: ${hasLiveRazorpay ? 'LIVE (Real Razorpay Gateway)' : 'STUB (Simulated Payment Gateway)'}`);

  if (!hasLiveGemini) {
    console.warn("⚠️ GEMINI_API_KEY not configured in environment secrets — running in simulated AI mode.");
    process.env.STUB_AI = 'true';
  } else {
    delete process.env.STUB_AI;
  }

  if (!hasLiveRazorpay) {
    console.warn("⚠️ RAZORPAY_KEY_ID / SECRET not configured in environment secrets — running in simulated gateway mode.");
    process.env.STUB_RAZORPAY = 'true';
  } else {
    delete process.env.STUB_RAZORPAY;
  }

  await seed(false);
  const db = getDb();
  const merchantId = 'merchant_live_test';

  // Seed context
  await db.prepare(`INSERT INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_airpods_live', '${merchantId}', 'AirPods Pro 2nd Gen', 24900, 'INR') ON CONFLICT (product_id) DO UPDATE SET price = 24900, name = 'AirPods Pro 2nd Gen'`).run();
  await db.prepare(`INSERT INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_airpods_live', '${merchantId}', 10) ON CONFLICT (product_id) DO UPDATE SET stock_level = 10`).run(); 

  // Seed policies
  await storePolicies({
    merchant_id: merchantId,
    version: uuidv4() as any,
    source_text: 'Maximum discount allowed is 15%.',
    compiled_at: new Date().toISOString(),
    rules: [
      { policy_id: uuidv4() as any, rule_type: 'MAX_DISCOUNT' as any, description: 'Maximum discount is 15%', conditions: [], parameters: { max_discount_percent: 15 }, priority: 1 },
    ]
  });

  const intent: IntentRequest = {
    request_id: uuidv4() as any,
    intent_id: uuidv4() as any,
    merchant_id: merchantId as any,
    buyer_input: 'I want to buy the AirPods Pro 2nd Gen for full price.',
    received_at: new Date().toISOString()
  };

  try {
    console.log("1. AI Buyer Processing Intent...");
    const result = await processIntent(intent);
    console.log(`-> Gate Decision: ${result.gate_decision}`);
    console.log(result);
    
    if (result.gate_decision !== 'APPROVE') {
      throw new Error("AI did not generate an approved proposal.");
    }
    
    console.log(`-> Action Created: ${result.action.action_id} (State: ${result.action.state})`);
    
    console.log("2. Checking out (JIT Re-validation) & Executing Live Razorpay Transaction...");
    const finalAction = await checkoutAction(intent.intent_id);
    console.log(`-> Execution State: ${finalAction.state}`);
    
    if (finalAction.state === 'VERIFIED_SUCCESS') {
      console.log(`-> Razorpay Order ID: ${finalAction.razorpay_order_id}`);
      
      console.log("4. Verifying execution...");
      // In a full verification loop, a webhook would trigger it. Here we trust the synchronous execResult for the smoke test.
      // We will check the audit events in DB.
      const audit = await db.prepare(`SELECT * FROM audit_events WHERE action_id = ? AND event_type = 'ACTION_VERIFIED_SUCCESS'`).get(finalAction.action_id);
      
      console.log(`-> Audit Event Found: ${audit ? 'YES' : 'NO'}`);
      
    } else {
      throw new Error(`Execution failed: ${finalAction.state}`);
    }

    console.log("=== LIVE SMOKE TEST PASSED ===");
    process.exit(0);

  } catch (err) {
    console.error("=== LIVE SMOKE TEST FAILED ===");
    console.error(err);
    process.exit(1);
  }
}

runLiveSmokeTest();
