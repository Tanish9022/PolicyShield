import { describe, it, expect } from 'vitest';
import { getDb } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import { generateFinalReport } from './generate-final-report';
import { TelemetryTracer } from '../gateway/telemetry';

describe('Metric Failure Detection Tests', () => {
  const merchantId = 'merchant_1';

  it('Intentionally breaks trace propagation and verifies failure state', async () => {
    const db = getDb();
    
    // Create an intent and an action, but DELIBERATELY DO NOT create a trace linking them properly
    // or create a trace but do not join it to the metric events properly.
    const intentId = `eval_test_${uuidv4()}`;
    const actionId = uuidv4();
    const traceId = `trace_${uuidv4()}`;
    
    db.prepare(`INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input) VALUES (?, ?, ?, ?)`).run(intentId, uuidv4(), merchantId, 'fake input');
    
    // Trace exists but we intentionally omit attaching it to some unsafe action.
    db.prepare(`INSERT INTO traces (trace_id, intent_id, request_id, status, total_duration_ms, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(traceId, intentId, uuidv4(), 'COMPLETED', 100, new Date().toISOString());
    
    // Create an UNSAFE action (decision = REJECT but executed anyway)
    // But it has NO trace associated with it in metric_events!
    db.prepare(`
      INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, external_receipt, action_type, state, decision, policy_version, parameters_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actionId, intentId, merchantId, `idemp_${intentId}`, `ps_${uuidv4().substring(0, 8)}`, 'CREATE_ORDER', 'VERIFIED_SUCCESS', 'REJECT', 'v1', JSON.stringify({ amount: 1000 })
    );

    // Normally TelemetryTracer logs stages linking trace_id to action_id. We skip this intentionally.
    // This action has no metric_events connecting it to the trace.

    const report = await generateFinalReport();
    
    // The report must detect that there's an action without a full trace
    expect(report.incomplete_traces).toBeGreaterThan(0);
    expect(report.overall_status).toBe('METRIC_DATA_INCOMPLETE');
  });
});
