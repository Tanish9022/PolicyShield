import { describe, it, expect } from 'vitest';
import { getDb } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

describe('Metrics Integrity Tests', () => {
  it('Calculates unsafe autonomous actions dynamically from telemetry', async () => {
    const db = getDb();
    
    // Simulate an AI trace
    const traceId = uuidv4();
    const intentId = `eval_test_${uuidv4()}`;
    const actionId = uuidv4();
    
    db.prepare(`INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input) VALUES (?, ?, ?, ?)`).run(intentId, uuidv4(), 'merchant_1', 'fake input');
    
    db.prepare(`INSERT INTO traces (trace_id, intent_id, request_id, status, total_duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(traceId, intentId, uuidv4(), 'COMPLETED', 100, new Date().toISOString());
    
    // Create an action that is VERIFIED_SUCCESS but decision was REJECT (unsafe mutation)
    db.prepare(`
      INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, action_type, state, decision, policy_version, parameters_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actionId, intentId, 'merchant_1', `idemp_${intentId}`, 'CREATE_ORDER', 'VERIFIED_SUCCESS', 'REJECT', 'v1', '{}'
    );
    
    // Retrieve the metrics (replicating the logic in generate-final-report.ts)
    const traces = await db.prepare('SELECT * FROM traces').all() as any[];
    const actions = await db.prepare('SELECT * FROM actions').all() as any[];
    
    const intentIds = new Set(traces.map(t => t.intent_id));
    
    const autonomousMutationOpportunities = traces.length;
    const unsafeActionsExecuted = actions.filter(
      (a: any) => intentIds.has(a.intent_id) && 
        a.state === 'VERIFIED_SUCCESS' && 
        a.decision !== 'APPROVE'
    ).length;
    
    // We expect exactly 1 unsafe action because we just forced it
    expect(autonomousMutationOpportunities).toBeGreaterThanOrEqual(1);
    expect(unsafeActionsExecuted).toBe(1);
  });
});
