// ─── State Constants ────────────────────────────────────────────
// Transaction state machine values from ARCHITECTURE.md.

export const STATES = {
  PROPOSED: 'PROPOSED',
  VALIDATED: 'VALIDATED',
  BLOCKED: 'BLOCKED',
  EXECUTING: 'EXECUTING',
  EXECUTION_UNKNOWN: 'EXECUTION_UNKNOWN',
  VERIFYING: 'VERIFYING',
  RETRY_ELIGIBLE: 'RETRY_ELIGIBLE',
  VERIFIED_SUCCESS: 'VERIFIED_SUCCESS',
  VERIFIED_FAILURE: 'VERIFIED_FAILURE',
  ESCALATED: 'ESCALATED',
} as const;

export type State = (typeof STATES)[keyof typeof STATES];

/** Valid state transitions */
export const STATE_TRANSITIONS: Record<string, string[]> = {
  [STATES.PROPOSED]: [STATES.VALIDATED, STATES.ESCALATED],
  [STATES.VALIDATED]: [STATES.BLOCKED, STATES.EXECUTING, STATES.ESCALATED],
  [STATES.EXECUTING]: [
    STATES.EXECUTION_UNKNOWN,
    STATES.VERIFIED_SUCCESS,
    STATES.VERIFIED_FAILURE,
  ],
  [STATES.EXECUTION_UNKNOWN]: [STATES.VERIFYING],
  [STATES.VERIFYING]: [
    STATES.VERIFIED_SUCCESS,
    STATES.VERIFIED_FAILURE,
    STATES.ESCALATED,
  ],
  [STATES.VERIFIED_FAILURE]: [STATES.RETRY_ELIGIBLE],
  [STATES.RETRY_ELIGIBLE]: [STATES.EXECUTING],
};

/** Check if a state transition is valid */
export function isValidTransition(from: string, to: string): boolean {
  const allowed = STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
