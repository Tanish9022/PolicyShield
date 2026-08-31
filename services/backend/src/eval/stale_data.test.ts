import { describe, it, expect } from 'vitest';
import { validateRecommendation } from '../policy-gate/validator';
import { ActionDecision } from '@policyshield/shared';

describe('Stale Data Tests', () => {
  it('Test S1: Price changed between negotiation and gate', () => {
    const context = {
      prices: {
        'prod_airpods': 25000 
      }
    };
    
    const recommendation = {
      proposed_action: {
        type: 'CREATE_ORDER',
        product_id: 'prod_airpods',
        base_price: 24000,
        amount: 24000
      },
      reasoning: 'Old price used'
    } as any;
    
    const result = validateRecommendation(recommendation, [], context);
    expect(result.decision).toBe(ActionDecision.REJECT);
    expect(result.reasons[0]).toContain('Stale price');
  });
});
