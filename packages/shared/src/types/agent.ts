import { IntentId, MerchantId } from './intent';
import { AgentState } from '../constants/states';

export type AgentRunId = string & { readonly __brand: 'AgentRunId' };
export type TraceId = string & { readonly __brand: 'TraceId' };

export interface AgentRun {
  agent_run_id: AgentRunId;
  intent_id: IntentId;
  merchant_id: MerchantId;
  state: AgentState;
  current_step: string;
  policy_version?: string;
  selected_product_id?: string;
  selected_action_id?: string;
  adaptation_count: number;
  trace_id: TraceId;
  trace_events: TraceEvent[];
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface TraceEvent {
  step: string;
  timestamp: string;
  duration_ms: number;
  status: 'SUCCESS' | 'FAILED' | 'ESCALATED' | 'REJECTED' | 'UNKNOWN' | 'PENDING';
  reason?: string;
  metadata?: any;
}

export interface ProductCandidate {
  product_id: string;
  name: string;
  price: number;
  inventory: number;
  promotion?: any;
  shipping: any[];
  eligibility: string[];
}

export interface BuyerDecision {
  decision: string;
  selected_product_id?: string;
  reasoning_evidence: string[];
  proposed_action?: any;
  next_step?: string;
}
