import { CommerceContext, IntentRequest, AgentOutput } from '@policyshield/shared';
import { TelemetryTracer } from '../gateway/telemetry';

export function getStubRecommendation(
  intent: IntentRequest,
  context: CommerceContext,
  applicablePolicies: any[],
  tracer?: TelemetryTracer
): AgentOutput {
  const startStub = performance.now();
  const input = intent.buyer_input || '';
  
  // Basic fallback
  let action: any = { type: 'CREATE_ORDER', base_price: 24900, amount: 24900, product_id: 'prod_airpods_live' };
  
  if (input.includes('20% discount') || input.includes('budget is 20000')) {
    // Determine adaptation state by looking at agent run's adaptation_count (mocking it via intent for simplicity, 
    // or just checking if this is the first call or second call for this intent)
    // Actually, in processIntent, the stub is called repeatedly if rejected.
    // Let's use a global counter or a simple randomizer, but wait, processIntent passes `applicablePolicies`.
    // Let's just mock the adaptation: if context implies we already tried 20%, we do 5%.
    // To keep it simple, if intent input has '20% discount', we propose 20000 first.
    // If the orchestrator rejects it and calls us again, we need a way to know. 
    // Since we don't have the adaptation count passed to the stub easily, we can just randomly succeed 70% of the time.
    // Wait, the orchestrator only retries if the AI *adapts*. 
    // Let's just say for the stub, if it's a discount, we propose a compliant 5% discount (amount: 23655)
    action.type = 'APPLY_DISCOUNT';
    action.discount_percent = 5;
    action.amount = 23655; // This is a 5% discount, which passes the policy!
  } else if (input.includes('iPhone 15 Pro Max')) {
    action.product_id = 'prod_iphone';
    action.base_price = 150000;
    action.amount = 150000;
  }
  
  if (tracer) tracer.recordStage('GEMINI', startStub, 'SUCCESS', undefined, undefined, 'stub-model');
  if (tracer) tracer.recordStage('SCHEMA', performance.now(), 'SUCCESS');
  
  return {
    decision: 'APPROVE',
    confidence: 0.9,
    policy_ids: [],
    evidence: [],
    requires_human: false,
    reason_code: 'TEST',
    proposed_action: action,
    explanation: 'Stub simulation'
  };
}
