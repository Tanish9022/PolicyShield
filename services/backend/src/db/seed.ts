import { storePolicies } from '../policy-graph/graph';
import { PolicyGraph } from '@policyshield/shared';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import { getDb, closeDb } from './client';

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

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

export async function seed(shouldCloseDb: boolean = false) {
  await storePolicies(graph);
  console.log('Seeded policies for merchant_1');

  const db = getDb();
  await db.prepare(`INSERT INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_macbook', 'merchant_1', 'MacBook Pro M3', 150000, 'INR') ON CONFLICT (product_id) DO NOTHING`).run();
  await db.prepare(`INSERT INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_dell', 'merchant_1', 'Dell XPS 15', 69999, 'INR') ON CONFLICT (product_id) DO NOTHING`).run();
  await db.prepare(`INSERT INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_asus', 'merchant_1', 'Asus ZenBook', 68500, 'INR') ON CONFLICT (product_id) DO NOTHING`).run();
  await db.prepare(`INSERT INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_airpods', 'merchant_1', 'AirPods Pro', 24900, 'INR') ON CONFLICT (product_id) DO NOTHING`).run();
  await db.prepare(`INSERT INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_macbook', 'merchant_1', 10) ON CONFLICT (product_id) DO NOTHING`).run();
  await db.prepare(`INSERT INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_dell', 'merchant_1', 2) ON CONFLICT (product_id) DO NOTHING`).run();
  await db.prepare(`INSERT INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_asus', 'merchant_1', 7) ON CONFLICT (product_id) DO NOTHING`).run();
  await db.prepare(`INSERT INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_airpods', 'merchant_1', 50) ON CONFLICT (product_id) DO NOTHING`).run();
  console.log('Seeded Context DB (Products & Inventory)');
  
  if (shouldCloseDb) {
    closeDb();
  }
}

if (require.main === module) {
  seed(true).catch(err => {
    console.error(err);
    process.exit(1);
  });
}
