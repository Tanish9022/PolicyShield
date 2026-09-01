import { getDb } from '../db/client';

export async function appendAgentEvent(runId: string, eventType: string, payload: any = {}): Promise<number> {
  const db = getDb();
  
  const transaction = db.transaction(() => {
    const result = db.prepare(`SELECT COALESCE(MAX(sequence), 0) + 1 as nextSeq FROM agent_events WHERE run_id = ?`).get(runId) as any;
    const seq = result.nextSeq;
    
    db.prepare(`
      INSERT INTO agent_events (run_id, sequence, event_type, payload_json)
      VALUES (?, ?, ?, ?)
    `).run(runId, seq, eventType, JSON.stringify(payload));
    
    return seq;
  });
  
  return await transaction();
}

export async function getAgentEvents(runId: string, afterSequence: number = 0) {
  const db = getDb();
  return await db.prepare(`
    SELECT * FROM agent_events 
    WHERE run_id = $1 AND sequence > $2 
    ORDER BY sequence ASC
  `).all(runId, afterSequence);
}
