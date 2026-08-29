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
});
