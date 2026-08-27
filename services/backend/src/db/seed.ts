import { storePolicies } from '../policy-graph/graph';
import { PolicyGraph } from '@policyshield/shared';
import { v4 as uuidv4 } from 'uuid';

const graph: PolicyGraph = {
  merchant_id: 'merchant_1',
  version: uuidv4() as any,
  source_text: 'Maximum discount allowed is 15%. Orders above 50000 require approval.',
  compiled_at: new Date().toISOString(),
  rules: [
    {
      policy_id: uuidv4(),
      rule_type: 'MAX_DISCOUNT',
      description: 'Maximum discount allowed is 15%',
      conditions: [],
      parameters: { max_discount_percent: 15 },
      priority: 1
    },
    {
      policy_id: uuidv4(),
      rule_type: 'APPROVAL_THRESHOLD',
      description: 'Orders above 50000 require approval.',
      conditions: [],
      parameters: { threshold_amount: 50000 },
      priority: 1
    }
  ]
};

storePolicies(graph);
console.log('Seeded policies for merchant_1');

import { getDb } from './client';

const db = getDb();
db.prepare(`INSERT OR REPLACE INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_macbook', 'merchant_1', 'MacBook Pro M3', 150000, 'INR')`).run();
db.prepare(`INSERT OR REPLACE INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_macbook', 'merchant_1', 10)`).run();
console.log('Seeded Context DB (Products & Inventory)');

