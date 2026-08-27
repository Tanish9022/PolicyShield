import { AgentOutput, PolicyRule, ActionDecision } from '@policyshield/shared';

// Deterministic Gate

export function validateRecommendation(
  recommendation: AgentOutput,
  rules: PolicyRule[],
  context?: any
): { decision: ActionDecision; reasons: string[]; metadata?: any } {
  const reasons: string[] = [];
  const metadata: any = {};
  const action = recommendation.proposed_action as any;

  // Stale price check if product_id is provided
  if ((action.type === 'CREATE_ORDER' || action.type === 'EXECUTE_PAYMENT') && context && context.prices && action.product_id) {
    const currentPrice = context.prices[action.product_id];
    if (action.amount && currentPrice && action.amount < currentPrice * (1 - ((action.discount_percent || 0)/100))) {
      reasons.push(`Stale price or invalid amount: ${action.amount} is less than required price ${currentPrice}.`);
    }
  }

  for (const rule of rules) {
    switch (rule.rule_type) {
      case 'MAX_DISCOUNT':
        if (action.type === 'APPLY_DISCOUNT' || action.discount_percent) {
           const requested = action.requested_discount_percent ?? action.discount_percent ?? 0;
           let promotion_max = 0;
           
           if (context && context.promotions && action.product_id) {
               const activePromos = context.promotions.filter((p: any) => 
                  p.active && (p.applicable_product_ids.length === 0 || p.applicable_product_ids.includes(action.product_id))
               );
               if (activePromos.length > 0) {
                   promotion_max = Math.max(...activePromos.map((p: any) => p.discount_percent));
               }
           }
           
           const policy_max = (rule.parameters?.max_discount_percent as number) ?? 100;
           
           const max_allowed = promotion_max > 0 ? Math.min(policy_max, promotion_max) : policy_max;
           
           metadata.requested_discount = requested;
           metadata.promotion_max_discount = promotion_max;
           metadata.policy_max_discount = policy_max;
           metadata.final_discount = Math.min(requested, max_allowed);
           
           if (action.discount_percent && action.discount_percent > max_allowed) {
               reasons.push(`Discount ${action.discount_percent}% exceeds permitted ${max_allowed}% (Policy: ${policy_max}%, Promotion: ${promotion_max}%).`);
           }
        }
        break;
      
      case 'INVENTORY_RESERVE':
        const reserve = (rule.parameters?.min_reserve ?? rule.parameters?.reserve_count) as number | undefined;
        if (reserve !== undefined && context && context.inventory && action.product_id) {
           const available = context.inventory[action.product_id] || 0;
           const qty = action.quantity || 1;
           if ((available - qty) < reserve) {
              reasons.push(`Insufficient inventory to maintain reserve of ${reserve}. Available: ${available}, requested: ${qty}.`);
           }
        }
        break;

      case 'APPROVAL_THRESHOLD':
        const threshold = rule.parameters?.threshold_amount as number | undefined;
        if (threshold !== undefined && action.amount && action.amount > threshold) {
          reasons.push(`Amount ${action.amount} exceeds approval threshold ${threshold}.`);
        }
        break;
        
      default:
        break;
    }
  }

  if (reasons.length > 0) {
    if (reasons.some(r => r.includes('approval threshold'))) {
      return { decision: ActionDecision.ESCALATE, reasons, metadata };
    }
    console.log('REJECT REASONS:', reasons);
    return { decision: ActionDecision.REJECT, reasons, metadata };
  }

  return { decision: ActionDecision.APPROVE, reasons: [], metadata };
}
