import { z } from 'zod';

// ─── Intent Schemas ─────────────────────────────────────────────

export const BuyerIntentInputSchema = z.object({
  buyer_input: z.string().min(1, 'Buyer input is required').max(1000, 'Input too long'),
  merchant_id: z.string().min(1, 'Merchant ID is required').max(50, 'ID too long'),
  customer_id: z.string().max(50, 'ID too long').optional(),
});

export type BuyerIntentInput = z.infer<typeof BuyerIntentInputSchema>;
