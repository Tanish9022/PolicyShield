import { IntentRequest, CommerceContext } from '@policyshield/shared';
import { CUSTOMERS, PROMOTIONS, SHIPPING } from './data';
import { getDb } from '../db/client';

export async function getCommerceContext(intent: IntentRequest): Promise<CommerceContext> {
  const customer = CUSTOMERS.find(c => c.customer_id === intent.customer_id) || null;
  const db = getDb();
  
  const products = await db.prepare(`SELECT * FROM products WHERE merchant_id = ?`).all(intent.merchant_id);
  const dbInventory = await db.prepare(`SELECT * FROM inventory WHERE merchant_id = ?`).all(intent.merchant_id) as any[];
  
  // Transform db inventory and prices to map
  const inventory: Record<string, number> = {};
  for (const item of dbInventory) {
    inventory[item.product_id] = item.stock_level;
  }
  
  const prices: Record<string, number> = {};
  for (const p of products as any[]) {
    prices[p.product_id] = p.price;
  }
  let buyer_memory: any = undefined;
  try {
    const memoryRow = intent.customer_id ? await db.prepare(`SELECT * FROM buyer_memory WHERE customer_id = ? AND merchant_id = ?`).get(intent.customer_id, intent.merchant_id) as any : null;
    if (memoryRow) {
      buyer_memory = {
        customer_id: memoryRow.customer_id,
        preferences: JSON.parse(memoryRow.preferences_json),
        negotiation_history: JSON.parse(memoryRow.negotiation_history_json),
        last_updated: memoryRow.last_updated,
        memory_version: memoryRow.memory_version
      };
    }
  } catch (e) {
    console.error('Memory Load Failure:', e);
    // memory_failure is an observable event but agent continues safely
    db.prepare(`INSERT INTO audit_events (event_id, event_type, intent_id, action_id, timestamp, metadata_json) VALUES (?, 'MEMORY_LOAD_FAILURE', ?, '', datetime('now'), '{}')`).run(require('uuid').v4(), intent.intent_id);
  }

  return {
    buyer_memory,
    products: products as any,
    inventory,
    prices,
    customer,
    promotions: PROMOTIONS,
    shipping: SHIPPING,
    fetched_at: new Date().toISOString(),
    context_version: 'v1'
  };
}
