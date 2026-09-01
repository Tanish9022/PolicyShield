import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { fetchArray } from '../lib/api';

export default function Decisions() {
  const [decisions, setDecisions] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchArray('/api/decisions').then(setDecisions);
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 h-full flex flex-col">
      <div className="shrink-0">
        <h1 className="text-3xl font-display font-semibold">Decisions</h1>
        <p className="text-text-muted mt-1">All processed intents and their outcomes.</p>
      </div>

      <div className="flex-1 border border-border rounded-lg overflow-hidden bg-surface/30 flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-sm relative">
            <thead className="bg-surface/50 border-b border-border text-text-muted sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Action ID</th>
                <th className="px-6 py-3 font-medium">Intent</th>
                <th className="px-6 py-3 font-medium">Action Type</th>
                <th className="px-6 py-3 font-medium">Decision</th>
                <th className="px-6 py-3 font-medium">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {decisions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-muted italic">
                    No decisions recorded.
                  </td>
                </tr>
              ) : (
                decisions.map((d) => (
                  <tr 
                    key={d.action_id} 
                    className="hover:bg-surface/80 cursor-pointer transition-colors"
                    onClick={() => navigate(`/decisions/${d.action_id}`)}
                  >
                    <td className="px-6 py-4 font-mono text-text-muted whitespace-nowrap">
                      {new Date(d.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-text-muted">
                      {d.action_id}
                    </td>
                    <td className="px-6 py-4 max-w-[200px] truncate" title={d.buyer_input}>
                      {d.buyer_input}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-text-main">
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
