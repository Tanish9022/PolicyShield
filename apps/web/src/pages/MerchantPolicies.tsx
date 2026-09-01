import { useState, useEffect } from 'react';
import { Save, RefreshCw, Archive, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_BASE } from '../lib/api';

export default function MerchantPolicies() {
  const [policyText, setPolicyText] = useState("Premium laptops can have at most 5% discount.\nKeep 3 units in reserve.\nOrders above ₹50,000 require approval.");
  const [isCompiling, setIsCompiling] = useState(false);
  const [activeVersion, setActiveVersion] = useState<any>(null);
  const [compileStatus, setCompileStatus] = useState<'IDLE' | 'COMPILING' | 'VALIDATED' | 'ERROR'>('IDLE');

  const fetchActivePolicy = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/policies/MERCH_1`);
      if (res.ok) {
        const data = await res.json();
        setActiveVersion(data);
        if (data.source_text) setPolicyText(data.source_text);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchActivePolicy();
  }, []);

  const handleCompile = async () => {
    setIsCompiling(true);
    setCompileStatus('COMPILING');
    try {
      const res = await fetch(`${API_BASE}/api/policies/compile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_id: 'MERCH_1', policy_text: policyText })
      });
      if (res.ok) {
        setCompileStatus('VALIDATED');
        await fetchActivePolicy();
      } else {
        setCompileStatus('ERROR');
      }
    } catch (err) {
      setCompileStatus('ERROR');
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="shrink-0">
        <h1 className="text-3xl font-display font-semibold">Merchant Policies</h1>
        <p className="text-text-muted mt-1">Translate business intent into enforceable transaction policy.</p>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-0">
        
        {/* Left: Compiler */}
        <div className="flex flex-col border border-border rounded-lg bg-surface/30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/50">
            <span className="font-medium text-sm">Natural-language Policy Compiler</span>
            <div className="flex items-center space-x-2">
              {compileStatus === 'COMPILING' && <span className="text-primary text-xs flex items-center"><RefreshCw size={12} className="animate-spin mr-1"/> Compiling...</span>}
              {compileStatus === 'VALIDATED' && <span className="text-emerald-500 text-xs flex items-center"><CheckCircle2 size={12} className="mr-1"/> Validated</span>}
              {compileStatus === 'ERROR' && <span className="text-rose-500 text-xs flex items-center"><AlertCircle size={12} className="mr-1"/> Compilation Error</span>}
            </div>
          </div>
          <textarea 
            value={policyText}
            onChange={(e) => setPolicyText(e.target.value)}
            className="flex-1 w-full bg-transparent p-4 text-text-main resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono text-sm"
            placeholder="Type your merchant policies here..."
          />
          <div className="p-4 border-t border-border bg-surface/30 flex justify-end">
            <button 
              onClick={handleCompile}
              disabled={isCompiling}
              className="flex items-center space-x-2 bg-text-main text-background hover:bg-white px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-50"
            >
              {isCompiling ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{isCompiling ? 'Compiling...' : 'Compile Policy'}</span>
            </button>
          </div>
        </div>

        {/* Right: Compiled Graph */}
        <div className="flex flex-col border border-border rounded-lg bg-surface/30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface/50">
            <span className="font-medium text-sm">Compiled Policy Graph</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-mono">
              {activeVersion?.version || 'NO_ACTIVE_POLICY'}
            </span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            
            {!activeVersion ? (
              <div className="h-full flex flex-col items-center justify-center text-text-muted">
                <Archive size={32} className="mb-2 opacity-50" />
                <p>No active policy compiled.</p>
              </div>
            ) : (
              (activeVersion.rules ?? []).map((rule: any, idx: number) => (
                <div key={idx} className="border border-border rounded-md p-4 bg-background">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-primary font-bold">{rule.type}</span>
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">Active</span>
                  </div>
                  <div className="space-y-1 mt-3 text-sm">
                    {rule.scope && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">scope</span>
                        <span className="font-mono text-text-main">{JSON.stringify(rule.scope)}</span>
                      </div>
                    )}
                    {rule.value !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">value</span>
                        <span className="font-mono text-text-main">{JSON.stringify(rule.value)}</span>
                      </div>
                    )}
                    {rule.threshold !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">threshold</span>
                        <span className="font-mono text-text-main">{JSON.stringify(rule.threshold)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-text-muted">priority</span>
                      <span className="font-mono text-text-main">{rule.priority}</span>
                    </div>
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
