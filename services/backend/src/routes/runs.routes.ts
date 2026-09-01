import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { getDb } from '../db/client';
import { getAgentEvents } from '../agent/events';

const router = Router();

// Apply auth and rate limiting
router.use(requireAuth);
router.use(rateLimit);

// GET /api/v1/runs/:runId
// Cheap snapshot — reads only from agent_runs + actions, no context re-fetch
router.get('/:runId', async (req, res, next) => {
  try {
    const db = getDb();
    const runId = req.params.runId;

    const run = await db.prepare('SELECT * FROM agent_runs WHERE agent_run_id = ?').get(runId) as any;
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    // Merchant access guard
    if (run.merchant_id !== req.auth!.merchantId) {
      return res.status(403).json({ error: 'Forbidden cross-merchant access' });
    }

    const lastEvent = db.prepare('SELECT COALESCE(MAX(sequence), 0) as maxSeq FROM agent_events WHERE run_id = ?').get(runId) as any;

    let candidates: any[] = [];
    if (run.selected_product_id) {
      const product = await db.prepare('SELECT product_id, name, price as base_price, currency FROM products WHERE product_id = ?').get(run.selected_product_id) as any;
      if (product) candidates.push(product);
    }

    let action: any = null;
    let proposal: any = null;
    if (run.selected_action_id) {
      action = await db.prepare('SELECT action_id, intent_id, state, decision, razorpay_order_id, parameters_json, reason_codes_json FROM actions WHERE action_id = ?').get(run.selected_action_id) as any;
      if (action) {
        try { proposal = JSON.parse(action.parameters_json); } catch {}
      }
    }

    // Also fetch buyer memory from the intent's customer
    let buyer_memory: any = null;
    const intentRow = await db.prepare('SELECT customer_id FROM intents WHERE intent_id = ?').get(run.intent_id) as any;
    if (intentRow?.customer_id) {
      const memRow = await db.prepare('SELECT * FROM buyer_memory WHERE customer_id = ?').get(intentRow.customer_id) as any;
      if (memRow) {
        try { buyer_memory = { ...memRow, preferences: JSON.parse(memRow.preferences_json) }; } catch {}
      }
    }

    res.json({
      run_id: run.agent_run_id,
      intent_id: run.intent_id,          // <-- needed for checkout call
      version: 1,
      state: run.state,
      current_step: run.current_step,
      last_event_sequence: lastEvent.maxSeq,
      adaptation_count: run.adaptation_count || 0,
      policy_version: run.policy_version,
      candidates,
      proposal,
      buyer_memory,
      action: action ? {
        action_id: action.action_id,
        intent_id: action.intent_id,
        state: action.state,
        decision: action.decision,
        razorpay_order_id: action.razorpay_order_id,
        reason_codes: (() => { try { return JSON.parse(action.reason_codes_json); } catch { return []; } })()
      } : null,
    });

  } catch (err) {
    next(err);
  }
});

// GET /api/v1/runs/:runId/events?after=N
// Append-only event log — safe to poll aggressively
router.get('/:runId/events', async (req, res, next) => {
  try {
    const db = getDb();
    const runId = req.params.runId;
    const after = parseInt(req.query.after as string) || 0;

    const run = await db.prepare('SELECT merchant_id FROM agent_runs WHERE agent_run_id = ?').get(runId) as any;
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (run.merchant_id !== req.auth!.merchantId) {
      return res.status(403).json({ error: 'Forbidden cross-merchant access' });
    }

    const events = await getAgentEvents(runId, after);

    const mapped = events.map((e: any) => ({
      run_id: e.run_id,
      sequence: e.sequence,
      event: e.event_type,
      payload: (() => { try { return JSON.parse(e.payload_json); } catch { return {}; } })(),
      timestamp: e.timestamp
    }));

    res.json(mapped);
  } catch (err) {
    next(err);
  }
});

export default router;
