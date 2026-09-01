import { Router } from 'express';
import { RazorpayAdapter } from '../execution/razorpay';
import { getDb } from '../db/client';
import { appendAgentEvent } from '../agent/events';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// POST /api/webhooks/razorpay
// Note: body is preserved as a raw Buffer by express.raw() in index.ts for this route
router.post('/razorpay', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = req.body.toString('utf8');

  // 1. Verify Signature
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!RazorpayAdapter.verifySignature(rawBody, signature, secret)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const payload = JSON.parse(rawBody);
  const eventId = req.headers['x-razorpay-event-id'] as string || `${payload.event}_${Date.now()}`;
  const db = getDb();

  // 2. Deduplication check (Idempotency)
  try {
    db.prepare('INSERT INTO webhook_events (event_id, event_type, payload_json) VALUES (?, ?, ?)')
      .run(eventId, payload.event, rawBody);
  } catch (err: any) {
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(200).json({ status: 'ignored_duplicate' });
    }
    throw err;
  }

  // 3. Acknowledge synchronously — Razorpay expects 200 fast
  res.status(200).json({ status: 'ok' });

  // 4. Async processing — never block the ack
  processWebhookEvent(eventId, payload).catch(err => {
    console.error(`[Webhook] Failed to process ${eventId} (${payload.event}):`, err);
  });
});

async function processWebhookEvent(eventId: string, payload: any) {
  const db = getDb();
  const event: string = payload.event;

  console.log(`[Webhook] Processing event: ${event} (${eventId})`);

  // ─── payment.captured ────────────────────────────────────────────
  // Razorpay confirmed payment was captured. This is the primary proof of success.
  if (event === 'payment.captured') {
    const payment = payload.payload?.payment?.entity;
    if (!payment) return;

    const orderId = payment.order_id;

    // Find the action linked to this order
    const action = await db.prepare('SELECT * FROM actions WHERE razorpay_order_id = ?').get(orderId) as any;
    if (!action) {
      console.warn(`[Webhook] payment.captured: no action found for order ${orderId}`);
      return;
    }

    // Transition: EXECUTING / EXECUTION_UNKNOWN → VERIFIED_SUCCESS
    db.prepare(`UPDATE actions SET state = 'VERIFIED_SUCCESS', updated_at = ? WHERE action_id = ?`)
      .run(new Date().toISOString(), action.action_id);

    // Update agent_run state
    const agentRun = await db.prepare('SELECT agent_run_id FROM agent_runs WHERE intent_id = ?').get(action.intent_id) as any;
    if (agentRun) {
      db.prepare(`UPDATE agent_runs SET state = 'COMPLETED', current_step = 'VERIFIED', completed_at = ? WHERE agent_run_id = ?`)
        .run(new Date().toISOString(), agentRun.agent_run_id);
      appendAgentEvent(agentRun.agent_run_id, 'VERIFIED_SUCCESS', {
        source: 'webhook',
        event: 'payment.captured',
        payment_id: payment.id,
        order_id: orderId,
        amount: payment.amount,
        currency: payment.currency
      });
    }

    // Audit
    db.prepare(`INSERT INTO audit_events (event_id, event_type, intent_id, action_id, result, timestamp) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(uuidv4(), 'WEBHOOK_PAYMENT_CAPTURED', action.intent_id, action.action_id, 'VERIFIED_SUCCESS', new Date().toISOString());

    console.log(`[Webhook] payment.captured → action ${action.action_id} marked VERIFIED_SUCCESS`);
  }

  // ─── payment.failed ──────────────────────────────────────────────
  // Payment attempt failed. Mark the action and run as FAILED.
  else if (event === 'payment.failed') {
    const payment = payload.payload?.payment?.entity;
    if (!payment) return;

    const orderId = payment.order_id;
    const errorDesc = payment.error_description || 'Payment failed';

    const action = await db.prepare('SELECT * FROM actions WHERE razorpay_order_id = ?').get(orderId) as any;
    if (!action) {
      console.warn(`[Webhook] payment.failed: no action found for order ${orderId}`);
      return;
    }

    // Only update if not already terminal
    const skipStates = ['VERIFIED_SUCCESS'];
    if (!skipStates.includes(action.state)) {
      db.prepare(`UPDATE actions SET state = 'VERIFIED_FAILURE', reason_codes_json = ?, updated_at = ? WHERE action_id = ?`)
        .run(JSON.stringify(['PAYMENT_FAILED', errorDesc]), new Date().toISOString(), action.action_id);

      const agentRun = await db.prepare('SELECT agent_run_id FROM agent_runs WHERE intent_id = ?').get(action.intent_id) as any;
      if (agentRun) {
        db.prepare(`UPDATE agent_runs SET state = 'FAILED', current_step = 'PAYMENT_FAILED', completed_at = ? WHERE agent_run_id = ?`)
          .run(new Date().toISOString(), agentRun.agent_run_id);
        appendAgentEvent(agentRun.agent_run_id, 'PAYMENT_FAILED', {
          source: 'webhook',
          event: 'payment.failed',
          payment_id: payment.id,
          order_id: orderId,
          error: errorDesc,
          error_code: payment.error_code
        });
      }

      db.prepare(`INSERT INTO audit_events (event_id, event_type, intent_id, action_id, result, timestamp) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(uuidv4(), 'WEBHOOK_PAYMENT_FAILED', action.intent_id, action.action_id, 'VERIFIED_FAILURE', new Date().toISOString());
    }

    console.log(`[Webhook] payment.failed → action ${action.action_id} marked VERIFIED_FAILURE`);
  }

  // ─── order.paid ──────────────────────────────────────────────────
  // Composite event: order was paid in full (includes payment.captured).
  // Use this to recover EXECUTION_UNKNOWN states where we never saved the order_id.
  else if (event === 'order.paid') {
    const order = payload.payload?.order?.entity;
    const payment = payload.payload?.payment?.entity;
    if (!order) return;

    const orderId = order.id;
    const receipt = order.receipt;

    // Find by order_id OR receipt (for EXECUTION_UNKNOWN where order_id may not be persisted)
    const action = await db.prepare('SELECT * FROM actions WHERE razorpay_order_id = ? OR external_receipt = ?').get(orderId, receipt) as any;
    if (!action) {
      console.warn(`[Webhook] order.paid: no action found for order ${orderId} / receipt ${receipt}`);
      return;
    }

    // If was EXECUTION_UNKNOWN — this is the recovery event
    if (action.state === 'EXECUTION_UNKNOWN' || action.state === 'EXECUTING') {
      db.prepare(`UPDATE actions SET state = 'VERIFIED_SUCCESS', razorpay_order_id = ?, updated_at = ? WHERE action_id = ?`)
        .run(orderId, new Date().toISOString(), action.action_id);

      const agentRun = await db.prepare('SELECT agent_run_id FROM agent_runs WHERE intent_id = ?').get(action.intent_id) as any;
      if (agentRun) {
        db.prepare(`UPDATE agent_runs SET state = 'COMPLETED', current_step = 'VERIFIED', completed_at = ? WHERE agent_run_id = ?`)
          .run(new Date().toISOString(), agentRun.agent_run_id);
        appendAgentEvent(agentRun.agent_run_id, 'VERIFIED_SUCCESS', {
          source: 'webhook',
          event: 'order.paid',
          order_id: orderId,
          payment_id: payment?.id,
          recovery: action.state === 'EXECUTION_UNKNOWN'
        });
      }

      db.prepare(`INSERT INTO audit_events (event_id, event_type, intent_id, action_id, result, timestamp) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(uuidv4(), 'WEBHOOK_ORDER_PAID', action.intent_id, action.action_id, 'VERIFIED_SUCCESS', new Date().toISOString());

      console.log(`[Webhook] order.paid → action ${action.action_id} recovered to VERIFIED_SUCCESS`);
    }
  }

  // Mark webhook as processed
  await db.prepare('UPDATE webhook_events SET processed = 1 WHERE event_id = ?').run(eventId);
}

export default router;
