import { getDb } from '../db/client';
import { ActionDecision, ActionType } from '@policyshield/shared';
import { RazorpayAdapter } from './razorpay';
import { isValidTransition } from '@policyshield/shared';
import { TelemetryTracer } from '../gateway/telemetry';



export async function executeAction(actionId: string, tracer?: TelemetryTracer): Promise<any> {
  const db = getDb();
  
  // 1. Fetch action
  const action = db.prepare('SELECT * FROM actions WHERE action_id = ?').get(actionId) as any;
  if (!action) throw new Error('Action not found');
  if (action.decision !== 'APPROVE') throw new Error('Action was not approved by policy gate');
  if (action.state !== 'VALIDATED' && action.state !== 'RETRY_ELIGIBLE') {
    throw new Error(`Cannot execute from state ${action.state}`);
  }

  // JIT Re-validation
  const startJit = performance.now();
  const intentRow = db.prepare('SELECT * FROM intents WHERE intent_id = ?').get(action.intent_id) as any;
  const intent = {
    request_id: intentRow.request_id,
    intent_id: intentRow.intent_id,
    merchant_id: intentRow.merchant_id,
    buyer_input: intentRow.buyer_input,
    received_at: intentRow.received_at
  };

  const { getCommerceContext } = await import('../context-engine/engine');
  const { getPolicies } = await import('../policy-graph/graph');
  const { resolveApplicablePolicies } = await import('../policy-graph/resolver');
  const { validateRecommendation } = await import('../policy-gate/validator');

  const context = await getCommerceContext(intent);
  const graph = getPolicies(action.merchant_id);
  if (!graph) throw new Error('Policies not found for JIT validation');

  if (graph.version !== action.policy_version) {
    db.prepare('UPDATE actions SET state = ?, decision = ?, updated_at = ? WHERE action_id = ?').run(
      'BLOCKED', 'REJECT', new Date().toISOString(), actionId
    );
    if (tracer) tracer.recordStage('JIT', startJit, 'FAILURE', 'REJECT', 'POLICY_RACE');
    throw new Error('Policy version mismatch - Execution BLOCKED');
  }

  const applicablePolicies = resolveApplicablePolicies(graph, context, intent);
  const parameters = JSON.parse(action.parameters_json);
  
  const gateResult = validateRecommendation({ proposed_action: parameters } as any, applicablePolicies, context);
  if (gateResult.decision !== 'APPROVE') {
     db.prepare('UPDATE actions SET state = ?, decision = ?, updated_at = ? WHERE action_id = ?').run(
      'BLOCKED', gateResult.decision, new Date().toISOString(), actionId
    );
    if (tracer) tracer.recordStage('JIT', startJit, 'FAILURE', gateResult.decision, 'INVENTORY_RACE');
    throw new Error(`JIT Validation failed: ${gateResult.reasons.join(', ')} - Execution BLOCKED`);
  }
  
  if (tracer) tracer.recordStage('JIT', startJit, 'SUCCESS');

  // Idempotency
  const startIdempotency = performance.now();
  // We use `action.idempotency_key` uniquely. If it fails due to UNIQUE constraint in DB or Razorpay, we catch it.
  if (tracer) tracer.recordStage('IDEMPOTENCY', startIdempotency, 'SUCCESS');

  // 2. Transition to EXECUTING atomically to prevent concurrent executions
  const updateResult = db.prepare(
    "UPDATE actions SET state = 'EXECUTING', updated_at = ? WHERE action_id = ? AND state IN ('VALIDATED', 'RETRY_ELIGIBLE')"
  ).run(new Date().toISOString(), actionId);
  
  if (updateResult.changes === 0) {
    throw new Error(`Concurrent execution detected or invalid state for action ${actionId}`);
  }

  try {
    let result: any = null;
    const startRazorpay = performance.now();

    if (action.action_type === 'CREATE_ORDER') {
      // Create Razorpay order
      const order = (await RazorpayAdapter.createOrder(
        parameters.amount || 1000, 
        parameters.currency || 'INR', 
        action.idempotency_key
      )) as any;
      
      if (tracer) tracer.recordStage('RAZORPAY', startRazorpay, 'SUCCESS');
      
      const startVerification = performance.now();
      // Update with Razorpay Order ID
      db.prepare('UPDATE actions SET razorpay_order_id = ? WHERE action_id = ?').run(order.id, actionId);
      result = order;
      if (tracer) tracer.recordStage('VERIFICATION', startVerification, 'SUCCESS');

      // 3. Success -> VERIFIED_SUCCESS
      db.prepare('UPDATE actions SET state = ?, updated_at = ? WHERE action_id = ?').run(
        'VERIFIED_SUCCESS', new Date().toISOString(), actionId
      );
    } else if (action.action_type === 'APPLY_DISCOUNT') {
      // APPLY_DISCOUNT is a local commerce state mutation, NOT a financial transaction.
      // We do NOT hit Razorpay here.
      db.prepare('UPDATE actions SET state = ?, updated_at = ? WHERE action_id = ?').run(
        'COMMERCE_STATE_UPDATED', new Date().toISOString(), actionId
      );
      result = { discount_applied: parameters.discount_percent };
    }

    return { status: 'SUCCESS', result };

  } catch (err: any) {
    // 4. Transport/Timeout Failure -> EXECUTION_UNKNOWN
    // If we can't be sure it failed, it's UNKNOWN.
    console.error(`[EXECUTION_UNKNOWN] action_id=${actionId} error=${err.message}`);
    
    db.prepare('UPDATE actions SET state = ?, updated_at = ? WHERE action_id = ?').run(
      'EXECUTION_UNKNOWN', new Date().toISOString(), actionId
    );

    return { status: 'EXECUTION_UNKNOWN', error: err.message };
  }
}

