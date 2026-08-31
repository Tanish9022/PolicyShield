import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import { getDb } from '../db/client';

import { setupTestDatabase, teardownTestDatabase, resetTestDatabase } from './test-db';

describe('Security Boundaries (Red Team)', () => {
  beforeAll(() => {
    setupTestDatabase();
  });

  afterAll(() => {
    teardownTestDatabase();
  });

  const validPayload = {
    buyer_input: "I want a laptop",
    merchant_id: "merchant_1"
  };

  it('1. Rejects unauthenticated requests if no headers provided', async () => {
    // With NODE_ENV=test, auth.ts won't use dev defaults, so missing header = 401
    const res = await request(app)
      .post('/api/intent')
      .send(validPayload);
      
    expect(res.status).toBe(401);
  });

  it('2. Enforces Tenant Isolation (Cross-Merchant Data Access)', async () => {
    // Simulate auth as DIFFERENT_MERCHANT
    const res = await request(app)
      .post('/api/intent')
      .set('x-merchant-id', 'DIFFERENT_MERCHANT')
      .send(validPayload); // payload says merchant_1
      
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Forbidden');
  });

  it('3. Rejects oversized payloads (Express JSON Limit)', async () => {
    const largePayload = {
      ...validPayload,
      buyer_input: "A".repeat(15000) // 15KB > 10KB limit
    };
    
    const res = await request(app)
      .post('/api/intent')
      .set('x-merchant-id', 'merchant_1')
      .send(largePayload);
      
    expect(res.status).toBe(413); // Payload Too Large
  });

  it('4. Applies Rate Limiting', async () => {
    // Spam the endpoint to trigger rate limit (max 30)
    let lastStatus = 200;
    for (let i = 0; i < 35; i++) {
      const res = await request(app)
        .post('/api/intent')
        .set('x-merchant-id', 'merchant_1')
        .send(validPayload);
      lastStatus = res.status;
    }
    
    // By the 35th request, we should definitely hit 429
    expect(lastStatus).toBe(429);
  });
});
