import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getDb } from '../db/client';
import { getAgentEvents } from '../agent/events';

const router = Router();

// Apply auth (no rate limit on SSE — it's a streaming connection)
router.use(requireAuth);

/**
 * GET /api/v1/runs/:runId/stream
 *
 * Server-Sent Events stream for a single agent run.
 * The client opens this once. Events are pushed as they arrive.
 * Closes automatically when the run reaches a terminal state.
 *
 * SSE format:
 *   data: {"type":"event","payload":{...}}\n\n
 *   data: {"type":"state","payload":{...}}\n\n   (on each state change)
 *   data: {"type":"done","payload":{"state":"COMPLETED"}}\n\n
 */
router.get('/:runId/stream', async (req, res, next) => {
  try {
    const db = getDb();
    const runId = req.params.runId;

    let run = await db.prepare('SELECT * FROM agent_runs WHERE agent_run_id = ?').get(runId) as any;
    
    // Race condition mitigation: The background worker might still be inserting the run. Wait up to 3 seconds.
    if (!run) {
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 200));
        run = await db.prepare('SELECT * FROM agent_runs WHERE agent_run_id = ?').get(runId) as any;
        if (run) break;
      }
    }

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    if (run.merchant_id !== req.auth!.merchantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // ── SSE setup ────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
    res.flushHeaders();

    const TERMINAL_STATES = new Set(['READY_FOR_CHECKOUT', 'COMPLETED', 'FAILED', 'BLOCKED', 'ESCALATED']);

    let lastSeq = 0;
    let lastState = '';

    const send = (type: string, payload: any) => {
      try {
        res.write(`data: ${JSON.stringify({ type, payload })}\n\n`);
      } catch {
        // client disconnected — interval will be cleared
      }
    };

    // ── Flush initial state + any existing events ─────────────────
    const existingEvents = await getAgentEvents(runId, 0);
    if (existingEvents.length > 0) {
      for (const e of existingEvents as any[]) {
        send('event', {
          sequence: e.sequence,
          event: e.event_type,
          payload: (() => { try { return JSON.parse(e.payload_json); } catch { return {}; } })(),
          timestamp: e.timestamp,
        });
        lastSeq = e.sequence;
      }
    }

    // Flush current run state
    const initialRun = await db.prepare('SELECT * FROM agent_runs WHERE agent_run_id = ?').get(runId) as any;
    if (initialRun) {
      send('state', buildStatePayload(db, initialRun));
      lastState = initialRun.state;

      if (TERMINAL_STATES.has(initialRun.state)) {
        send('done', { state: initialRun.state, intent_id: initialRun.intent_id, run_id: initialRun.agent_run_id });
        res.end();
        return;
      }
    }

    // ── Poll loop — push deltas only ──────────────────────────────
    const interval = setInterval(async () => {
      try {
        // New events
        const newEvts = await getAgentEvents(runId, lastSeq) as any[];
        for (const e of newEvts) {
          send('event', {
            sequence: e.sequence,
            event: e.event_type,
            payload: (() => { try { return JSON.parse(e.payload_json); } catch { return {}; } })(),
            timestamp: e.timestamp,
          });
          lastSeq = e.sequence;
        }

        // State change
        const currentRun = await db.prepare('SELECT * FROM agent_runs WHERE agent_run_id = ?').get(runId) as any;
        if (!currentRun) {
          clearInterval(interval);
          res.end();
          return;
        }

        if (currentRun.state !== lastState) {
          lastState = currentRun.state;
          send('state', await buildStatePayload(db, currentRun));

          if (TERMINAL_STATES.has(currentRun.state)) {
            send('done', { state: currentRun.state, intent_id: currentRun.intent_id, run_id: currentRun.agent_run_id });
            clearInterval(interval);
            res.end();
          }
        }
      } catch {
        clearInterval(interval);
      }
    }, 300); // 300ms — fast enough to feel live, not abusive

    // ── Cleanup on client disconnect ──────────────────────────────
    req.on('close', () => {
      clearInterval(interval);
    });

  } catch (err) {
    next(err);
  }
});

async function buildStatePayload(db: any, run: any) {
  const lastEvent = await db.prepare('SELECT COALESCE(MAX(sequence), 0) as maxSeq FROM agent_events WHERE run_id = ?').get(run.agent_run_id) as any;

  let candidates: any[] = [];
  if (run.selected_product_id) {
    const p = await db.prepare('SELECT product_id, name, price as base_price, currency FROM products WHERE product_id = ?').get(run.selected_product_id) as any;
    if (p) candidates.push(p);
  }

  let action: any = null;
  let proposal: any = null;
  if (run.selected_action_id) {
    action = await db.prepare('SELECT action_id, intent_id, state, decision, razorpay_order_id, parameters_json, reason_codes_json FROM actions WHERE action_id = ?').get(run.selected_action_id) as any;
    if (action) {
      try { proposal = JSON.parse(action.parameters_json); } catch {}
    }
  }

  let buyer_memory: any = null;
  const intentRow = await db.prepare('SELECT customer_id FROM intents WHERE intent_id = ?').get(run.intent_id) as any;
  if (intentRow?.customer_id) {
    const memRow = await db.prepare('SELECT * FROM buyer_memory WHERE customer_id = ?').get(intentRow.customer_id) as any;
    if (memRow) {
      try { buyer_memory = { ...memRow, preferences: JSON.parse(memRow.preferences_json) }; } catch {}
    }
  }

  return {
    run_id: run.agent_run_id,
    intent_id: run.intent_id,
    state: run.state,
    current_step: run.current_step,
    adaptation_count: run.adaptation_count || 0,
    policy_version: run.policy_version,
    last_event_sequence: lastEvent?.maxSeq || 0,
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
  };
}

export default router;
