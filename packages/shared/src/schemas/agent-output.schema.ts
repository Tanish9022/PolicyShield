import { z } from 'zod';

// ─── Agent Output Schema ────────────────────────────────────────
// Matches the output contract from AI_AGENT_SPEC.md.
// Gemini structured output + Zod runtime validation.

export const AgentDecisionSchema = z.enum([
  'APPROVE',
  'MODIFY',
  'REJECT',
  'ESCALATE',
]);

export const ProposedActionSchema = z.object({
  type: z.string(),
  /** Action-specific parameters */
  product_id: z.string().optional(),
  discount_percent: z.number().optional(),
  requested_discount_percent: z.number().optional(),
  quantity: z.number().optional(),
  shipping_option_id: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
});

export const AgentOutputSchema = z.object({
  decision: AgentDecisionSchema,
  confidence: z.number().min(0).max(1),
  policy_ids: z.array(z.string()),
  evidence: z.array(z.string()),
  proposed_action: ProposedActionSchema,
  requires_human: z.boolean(),
  reason_code: z.string(),
  explanation: z.string().optional(),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;
export type AgentDecision = z.infer<typeof AgentDecisionSchema>;
export type ProposedAction = z.infer<typeof ProposedActionSchema>;
