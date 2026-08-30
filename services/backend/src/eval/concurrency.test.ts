import { describe, it, expect } from 'vitest';
import { processIntent } from '../gateway/orchestrator';
import { executeAction } from '../execution/executor';
import { IntentRequest } from '@policyshield/shared';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/client';

describe('Concurrency Tests', () => {
  const merchantId = 'merchant_1';

  it('Test 11: Concurrent Execution (TOCTOU)', async () => {
    // 1. Create a validated action
    const intent: IntentRequest = {
      request_id: uuidv4() as any,
      intent_id: uuidv4() as any,
      merchant_id: merchantId as any,
      buyer_input: 'I want to buy the AirPods Pro at full price',
      received_at: new Date().toISOString()
    };
    
    const result = await processIntent(intent);
    const actionId = result.action.action_id;
    
    // Explicitly set it to VALIDATED to simulate it being ready to execute
    const db = getDb();
    db.prepare("UPDATE actions SET state = 'VALIDATED' WHERE action_id = ?").run(actionId);
    
    // 2. Try 10 concurrent executions
    const attempts = 10;
    const promises = [];
    for (let i = 0; i < attempts; i++) {
      promises.push(executeAction(actionId).catch(e => e.message));
    }
    
    const results = await Promise.all(promises);
    
    const successCount = results.filter(r => r && typeof r !== 'string' && r.status === 'SUCCESS').length;
    const errorCount = results.filter(r => typeof r === 'string' && r.includes('Concurrent execution detected')).length;
    
    expect(successCount).toBe(1);
    expect(errorCount).toBe(attempts - 1);
  });

  it('Test 12: Intent-level and Action-level Idempotency Enforcement', async () => {
    const db = getDb();
    const intentId = uuidv4() as any;
    
    const intent: IntentRequest = {
      request_id: uuidv4() as any,
      intent_id: intentId,
      merchant_id: merchantId as any,
      buyer_input: 'I want to buy the AirPods Pro at full price',
      received_at: new Date().toISOString()
    };

    // 1. First processIntent should create the action
    const result1 = await processIntent(intent);
    expect(result1.action.state).toBe('VALIDATED');

    // 2. Second processIntent with same intent_id (same idempotency_key = idemp_intentId)
    // should yield the SAME action instead of duplicating. Enforced by DB UNIQUE constraint in processIntent.
    const result2 = await processIntent(intent);
    expect(result2.action.action_id).toBe(result1.action.action_id);

    // 3. Mark the action as completed in DB to test execution-level idempotency
    db.prepare("UPDATE actions SET state = 'VERIFIED_SUCCESS' WHERE action_id = ?").run(result1.action.action_id);

    // 4. Executing an already executed action must throw immediately.
    // Enforced in executor.ts at the start of executeAction().
    await expect(executeAction(result1.action.action_id)).rejects.toThrow(/Cannot execute from state VERIFIED_SUCCESS/);
  });
});
