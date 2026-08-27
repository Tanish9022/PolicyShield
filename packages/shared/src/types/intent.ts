// ─── Intent Types ───────────────────────────────────────────────

/** Branded string types for compile-time safety */
export type IntentId = string & { readonly __brand: 'IntentId' };
export type RequestId = string & { readonly __brand: 'RequestId' };
export type MerchantId = string & { readonly __brand: 'MerchantId' };

/** Raw buyer intent as received by the Commerce Gateway */
export interface IntentRequest {
  /** Unique request identifier (assigned by gateway) */
  request_id: RequestId;
  /** Logical intent identifier (derived from buyer input) */
  intent_id: IntentId;
  /** Merchant scope */
  merchant_id: MerchantId;
  /** Natural-language buyer input */
  buyer_input: string;
  /** Customer identifier (if known) */
  customer_id?: string;
  /** Timestamp of receipt */
  received_at: string;
}
