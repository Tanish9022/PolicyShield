import { getDb } from '../db/client';
import { ActionDecision, ActionType } from '@policyshield/shared';
import { RazorpayAdapter } from './razorpay';
import { isValidTransition } from '@policyshield/shared';
import { TelemetryTracer } from '../gateway/telemetry';



/**
 * Executes a deterministically approved action by interfacing with the payment gateway.
 * 
 * Includes JIT (Just-In-Time) validation to ensure state hasn't mutated since the AI proposed the action.
 * Atomically transitions states to prevent concurrent double-executions (idempotency).
 * If the transport layer fails mid-flight, transitions to EXECUTION_UNKNOWN for later recovery.
 * 
 * @param actionId - The UUID of the action to execute
 * @param tracer - Optional telemetry tracer
 * @returns The gateway result or the failure state
 */
export async function executeAction(actionId: string, tracer?: TelemetryTracer): Promise<any> {
  const db = getDb();
  
  // 1. Fetch action
  const action = await db.prepare('SELECT * FROM actions WHERE action_id = ?').get(actionId) as any;
  if (!action) throw new Error('Action not found');
  if (action.decision !== 'APPROVE') throw new Error('Action was not approved by policy gate');
  if (action.state !== 'VALIDATED' && action.state !== 'RETRY_ELIGIBLE' && action.state !== 'READY_FOR_CHECKOUT') {
    throw new Error(`Cannot execute from state ${action.state}`);
  }

  // JIT Re-validation
  const startJit = performance.now();
  const intentRow = await db.prepare('SELECT * FROM intents WHERE intent_id = ?').get(action.intent_id) as any;
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
  const graph = await getPolicies(action.merchant_id);
  if (!graph) throw new Error('Policies not found for JIT validation');

  if (graph.version !== action.policy_version) {
    await db.prepare('UPDATE actions SET state = ?, decision = ?, updated_at = ? WHERE action_id = ?').run(
      'BLOCKED', 'REJECT', new Date().toISOString(), actionId
    );
    if (tracer) tracer.recordStage('JIT', startJit, 'FAILURE', 'REJECT', 'POLICY_RACE');
    throw new Error('Policy version mismatch - Execution BLOCKED');
  }

  const applicablePolicies = resolveApplicablePolicies(graph, context, intent);
  const parameters = JSON.parse(action.parameters_json);
  
  // Bypass JIT policy gate if a human manually approved this action
  if (action.state !== 'READY_FOR_CHECKOUT') {
    const gateResult = validateRecommendation({ proposed_action: parameters } as any, applicablePolicies, context);
    if (gateResult.decision !== 'APPROVE') {
       await db.prepare('UPDATE actions SET state = ?, decision = ?, updated_at = ? WHERE action_id = ?').run(
        'BLOCKED', gateResult.decision, new Date().toISOString(), actionId
      );
      if (tracer) tracer.recordStage('JIT', startJit, 'FAILURE', gateResult.decision, 'INVENTORY_RACE');
      throw new Error(`JIT Validation failed: ${gateResult.reasons.join(', ')} - Execution BLOCKED`);
    }
  }
  
  if (tracer) tracer.recordStage('JIT', startJit, 'SUCCESS');

  // Idempotency check: Ensure this action is not already executing or completed
  const startIdempotency = performance.now();
  if (action.state === 'EXECUTING' || action.state === 'VERIFIED_SUCCESS') {
    if (tracer) tracer.recordStage('IDEMPOTENCY', startIdempotency, 'FAILURE', undefined, 'ALREADY_EXECUTED_OR_EXECUTING');
    throw new Error(`Action ${actionId} is already in state ${action.state}`);
  }
  if (tracer) tracer.recordStage('IDEMPOTENCY', startIdempotency, 'SUCCESS');

  // 2. Transition to EXECUTING atomically to prevent concurrent executions
  const updateResult = await db.prepare(
    "UPDATE actions SET state = 'EXECUTING', updated_at = ? WHERE action_id = ? AND state IN ('VALIDATED', 'RETRY_ELIGIBLE', 'READY_FOR_CHECKOUT')"
  ).run(new Date().toISOString(), actionId);
  
  const changes = (updateResult as any).rowCount ?? (updateResult as any).changes;
  if (changes === 0) {
    throw new Error(`Concurrent execution detected or invalid state for action ${actionId}`);
  }

  try {
    let result: any = null;
    const startRazorpay = performance.now();

    if (action.action_type === 'CREATE_ORDER' || action.action_type === 'APPLY_DISCOUNT') {
      let amountInRupees = 0;
      
      if (action.action_type === 'APPLY_DISCOUNT') {
         const basePrice = context.prices[parameters.product_id];
         if (!basePrice) throw new Error('Product price not found');
         const discount = parameters.discount_percent || 0;
         amountInRupees = basePrice * (1 - discount / 100);
      } else {
         amountInRupees = parameters.amount || (context.prices[parameters.product_id] || 1000);
      }
      
      const amountInPaise = Math.round(amountInRupees * 100);

      // Create Razorpay order
      const order = (await RazorpayAdapter.createOrder(
        amountInPaise, 
        parameters.currency || 'INR', 
        action.external_receipt
      )) as any;
      
      if (tracer) tracer.recordStage('RAZORPAY', startRazorpay, 'SUCCESS');
      
      const startVerification = performance.now();
      // Update with Razorpay Order ID
      await db.prepare('UPDATE actions SET razorpay_order_id = ? WHERE action_id = ?').run(order.id, actionId);
      result = order;
      if (tracer) tracer.recordStage('VERIFICATION', startVerification, 'SUCCESS');

      // 3. Success -> VERIFIED_SUCCESS
      await db.prepare('UPDATE actions SET state = ?, updated_at = ? WHERE action_id = ?').run(
        'VERIFIED_SUCCESS', new Date().toISOString(), actionId
      );
    }

    return { status: 'SUCCESS', result };

  } catch (err: any) {
    // 4. Transport/Timeout Failure -> EXECUTION_UNKNOWN
    // If we can't be sure it failed, it's UNKNOWN.
    console.error(`[EXECUTION_UNKNOWN] action_id=${actionId} error=${err.message}`);
    
    await db.prepare('UPDATE actions SET state = ?, updated_at = ? WHERE action_id = ?').run(
      'EXECUTION_UNKNOWN', new Date().toISOString(), actionId
    );

    return { status: 'EXECUTION_UNKNOWN', error: err.message };
  }
}

