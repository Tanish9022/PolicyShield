import { z } from 'zod';

// ─── Intent Schemas ─────────────────────────────────────────────

export const BuyerIntentInputSchema = z.object({
  buyer_input: z.string().min(1, 'Buyer input is required'),
  merchant_id: z.string().min(1, 'Merchant ID is required'),
  customer_id: z.string().optional(),
});

export type BuyerIntentInput = z.infer<typeof BuyerIntentInputSchema>;
