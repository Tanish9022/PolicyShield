import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Cpu, ShieldAlert, Key, Server, Database } from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';

export default function AiBuyer() {
  const [input, setInput] = useState('');
  const [chatLog, setChatLog] = useState<{role: 'user' | 'assistant', text: string}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // State from the transaction
  const [activeAction, setActiveAction] = useState<any>(null);
  const [evidence, setEvidence] = useState<any>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  const submitIntent = async (text: string) => {
    if (!text.trim() || isProcessing) return;
    
    setInput('');
    setChatLog(prev => [...prev, { role: 'user', text }]);
    setIsProcessing(true);
    
    try {
      const res = await fetch('http://localhost:3001/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: 'MERCH_1',
          buyer_input: text,
          customer_id: 'CUST_001'
        })
      });
      
      const data = await res.json();

      let responseText = data.recommendation?.explanation || "I have processed your request.";
      if (data.gate_decision === 'BLOCK') {
        responseText = "I'm sorry, I cannot fulfill that request due to store policy. " + (data.recommendation?.explanation || "");
      } else if (data.action?.razorpay_order_id) {
        responseText += ` (Order ID: ${data.action.razorpay_order_id})`;
      }

      setChatLog(prev => [...prev, { 
        role: 'assistant', 
        text: responseText
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

  const handleQuickAction = (text: string) => {
    submitIntent(text);
  };

  return (
    <div className="h-full flex flex-col space-y-4 animate-in fade-in duration-500">
      <div className="shrink-0">
        <h1 className="text-3xl font-display font-semibold">AI Buyer Simulator</h1>
        <p className="text-text-muted mt-1">Simulate intents and observe the deterministic policy gate.</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* LEFT: Buyer Chat */}
        <div className="lg:col-span-4 flex flex-col border border-border rounded-lg bg-surface/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface/50 font-medium text-sm flex items-center justify-between">
            <span>Buyer Intent</span>
            {isProcessing && <span className="text-xs text-primary animate-pulse">Processing...</span>}
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {chatLog.length === 0 && (
              <div className="text-center text-text-muted text-sm mt-10">
                Send a message or select a quick scenario.
              </div>
            )}
            
            {chatLog.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-surface border border-border ml-3' : 'bg-primary-muted text-primary mr-3'}`}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-text-main text-background' : 'bg-surface border border-border'}`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-border bg-surface/50">
            <div className="flex flex-wrap gap-2 mb-3">
              {['Buy the best laptop', 'Buy laptop with 20% discount', 'Buy 5 laptops', 'Buy a phone'].map(scenario => (
                <button 
                  key={scenario}
                  onClick={() => handleQuickAction(scenario)}
                  disabled={isProcessing}
                  className="px-2 py-1 bg-surface border border-border rounded text-xs hover:bg-border transition-colors disabled:opacity-50"
                >
                  {scenario}
                </button>
              ))}
            </div>
            <form 
              onSubmit={(e) => { e.preventDefault(); submitIntent(input); }}
              className="flex space-x-2"
            >
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type intent..."
                className="flex-1 bg-transparent border border-border rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
                disabled={isProcessing}
              />
              <button 
                type="submit"
                disabled={isProcessing || !input.trim()}
                className="bg-primary text-background p-2 rounded-md hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        </div>

        {/* MIDDLE: Decision Flow */}
        <div className="lg:col-span-4 flex flex-col border border-border rounded-lg bg-surface/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface/50 font-medium text-sm">
            Live Decision
          </div>
          <div className="flex-1 p-6 overflow-y-auto bg-[url('/grid.svg')] bg-center">
            
            {!activeAction ? (
              <div className="h-full flex items-center justify-center text-text-muted text-sm text-center">
                Waiting for intent...
              </div>
            ) : (
              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                
                {/* Intent Node */}
                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border border-border bg-surface shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10">
                     <User size={16} className="text-text-muted" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border bg-background shadow-sm">
                    <span className="text-xs font-mono text-text-muted mb-1 block">1. INTENT</span>
                    <div className="text-sm">{activeAction.action_type || 'Unknown Action'}</div>
                  </div>
                </div>

                {/* Gemini Node */}
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

                {/* Policy Gate Node */}
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

                {/* Execution Node (Only if not blocked) */}
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
        </div>

        {/* RIGHT: System Evidence */}
        <div className="lg:col-span-4 flex flex-col border border-border rounded-lg bg-surface/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface/50 font-medium text-sm flex justify-between items-center">
            <span>System Evidence</span>
            {activeAction?.policy_version && (
              <span className="px-2 py-0.5 rounded bg-surface border border-border text-xs font-mono text-text-muted">
                {activeAction.policy_version}
              </span>
            )}
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {!evidence ? (
               <div className="h-full flex flex-col items-center justify-center text-text-muted text-sm text-center">
                 <Database size={32} className="mb-2 opacity-50" />
                 Context and state data will appear here during evaluation.
               </div>
            ) : (
              Object.entries(evidence).map(([key, val]) => (
                <div key={key} className="border border-border rounded-md bg-background overflow-hidden">
                  <div className="bg-surface/50 px-3 py-1.5 border-b border-border text-xs font-mono font-bold text-text-muted uppercase">
                    {key}
                  </div>
                  <div className="p-3">
                    <pre className="text-[10px] font-mono text-text-main overflow-x-auto">
                      {JSON.stringify(val, null, 2)}
                    </pre>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
