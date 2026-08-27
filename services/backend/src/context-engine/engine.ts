import { IntentRequest, CommerceContext } from '@policyshield/shared';
import { CUSTOMERS, PROMOTIONS, SHIPPING } from './data';
import { getDb } from '../db/client';

export async function getCommerceContext(intent: IntentRequest): Promise<CommerceContext> {
  const customer = CUSTOMERS.find(c => c.customer_id === intent.customer_id) || null;
  const db = getDb();
  
  const products = db.prepare(`SELECT * FROM products WHERE merchant_id = ?`).all(intent.merchant_id);
  const dbInventory = db.prepare(`SELECT * FROM inventory WHERE merchant_id = ?`).all(intent.merchant_id) as any[];
  
  // Transform db inventory and prices to map
  const inventory: Record<string, number> = {};
  for (const item of dbInventory) {
    inventory[item.product_id] = item.stock_level;
  }
  
  const prices: Record<string, number> = {};
  for (const p of products as any[]) {
    prices[p.product_id] = p.price;
  }
  
  return {
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
