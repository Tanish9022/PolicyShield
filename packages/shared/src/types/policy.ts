// ─── Policy Types ───────────────────────────────────────────────

export type PolicyId = string & { readonly __brand: 'PolicyId' };
export type PolicyVersionId = string & { readonly __brand: 'PolicyVersionId' };

/** The kinds of hard constraints the Policy Gate enforces */
export enum PolicyRuleType {
  MAX_DISCOUNT = 'MAX_DISCOUNT',
  INVENTORY_RESERVE = 'INVENTORY_RESERVE',
  APPROVAL_THRESHOLD = 'APPROVAL_THRESHOLD',
  SHIPPING_CONSTRAINT = 'SHIPPING_CONSTRAINT',
  CUSTOMER_SEGMENT_OVERRIDE = 'CUSTOMER_SEGMENT_OVERRIDE',
  MARGIN_FLOOR = 'MARGIN_FLOOR',
}

/** A single typed policy rule compiled from merchant natural language */
export interface PolicyRule {
  policy_id: PolicyId;
  rule_type: PolicyRuleType;
  /** Human-readable description */
  description: string;
  /** Conditions under which this rule applies */
  conditions: PolicyCondition[];
  /** The constraint parameters (e.g. { max_discount_percent: 5 }) */
  parameters: Record<string, unknown>;
  /** Priority for conflict resolution (higher wins) */
  priority: number;
}

export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in';
  value: unknown;
}

/** A versioned snapshot of all merchant policies */
export interface PolicyGraph {
  merchant_id: string;
  version: PolicyVersionId;
  rules: PolicyRule[];
  compiled_at: string;
  /** Source natural-language text */
  source_text: string;
}

/** Status of a policy compilation attempt */
export enum PolicyCompilationStatus {
  SUCCESS = 'SUCCESS',
  AMBIGUOUS = 'AMBIGUOUS',
  INVALID = 'INVALID',
}

export interface PolicyCompilationResult {
  status: PolicyCompilationStatus;
  graph: PolicyGraph | null;
  /** Ambiguities or issues detected during compilation */
  issues: string[];
}
