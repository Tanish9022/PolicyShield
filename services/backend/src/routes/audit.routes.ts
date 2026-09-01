import { Router } from 'express';
import { getDb } from '../db/client';

const router = Router();

router.get('/', async (req, res) => {
  const db = getDb();
  try {
    const events = await db.prepare(`
      SELECT 
        a.action_id as event_id,
        a.action_type as event_type,
        a.intent_id,
        a.action_id,
        a.decision,
        a.state as result,
        a.created_at as timestamp,
        a.razorpay_order_id,
        a.parameters_json,
        a.reason_codes_json,
        a.evidence_json,
        i.buyer_input
      FROM actions a
      LEFT JOIN intents i ON a.intent_id = i.intent_id
      ORDER BY a.created_at DESC
      LIMIT 200
    `).all();
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
