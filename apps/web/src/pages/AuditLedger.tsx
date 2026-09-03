import { useEffect, useState } from 'react';
import { Search, Zap, Loader2, CheckCircle2 } from 'lucide-react';
import { fetchArray, API_BASE } from '../lib/api';

export default function AuditLedger() {
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [executingIntentId, setExecutingIntentId] = useState<string | null>(null);
  const [executionMessage, setExecutionMessage] = useState<{ id: string; text: string; success: boolean } | null>(null);

  const loadEvents = () => {
    fetchArray('/api/audit').then(setEvents);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleExecuteCheckout = async (intentId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (executingIntentId) return;
    setExecutingIntentId(intentId);
    setExecutionMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/intent/${intentId}/checkout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-merchant-id': 'merchant_1'
        }
      });
      const data = await res.json();
      if (res.ok && data.razorpay_order_id) {
        setExecutionMessage({
          id: intentId,
          text: `Order Generated: ${data.razorpay_order_id}`,
          success: true
        });
        loadEvents();
      } else {
        setExecutionMessage({
          id: intentId,
          text: data.error || 'Checkout execution completed',
          success: res.ok
        });
        loadEvents();
      }
    } catch (err: any) {
      setExecutionMessage({
        id: intentId,
        text: err.message || 'Execution failed',
        success: false
      });
    } finally {
      setExecutingIntentId(null);
    }
  };

  const filteredEvents = events.filter(e => 
    (e.event_id && e.event_id.includes(filter)) || 
    (e.intent_id && e.intent_id.includes(filter)) || 
    (e.event_type && e.event_type.toLowerCase().includes(filter.toLowerCase()))
  );

  const toggleExpand = (eventId: string) => {
    setExpandedEventId(expandedEventId === eventId ? null : eventId);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="shrink-0 flex justify-between items-end border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-display font-semibold flex items-center">
            <Search className="mr-3" size={32} />
            Audit Ledger
          </h1>
          <p className="text-text-muted mt-2">
            Immutable, append-only record of all intents, policy evaluations, and state changes.
          </p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-text-muted" />
          <input 
            type="text" 
            placeholder="Filter events or IDs..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 pr-4 py-2 bg-surface border border-border rounded-md text-sm focus:outline-none focus:border-primary w-64"
          />
        </div>
      </div>

      <div className="flex-1 border border-border rounded-lg overflow-hidden bg-surface/30 flex flex-col min-h-0">
        <div className="overflow-y-auto overflow-x-auto flex-1">
          <table className="w-full min-w-[700px] text-left text-sm relative border-collapse">
            <thead className="bg-surface/80 border-b border-border text-text-muted sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-6 py-3 font-medium">Timestamp</th>
                <th className="px-6 py-3 font-medium">Event Type</th>
                <th className="px-6 py-3 font-medium">Intent ID</th>
                <th className="px-6 py-3 font-medium">Decision</th>
                <th className="px-6 py-3 font-medium">Razorpay Order ID</th>
                <th className="px-6 py-3 font-medium">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-muted italic">
                    No audit events found.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((e) => {
                  const isExpanded = expandedEventId === e.event_id;
                  return (
                    <>
                      <tr 
                        key={e.event_id} 
                        onClick={() => toggleExpand(e.event_id)}
                        className={`hover:bg-surface/50 transition-colors cursor-pointer ${isExpanded ? 'bg-surface/40' : ''}`}
                      >
                        <td className="px-6 py-4 font-mono text-xs text-text-muted whitespace-nowrap">
                          {new Date(e.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-text-main">
                          {e.event_type}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-text-muted truncate max-w-[120px]">
                          {e.intent_id}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          <span className={
                            e.decision === 'BLOCK' || e.decision === 'REJECT' ? 'text-rose-400 font-bold' : 
                            e.decision === 'ESCALATE' ? 'text-amber-400 font-bold' :
                            e.decision === 'APPROVE' ? 'text-emerald-400 font-bold' : 
                            'text-text-muted'
                          }>
                            {e.decision || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {e.razorpay_order_id ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                              {e.razorpay_order_id}
                            </span>
                          ) : (e.decision === 'APPROVE' || e.result === 'VALIDATED' || e.result === 'READY_FOR_CHECKOUT') && e.intent_id ? (
                            <button
                              onClick={(ev) => handleExecuteCheckout(e.intent_id, ev)}
                              disabled={executingIntentId === e.intent_id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary hover:text-white font-mono text-[11px] font-semibold transition-all shadow-sm"
                              title="Execute Checkout in Razorpay Test Mode"
                            >
                              {executingIntentId === e.intent_id ? (
                                <>
                                  <Loader2 size={11} className="animate-spin" />
                                  Creating...
                                </>
                              ) : (
                                <>
                                  <Zap size={11} className="text-amber-400" />
                                  Execute Order
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-text-muted">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            e.result === 'VERIFIED_SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            e.result === 'READY_FOR_CHECKOUT' || e.result === 'VALIDATED' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                            e.result === 'ESCALATED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-surface text-text-muted'
                          }`}>
                            {e.result || '-'}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${e.event_id}-expanded`} className="bg-surface/10 border-b border-border/80">
                          <td colSpan={6} className="px-8 py-6">
                            {executionMessage && executionMessage.id === e.intent_id && (
                              <div className={`mb-4 p-3 rounded-lg text-xs font-mono flex items-center gap-2 border ${
                                executionMessage.success 
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                              }`}>
                                <CheckCircle2 size={14} className="shrink-0" />
                                <span>{executionMessage.text}</span>
                              </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                              {/* Left Column */}
                              <div className="space-y-4">
                                <div>
                                  <h4 className="text-xs font-semibold uppercase text-text-muted mb-1 tracking-wider">Buyer Request / Input</h4>
                                  <div className="p-3 bg-background/50 border border-border/50 rounded-lg text-text-main italic font-sans">
                                    "{e.buyer_input || 'No input recorded'}"
                                  </div>
                                </div>
                                
                                <div>
                                  <h4 className="text-xs font-semibold uppercase text-text-muted mb-1 tracking-wider">AI Proposed Action Details</h4>
                                  <div className="p-3 bg-background/50 border border-border/50 rounded-lg font-mono text-xs">
                                    <pre className="text-text-muted overflow-x-auto whitespace-pre-wrap">
                                      {e.parameters_json ? JSON.stringify(JSON.parse(e.parameters_json), null, 2) : '{}'}
                                    </pre>
                                  </div>
                                </div>
                              </div>

                              {/* Right Column */}
                              <div className="space-y-4">
                                <div>
                                  <h4 className="text-xs font-semibold uppercase text-text-muted mb-1 tracking-wider">Policy Gate Verdict</h4>
                                  <div className={`p-3 border rounded-lg flex items-center justify-between ${
                                    e.decision === 'BLOCK' || e.decision === 'REJECT' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' :
                                    e.decision === 'ESCALATE' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
                                    'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                  }`}>
                                    <div>
                                      <span className="font-semibold text-base block">{e.decision || 'UNKNOWN'}</span>
                                      {e.reason_codes_json && JSON.parse(e.reason_codes_json).length > 0 ? (
                                        <span className="text-xs font-mono block mt-1">
                                          Triggers: {JSON.parse(e.reason_codes_json).join(', ')}
                                        </span>
                                      ) : (
                                        <span className="text-xs block mt-1">All safety invariants checked and satisfied.</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <h4 className="text-xs font-semibold uppercase text-text-muted mb-1 tracking-wider">Razorpay Test Mode Execution</h4>
                                  <div className="p-3 bg-background/50 border border-border/50 rounded-lg space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-text-muted">Execution State:</span>
                                      <span className="font-mono font-semibold uppercase text-text-main">{e.result}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-text-muted">Razorpay Order ID:</span>
                                      <span className="font-mono text-primary font-bold">{e.razorpay_order_id || 'Not Executed / Pending Checkout'}</span>
                                    </div>

                                    {!e.razorpay_order_id && (e.decision === 'APPROVE' || e.result === 'VALIDATED' || e.result === 'READY_FOR_CHECKOUT') && e.intent_id && (
                                      <div className="pt-2 border-t border-border/40">
                                        <button
                                          onClick={(ev) => handleExecuteCheckout(e.intent_id, ev)}
                                          disabled={executingIntentId === e.intent_id}
                                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-semibold text-xs transition-colors shadow-md"
                                        >
                                          {executingIntentId === e.intent_id ? (
                                            <>
                                              <Loader2 size={13} className="animate-spin" />
                                              Calling Razorpay Test API...
                                            </>
                                          ) : (
                                            <>
                                              <Zap size={13} className="text-amber-300" />
                                              ⚡ Execute Order & Generate Razorpay Order ID
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
