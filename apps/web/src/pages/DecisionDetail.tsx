import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, ShieldCheck, ShieldAlert, Database } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { API_BASE } from '../lib/api';

export default function DecisionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<{action: any, audit_events: any[]} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/decisions/${id}`)
      .then(res => res.json())
      .then(resData => {
        if (!resData.error) setData(resData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-text-muted animate-pulse">Loading decision data...</div>;
  if (!data) return <div className="p-8 text-rose-500">Decision not found.</div>;

  const { action, audit_events } = data;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-10">
      
      <button onClick={() => navigate(-1)} className="flex items-center text-text-muted hover:text-text-main transition-colors text-sm">
        <ArrowLeft size={16} className="mr-2" /> Back
      </button>

      <div className="flex justify-between items-start border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-display font-semibold flex items-center">
            Decision <span className="text-text-muted ml-3 font-mono text-xl">{action.action_id}</span>
          </h1>
          <p className="text-text-muted mt-2 max-w-2xl">{action.buyer_input}</p>
        </div>
        <div className="flex flex-col items-end space-y-2">
          <StatusBadge status={action.state} />
          <span className="text-xs font-mono text-text-muted">{new Date(action.created_at).toLocaleString()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left: Timeline */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-xl font-display font-medium">Execution Timeline</h2>
          
          <div className="space-y-0 relative before:absolute before:inset-0 before:ml-[1.4rem] before:h-full before:w-px before:bg-border">
            
            {audit_events.map((event) => (
              <div key={event.event_id} className="relative pl-12 py-4">
                <div className={`absolute left-4 top-5 w-3 h-3 rounded-full border border-background shadow-sm -translate-x-1.5 
                  ${event.event_type.includes('FAIL') || event.event_type.includes('BLOCK') ? 'bg-rose-500' : 
                    event.event_type.includes('SUCCESS') || event.event_type.includes('VERIFIED') ? 'bg-emerald-500' : 'bg-primary'}`} 
                />
                
                <div className="bg-surface/30 border border-border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono text-sm font-semibold tracking-wide text-text-main">
                      {event.event_type}
                    </span>
                    <span className="text-xs font-mono text-text-muted flex items-center">
                      <Clock size={12} className="mr-1" />
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {event.decision && (
                    <div className="mt-2 text-sm">
                      <span className="text-text-muted">Decision: </span>
                      <span className={event.decision === 'BLOCK' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>{event.decision}</span>
                    </div>
                  )}

                  {event.result && (
                     <div className="mt-2 text-sm">
                      <span className="text-text-muted">Result: </span>
                      <span className="font-mono">{event.result}</span>
                    </div>
                  )}
                  
                  {event.metadata_json && event.metadata_json !== '{}' && (
                    <div className="mt-3 bg-background border border-border rounded p-2 overflow-x-auto">
                      <pre className="text-[10px] font-mono text-text-muted">
                        {JSON.stringify(JSON.parse(event.metadata_json), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Meta & Evidence */}
        <div className="space-y-6">
          <div className="bg-surface/30 border border-border rounded-lg p-5">
            <h3 className="font-medium mb-4 flex items-center text-sm">
              <Database size={16} className="mr-2 text-text-muted" /> Transaction Meta
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-text-muted block text-xs">Intent ID</span>
                <span className="font-mono">{action.intent_id}</span>
              </div>
              <div>
                <span className="text-text-muted block text-xs">Customer ID</span>
                <span className="font-mono">{action.customer_id}</span>
              </div>
              <div>
                <span className="text-text-muted block text-xs">Policy Version</span>
                <span className="font-mono text-primary">{action.policy_version}</span>
              </div>
              <div>
                <span className="text-text-muted block text-xs">Idempotency Key</span>
                <span className="font-mono break-all">{action.idempotency_key}</span>
              </div>
              {action.action_type === 'APPLY_DISCOUNT' && action.evidence_json && (
                <div>
                  <span className="text-text-muted block text-xs">Razorpay Execution</span>
                  <span className="font-mono text-amber-400">NOT INVOKED (Local Mutation)</span>
                </div>
              )}
              {action.razorpay_order_id && (
                <div>
                  <span className="text-text-muted block text-xs">Razorpay Order ID</span>
                  <span className="font-mono text-emerald-400">{action.razorpay_order_id}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-surface/30 border border-border rounded-lg p-5">
             <h3 className="font-medium mb-4 text-sm">AI Recommendation</h3>
             <pre className="text-[10px] font-mono text-text-main bg-background border border-border p-3 rounded overflow-x-auto">
               {(() => { try { return JSON.stringify(JSON.parse(action.parameters_json), null, 2); } catch { return action.parameters_json || '{}'; } })()}
             </pre>
          </div>
          
          {action.action_type === 'APPLY_DISCOUNT' && action.evidence_json && JSON.parse(action.evidence_json).discount_metadata && (
            <div className="bg-surface/30 border border-border rounded-lg p-5">
              <h3 className="font-medium mb-4 text-sm flex items-center">
                <ShieldCheck size={16} className="mr-2 text-primary" /> Authority Precedence
              </h3>
              {(() => {
                const dm = JSON.parse(action.evidence_json).discount_metadata;
                return (
                  <div className="space-y-4 text-sm font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">1. Merchant Policy Limit</span>
                      <span className="text-emerald-400 font-bold">{dm.policy_max_discount}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-muted">2. Promotion Availability</span>
                      <span className="text-blue-400">{dm.promotion_max_discount}%</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="text-text-muted">3. Buyer Requested</span>
                      <span className="text-amber-400">{dm.requested_discount}%</span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="font-bold">Final Permitted</span>
                      <span className="text-primary font-bold">{dm.final_discount}%</span>
                    </div>
                    <div className="text-[11px] font-sans text-text-muted mt-4 bg-background border border-border p-3 rounded">
                      <span className="text-emerald-400 font-semibold mb-1 block">MERCHANT POLICY &gt; PROMOTION &gt; BUYER REQUEST</span>
                      Promotion availability does not override merchant policy constraints.
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          <div className="bg-surface/30 border border-border rounded-lg p-5">
             <h3 className="font-medium mb-4 text-sm">Policy Gate Verification</h3>
             {action.state === 'ESCALATED' || action.decision === 'ESCALATE' ? (
                <div className="flex flex-col text-amber-400 text-sm">
                  <div className="flex items-start">
                    <ShieldAlert size={16} className="mr-2 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-bold block mb-1">Human Review Required</span>
                      <span className="text-amber-300 font-mono text-xs">Exceeded automated approval thresholds.</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-amber-900/30 flex space-x-3">
                    <button className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded border border-emerald-500/50 transition-colors text-xs font-semibold">
                      Approve & Execute
                    </button>
                    <button className="px-3 py-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded border border-rose-500/50 transition-colors text-xs font-semibold">
                      Reject Action
                    </button>
                  </div>
                </div>
             ) : action.decision === 'BLOCK' ? (
                <div className="flex items-start text-rose-400 text-sm">
                  <ShieldAlert size={16} className="mr-2 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold block mb-1">Execution Blocked</span>
                    <span className="text-rose-300 font-mono text-xs">{action.reason_codes_json ? JSON.parse(action.reason_codes_json).join(', ') : 'Policy Violated'}</span>
                  </div>
                </div>
             ) : (
               <div className="flex items-center text-emerald-400 text-sm">
                  <ShieldCheck size={16} className="mr-2 shrink-0" />
                  <span className="font-bold">Policy Constraints Satisfied</span>
                </div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
}
