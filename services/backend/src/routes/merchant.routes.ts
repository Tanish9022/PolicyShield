import { Router } from 'express';
import { PRODUCTS, INVENTORY, PROMOTIONS, SHIPPING, CUSTOMERS } from '../context-engine/data';

import { getDb } from '../db/client';

const router = Router();

router.get('/products', (_req, res) => res.json(PRODUCTS));

router.get('/inventory', async (req, res) => {
  try {
    const db = getDb();
    // Fetch products and their stock levels for merchant_1
    const inventoryItems = await db.prepare(`
      SELECT p.product_id, p.name, p.price, p.currency, i.stock_level
      FROM products p
      LEFT JOIN inventory i ON p.product_id = i.product_id
      WHERE p.merchant_id = 'merchant_1'
    `).all();
    res.json(inventoryItems);
  } catch (error) {
    console.error('Failed to fetch inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

router.post('/inventory', async (req, res) => {
  try {
    const { product_id, name, price, stock_level } = req.body;
    if (!product_id || !name || price === undefined || stock_level === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getDb();
    // Assuming merchant_1 for demo
    await db.prepare(`INSERT INTO products (product_id, merchant_id, name, price, currency) VALUES (?, 'merchant_1', ?, ?, 'INR') ON CONFLICT (product_id) DO UPDATE SET name=excluded.name, price=excluded.price`).run(product_id, name, price);
    await db.prepare(`INSERT INTO inventory (product_id, merchant_id, stock_level) VALUES (?, 'merchant_1', ?) ON CONFLICT (product_id) DO UPDATE SET stock_level=excluded.stock_level`).run(product_id, stock_level);
    
    res.json({ success: true, product_id });
  } catch (error) {
    console.error('Failed to save inventory:', error);
    res.status(500).json({ error: 'Failed to save inventory' });
  }
});

router.get('/promotions', (_req, res) => res.json(PROMOTIONS));
router.get('/shipping', (_req, res) => res.json(SHIPPING));
router.get('/customers', (_req, res) => res.json(CUSTOMERS));

export default router;
