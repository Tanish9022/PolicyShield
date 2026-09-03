process.env.NODE_ENV = 'test';
process.env.USE_SQLITE = 'true';
process.env.STUB_AI = 'true';
process.env.DB_PATH = ':memory:';

import { getDb } from '../db/client';
import { seed } from '../db/seed';
import { processIntent } from '../gateway/orchestrator';

async function main() {
  await seed(false);
  const db = getDb();
  await db.prepare('UPDATE products SET price = 1000 WHERE product_id = ?').run('prod_macbook');

  const scenarios = [
    { name: '1. Standard Compliant Purchase', input: 'I want to buy the MacBook Pro at full price' },
    { name: '2. Aggressive Discount Request (50%) -> Policy Gate Interception & Adaptation', input: 'Give me a 50% discount on MacBook Pro' },
    { name: '3. High-Value Escalation (₹60,000 > ₹50,000 threshold) -> Human Handoff', input: 'I want to buy a laptop worth 60000' }
  ];

  for (const s of scenarios) {
    const res = await processIntent({
      request_id: 'req_' + Math.random().toString(36).substring(7),
      intent_id: 'int_' + Math.random().toString(36).substring(7),
      merchant_id: 'merchant_1',
      buyer_input: s.input,
      received_at: new Date().toISOString()
    });
    console.log(`\n======================================================`);
    console.log(`SCENARIO: ${s.name}`);
    console.log(`Buyer Input: "${s.input}"`);
    console.log(`Gate Decision: ${res.gate_decision}`);
    console.log(`Action ID: ${res.action?.action_id}`);
    console.log(`Action State: ${res.action?.state}`);
    console.log(`Reason Codes: ${res.action?.reason_codes_json}`);
    console.log(`Evidence:`);
    console.log(JSON.stringify(JSON.parse(res.action?.evidence_json || '{}'), null, 2));
  }
}

main().catch(console.error);
