import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import webhookRoutes from '../routes/webhook.routes';
import crypto from 'crypto';
import { getDb } from '../db/client';

const app = express();
app.use(express.raw({ type: 'application/json' }));
app.use('/api/webhooks', webhookRoutes);

describe('Webhook Tests', () => {
  it('Webhook test 1: Valid signature is accepted and deduplicated', async () => {
    const rawBody = JSON.stringify({
      event: 'order.paid',
      entity: { id: 'evt_valid' },
      payload: { order: { entity: { id: 'order_123' } } }
    });
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    expect(secret).toBe('test-only-secret'); // Ensuring test config is loaded
    
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    const res1 = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'evt_valid')
      .set('Content-Type', 'application/json')
      .send(rawBody);
      
    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe('ok');

    // Duplicate test (Idempotency)
    const res2 = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'evt_valid')
      .set('Content-Type', 'application/json')
      .send(rawBody);
      
    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('ignored_duplicate');
  });

  it('Webhook test 2: Invalid signature is rejected', async () => {
    const rawBody = JSON.stringify({ event: 'order.paid' });
    const signature = 'wrong-signature';
    
    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', signature)
      .set('Content-Type', 'application/json')
      .send(Buffer.from(rawBody));
      
    expect(res.status).toBe(400);
  });

  it('Webhook test 3: Missing secret fails closed', async () => {
    // Temporarily unset the secret
    const oldSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    delete process.env.RAZORPAY_WEBHOOK_SECRET;

    const rawBody = JSON.stringify({ event: 'order.paid' });
    
    const res = await request(app)
      .post('/api/webhooks/razorpay')
      .set('x-razorpay-signature', 'some-sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(rawBody));
      
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Webhook secret not configured');

    process.env.RAZORPAY_WEBHOOK_SECRET = oldSecret;
  });
});
