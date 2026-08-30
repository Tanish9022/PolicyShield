import { useState, useEffect } from 'react';
import { Send, CheckCircle, Clock, ShieldAlert, CreditCard } from 'lucide-react';

export default function DemoMode() {
  const [buyerInput, setBuyerInput] = useState('Find me the best laptop under ₹70,000 with maximum discount and delivery tomorrow.');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<any>(null);
  
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<any>(null);

  const steps = [
    'Initializing AI Buyer Agent...',
    'Discovery: Searching catalog & verifying inventory...',
    'Comparison: Evaluating options...',
    'Negotiation: Proposing maximum discount...',
    'Policy Gate: Validating against merchant constraints...',
    'Adaptation: Adjusting to policy limits...',
    'Ready for Confirmation'
  ];

  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingStep((s) => Math.min(s + 1, steps.length - 2));
      }, 3000);
      return () => clearInterval(interval);
    } else {
      setLoadingStep(0);
    }
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setCheckoutResult(null);
    
    try {
      const res = await fetch('http://localhost:3001/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: 'merchant_1',
          buyer_input: buyerInput,
          customer_id: 'cust_demo'
        })
      });
      const data = await res.json();
      setResult(data);
      setLoadingStep(steps.length - 1);
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!result?.agent_run?.intent_id) return;
    setCheckoutLoading(true);
    
    try {
      const res = await fetch(`http://localhost:3001/api/intent/${result.agent_run.intent_id}/checkout`, {
        method: 'POST'
      });
      const data = await res.json();
      setCheckoutResult(data);
    } catch (err) {
      console.error(err);
      alert('Error connecting to backend');
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center max-w-4xl mx-auto h-full space-y-8 py-10 animate-in zoom-in-95 duration-500">
      
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-display font-bold text-primary">End-to-End Checkout Demo</h1>
        <p className="text-text-muted">Experience the end-to-end agentic commerce flow with deterministic safety.</p>
      </div>

      <div className="w-full bg-surface/30 border border-border rounded-xl p-6">
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input 
            type="text" 
            value={buyerInput}
            onChange={e => setBuyerInput(e.target.value)}
            className="flex-1 bg-background border border-border rounded-lg px-4 py-3 focus:border-primary focus:outline-none"
            placeholder="Type your request here..."
          />
          <button 
            type="submit"
            disabled={loading || checkoutLoading}
            className="bg-primary text-background px-6 py-3 rounded-lg font-bold flex items-center hover:bg-primary-hover disabled:opacity-50"
          >
            <Send size={18} className="mr-2" />
            Send Intent
          </button>
        </form>
      </div>

      {loading && (
        <div className="w-full bg-surface/30 border border-border rounded-xl p-8 text-center space-y-4">
          <Clock className="mx-auto text-primary animate-pulse" size={40} />
          <h2 className="text-xl font-medium">{steps[loadingStep]}</h2>
          <div className="w-full bg-background h-2 rounded-full overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-500"
              style={{ width: `${((loadingStep + 1) / steps.length) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {!loading && result && (
        <div className="w-full space-y-6">
          <div className="bg-surface border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display text-emerald-400 flex items-center">
                <CheckCircle className="mr-2" /> Agent Decision Reached
              </h2>
              <span className="px-3 py-1 bg-surface border border-border rounded text-xs font-mono">
                {result.agent_run.state}
              </span>
            </div>
            
            {result.action && result.action.evidence_json && (() => {
               const evidence = JSON.parse(result.action.evidence_json);
               const rec = evidence.recommendation.proposed_action;
               return (
                 <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                     <div className="bg-background border border-border p-4 rounded-lg">
                       <h3 className="text-sm text-text-muted mb-1">Selected Product</h3>
                       <p className="font-mono text-primary text-lg">{rec.product_id}</p>
                     </div>
                     <div className="bg-background border border-border p-4 rounded-lg">
                       <h3 className="text-sm text-text-muted mb-1">Proposed Action</h3>
                       <p className="font-mono text-primary text-lg">{rec.type}</p>
                       {rec.discount_percent && (
                         <p className="text-sm text-rose-400 mt-1">Discount: {rec.discount_percent}% (Adapted)</p>
                       )}
                     </div>
                   </div>
                   
                   <div className="bg-background border border-border p-4 rounded-lg">
                     <h3 className="text-sm text-text-muted mb-2 flex items-center">
                       <ShieldAlert size={14} className="mr-2 text-primary" /> 
                       Agent Reasoning
                     </h3>
                     <p className="text-sm text-text-main italic">"{evidence.recommendation.explanation}"</p>
                   </div>
                 </div>
               );
            })()}
          </div>
          
          {result.agent_run.state === 'READY_FOR_CHECKOUT' && !checkoutResult && (
            <div className="flex justify-center">
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="bg-emerald-500 text-background px-12 py-4 rounded-full font-bold text-lg flex items-center hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all transform hover:scale-105 disabled:opacity-50"
              >
                {checkoutLoading ? <Clock className="animate-spin mr-2" /> : <CreditCard className="mr-2" />}
                CONFIRM CHECKOUT
              </button>
            </div>
          )}

          {checkoutResult && (
             <div className="bg-surface border border-emerald-500/30 rounded-xl p-8 text-center space-y-4 animate-in slide-in-from-bottom-4">
               <div className="mx-auto w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                 <CheckCircle className="text-emerald-500" size={32} />
               </div>
               <h2 className="text-2xl font-bold text-emerald-400">Order Successful!</h2>
               <p className="text-text-muted">The transaction was authorized and logged immutably.</p>
               
               <div className="inline-block bg-background border border-border p-4 rounded-lg mt-4 text-left">
                 <p className="text-sm text-text-muted">Final Action State: <span className="text-emerald-400 font-mono">{checkoutResult.state}</span></p>
                 {checkoutResult.razorpay_order_id && (
                   <p className="text-sm text-text-muted mt-2">Razorpay Order ID: <span className="text-primary font-mono">{checkoutResult.razorpay_order_id}</span></p>
                 )}
               </div>
             </div>
          )}
        </div>
      )}
    </div>
  );
}
