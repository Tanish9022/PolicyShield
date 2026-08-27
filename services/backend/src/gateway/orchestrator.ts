import { IntentRequest, ActionRecord, AuditEventType } from '@policyshield/shared';
import { getCommerceContext } from '../context-engine/engine';
import { getPolicies } from '../policy-graph/graph';
import { resolveApplicablePolicies } from '../policy-graph/resolver';
import { getAgentRecommendation } from '../agent/reasoning';
import { validateRecommendation } from '../policy-gate/validator';
import { getDb } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import { TelemetryTracer } from './telemetry';

function logAudit(event: any) {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_events 
    (event_id, event_type, intent_id, action_id, policy_version, model_version, decision, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    event.event_type,
    event.intent_id,
    event.action_id || '',
    event.policy_version || '',
    event.model_version || '',
    event.decision || '',
    new Date().toISOString()
  );
}

export async function processIntent(intent: IntentRequest): Promise<any> {
  const tracer = new TelemetryTracer(intent.request_id, intent.intent_id);
  const startTotal = performance.now();
  const db = getDb();
  
  const startAuditIntent = performance.now();
  db.prepare(`
    INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input, received_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `).run(
    intent.intent_id,
    intent.request_id,
    intent.merchant_id,
    intent.buyer_input,
    intent.received_at
  );
  logAudit({ event_type: AuditEventType.INTENT_RECEIVED, intent_id: intent.intent_id });
  tracer.recordStage('REQUEST', startAuditIntent, 'SUCCESS');

  // 1. Fetch Context
  const startContext = performance.now();
  const context = await getCommerceContext(intent);
  tracer.recordStage('CONTEXT', startContext, 'SUCCESS');
  
  // 2. Load Policies
  const startPolicy = performance.now();
  const graph = getPolicies(intent.merchant_id);
  if (!graph) throw new Error('No policies found for merchant');
  const applicablePolicies = resolveApplicablePolicies(graph, context, intent);
  tracer.recordStage('POLICY', startPolicy, 'SUCCESS', graph.version);

  // 3. AI Reasoning
  // We pass tracer down so reasoning can log GEMINI and SCHEMA separately.
  const recommendation = await getAgentRecommendation(intent, context, applicablePolicies, tracer);
  
  if (recommendation.decision === 'REJECT') {
    tracer.completeTrace('REJECTED_BY_MODEL');
    return { gate_decision: 'REJECT', reason: 'Rejected by AI Reasoning' };
  }

  // 4. Deterministic Gate
  const startGate = performance.now();
  const gateResult = validateRecommendation(recommendation, applicablePolicies, context);
  tracer.recordStage('POLICY_GATE', startGate, 'SUCCESS', gateResult.decision);

  // 5. Save Action Record (Persist the decision)
  const startAction = performance.now();
  const actionId = uuidv4();
  tracer.setActionId(actionId);
  
  db.prepare(`
    INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, action_type, state, decision, policy_version, parameters_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    actionId,
    intent.intent_id,
    intent.merchant_id,
    `idemp_${intent.intent_id}`, // basic idempotency
    recommendation.proposed_action.type,
    gateResult.decision === 'APPROVE' ? 'VALIDATED' : (gateResult.decision === 'ESCALATE' ? 'ESCALATED' : 'BLOCKED'),
    gateResult.decision,
    graph.version,
    JSON.stringify(recommendation.proposed_action)
  );

  logAudit({ 
    event_type: AuditEventType.GATE_DECISION, 
    intent_id: intent.intent_id,
    action_id: actionId,
    decision: gateResult.decision
  });
  
  // Explicitly label MODEL_ERROR_CONTAINED_BY_GATE if Model approved but Gate rejected/modified
  let modelErrorContained = false;
  if (recommendation.decision === 'APPROVE' && gateResult.decision !== 'APPROVE') {
     modelErrorContained = true;
     tracer.recordStage('MODEL_ERROR_CONTAINED', startGate, 'SUCCESS', gateResult.decision, 'MODEL_ERROR_CONTAINED_BY_GATE');
  }

  tracer.recordStage('AUDIT', startAction, 'SUCCESS');

  let finalAction = db.prepare('SELECT * FROM actions WHERE action_id = ?').get(actionId) as any;

  if (gateResult.decision === 'APPROVE') {
    const { executeAction } = await import('../execution/executor');
    await executeAction(actionId, tracer);
    // Re-fetch after execution
    finalAction = db.prepare('SELECT * FROM actions WHERE action_id = ?').get(actionId) as any;
  }

  // Create evidence JSON for the frontend
  const evidence = {
    gate_decision: gateResult.decision,
    reasons: gateResult.reasons,
    discount_metadata: gateResult.metadata,
    razorpay_invoked: recommendation.proposed_action.type === 'CREATE_ORDER',
    recommendation: recommendation,
    policy_version: graph.version,
    model_error_contained: modelErrorContained
  };

  db.prepare('UPDATE actions SET evidence_json = ? WHERE action_id = ?').run(
    JSON.stringify(evidence), actionId
  );
  
  finalAction = db.prepare('SELECT * FROM actions WHERE action_id = ?').get(actionId) as any;

  tracer.completeTrace(finalAction.state);

  return {
    gate_decision: gateResult.decision,
    reasons: gateResult.reasons,
    recommendation,
    action: finalAction
  };
}

export async function resolveUnknownExecution(intentId: string, tracer?: TelemetryTracer): Promise<any> {
  const startTotal = performance.now();
  const db = getDb();
  
  // Find the unknown action
  const action = db.prepare(`SELECT * FROM actions WHERE intent_id = ? AND state = 'EXECUTION_UNKNOWN'`).get(intentId) as any;
  if (!action) return { status: 'NO_UNKNOWN_ACTION_FOUND' };
  
  logAudit({ event_type: AuditEventType.EXECUTION_RECOVERY, intent_id: intentId, action_id: action.action_id });
  const { RazorpayAdapter } = await import('../execution/razorpay');
  const existingOrder = await RazorpayAdapter.fetchOrderByReceipt(action.idempotency_key);
  
  if (existingOrder) {
    db.prepare(`UPDATE actions SET state = 'VERIFIED_SUCCESS', razorpay_order_id = ? WHERE action_id = ?`).run(existingOrder.id, action.action_id);
    logAudit({ event_type: AuditEventType.EXECUTION_RECOVERY, intent_id: intentId, action_id: action.action_id, decision: 'VERIFIED_SUCCESS' });
    if (tracer) {
       tracer.recordStage('RECOVERY', startTotal, 'SUCCESS', 'VERIFIED_SUCCESS');
       tracer.completeTrace('VERIFIED_SUCCESS');
    }
    return { status: 'VERIFIED_SUCCESS', order: existingOrder };
  } else {
    db.prepare(`UPDATE actions SET state = 'VERIFIED_FAILURE' WHERE action_id = ?`).run(action.action_id);
    logAudit({ event_type: AuditEventType.EXECUTION_RECOVERY, intent_id: intentId, action_id: action.action_id, decision: 'VERIFIED_FAILURE' });
    if (tracer) {
       tracer.recordStage('RECOVERY', startTotal, 'SUCCESS', 'VERIFIED_FAILURE');
       tracer.completeTrace('VERIFIED_FAILURE');
    }
    return { status: 'VERIFIED_FAILURE', retry_eligible: true };
  }
}

