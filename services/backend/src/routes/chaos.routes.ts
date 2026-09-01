import { Router } from 'express';
import { getDb } from '../db/client';

const router = Router();

router.post('/inventory', async (req, res) => {
  const { productId = 'lptp_pro', stockLevel = 0 } = req.body;
  const db = getDb();
  try {
    await db.prepare('UPDATE inventory SET stock_level = ? WHERE product_id = ?').run(stockLevel, productId);
    res.json({ status: 'CHAOS_INJECTED', message: `Inventory for ${productId} set to ${stockLevel}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/price', async (req, res) => {
  const { productId = 'lptp_pro', price = 90000 } = req.body;
  const db = getDb();
  try {
    await db.prepare('UPDATE products SET price = ? WHERE product_id = ?').run(price, productId);
    res.json({ status: 'CHAOS_INJECTED', message: `Price for ${productId} set to ${price}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset', async (req, res) => {
  const db = getDb();
  try {
    // Reset to defaults
    await db.prepare("UPDATE inventory SET stock_level = 10 WHERE product_id = 'lptp_pro'").run();
    await db.prepare("UPDATE products SET price = 69999 WHERE product_id = 'lptp_pro'").run();
    res.json({ status: 'RESET', message: 'Demo state reset to normal.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/timeout', async (req, res) => {
  const { enabled = true } = req.body;
  process.env.SIMULATE_TIMEOUT = enabled ? 'true' : 'false';
  res.json({ status: 'CHAOS_INJECTED', message: `SIMULATE_TIMEOUT set to ${process.env.SIMULATE_TIMEOUT}` });
});

export default router;
