import { z } from 'zod';

// ─── Intent Schemas ─────────────────────────────────────────────

export const BuyerIntentInputSchema = z.object({
  buyer_input: z.string().min(1, 'Buyer input is required').max(1000, 'Input too long'),
  // merchant_id is intentionally optional here — the server derives it from auth context (x-merchant-id header or DEV_MERCHANT_ID env).
  // Never trust merchant_id from the request body for authorization decisions.
  merchant_id: z.string().max(50).optional(),
  customer_id: z.string().max(50, 'ID too long').optional(),
});

export type BuyerIntentInput = z.infer<typeof BuyerIntentInputSchema>;
