import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { Activity, ShieldCheck, AlertTriangle, XCircle, CheckCircle, HelpCircle } from 'lucide-react';

interface SystemStatus {
  policies: number;
  decisionsToday: number;
  violationsBlocked: number;
  escalations: number;
  successfulVerified: number;
  unknownExecutions: number;
  unsafeMutations: number;
}

export default function Overview() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [recentDecisions, setRecentDecisions] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || "http://localhost:3001"}`}/api/status`)
      .then(res => res.json())
      .then(data => setStatus(data))
      .catch(console.error);

    fetch(`${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || "http://localhost:3001"}`}/api/decisions`)
      .then(res => res.json())
      .then(data => setRecentDecisions(data.slice(0, 10)))
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Header section */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-display font-semibold tracking-tight">PolicyShield</h1>
          <h2 className="text-xl text-text-muted mt-2 font-light">Autonomous commerce, under deterministic control.</h2>
          <p className="text-sm text-text-muted mt-4 font-mono max-w-2xl leading-relaxed">
            AI can reason. <br/>
            Merchants define the rules. <br/>
            Deterministic systems enforce them.
          </p>
        </div>
        <div className="bg-surface/50 border border-border p-4 rounded-lg flex space-x-8 text-sm">
           <div className="flex flex-col space-y-1">
             <span className="text-text-muted">Policy Engine</span>
             <div className="flex items-center space-x-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="font-medium text-emerald-400">Active v12</span></div>
           </div>
           <div className="flex flex-col space-y-1">
             <span className="text-text-muted">Verification Gate</span>
             <div className="flex items-center space-x-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="font-medium text-emerald-400">Enforcing</span></div>
           </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard 
          title="Decisions Today" 
          value={status?.decisionsToday ?? '—'} 
          icon={<Activity size={16} />} 
        />
        <MetricCard 
          title="Policy Violations Blocked" 
          value={status?.violationsBlocked ?? '—'} 
          icon={<ShieldCheck size={16} />} 
          highlight={!!(status && status.violationsBlocked > 0)}
        />
        <MetricCard 
          title="Successful Verified" 
          value={status?.successfulVerified ?? '—'} 
          icon={<CheckCircle size={16} />} 
        />
        <MetricCard 
          title="Escalations" 
          value={status?.escalations ?? '—'} 
          icon={<AlertTriangle size={16} />} 
          alert={!!(status && status.escalations > 0)}
        />
        <MetricCard 
          title="Unknown Executions" 
          value={status?.unknownExecutions ?? '—'} 
          icon={<HelpCircle size={16} />} 
        />
        <MetricCard 
          title="Unsafe Autonomous Actions" 
          value={status?.unsafeMutations ?? '—'} 
          icon={<XCircle size={16} />} 
        />
      </div>

      {/* Decision Control Plane Visual */}
      <div className="border border-border rounded-xl bg-surface/30 p-8 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
        <h3 className="text-xl font-display font-medium mb-6">Decision Control Plane</h3>
        
        <div className="flex justify-between items-center px-4">
           {['Buyer Intent', 'Context', 'Policy Graph', 'Gemini', 'Policy Gate', 'JIT Validation', 'Razorpay', 'Verification'].map((step, idx) => (
             <div key={idx} className="flex flex-col items-center">
                <div className={`w-3 h-3 rounded-full mb-3 ${idx === 4 ? 'bg-primary shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-border'}`}></div>
                <span className={`text-xs font-mono text-center max-w-[80px] ${idx === 4 ? 'text-primary' : 'text-text-muted'}`}>{step}</span>
             </div>
           ))}
        </div>
      </div>

      {/* Recent Decisions Table */}
      <div>
        <h3 className="text-xl font-display font-medium mb-4">Recent Decisions</h3>
        <div className="border border-border rounded-lg overflow-hidden bg-surface/30">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface/50 border-b border-border text-text-muted">
              <tr>
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Intent</th>
                <th className="px-6 py-3 font-medium">Action</th>
                <th className="px-6 py-3 font-medium">Decision</th>
                <th className="px-6 py-3 font-medium">Final State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentDecisions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-text-muted italic">
                    No recent decisions. Go to the AI Buyer Simulator to run a scenario.
                  </td>
                </tr>
              ) : (
                recentDecisions.map((d) => (
                  <tr 
                    key={d.action_id} 
                    className="hover:bg-surface/80 cursor-pointer transition-colors"
                    onClick={() => navigate(`/decisions/${d.action_id}`)}
                  >
                    <td className="px-6 py-4 font-mono text-text-muted">
                      {new Date(d.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 max-w-[200px] truncate" title={d.buyer_input}>
                      {d.buyer_input}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">
                      {d.action_type}
                    </td>
                    <td className="px-6 py-4">
                       <span className={d.decision === 'BLOCK' ? 'text-rose-400 font-medium' : 'text-text-main'}>
                         {d.decision}
                       </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={d.state} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
