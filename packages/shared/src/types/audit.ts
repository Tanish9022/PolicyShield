// ─── Audit Types ────────────────────────────────────────────────

/** Immutable audit event recorded for every important decision */
export interface AuditEvent {
  event_id: string;
  event_type: AuditEventType;
  intent_id: string;
  action_id: string;
  policy_version: string;
  model_version: string;
  decision: string;
  policy_ids: string[];
  evidence_refs: string[];
  action_type: string;
  result: string;
  /** Additional structured metadata */
  metadata: Record<string, unknown>;
  timestamp: string;
}

export enum AuditEventType {
  INTENT_RECEIVED = 'INTENT_RECEIVED',
  CONTEXT_FETCHED = 'CONTEXT_FETCHED',
  AGENT_RECOMMENDATION = 'AGENT_RECOMMENDATION',
  GATE_DECISION = 'GATE_DECISION',
  ACTION_EXECUTED = 'ACTION_EXECUTED',
  VERIFICATION_RESULT = 'VERIFICATION_RESULT',
  EXECUTION_RECOVERY = 'EXECUTION_RECOVERY',
  ESCALATION = 'ESCALATION',
  POLICY_COMPILED = 'POLICY_COMPILED',
}

/** Recovery event for EXECUTION_UNKNOWN resolution */
export interface RecoveryEvent {
  event_type: 'EXECUTION_RECOVERY';
  request_id: string;
  intent_id: string;
  action_id: string;
  previous_state: string;
  verification_source: string;
  verification_result: 'FOUND' | 'NOT_FOUND' | 'UNKNOWN';
  retry_allowed: boolean;
  retry_reason: string;
  timestamp: string;
}
