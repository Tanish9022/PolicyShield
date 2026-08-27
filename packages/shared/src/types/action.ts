// ─── Action Types ───────────────────────────────────────────────

export type ActionId = string & { readonly __brand: 'ActionId' };
export type IdempotencyKey = string & { readonly __brand: 'IdempotencyKey' };

/**
 * Transaction state machine from ARCHITECTURE.md / FAILURE_RECOVERY.md.
 *
 * [*] → PROPOSED → VALIDATED → EXECUTING → VERIFIED_SUCCESS | VERIFIED_FAILURE
 *                 ↘ ESCALATED   ↘ EXECUTION_UNKNOWN → VERIFYING → ...
 *                 ↘ BLOCKED
 */
export enum ActionState {
  PROPOSED = 'PROPOSED',
  VALIDATED = 'VALIDATED',
  BLOCKED = 'BLOCKED',
  EXECUTING = 'EXECUTING',
  EXECUTION_UNKNOWN = 'EXECUTION_UNKNOWN',
  VERIFYING = 'VERIFYING',
  RETRY_ELIGIBLE = 'RETRY_ELIGIBLE',
  VERIFIED_SUCCESS = 'VERIFIED_SUCCESS',
  VERIFIED_FAILURE = 'VERIFIED_FAILURE',
  COMMERCE_STATE_UPDATED = 'COMMERCE_STATE_UPDATED',
  ESCALATED = 'ESCALATED',
}

/** The four possible gate decisions */
export enum ActionDecision {
  APPROVE = 'APPROVE',
  MODIFY = 'MODIFY',
  REJECT = 'REJECT',
  ESCALATE = 'ESCALATE',
}

/** Allowlisted action types that the executor can perform */
export enum ActionType {
  CREATE_ORDER = 'CREATE_ORDER',
  APPLY_DISCOUNT = 'APPLY_DISCOUNT',
  SELECT_SHIPPING = 'SELECT_SHIPPING',
  EXECUTE_PAYMENT = 'EXECUTE_PAYMENT',
  REQUEST_APPROVAL = 'REQUEST_APPROVAL',
}

/** Full action record persisted in the database */
export interface ActionRecord {
  action_id: ActionId;
  intent_id: string;
  merchant_id: string;
  idempotency_key: IdempotencyKey;
  action_type: ActionType;
  state: ActionState;
  decision: ActionDecision;
  /** Policy version used for validation */
  policy_version: string;
  /** The proposed action parameters */
  parameters: Record<string, unknown>;
  /** Razorpay order ID if created */
  razorpay_order_id?: string;
  /** Reason codes from the policy gate */
  reason_codes: string[];
  /** Evidence references */
  evidence_refs: string[];
  created_at: string;
  updated_at: string;
}
