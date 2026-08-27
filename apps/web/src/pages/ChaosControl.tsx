import { useState } from 'react';
import { Activity, Skull, ShieldCheck, DatabaseZap, RotateCcw, AlertTriangle } from 'lucide-react';

export default function ChaosControl() {
  const [injecting, setInjecting] = useState<string | null>(null);
  const [chaosLog, setChaosLog] = useState<{time: Date, event: string}[]>([]);

  const injectChaos = async (type: string) => {
    setInjecting(type);
    try {
      let endpoint = '';
      let body = {};
      
      switch (type) {
        case 'INVENTORY_0':
          endpoint = '/api/chaos/inventory';
          body = { stockLevel: 0 };
          break;
        case 'STALE_PRICE':
          endpoint = '/api/chaos/price';
          body = { price: 49999 };
          break;
        case 'RESET':
          endpoint = '/api/chaos/reset';
          break;
      }
      
      const res = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      setChaosLog(prev => [{time: new Date(), event: data.message}, ...prev]);
    } catch (err: any) {
      setChaosLog(prev => [{time: new Date(), event: `Failed: ${err.message}`}, ...prev]);
    } finally {
      setInjecting(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col max-w-5xl mx-auto">
      <div className="shrink-0 border-b border-border pb-6">
        <h1 className="text-3xl font-display font-semibold flex items-center text-primary">
          <Skull className="mr-3" size={32} />
          Chaos Lab
        </h1>
        <p className="text-text-muted mt-2">
          Break the system deliberately. Verify that it fails safely.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 shrink-0">
        
        {/* Fault Toggles */}
        <div className="space-y-4">
          <h2 className="text-xl font-display font-medium">Fault Injection</h2>
          
          <div className="bg-surface/30 border border-border rounded-lg p-5 flex justify-between items-center">
             <div>
               <h3 className="font-semibold flex items-center"><DatabaseZap size={16} className="mr-2 text-rose-500"/> Inventory Mutation (Race Condition)</h3>
               <p className="text-xs text-text-muted mt-1 max-w-[280px]">Simulates another buyer purchasing the last item right before this execution.</p>
             </div>
             <button 
                onClick={() => injectChaos('INVENTORY_0')}
                disabled={injecting !== null}
                className="px-4 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded font-medium text-sm hover:bg-rose-500/20 transition-colors"
             >
               Set Stock to 0
             </button>
          </div>

          <div className="bg-surface/30 border border-border rounded-lg p-5 flex justify-between items-center">
             <div>
               <h3 className="font-semibold flex items-center"><AlertTriangle size={16} className="mr-2 text-primary"/> Stale Price (Cache Invalidation)</h3>
               <p className="text-xs text-text-muted mt-1 max-w-[280px]">Simulates AI reasoning over an old price, while authoritative price increased.</p>
             </div>
             <button 
                onClick={() => injectChaos('STALE_PRICE')}
                disabled={injecting !== null}
                className="px-4 py-2 bg-primary-muted text-primary border border-primary/30 rounded font-medium text-sm hover:bg-primary/20 transition-colors"
             >
               Alter Price
             </button>
          </div>

          <div className="bg-surface/30 border border-border rounded-lg p-5 flex justify-between items-center opacity-70">
             <div>
               <h3 className="font-semibold flex items-center"><Activity size={16} className="mr-2 text-purple-500"/> Razorpay Timeout</h3>
               <p className="text-xs text-text-muted mt-1 max-w-[280px]">Network drop after dispatching API call. Causes EXECUTION_UNKNOWN.</p>
             </div>
             <div className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded">
               Inject via Intent Headers
             </div>
          </div>
        </div>

        {/* Chaos Event Log */}
        <div className="flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-xl font-display font-medium">Event Log</h2>
             <button 
               onClick={() => injectChaos('RESET')}
               disabled={injecting !== null}
               className="flex items-center space-x-1 text-sm text-text-muted hover:text-emerald-400 transition-colors"
             >
               <RotateCcw size={14} />
               <span>Reset State</span>
             </button>
          </div>
          
          <div className="flex-1 bg-background border border-border rounded-lg p-4 overflow-y-auto font-mono text-sm space-y-2">
            {chaosLog.length === 0 ? (
              <div className="text-text-muted text-center mt-10 italic text-xs">Waiting for fault injection...</div>
            ) : (
              chaosLog.map((log, i) => (
                <div key={i} className="border-l-2 border-primary pl-3 py-1">
                  <span className="text-text-muted text-xs mr-3">{log.time.toLocaleTimeString()}</span>
                  <span className={log.event.includes('Failed') ? 'text-rose-400' : 'text-text-main'}>{log.event}</span>
                </div>
              ))
            )}
          </div>
        </div>
        
      </div>
      
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-5 flex items-start">
        <ShieldCheck className="text-emerald-500 shrink-0 mr-4 mt-0.5" />
        <div>
          <h4 className="font-semibold text-emerald-400">JIT Re-validation Guard</h4>
          <p className="text-sm text-text-muted mt-1">
            Even if AI hallucinated or state mutated maliciously under the hood, the PolicyShield JIT guard fetches the authoritative state exactly 1ms before executing against Razorpay to ensure `UNSAFE_AUTONOMOUS_ACTIONS = 0`.
          </p>
        </div>
      </div>

    </div>
  );
}
