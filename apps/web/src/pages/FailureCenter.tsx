import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { AlertOctagon, HelpCircle, ServerCrash } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';

export default function FailureCenter() {
  const [failures, setFailures] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || `${import.meta.env.VITE_API_URL || "http://localhost:3001"}`}/api/decisions`)
      .then(res => res.json())
      .then(data => {
        // Filter for failures or unknown states
        const failed = data.filter((d: any) => 
          ['EXECUTION_UNKNOWN', 'ESCALATED', 'VERIFIED_FAILURE'].includes(d.state)
        );
        setFailures(failed);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-3xl font-display font-semibold flex items-center text-rose-500">
            <ServerCrash className="mr-3" size={32} />
            Failure Center
          </h1>
          <p className="text-text-muted mt-2 max-w-2xl">
            External failure is not business failure. Track uncertain execution states and automated recovery.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <MetricCard 
          title="Unknown Executions" 
          value={failures.filter(f => f.state === 'EXECUTION_UNKNOWN').length} 
          icon={<HelpCircle size={16} />} 
          alert={failures.some(f => f.state === 'EXECUTION_UNKNOWN')}
        />
        <MetricCard 
          title="Escalated to Human" 
          value={failures.filter(f => f.state === 'ESCALATED').length} 
          icon={<AlertOctagon size={16} />} 
          alert={failures.some(f => f.state === 'ESCALATED')}
        />
        <MetricCard 
          title="Recovered Successfully" 
          value="--" 
          icon={<ServerCrash size={16} />} 
        />
      </div>

      <div className="flex-1 border border-rose-500/20 rounded-lg overflow-hidden bg-rose-500/5 flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-sm relative">
            <thead className="bg-surface/80 border-b border-border text-text-muted sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-6 py-3 font-medium">Incident Time</th>
                <th className="px-6 py-3 font-medium">Action ID</th>
                <th className="px-6 py-3 font-medium">Action Type</th>
                <th className="px-6 py-3 font-medium">Current State</th>
                <th className="px-6 py-3 font-medium">Recovery Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {failures.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <CheckCircle2 className="text-emerald-500" size={24} />
                      </div>
                      <p>No active failures or unknown executions.</p>
                      <p className="text-xs">Go to Chaos Control to inject faults.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                failures.map((f) => (
                  <tr 
                    key={f.action_id} 
                    className="hover:bg-surface/80 cursor-pointer transition-colors"
                    onClick={() => navigate(`/decisions/${f.action_id}`)}
                  >
                    <td className="px-6 py-4 font-mono text-text-muted whitespace-nowrap">
                      {new Date(f.updated_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-text-main">
                      {f.action_id}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-text-main">
                      {f.action_type}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={f.state} />
                    </td>
                    <td className="px-6 py-4">
                      {f.state === 'EXECUTION_UNKNOWN' ? (
                        <span className="text-primary text-xs font-mono animate-pulse">Verifying via Webhook...</span>
                      ) : (
                        <span className="text-text-muted text-xs font-mono">—</span>
                      )}
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

// Missing icon import
import { CheckCircle2 } from 'lucide-react';
