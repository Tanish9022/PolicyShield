import { Router } from 'express';
import { getDb } from '../db/client';

const router = Router();

router.get('/', (req, res) => {
  const db = getDb();
  try {
    const events = db.prepare(`
      SELECT * FROM audit_events 
      ORDER BY timestamp DESC
      LIMIT 200
    `).all();
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
