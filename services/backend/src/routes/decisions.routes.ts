import { Router } from 'express';
import { getDb } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';

const router = Router();

router.use(requireAuth);
router.use(rateLimit);

router.get('/', (req, res) => {
  const db = getDb();
  try {
    const actions = db.prepare(`
      SELECT 
        a.action_id, a.state, a.decision, a.action_type, a.created_at, a.updated_at, a.intent_id,
        i.buyer_input, i.merchant_id
      FROM actions a
      JOIN intents i ON a.intent_id = i.intent_id
      WHERE i.merchant_id = ?
      ORDER BY a.created_at DESC
      LIMIT 100
    `).all(req.auth!.merchantId);
    res.json(actions);
  } catch (err: any) {
    res.status(500).json({ error: err.message, request_id: req.headers['x-request-id'] });
  }
});

router.get('/:id', (req, res) => {
  const db = getDb();
  try {
    const action = db.prepare(`
      SELECT 
        a.*, 
        i.buyer_input, i.request_id, i.customer_id
      FROM actions a
      JOIN intents i ON a.intent_id = i.intent_id
      WHERE a.action_id = ? AND i.merchant_id = ?
    `).get(req.params.id, req.auth!.merchantId);

    if (!action) {
      return res.status(404).json({ error: 'Action not found or unauthorized', request_id: req.headers['x-request-id'] });
    }

    const auditEvents = db.prepare(`
      SELECT * FROM audit_events 
      WHERE action_id = ? OR intent_id = ?
      ORDER BY timestamp ASC
    `).all(req.params.id, (action as any).intent_id);

    res.json({ action, audit_events: auditEvents });
  } catch (err: any) {
    res.status(500).json({ error: err.message, request_id: req.headers['x-request-id'] });
  }
});

export default router;
