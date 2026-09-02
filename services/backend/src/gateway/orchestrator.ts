import { IntentRequest, ActionRecord, AuditEventType } from '@policyshield/shared';
import { getCommerceContext } from '../context-engine/engine';
import { extractAndPersistExplicitPreferences } from '../agent/memory';
import { getPolicies } from '../policy-graph/graph';
import { resolveApplicablePolicies } from '../policy-graph/resolver';
import { getAgentRecommendation } from '../agent/reasoning';
import { validateRecommendation } from '../policy-gate/validator';
import { getDb } from '../db/client';
import { v4 as uuidv4 } from 'uuid';
import { TelemetryTracer } from './telemetry';
import { appendAgentEvent } from '../agent/events';

async function logAudit(event: any) {
  const db = getDb();
  await db.prepare(`
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

export async function processIntent(intent: IntentRequest, agentRunId: string = uuidv4()): Promise<any> {
  const tracer = new TelemetryTracer(intent.request_id, intent.intent_id);
  const startTotal = performance.now();
  const db = getDb();
  
  const startAuditIntent = performance.now();
  
  // Extract and persist any explicit memory from the user intent
  extractAndPersistExplicitPreferences(db, intent);
  
  await db.prepare(`
    INSERT INTO intents (intent_id, request_id, merchant_id, buyer_input, customer_id, received_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `).run(
    intent.intent_id,
    intent.request_id,
    intent.merchant_id,
    intent.buyer_input,
    intent.customer_id || null,
    intent.received_at || new Date().toISOString()
  );
  await logAudit({ event_type: AuditEventType.INTENT_RECEIVED, intent_id: intent.intent_id });
  tracer.recordStage('REQUEST', startAuditIntent, 'SUCCESS');

  await db.prepare(`
    INSERT INTO agent_runs (agent_run_id, intent_id, merchant_id, state, current_step, trace_id)
    VALUES (?, ?, ?, 'NEW', 'DISCOVERY', ?)
  `).run(agentRunId, intent.intent_id, intent.merchant_id, tracer.traceIdVal);

  await appendAgentEvent(agentRunId, 'INTENT_RECEIVED', { intent });

  // 1. Fetch Context
  const startContext = performance.now();
  const context = await getCommerceContext(intent);
  tracer.recordStage('CONTEXT', startContext, 'SUCCESS');
  
  // 2. Load Policies
  const startPolicy = performance.now();
  const graph = await getPolicies(intent.merchant_id);
  if (!graph) throw new Error('No policies found for merchant');
  const applicablePolicies = resolveApplicablePolicies(graph, context, intent);
  tracer.recordStage('POLICY', startPolicy, 'SUCCESS', graph.version);

  await db.prepare(`UPDATE agent_runs SET policy_version = ?, state = 'DISCOVERING' WHERE agent_run_id = ?`).run(graph.version, agentRunId);

  // 3. Discovery
  const { discoverCandidates } = await import('../agent/discovery');
  const candidates = await discoverCandidates(intent, context, tracer);
  
  await appendAgentEvent(agentRunId, 'DISCOVER', { candidates_count: candidates.length });

  if (candidates.length === 0) {
    const actionId = uuidv4();
    const idempKey = `idemp_${intent.intent_id}_disc_fail`;
    await db.prepare(`
      INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, action_type, state, decision, policy_version, reason_codes_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(actionId, intent.intent_id, intent.merchant_id, idempKey, 'HANDOFF', 'ESCALATED', 'ESCALATE', 'latest', JSON.stringify(['NO_CANDIDATES_FOUND']));

    await db.prepare(`UPDATE agent_runs SET state = 'ESCALATED', current_step = 'FAILED_DISCOVERY', completed_at = ? WHERE agent_run_id = ?`).run(new Date().toISOString(), agentRunId);
    tracer.completeTrace('ESCALATED');
    return { status: 'NO_MATCH', reason: 'No candidates found.' };
  }

  await db.prepare(`UPDATE agent_runs SET state = 'COMPARING', current_step = 'COMPARISON' WHERE agent_run_id = ?`).run(agentRunId);

  // 4. Comparison
  const { compareCandidates } = await import('../agent/comparison');
  const decision = await compareCandidates(intent, candidates, tracer);
  
  await appendAgentEvent(agentRunId, 'COMPARE', { decision });

  if (decision.decision !== 'SELECT' || !decision.selected_product_id) {
    const actionId = uuidv4();
    const idempKey = `idemp_${intent.intent_id}_comp_fail`;
    await db.prepare(`
      INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, action_type, state, decision, policy_version, reason_codes_json, evidence_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(actionId, intent.intent_id, intent.merchant_id, idempKey, 'HANDOFF', 'ESCALATED', 'ESCALATE', 'latest', JSON.stringify(['FAILED_COMPARISON']), JSON.stringify(decision.reasoning_evidence || []));

    await db.prepare(`UPDATE agent_runs SET state = 'ESCALATED', current_step = 'FAILED_COMPARISON', completed_at = ? WHERE agent_run_id = ?`).run(new Date().toISOString(), agentRunId);
    tracer.completeTrace('ESCALATED');
    return { status: 'ESCALATED', reason: 'AI could not select a candidate.' };
  }

  const selectedCandidate = candidates.find(c => c.product_id === decision.selected_product_id);
  await db.prepare(`UPDATE agent_runs SET selected_product_id = ?, state = 'NEGOTIATING', current_step = 'NEGOTIATION' WHERE agent_run_id = ?`).run(decision.selected_product_id, agentRunId);

  // 5. Negotiation
  const { proposeAction } = await import('../agent/negotiation');
  let negotiation = await proposeAction(intent, selectedCandidate!, undefined, tracer);
  
  await appendAgentEvent(agentRunId, 'PROPOSE', { proposal: negotiation.proposed_action, reasoning: negotiation.reasoning });

  // 6. Policy Gate
  await db.prepare(`UPDATE agent_runs SET state = 'WAITING_POLICY', current_step = 'POLICY_CHECK' WHERE agent_run_id = ?`).run(agentRunId);
  const startGate = performance.now();
  let agentOutputMock = { proposed_action: negotiation.proposed_action } as any;
  let gateResult = validateRecommendation(agentOutputMock, applicablePolicies, context);
  tracer.recordStage('POLICY_GATE', startGate, 'SUCCESS', gateResult.decision);

  const MAX_NEGOTIATION_ATTEMPTS = 3;
  let adaptationCount = 0;
  let modelErrorContained = false;

  // 7. Adaptation Loop
  while (gateResult.decision === 'REJECT' && adaptationCount < MAX_NEGOTIATION_ATTEMPTS) {
    modelErrorContained = true;
    adaptationCount++;
    
    await appendAgentEvent(agentRunId, 'POLICY_REJECT', { 
      proposal: negotiation.proposed_action,
      reasons: gateResult.reasons,
      metadata: gateResult.metadata
    });
    
    await db.prepare(`UPDATE agent_runs SET state = 'POLICY_REJECTED', current_step = 'ADAPTATION', adaptation_count = ? WHERE agent_run_id = ?`).run(adaptationCount, agentRunId);
    
    const feedback = {
      decision: gateResult.decision,
      reasons: gateResult.reasons,
      metadata: gateResult.metadata
    };
    
    await appendAgentEvent(agentRunId, 'ADAPT', { attempt: adaptationCount, feedback });
    negotiation = await proposeAction(intent, selectedCandidate!, feedback, tracer);
    await appendAgentEvent(agentRunId, 'PROPOSE', { proposal: negotiation.proposed_action, reasoning: negotiation.reasoning });
    
    await db.prepare(`UPDATE agent_runs SET state = 'WAITING_POLICY', current_step = 'POLICY_CHECK' WHERE agent_run_id = ?`).run(agentRunId);
    agentOutputMock = { proposed_action: negotiation.proposed_action } as any;
    gateResult = validateRecommendation(agentOutputMock, applicablePolicies, context);
  }

  // 8. Save Final Action
  const startAction = performance.now();
  const actionId = uuidv4();
  tracer.setActionId(actionId);
  
  const finalState = gateResult.decision === 'APPROVE' ? 'VALIDATED' : (gateResult.decision === 'ESCALATE' ? 'ESCALATED' : 'BLOCKED');

  const crypto = require('crypto');
  const idempKey = `idemp_${intent.intent_id}`;
  const externalReceipt = `ps_${crypto.createHash('sha256').update(idempKey).digest('hex').substring(0, 36)}`;

  try {
    await db.prepare(`
      INSERT INTO actions (action_id, intent_id, merchant_id, idempotency_key, external_receipt, action_type, state, decision, policy_version, parameters_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actionId,
      intent.intent_id,
      intent.merchant_id,
      idempKey,
      externalReceipt,
      negotiation.proposed_action.type,
      finalState,
      gateResult.decision,
      graph.version,
      JSON.stringify(negotiation.proposed_action)
    );
  } catch (err: any) {
    if (err.message.includes('UNIQUE constraint failed: actions.idempotency_key') || err.message.includes('UNIQUE constraint failed: actions.external_receipt')) {
      const existing = await db.prepare('SELECT parameters_json FROM actions WHERE idempotency_key = ?').get(idempKey) as any;
      if (existing.parameters_json !== JSON.stringify(negotiation.proposed_action)) {
         tracer.recordStage('ACTION_SAVE', startAction, 'FAILURE', 'CONFLICT', 'IDEMPOTENCY_CONFLICT');
         tracer.completeTrace('CONFLICT');
         return { status: 'CONFLICT', reason: 'Idempotency conflict: different payload for same intent' };
      }
      // If same payload, we can proceed as it's a true retry of the exact same state
      // We would just use the existing actionId. However, orchestrator is supposed to create it.
      // For simplicity, if it's the exact same payload, we just return the existing one.
      const existingAction = await db.prepare('SELECT * FROM actions WHERE idempotency_key = ?').get(idempKey) as any;
      tracer.completeTrace(existingAction.state);
      const existingAgentRun = await db.prepare('SELECT * FROM agent_runs WHERE intent_id = ? ORDER BY created_at DESC LIMIT 1').get(intent.intent_id) as any;
      return {
        gate_decision: existingAction.decision,
        reasons: JSON.parse(existingAction.reason_codes_json || '[]'),
        agent_run: existingAgentRun,
        candidates: candidates,
        action: existingAction
      };
    }
    throw err;
  }

  await logAudit({ 
    event_type: AuditEventType.GATE_DECISION, 
    intent_id: intent.intent_id,
    action_id: actionId,
    decision: gateResult.decision
  });
  
  if (modelErrorContained) {
     tracer.recordStage('MODEL_ERROR_CONTAINED', startGate, 'SUCCESS', gateResult.decision, 'MODEL_ERROR_CONTAINED_BY_GATE');
  }

  const evidence = {
    gate_decision: gateResult.decision,
    reasons: gateResult.reasons,
    discount_metadata: gateResult.metadata,
    razorpay_invoked: false, // NOT INVOKED YET
    recommendation: { proposed_action: negotiation.proposed_action, explanation: negotiation.reasoning },
    policy_version: graph.version,
    model_error_contained: modelErrorContained
  };

  await db.prepare('UPDATE actions SET evidence_json = ?, reason_codes_json = ? WHERE action_id = ?').run(
    JSON.stringify(evidence), JSON.stringify(gateResult.reasons), actionId
  );

  if (gateResult.decision === 'APPROVE') {
    await appendAgentEvent(agentRunId, 'POLICY_APPROVE', { proposal: negotiation.proposed_action });
    await db.prepare(`UPDATE agent_runs SET selected_action_id = ?, state = 'READY_FOR_CHECKOUT', current_step = 'CHECKOUT_PENDING' WHERE agent_run_id = ?`).run(actionId, agentRunId);
  } else {
    await appendAgentEvent(agentRunId, 'POLICY_REJECT', { proposal: negotiation.proposed_action, reasons: gateResult.reasons });
    await db.prepare(`UPDATE agent_runs SET selected_action_id = ?, state = 'FAILED', current_step = 'FAILED_POLICY', completed_at = ? WHERE agent_run_id = ?`).run(actionId, new Date().toISOString(), agentRunId);
  }

  const finalAction = await db.prepare('SELECT * FROM actions WHERE action_id = ?').get(actionId) as any;
  const agentRun = await db.prepare('SELECT * FROM agent_runs WHERE agent_run_id = ?').get(agentRunId) as any;

  // We DO NOT execute Razorpay here anymore. Deliberate separation.
  tracer.completeTrace(finalAction.state);

  return {
    gate_decision: gateResult.decision,
    reasons: gateResult.reasons,
    agent_run: agentRun,
    candidates: candidates,
    action: finalAction,
    buyer_memory: context.buyer_memory
  };
}

export async function checkoutAction(intentId: string): Promise<any> {
  const db = getDb();
  
  const action = await db.prepare('SELECT * FROM actions WHERE intent_id = ? AND state IN (\'VALIDATED\', \'READY_FOR_CHECKOUT\')').get(intentId) as any;
  if (!action) throw new Error('No valid approved action found for checkout');
  
  const intentRow = await db.prepare('SELECT * FROM intents WHERE intent_id = ?').get(intentId) as any;
  const intent: IntentRequest = {
    request_id: intentRow.request_id,
    intent_id: intentRow.intent_id,
    merchant_id: intentRow.merchant_id,
    buyer_input: intentRow.buyer_input,
    received_at: intentRow.received_at
  };

  const tracer = new TelemetryTracer(intent.request_id, intent.intent_id);
  tracer.setActionId(action.action_id);
  const startJit = performance.now();
  
  const agentRun = await db.prepare('SELECT agent_run_id FROM agent_runs WHERE intent_id = ?').get(intentId) as any;
  const agentRunId = agentRun?.agent_run_id;

  // JIT VALIDATION
  const context = await getCommerceContext(intent);
  const graph = await getPolicies(intent.merchant_id);
  if (!graph) throw new Error('Policies missing during JIT');
  const applicablePolicies = resolveApplicablePolicies(graph, context, intent);
  
  if (graph.version !== action.policy_version) {
    await db.prepare(`UPDATE actions SET state = 'BLOCKED', reason_codes_json = ? WHERE action_id = ?`).run(JSON.stringify(['POLICY_VERSION_CHANGED']), action.action_id);
    await db.prepare(`UPDATE agent_runs SET state = 'FAILED', current_step = 'JIT_FAILED' WHERE intent_id = ?`).run(intentId);
    if (agentRunId) await appendAgentEvent(agentRunId, 'JIT_FAILED', { reason: 'POLICY_VERSION_CHANGED' });
    tracer.recordStage('JIT_VALIDATION', startJit, 'FAILURE', undefined, 'POLICY_VERSION_CHANGED');
    tracer.completeTrace('BLOCKED');
    throw new Error('Policy version changed. Checkout blocked.');
  }

  if (action.state !== 'READY_FOR_CHECKOUT') {
    const agentOutputMock = { proposed_action: JSON.parse(action.parameters_json) } as any;
    const gateResult = validateRecommendation(agentOutputMock, applicablePolicies, context);

    if (gateResult.decision !== 'APPROVE') {
      await db.prepare(`UPDATE actions SET state = 'BLOCKED', reason_codes_json = ? WHERE action_id = ?`).run(JSON.stringify(gateResult.reasons), action.action_id);
      await db.prepare(`UPDATE agent_runs SET state = 'FAILED', current_step = 'JIT_FAILED' WHERE intent_id = ?`).run(intentId);
      if (agentRunId) await appendAgentEvent(agentRunId, 'JIT_FAILED', { reasons: gateResult.reasons });
      tracer.recordStage('JIT_VALIDATION', startJit, 'FAILURE', undefined, 'JIT_REJECTED');
      tracer.completeTrace('BLOCKED');
      throw new Error('JIT Validation failed: ' + gateResult.reasons.join(', '));
    }
  }

  tracer.recordStage('JIT_VALIDATION', startJit, 'SUCCESS');
  if (agentRunId) await appendAgentEvent(agentRunId, 'JIT_VALIDATE', { status: 'SUCCESS' });

  await db.prepare(`UPDATE agent_runs SET state = 'EXECUTING', current_step = 'RAZORPAY' WHERE intent_id = ?`).run(intentId);
  if (agentRunId) await appendAgentEvent(agentRunId, 'PAYMENT_CREATE', { action_id: action.action_id });

  // EXECUTION
  const { executeAction } = await import('../execution/executor');
  await executeAction(action.action_id, tracer);
  
  const finalAction = await db.prepare('SELECT * FROM actions WHERE action_id = ?').get(action.action_id) as any;
  
  if (finalAction.state === 'VERIFIED_SUCCESS') {
    await db.prepare(`UPDATE agent_runs SET state = 'COMPLETED', current_step = 'VERIFIED', completed_at = ? WHERE intent_id = ?`).run(new Date().toISOString(), intentId);
    if (agentRunId) await appendAgentEvent(agentRunId, 'VERIFIED_SUCCESS', { order_id: finalAction.razorpay_order_id });
  } else if (finalAction.state === 'EXECUTION_UNKNOWN') {
    await db.prepare(`UPDATE agent_runs SET state = 'EXECUTION_UNKNOWN', current_step = 'VERIFYING' WHERE intent_id = ?`).run(intentId);
    if (agentRunId) await appendAgentEvent(agentRunId, 'EXECUTION_UNKNOWN', { status: 'AWAITING_VERIFICATION' });
  }
  
  tracer.completeTrace(finalAction.state);
  return finalAction;
}

export async function resolveUnknownExecution(intentId: string, tracer?: TelemetryTracer): Promise<any> {
  const startTotal = performance.now();
  const db = getDb();
  
  const action = await db.prepare(`SELECT * FROM actions WHERE intent_id = ? AND state = 'EXECUTION_UNKNOWN'`).get(intentId) as any;
  if (!action) return { status: 'NO_UNKNOWN_ACTION_FOUND' };
  
  const agentRun = await db.prepare('SELECT agent_run_id FROM agent_runs WHERE intent_id = ?').get(intentId) as any;
  const agentRunId = agentRun?.agent_run_id;
  
  if (agentRunId) await appendAgentEvent(agentRunId, 'PAYMENT_VERIFY', { action_id: action.action_id });
  
  await logAudit({ event_type: AuditEventType.EXECUTION_RECOVERY, intent_id: intentId, action_id: action.action_id });
  const { RazorpayAdapter } = await import('../execution/razorpay');
  
  let existingOrder = null;
  let attempts = 3;
  let backoffMs = 1000;

  for (let i = 0; i < attempts; i++) {
    if (action.razorpay_order_id) {
      try {
        existingOrder = await RazorpayAdapter.fetchOrder(action.razorpay_order_id);
      } catch (err: any) {
        console.error(`Recovery attempt ${i+1} failed to fetch by order ID:`, err.message || err);
      }
    }
    
    if (!existingOrder) {
      existingOrder = await RazorpayAdapter.fetchOrderByReceipt(action.external_receipt);
    }
    
    if (existingOrder) {
      break;
    }
    
    if (i < attempts - 1) {
      console.log(`Recovery attempt ${i+1} - Order not found. Retrying in ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      backoffMs *= 2;
    }
  }
  
  if (existingOrder) {
    await db.prepare(`UPDATE actions SET state = 'VERIFIED_SUCCESS', razorpay_order_id = ? WHERE action_id = ?`).run(existingOrder.id, action.action_id);
    await db.prepare(`UPDATE agent_runs SET state = 'COMPLETED', current_step = 'VERIFIED' WHERE intent_id = ?`).run(intentId);
    if (agentRunId) await appendAgentEvent(agentRunId, 'VERIFIED_SUCCESS', { order_id: existingOrder.id });
    
    await logAudit({ event_type: AuditEventType.EXECUTION_RECOVERY, intent_id: intentId, action_id: action.action_id, decision: 'VERIFIED_SUCCESS' });
    if (tracer) {
       tracer.recordStage('RECOVERY', startTotal, 'SUCCESS', 'VERIFIED_SUCCESS');
       tracer.completeTrace('VERIFIED_SUCCESS');
    }
    return { status: 'VERIFIED_SUCCESS', order: existingOrder };
  } else {
    await db.prepare(`UPDATE actions SET state = 'VERIFIED_FAILURE' WHERE action_id = ?`).run(action.action_id);
    await db.prepare(`UPDATE agent_runs SET state = 'FAILED', current_step = 'VERIFIED' WHERE intent_id = ?`).run(intentId);
    if (agentRunId) await appendAgentEvent(agentRunId, 'VERIFIED_FAILURE', { reason: 'ORDER_NOT_FOUND' });
    
    await logAudit({ event_type: AuditEventType.EXECUTION_RECOVERY, intent_id: intentId, action_id: action.action_id, decision: 'VERIFIED_FAILURE' });
    if (tracer) {
       tracer.recordStage('RECOVERY', startTotal, 'SUCCESS', 'VERIFIED_FAILURE');
       tracer.completeTrace('VERIFIED_FAILURE');
    }
    return { status: 'VERIFIED_FAILURE', retry_eligible: true };
  }
}

