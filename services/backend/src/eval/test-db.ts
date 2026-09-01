import { getDb, closeDb } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import { storePolicies } from '../policy-graph/graph';
import { PolicyGraph } from '@policyshield/shared';
import fs from 'fs';
import path from 'path';


let testDbPath: string | null = null;

export function setupTestDatabase(): any {
  process.env.RAZORPAY_WEBHOOK_SECRET = 'test-only-secret';
  testDbPath = `./tmp-test-${uuidv4()}.db`;
  process.env.DB_PATH = testDbPath;
  const db = getDb(); // Initializes schema
  return db;
}

export function teardownTestDatabase() {
  closeDb();
  if (testDbPath && fs.existsSync(testDbPath)) {
    try { fs.unlinkSync(testDbPath); fs.unlinkSync(testDbPath + '-wal'); fs.unlinkSync(testDbPath + '-shm'); } catch (e) {}
  }
}

export async function resetTestDatabase() {
  const db = getDb();
  // Delete in correct order to avoid foreign key constraints
  await db.prepare('DELETE FROM metric_events').run();
  await db.prepare('DELETE FROM traces').run();
  await db.prepare('DELETE FROM audit_events').run();
  await db.prepare('DELETE FROM webhook_events').run();
  await db.prepare('DELETE FROM agent_events').run();
  await db.prepare('DELETE FROM agent_runs').run();
  await db.prepare('DELETE FROM actions').run();
  await db.prepare('DELETE FROM intents').run();
  await db.prepare('DELETE FROM buyer_memory').run();
  await db.prepare('DELETE FROM inventory').run();
  await db.prepare('DELETE FROM products').run();
  await db.prepare('DELETE FROM policy_versions').run();
  
  await seedTestDatabase();
}

export async function seedTestDatabase() {
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

  const db = getDb();
  await db.prepare(`INSERT OR REPLACE INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_macbook', 'merchant_1', 'MacBook Pro M3', 150000, 'INR')`).run();
  await db.prepare(`INSERT OR REPLACE INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_dell', 'merchant_1', 'Dell XPS 15', 69999, 'INR')`).run();
  await db.prepare(`INSERT OR REPLACE INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_asus', 'merchant_1', 'Asus ZenBook', 68500, 'INR')`).run();
  await db.prepare(`INSERT OR REPLACE INTO products (product_id, merchant_id, name, price, currency) VALUES ('prod_airpods', 'merchant_1', 'AirPods Pro', 24900, 'INR')`).run();
  await db.prepare(`INSERT OR REPLACE INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_macbook', 'merchant_1', 10)`).run();
  await db.prepare(`INSERT OR REPLACE INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_dell', 'merchant_1', 2)`).run();
  await db.prepare(`INSERT OR REPLACE INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_asus', 'merchant_1', 7)`).run();
  await db.prepare(`INSERT OR REPLACE INTO inventory (product_id, merchant_id, stock_level) VALUES ('prod_airpods', 'merchant_1', 50)`).run();
}
