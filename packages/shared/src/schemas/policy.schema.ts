import { z } from 'zod';

// ─── Policy Schemas ─────────────────────────────────────────────

export const PolicyCompileInputSchema = z.object({
  merchant_id: z.string().min(1),
  policy_text: z.string().min(1, 'Policy text is required'),
});

export const PolicyConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'not_in']),
  value: z.unknown(),
});

export const PolicyRuleSchema = z.object({
  policy_id: z.string(),
  rule_type: z.enum([
    'MAX_DISCOUNT',
    'INVENTORY_RESERVE',
    'APPROVAL_THRESHOLD',
    'SHIPPING_CONSTRAINT',
    'CUSTOMER_SEGMENT_OVERRIDE',
    'MARGIN_FLOOR',
  ]),
  description: z.string(),
  conditions: z.array(PolicyConditionSchema),
  parameters: z.record(z.unknown()),
  priority: z.number().int().min(0),
});

export type PolicyCompileInput = z.infer<typeof PolicyCompileInputSchema>;
