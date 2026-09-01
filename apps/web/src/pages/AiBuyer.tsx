import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Bot, User, Shield, CheckCircle, CreditCard,
  Zap, AlertTriangle, ChevronRight
} from 'lucide-react';

// ─── Constants ───────────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MERCHANT_ID = 'merchant_1';
const CUSTOMER_ID = 'cust_demo';

const HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'x-merchant-id': MERCHANT_ID,
  'x-customer-id': CUSTOMER_ID,
};

// ─── Types ───────────────────────────────────────────────────────
interface ChatMsg {
  role: 'user' | 'agent';
  text: string;
  runId?: string;
  intentId?: string;
  ts: number;
}

interface AgentEvent {
  sequence: number;
  event: string;
  payload: any;
  timestamp: string;
}

interface RunState {
  run_id: string;
  intent_id: string;
  state: string;
  current_step: string;
  adaptation_count: number;
  last_event_sequence: number;
  candidates: any[];
  proposal: any;
  buyer_memory: any;
  action: any | null;
  policy_version: string;
}

// ─── Event colour palette ─────────────────────────────────────────
const EVENT_META: Record<string, { color: string; dot: string; label: string }> = {
  INTENT_RECEIVED:   { color: 'text-blue-300',   dot: '#93C5FD', label: 'Intent Received' },
  DISCOVER:          { color: 'text-violet-300',  dot: '#C4B5FD', label: 'Discovery' },
  COMPARE:           { color: 'text-violet-300',  dot: '#C4B5FD', label: 'Comparison' },
  PROPOSE:           { color: 'text-yellow-300',  dot: '#FDE68A', label: 'LLM Proposal' },
  POLICY_REJECT:     { color: 'text-rose-300',    dot: '#FCA5A5', label: 'Policy Reject' },
  ADAPT:             { color: 'text-orange-300',  dot: '#FDBA74', label: 'Adaptation' },
  POLICY_APPROVE:    { color: 'text-emerald-300', dot: '#6EE7B7', label: 'Policy Approve ✓' },
  JIT_VALIDATE:      { color: 'text-teal-300',    dot: '#5EEAD4', label: 'JIT Validate' },
  JIT_FAILED:        { color: 'text-rose-300',    dot: '#FCA5A5', label: 'JIT Failed' },
  PAYMENT_CREATE:    { color: 'text-indigo-300',  dot: '#A5B4FC', label: 'Payment Create' },
  PAYMENT_FAILED:    { color: 'text-rose-400',    dot: '#F87171', label: 'Payment Failed' },
  VERIFIED_SUCCESS:  { color: 'text-emerald-300', dot: '#6EE7B7', label: 'Verified ✓' },
  VERIFIED_FAILURE:  { color: 'text-rose-300',    dot: '#FCA5A5', label: 'Verified Failed' },
  EXECUTION_UNKNOWN: { color: 'text-amber-300',   dot: '#FCD34D', label: 'Awaiting Webhook' },
  PAYMENT_VERIFY:    { color: 'text-teal-300',    dot: '#5EEAD4', label: 'Verifying' },
};

// ─── Helpers ──────────────────────────────────────────────────────
function getEventMeta(event: string) {
  return EVENT_META[event] ?? { color: 'text-white/50', dot: '#6B7280', label: event };
}

function StateChip({ state }: { state: string }) {
  const s = state.toLowerCase();
  const isGood = ['completed', 'verified_success', 'ready_for_checkout'].some(x => s.includes(x));
  const isBad  = ['failed', 'blocked'].some(x => s.includes(x));
  const isBusy = !isGood && !isBad;

  const cls = isGood
    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
    : isBad
    ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
    : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cls}`}>
      <span
        className={`w-1.5 h-1.5 rounded-full ${isBusy ? 'pulse-live' : ''}`}
        style={{
          background: isGood ? '#34d399' : isBad ? '#f87171' : '#818cf8',
          boxShadow: isGood ? '0 0 4px #34d399' : isBad ? '0 0 4px #f87171' : '0 0 4px #818cf8'
        }}
      />
      {state}
    </span>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─── EventRow ─────────────────────────────────────────────────────
function EventRow({ evt }: { evt: AgentEvent }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getEventMeta(evt.event);
  const hasPayload = Object.keys(evt.payload || {}).length > 0;

  return (
    <div
      className="event-enter border border-white/5 rounded-xl overflow-hidden"
      style={{ background: 'rgba(15,15,22,0.8)' }}
    >
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left btn-press"
        onClick={() => hasPayload && setExpanded(e => !e)}
        disabled={!hasPayload}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: meta.dot, boxShadow: `0 0 5px ${meta.dot}` }}
        />
        <span className="text-[10px] text-white/25 font-code w-4 shrink-0">#{evt.sequence}</span>
        <span className={`text-[11px] font-semibold font-code tracking-wide flex-1 ${meta.color}`}>
          {meta.label}
        </span>
        <span className="text-[10px] text-white/20 font-code shrink-0">
          {new Date(evt.timestamp).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        {hasPayload && (
          <ChevronRight
            size={12}
            className={`text-white/20 transition-transform duration-150 shrink-0 ${expanded ? 'rotate-90' : ''}`}
          />
        )}
      </button>

      {expanded && hasPayload && (
        <div className="border-t border-white/5 px-3 py-3">
          <pre className="font-code text-[10px] text-white/50 overflow-x-auto leading-relaxed">
            {JSON.stringify(evt.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function AiBuyer() {
  const [input, setInput]               = useState('');
  const [chat, setChat]                 = useState<ChatMsg[]>([]);
  const [isRunning, setIsRunning]       = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const [runState, setRunState]   = useState<RunState | null>(null);
  const [events, setEvents]       = useState<AgentEvent[]>([]);

  // Refs — stable across re-renders
  const hasRespondedRef  = useRef(false);
  const activeRunIdRef   = useRef<string | null>(null);
  const evtSourceRef     = useRef<EventSource | null>(null);
  const chatEndRef       = useRef<HTMLDivElement>(null);
  const eventsEndRef     = useRef<HTMLDivElement>(null);
  const inputRef         = useRef<HTMLInputElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);
  useEffect(() => { eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [events]);

  // ── SSE stream listener ──────────────────────────────────────────
  const openStream = useCallback((runId: string) => {
    // Close any existing stream
    evtSourceRef.current?.close();

    // SSE requires GET, so auth headers go as query params (standard pattern)
    const url = new URL(`${API}/api/v1/runs/${runId}/stream`);
    url.searchParams.set('x-merchant-id', MERCHANT_ID);
    url.searchParams.set('x-customer-id', CUSTOMER_ID);

    const es = new EventSource(url.toString());
    evtSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === 'event') {
          setEvents(prev => {
            // deduplicate by sequence
            if (prev.some(x => x.sequence === msg.payload.sequence)) return prev;
            return [...prev, msg.payload as AgentEvent];
          });
        }

        if (msg.type === 'state') {
          setRunState(msg.payload as RunState);
        }

        if (msg.type === 'done') {
          const finalState: string = msg.payload.state;
          es.close();
          evtSourceRef.current = null;

          if (!hasRespondedRef.current) {
            hasRespondedRef.current = true;
            setIsRunning(false);

            const text = finalState === 'BLOCKED'
              ? 'Request blocked by policy gate. The constraint rules were not satisfied.'
              : finalState === 'FAILED'
              ? 'The agent run failed. Check the event log for details.'
              : finalState === 'ESCALATED'
              ? 'This request has been escalated for human review.'
              : 'I found a match that passed all policy checks. Ready for checkout when you are.';

            setChat(prev => [...prev, {
              role: 'agent', text, ts: Date.now(),
              runId, intentId: msg.payload.intent_id
            }]);
          }
        }
      } catch {
        // malformed SSE message — ignore
      }
    };

    es.onerror = () => {
      // SSE auto-reconnects on transient errors — only hard-close on explicit done
      console.warn('[SSE] Connection error — browser will retry');
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { evtSourceRef.current?.close(); };
  }, []);

  // ── Submit intent ─────────────────────────────────────────────────
  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isRunning || checkoutBusy) return;

    setInput('');
    setIsRunning(true);
    setRunState(null);
    setEvents([]);
    hasRespondedRef.current = false;
    activeRunIdRef.current = null;
    evtSourceRef.current?.close();

    setChat(prev => [...prev, { role: 'user', text: trimmed, ts: Date.now() }]);

    try {
      const res = await fetch(`${API}/api/intent`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ buyer_input: trimmed }),
      });

      if (res.status === 202) {
        const data = await res.json();
        activeRunIdRef.current = data.run_id;
        openStream(data.run_id);
      } else {
        const err = await res.json().catch(() => ({}));
        setChat(prev => [...prev, {
          role: 'agent',
          text: `Error: ${err.error || res.statusText}`,
          ts: Date.now()
        }]);
        setIsRunning(false);
      }
    } catch (err) {
      setChat(prev => [...prev, { role: 'agent', text: 'Cannot reach backend.', ts: Date.now() }]);
      setIsRunning(false);
    }

    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ── Checkout ───────────────────────────────────────────────────
  const checkout = async (intentId: string, msgIndex: number) => {
    setCheckoutBusy(true);
    try {
      const res = await fetch(`${API}/api/intent/${intentId}/checkout`, {
        method: 'POST', headers: HEADERS
      });
      const data = await res.json();

      if (res.ok) {
        setChat(prev => {
          const next = [...prev];
          next[msgIndex] = {
            ...next[msgIndex],
            text: `Order placed. Razorpay ID: ${data.razorpay_order_id || data.external_receipt}`
          };
          return next;
        });
        // Re-open SSE stream to get VERIFIED_SUCCESS from webhook
        if (activeRunIdRef.current) openStream(activeRunIdRef.current);
      } else {
        alert(`Checkout failed: ${data.error || 'Unknown error'}`);
      }
    } catch {
      alert('Cannot reach backend for checkout');
    } finally {
      setCheckoutBusy(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col gap-4" style={{ maxHeight: 'calc(100vh - 8rem)' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">AI Buyer Console</h1>
          <p className="text-sm text-white/30 mt-0.5">
            Every state rendered from backend events — frontend never infers
          </p>
        </div>
        {runState && (
          <div className="flex items-center gap-2 pt-1">
            <StateChip state={runState.state} />
            {runState.adaptation_count > 0 && (
              <span className="text-[11px] text-amber-400/70 font-code">
                {runState.adaptation_count}× adapted
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── 3-Zone Grid ───────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-[1fr_360px_280px] gap-4 min-h-0">

        {/* LEFT — Buyer Chat ─────────────────────────────────── */}
        <div className="glass rounded-2xl flex flex-col overflow-hidden min-h-0">
          <div className="shrink-0 flex items-center gap-2.5 px-5 py-3.5 border-b border-white/5">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <User size={12} className="text-indigo-300" />
            </div>
            <span className="text-sm font-semibold text-white/70 tracking-wide uppercase">Buyer Interface</span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
            {chat?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-white/20">
                <Bot size={32} strokeWidth={1.5} />
                <span className="text-base">Send an intent to begin</span>
              </div>
            ) : (
              chat?.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'agent' && (
                    <div className="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Shield size={13} className="text-indigo-400" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2 max-w-[82%]">
                    <div
                      className={`px-4 py-3 rounded-2xl text-base leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-white/8 text-white/90 rounded-tr-sm'
                          : 'bg-indigo-500/8 border border-indigo-500/15 text-white/80 rounded-tl-sm'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Checkout CTA */}
                    {msg.role === 'agent' && msg.intentId && runState?.state === 'READY_FOR_CHECKOUT' && (
                      <button
                        onClick={() => checkout(msg.intentId!, i)}
                        disabled={checkoutBusy || isRunning}
                        className="self-start btn-press flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                          bg-emerald-500 text-black hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20
                          disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {checkoutBusy ? <Spinner /> : <CreditCard size={14} />}
                        Confirm Checkout
                      </button>
                    )}

                    {/* Success chip */}
                    {msg.role === 'agent' && runState?.state === 'COMPLETED' && msg.runId === runState.run_id && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 self-start">
                        <CheckCircle size={13} className="text-emerald-400" />
                        <span className="text-xs text-emerald-300 font-medium">Order verified</span>
                      </div>
                    )}

                    {/* Failed chip */}
                    {msg.role === 'agent' && (runState?.state === 'FAILED' || runState?.state === 'BLOCKED') && msg.runId === runState?.run_id && (
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 self-start">
                        <AlertTriangle size={13} className="text-rose-400" />
                        <span className="text-xs text-rose-300 font-medium">{runState?.state}</span>
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-white/8 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                      <User size={13} className="text-white/50" />
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Thinking indicator */}
            {isRunning && (
              <div className="flex gap-3 justify-start">
                <div className="w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield size={13} className="text-indigo-400" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-indigo-500/8 border border-indigo-500/15 flex items-center gap-2">
                  <Spinner />
                  <span className="text-base text-white/40">
                    {runState ? (runState.current_step ?? 'processing').replace(/_/g, ' ').toLowerCase() : 'processing...'}
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-white/5 p-4">
            <div className="flex flex-wrap gap-2 mb-3">
              {[
                'Best laptop under ₹80,000',
                'Laptop with 20% discount',
                'Buy 5 laptops for the team',
              ].map(s => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  disabled={isRunning || checkoutBusy}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/40 border border-white/8
                    hover:text-white/70 hover:border-white/20 btn-press transition-colors disabled:opacity-30"
                >
                  {s}
                </button>
              ))}
            </div>

            <form onSubmit={e => { e.preventDefault(); submit(input); }} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Describe what you want to buy..."
                disabled={isRunning || checkoutBusy}
                className="flex-1 bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-black
                  placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-2
                  focus:ring-indigo-500/20 transition-all disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={isRunning || checkoutBusy || !input.trim()}
                className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center btn-press
                  hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/20
                  disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isRunning ? <Spinner /> : <Send size={15} className="text-white" />}
              </button>
            </form>
          </div>
        </div>

        {/* MIDDLE — Immutable Event Log ─────────────────────── */}
        <div
          className="rounded-2xl flex flex-col overflow-hidden min-h-0"
          style={{ background: 'rgba(9,9,13,0.95)', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div className="shrink-0 flex items-center justify-between px-4 py-3.5 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                <Zap size={12} className="text-emerald-400" />
              </div>
              <span className="text-sm font-semibold text-white/60 tracking-wide uppercase">Event Log</span>
            </div>
            <div className="flex items-center gap-2">
              {isRunning && (
                <span className="text-[10px] text-emerald-400/60 font-code flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 pulse-live" />
                  live
                </span>
              )}
              {events.length > 0 && (
                <span className="text-[10px] font-code text-white/20">{events.length} events</span>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
            {events?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-white/15">
                <Zap size={24} strokeWidth={1.5} />
                <span className="text-[12px] font-code">Awaiting events...</span>
              </div>
            ) : (
              events?.map(evt => <EventRow key={evt.sequence} evt={evt} />)
            )}
            <div ref={eventsEndRef} />
          </div>
        </div>

        {/* RIGHT — Agent State ───────────────────────────────── */}
        <div className="glass rounded-2xl flex flex-col overflow-hidden min-h-0">
          <div className="shrink-0 flex items-center gap-2.5 px-4 py-3.5 border-b border-white/5">
            <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <Shield size={12} className="text-blue-400" />
            </div>
            <span className="text-sm font-semibold text-white/60 tracking-wide uppercase">Agent State</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 text-[12px]">
            {!runState ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-white/15">
                <Shield size={24} strokeWidth={1.5} />
                <span className="font-code text-[11px]">No active run</span>
              </div>
            ) : (
              <>
                {/* Execution */}
                <div className="bg-white/3 border border-white/5 rounded-xl p-3 space-y-2">
                  <div className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">Execution</div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/40">State</span>
                    <StateChip state={runState.state} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/40">Step</span>
                    <span className="font-code text-white/60">{runState.current_step}</span>
                  </div>
                  {runState.adaptation_count > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Adaptations</span>
                      <span className="font-code text-amber-300">{runState.adaptation_count}×</span>
                    </div>
                  )}
                  {runState.policy_version && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/40">Policy</span>
                      <span className="font-code text-white/30 text-[10px]">{runState.policy_version}</span>
                    </div>
                  )}
                </div>

                {/* Candidates */}
                {runState.candidates?.length > 0 && (
                  <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 space-y-2">
                    <div className="text-[10px] font-semibold text-emerald-400/60 uppercase tracking-widest">Candidates</div>
                    {runState.candidates?.map((c: any, i: number) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-white/60 truncate mr-2">{c.name}</span>
                        <span className="font-code text-emerald-300 shrink-0">
                          ₹{(c.base_price / 100).toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* LLM Proposal */}
                {runState.proposal && (
                  <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-xl p-3 space-y-2">
                    <div className="text-[10px] font-semibold text-indigo-400/60 uppercase tracking-widest">LLM Proposal</div>
                    <pre className="font-code text-[10px] text-white/40 overflow-x-auto leading-relaxed">
                      {JSON.stringify(runState.proposal, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Policy violations */}
                {runState.action?.reason_codes?.length > 0 && (
                  <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 space-y-1.5">
                    <div className="text-[10px] font-semibold text-rose-400/60 uppercase tracking-widest">Policy Violations</div>
                    {runState.action.reason_codes?.map((r: string, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <AlertTriangle size={11} className="text-rose-400/60 shrink-0" />
                        <span className="font-code text-rose-300/70">{r}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payment confirmed */}
                {runState.action?.razorpay_order_id && (
                  <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 space-y-1.5">
                    <div className="text-[10px] font-semibold text-emerald-400/60 uppercase tracking-widest">Payment</div>
                    <div className="flex items-center gap-2">
                      <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                      <span className="font-code text-[10px] text-emerald-300/70 break-all">
                        {runState.action.razorpay_order_id}
                      </span>
                    </div>
                  </div>
                )}

                {/* Buyer memory */}
                {runState.buyer_memory && (
                  <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-3 space-y-2">
                    <div className="text-[10px] font-semibold text-purple-400/60 uppercase tracking-widest">Buyer Memory</div>
                    {Object.entries(runState.buyer_memory.preferences || {}).length === 0 ? (
                      <span className="text-white/25 font-code">No preferences stored</span>
                    ) : (
                      Object.entries(runState.buyer_memory.preferences || {})?.map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between gap-2">
                          <span className="text-white/30 font-code truncate">{k}</span>
                          <span className="text-purple-300/70 font-code text-[10px]">{String(v)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
