// ─── Decision Constants ─────────────────────────────────────────
// Canonical values for the four gate decisions.

export const DECISIONS = {
  APPROVE: 'APPROVE',
  MODIFY: 'MODIFY',
  REJECT: 'REJECT',
  ESCALATE: 'ESCALATE',
} as const;

export type Decision = (typeof DECISIONS)[keyof typeof DECISIONS];
