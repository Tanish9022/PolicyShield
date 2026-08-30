import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Cpu, ShieldAlert, Server, Database, CreditCard, Clock, CheckCircle } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  action_state?: string;
  intent_id?: string;
  razorpay_order_id?: string;
}

export default function AiBuyer() {
  const [activeTab, setActiveTab] = useState<'chat' | 'live' | 'evidence'>('chat');
  
  const [input, setInput] = useState('');
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  const [activeAction, setActiveAction] = useState<any>(null);
  const [evidence, setEvidence] = useState<any>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatLog, activeTab]);

  const submitIntent = async (text: string) => {
    if (!text.trim() || isProcessing || checkoutLoading) return;
    
    setInput('');
    setChatLog(prev => [...prev, { role: 'user', text }]);
    setIsProcessing(true);
    
    try {
      const res = await fetch('http://localhost:3001/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: 'merchant_1',
          buyer_input: text,
          customer_id: 'cust_demo'
        })
      });
      
      const data = await res.json();
      
      let explanation = "I have processed your request.";
      if (data.action?.evidence_json) {
        try {
          const ev = JSON.parse(data.action.evidence_json);
          if (ev.recommendation?.explanation) {
            explanation = ev.recommendation.explanation;
          }
        } catch (e) {
          // ignore parsing error
        }
      }

      let responseText = `"${explanation}"`;
      
      if (data.gate_decision === 'BLOCK') {
        let reasons = "";
        if (data.action?.reason_codes_json) {
          try {
             reasons = " (" + JSON.parse(data.action.reason_codes_json).join(', ') + ")";
          } catch (e) {}
        }
        responseText = `I'm sorry, I cannot fulfill that request due to store policy.${reasons}\n\nAgent reasoning: ${explanation}`;
      }

      setChatLog(prev => [...prev, { 
        role: 'assistant', 
        text: responseText,
        action_state: data.action?.state,
        intent_id: data.action?.intent_id,
        razorpay_order_id: data.action?.razorpay_order_id
      }]);
      
      setActiveAction(data.action);
      
      if (data.action?.evidence_json) {
        setEvidence(JSON.parse(data.action.evidence_json));
      } else {
        setEvidence(null);
      }
      
    } catch (err) {
      console.error(err);
      setChatLog(prev => [...prev, { role: 'assistant', text: 'Error connecting to PolicyShield backend.' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = async (intentId: string, messageIndex: number) => {
    setCheckoutLoading(true);
    
    try {
      const res = await fetch(`http://localhost:3001/api/intent/${intentId}/checkout`, {
        method: 'POST'
      });
      const data = await res.json();
      
      setChatLog(prev => {
        const newLog = [...prev];
        newLog[messageIndex] = {
          ...newLog[messageIndex],
          action_state: data.state,
          razorpay_order_id: data.razorpay_order_id
        };
        return newLog;
      });
      
      if (activeAction?.intent_id === intentId) {
        setActiveAction((prev: any) => ({
          ...prev,
          state: data.state,
          razorpay_order_id: data.razorpay_order_id
        }));
      }
      
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend for checkout');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-500 max-w-4xl mx-auto w-full pb-10">
      <div className="shrink-0 text-center py-6">
        <h1 className="text-3xl font-display font-semibold">AI Buyer Simulator</h1>
        <p className="text-text-muted mt-1">Interact with the autonomous buyer agent.</p>
      </div>

      <div className="flex justify-center space-x-2">
        <button onClick={() => setActiveTab('chat')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'chat' ? 'bg-primary text-background' : 'bg-surface border border-border hover:bg-border'}`}>Buyer Chat</button>
        <button onClick={() => setActiveTab('live')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'live' ? 'bg-primary text-background' : 'bg-surface border border-border hover:bg-border'}`}>Live Decision</button>
        <button onClick={() => setActiveTab('evidence')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'evidence' ? 'bg-primary text-background' : 'bg-surface border border-border hover:bg-border'}`}>System Evidence</button>
      </div>

      <div className="flex-1 flex flex-col border border-border rounded-lg bg-surface/30 overflow-hidden shadow-lg relative min-h-[500px]">
        {activeTab === 'chat' && (
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {chatLog.length === 0 && (
                <div className="h-full flex items-center justify-center text-text-muted text-sm text-center">
                  Send a message or select a quick scenario to begin.
                </div>
              )}
              
              {chatLog.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-1 shadow-sm ${msg.role === 'user' ? 'bg-surface border border-border ml-3' : 'bg-primary-muted border border-primary/30 text-primary mr-3'}`}>
                      {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                    </div>
                    
                    <div className="flex flex-col space-y-2">
                      <div className={`p-4 rounded-xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-text-main text-background rounded-tr-sm' : 'bg-surface border border-border rounded-tl-sm'}`}>
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      </div>
                      
                      {msg.role === 'assistant' && msg.action_state === 'READY_FOR_CHECKOUT' && msg.intent_id && (
                        <div className="pt-2">
                          <button
                            onClick={() => handleCheckout(msg.intent_id!, idx)}
                            disabled={checkoutLoading || isProcessing}
                            className="bg-emerald-500 text-background px-6 py-2.5 rounded-lg font-bold text-sm flex items-center hover:bg-emerald-400 shadow-sm transition-colors disabled:opacity-50"
                          >
                            {checkoutLoading ? <Clock className="animate-spin mr-2" size={16} /> : <CreditCard className="mr-2" size={16} />}
                            Confirm Checkout
                          </button>
                        </div>
                      )}
                      
                      {msg.role === 'assistant' && (msg.action_state === 'VERIFIED_SUCCESS' || msg.razorpay_order_id) && (
                        <div className="pt-2">
                          <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg text-sm">
                            <CheckCircle size={16} />
                            <span className="font-semibold">Order Successful!</span>
                            {msg.razorpay_order_id && (
                              <span className="font-mono text-xs opacity-75 ml-2 border-l border-emerald-500/30 pl-2">
                                ID: {msg.razorpay_order_id}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            <div className="p-4 border-t border-border bg-surface/80 backdrop-blur">
              <div className="flex flex-wrap gap-2 mb-4 justify-center">
                {['Buy the best laptop', 'Buy laptop with 20% discount', 'Buy 5 laptops', 'Buy a phone'].map(scenario => (
                  <button 
                    key={scenario}
                    onClick={() => submitIntent(scenario)}
                    disabled={isProcessing || checkoutLoading}
                    className="px-3 py-1.5 bg-background border border-border rounded-full text-xs font-medium hover:bg-surface hover:text-primary transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {scenario}
                  </button>
                ))}
              </div>
              <form 
                onSubmit={(e) => { e.preventDefault(); submitIntent(input); }}
                className="flex space-x-3"
              >
                <input 
                  type="text" 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type your intent here..."
                  className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-sm text-text-main focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                  disabled={isProcessing || checkoutLoading}
                />
                <button 
                  type="submit"
                  disabled={isProcessing || checkoutLoading || !input.trim()}
                  className="bg-primary text-background px-5 rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center"
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'live' && (
          <div className="absolute inset-0 p-6 overflow-y-auto bg-[url('/grid.svg')] bg-center">
            {!activeAction ? (
              <div className="h-full flex items-center justify-center text-text-muted text-sm text-center">
                No active transaction. Start a chat first.
              </div>
            ) : (
              <div className="space-y-6 max-w-xl mx-auto relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                     <User size={16} className="text-text-muted" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-background shadow-sm">
                    <span className="text-xs font-mono text-text-muted mb-1 block">1. INTENT</span>
                    <div className="text-sm">{activeAction.action_type || 'Unknown Action'}</div>
                  </div>
                </div>

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-primary/30 bg-primary-muted shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                     <Cpu size={16} className="text-primary" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-primary/20 bg-primary-muted/10 shadow-sm">
                    <span className="text-xs font-mono text-primary mb-1 block">2. GEMINI PROPOSAL</span>
                    <div className="font-mono text-xs overflow-hidden text-ellipsis whitespace-nowrap">
                       {activeAction.parameters_json}
                    </div>
                  </div>
                </div>

                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${activeAction.decision === 'BLOCK' ? 'border-rose-500 bg-rose-500/20' : 'border-emerald-500 bg-emerald-500/20'}`}>
                     <ShieldAlert size={16} className={activeAction.decision === 'BLOCK' ? 'text-rose-500' : 'text-emerald-500'} />
                  </div>
                  <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border shadow-sm ${activeAction.decision === 'BLOCK' ? 'border-rose-500/50 bg-rose-500/10' : 'border-emerald-500/50 bg-emerald-500/10'}`}>
                    <span className={`text-xs font-mono mb-1 block ${activeAction.decision === 'BLOCK' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      3. POLICY GATE
                    </span>
                    <div className="text-sm font-bold">
                       {activeAction.decision}
                    </div>
                    {activeAction.decision === 'BLOCK' && activeAction.reason_codes_json && (
                      <div className="text-xs font-mono mt-2 text-rose-300">
                        {JSON.parse(activeAction.reason_codes_json).join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {activeAction.decision !== 'BLOCK' && (
                  <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                       <Server size={16} className="text-text-muted" />
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-background shadow-sm">
                      <span className="text-xs font-mono text-text-muted mb-1 block">4. EXECUTION</span>
                      <StatusBadge status={activeAction.state} />
                      {activeAction.razorpay_order_id && (
                        <div className="text-xs font-mono mt-2 text-text-muted truncate">
                          ID: {activeAction.razorpay_order_id}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="absolute inset-0 p-6 overflow-y-auto">
            {!evidence ? (
               <div className="h-full flex flex-col items-center justify-center text-text-muted text-sm text-center">
                 <Database size={32} className="mb-2 opacity-50" />
                 No evidence available. Start a chat first.
               </div>
            ) : (
              <div className="space-y-4 max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-text-main">System Evidence payload</h3>
                  {activeAction?.policy_version && (
                    <span className="px-2 py-0.5 rounded bg-surface border border-border text-xs font-mono text-text-muted">
                      {activeAction.policy_version}
                    </span>
                  )}
                </div>
                {Object.entries(evidence).map(([key, val]) => (
                  <div key={key} className="border border-border rounded-md bg-background overflow-hidden">
                    <div className="bg-surface/50 px-3 py-2 border-b border-border text-xs font-mono font-bold text-text-muted uppercase">
                      {key}
                    </div>
                    <div className="p-4">
                      <pre className="text-xs font-mono text-text-main overflow-x-auto">
                        {JSON.stringify(val, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
