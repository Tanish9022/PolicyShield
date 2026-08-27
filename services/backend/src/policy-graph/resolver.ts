import { PolicyGraph, PolicyRule, CommerceContext, IntentRequest } from '@policyshield/shared';

// Evaluates a condition against the context/intent
function evaluateCondition(condition: any, context: CommerceContext, intent: IntentRequest): boolean {
  // A full expression evaluator is a 500-line DSL parser.
  // The lazy version hardcodes the fields we actually support in the demo.
  let value: any = null;
  
  if (condition.field === 'customer.segment') value = context.customer?.segment;
  else if (condition.field === 'product.tags') value = context.products[0]?.tags; // simplified
  else if (condition.field === 'order.value') value = 10000; // Simplified for MVP

  switch (condition.operator) {
    case 'eq': return value === condition.value;
    case 'neq': return value !== condition.value;
    case 'in': return Array.isArray(value) ? value.includes(condition.value) : false;
    default: return false; // unhandled operators fail safely
  }
}

export function resolveApplicablePolicies(
  graph: PolicyGraph,
  context: CommerceContext,
  intent: IntentRequest
): PolicyRule[] {
  // Filter rules whose conditions are met. 
  // If a rule has no conditions, it applies globally.
  return graph.rules.filter(rule => {
    if (!rule.conditions || rule.conditions.length === 0) return true;
    return rule.conditions.every(cond => evaluateCondition(cond, context, intent));
  });
}
