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
      policy_id: 'pol_1' as any,
      rule_type: 'MAX_DISCOUNT' as any,
      description: 'Maximum discount allowed is 15%',
      conditions: [],
      parameters: { max_discount_percent: 15 },
      priority: 1
    },
    {
      policy_id: 'pol_2' as any,
      rule_type: 'APPROVAL_THRESHOLD' as any,
      description: 'Orders above 50000 require approval.',
      conditions: [],
      parameters: { threshold_amount: 50000 },
      priority: 1
    },
    {
      policy_id: 'pol_3' as any,
      rule_type: 'INVENTORY_RESERVE' as any,
      description: 'Maintain a reserve of 2 items in inventory.',
      conditions: [],
      parameters: { reserve_count: 2 },
      priority: 1
    }
  ]
};

storePolicies(graph);
console.log('Seeded policies for merchant_1');

import { getDb } from './client';

const db = getDb();
db.prepare(`INSERT OR REPLACE INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_macbook', 'merchant_1', 'MacBook Pro M3', 150000, 'INR')`).run();
db.prepare(`INSERT OR REPLACE INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_dell', 'merchant_1', 'Dell XPS 15', 69999, 'INR')`).run();
db.prepare(`INSERT OR REPLACE INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_asus', 'merchant_1', 'Asus ZenBook', 68500, 'INR')`).run();
db.prepare(`INSERT OR REPLACE INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_airpods', 'merchant_1', 'AirPods Pro', 24900, 'INR')`).run();
db.prepare(`INSERT OR REPLACE INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_macbook', 'merchant_1', 10)`).run();
db.prepare(`INSERT OR REPLACE INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_dell', 'merchant_1', 2)`).run();
db.prepare(`INSERT OR REPLACE INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_asus', 'merchant_1', 7)`).run();
db.prepare(`INSERT OR REPLACE INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_airpods', 'merchant_1', 50)`).run();
console.log('Seeded Context DB (Products & Inventory)');

