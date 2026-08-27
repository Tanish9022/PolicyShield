import { Router } from 'express';
import { getDb } from '../db/client';

const router = Router();

router.post('/inventory', (req, res) => {
  const { productId = 'lptp_pro', stockLevel = 0 } = req.body;
  const db = getDb();
  try {
    db.prepare('UPDATE inventory SET stock_level = ? WHERE product_id = ?').run(stockLevel, productId);
    res.json({ status: 'CHAOS_INJECTED', message: `Inventory for ${productId} set to ${stockLevel}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/price', (req, res) => {
  const { productId = 'lptp_pro', price = 90000 } = req.body;
  const db = getDb();
  try {
    db.prepare('UPDATE products SET price = ? WHERE product_id = ?').run(price, productId);
    res.json({ status: 'CHAOS_INJECTED', message: `Price for ${productId} set to ${price}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/reset', (req, res) => {
  const db = getDb();
  try {
    // Reset to defaults
    db.prepare("UPDATE inventory SET stock_level = 10 WHERE product_id = 'lptp_pro'").run();
    db.prepare("UPDATE products SET price = 69999 WHERE product_id = 'lptp_pro'").run();
    res.json({ status: 'RESET', message: 'Demo state reset to normal.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
