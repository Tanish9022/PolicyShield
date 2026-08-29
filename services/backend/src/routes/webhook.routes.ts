import { Router } from 'express';
import { RazorpayAdapter } from '../execution/razorpay';
import { getDb } from '../db/client';

const router = Router();

// Endpoint for Razorpay Webhooks
// Note: body is preserved as a raw Buffer by express.raw() in index.ts for this route
router.post('/razorpay', (req, res) => {
  const signature = req.headers['x-razorpay-signature'] as string;
  const rawBody = req.body.toString('utf8');
  console.log("RAW BODY:", rawBody);
  console.log("SIGNATURE:", signature);
  console.log("SECRET:", process.env.RAZORPAY_WEBHOOK_SECRET);

  // 1. Verify Signature
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!RazorpayAdapter.verifySignature(rawBody, signature, secret)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const payload = JSON.parse(rawBody);
  const eventId = req.headers['x-razorpay-event-id'] as string || payload.entity?.id;
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

  // 3. Acknowledge the webhook synchronously
  res.status(200).json({ status: 'ok' });

  // 4. Async processing
  processWebhookEvent(eventId, payload).catch(err => {
    console.error(`Failed to process webhook ${eventId}:`, err);
  });
});

async function processWebhookEvent(eventId: string, payload: any) {
  const db = getDb();
  
  if (payload.event === 'order.paid') {
    const orderId = payload.payload.order.entity.id;
    
    // Find matching action
    const action = db.prepare('SELECT * FROM actions WHERE razorpay_order_id = ?').get(orderId) as any;
    
    if (action && action.state === 'EXECUTION_UNKNOWN') {
      // Recovery successful -> VERIFIED_SUCCESS
      db.prepare('UPDATE actions SET state = ?, updated_at = ? WHERE action_id = ?').run(
        'VERIFIED_SUCCESS', new Date().toISOString(), action.action_id
      );
      
      // Audit the recovery
      db.prepare(`
        INSERT INTO audit_events 
        (event_id, event_type, intent_id, action_id, result, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        require('uuid').v4(),
        'EXECUTION_RECOVERY',
        action.intent_id,
        action.action_id,
        'VERIFIED_SUCCESS',
        new Date().toISOString()
      );
    }
  }

  // Mark processed
  db.prepare('UPDATE webhook_events SET processed = 1 WHERE event_id = ?').run(eventId);
}

export default router;
