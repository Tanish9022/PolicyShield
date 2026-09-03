import { Router } from 'express';
import { getDb } from '../db/client';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';

const router = Router();

router.use(requireAuth);
router.use(rateLimit);

router.get('/', async (req, res) => {
  const db = getDb();
  try {
    const actions = await db.prepare(`
      SELECT 
        a.action_id, a.state, a.decision, a.action_type, a.created_at, a.updated_at, a.intent_id, a.razorpay_order_id,
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

router.get('/:id', async (req, res) => {
  const db = getDb();
  try {
    const action = await db.prepare(`
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

    const auditEvents = await db.prepare(`
      SELECT * FROM audit_events 
      WHERE action_id = ? OR intent_id = ?
      ORDER BY timestamp ASC
    `).all(req.params.id, (action as any).intent_id);

    res.json({ action, audit_events: auditEvents });
  } catch (err: any) {
    res.status(500).json({ error: err.message, request_id: req.headers['x-request-id'] });
  }
});

router.post('/:id/resolve', async (req, res) => {
  const db = getDb();
  try {
    const { decision } = req.body;
    if (decision !== 'APPROVE' && decision !== 'BLOCK') {
      return res.status(400).json({ error: 'Invalid decision', request_id: req.headers['x-request-id'] });
    }

    const state = decision === 'APPROVE' ? 'READY_FOR_CHECKOUT' : 'REJECTED';

    const result = await db.prepare(`
      UPDATE actions 
      SET decision = ?, state = ?, updated_at = CURRENT_TIMESTAMP
      WHERE action_id = ? AND EXISTS (
        SELECT 1 FROM intents i WHERE i.intent_id = actions.intent_id AND i.merchant_id = ?
      )
    `).run(decision, state, req.params.id, req.auth!.merchantId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Action not found or unauthorized', request_id: req.headers['x-request-id'] });
    }

    // Add audit event for the manual override
    const action = await db.prepare('SELECT intent_id FROM actions WHERE action_id = ?').get(req.params.id) as any;
    if (action) {
      await db.prepare(`
        INSERT INTO audit_events 
        (event_id, event_type, intent_id, action_id, decision, timestamp)
        VALUES (?, 'MANUAL_OVERRIDE', ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(require('uuid').v4(), action.intent_id, req.params.id, decision);
    }

    let finalState = state;
    let razorpayOrderId = null;

    // When approved by human, immediately execute checkout to generate live Razorpay order
    if (decision === 'APPROVE' && action?.intent_id) {
      try {
        const { checkoutAction } = await import('../gateway/orchestrator');
        const executionResult = await checkoutAction(action.intent_id);
        finalState = executionResult.state || 'VERIFIED_SUCCESS';
        razorpayOrderId = executionResult.razorpay_order_id || null;
      } catch (checkoutErr: any) {
        // Even if immediate checkout fails, state is already READY_FOR_CHECKOUT
        console.warn(`[RESOLVE_CHECKOUT_DEFERRED] intent_id=${action.intent_id} error=${checkoutErr.message}`);
      }
    }

    res.json({ 
      success: true, 
      decision, 
      state: finalState,
      razorpay_order_id: razorpayOrderId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, request_id: req.headers['x-request-id'] });
  }
});

export default router;
