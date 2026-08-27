import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export default function AuditLedger() {
  const [events, setEvents] = useState<any[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('http://localhost:3001/api/audit')
      .then(res => res.json())
      .then(data => setEvents(data))
      .catch(console.error);
  }, []);

  const filteredEvents = events.filter(e => 
    e.event_id.includes(filter) || 
    e.intent_id.includes(filter) || 
    e.action_id.includes(filter) || 
    e.event_type.toLowerCase().includes(filter.toLowerCase())
  );

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
        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left text-sm relative">
            <thead className="bg-surface/80 border-b border-border text-text-muted sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-6 py-3 font-medium">Timestamp</th>
                <th className="px-6 py-3 font-medium">Event Type</th>
                <th className="px-6 py-3 font-medium">Intent ID</th>
                <th className="px-6 py-3 font-medium">Action ID</th>
                <th className="px-6 py-3 font-medium">Decision</th>
                <th className="px-6 py-3 font-medium">Result</th>
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
                filteredEvents.map((e) => (
                  <tr key={e.event_id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-text-muted whitespace-nowrap">
                      {new Date(e.timestamp).toISOString()}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs font-semibold text-text-main">
                      {e.event_type}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-text-muted truncate max-w-[120px]">
                      {e.intent_id}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-text-muted truncate max-w-[120px]">
                      {e.action_id || '-'}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs">
                      <span className={e.decision === 'BLOCK' ? 'text-rose-400 font-bold' : e.decision ? 'text-emerald-400 font-bold' : 'text-text-muted'}>
                        {e.decision || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-[10px] text-text-muted truncate max-w-[200px]">
                      {e.result || '-'}
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
