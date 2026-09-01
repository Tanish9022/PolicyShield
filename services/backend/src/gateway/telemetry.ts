import { getDb } from '../db/client';
import { v4 as uuidv4 } from 'uuid';

export class TelemetryTracer {
  private traceId: string;
  private requestId: string;
  private intentId: string;
  private actionId: string | null = null;
  private traceStartTime: number;

  constructor(requestId: string, intentId: string) {
    this.traceId = uuidv4();
    this.requestId = requestId;
    this.intentId = intentId;
    this.traceStartTime = performance.now();

    const db = getDb();
    db.prepare(`
      INSERT INTO traces (trace_id, request_id, intent_id, status)
      VALUES (?, ?, ?, 'STARTED')
    `).run(this.traceId, this.requestId, this.intentId);
  }

  public async setActionId(actionId: string) {
    this.actionId = actionId;
    const db = getDb();
    await db.prepare(`UPDATE traces SET action_id = ? WHERE trace_id = ?`).run(this.actionId, this.traceId);
  }

  public async recordStage(stage: string, startTime: number, result: string, decision?: string, errorType?: string, model?: string, metadata?: any) {
    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const db = getDb();
    
    db.prepare(`
      INSERT INTO metric_events (
        event_id, trace_id, request_id, intent_id, action_id, 
        stage, start_time, end_time, duration_ms, 
        result, decision, error_type, model, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(), this.traceId, this.requestId, this.intentId, this.actionId,
      stage, startTime, endTime, durationMs,
      result, decision || null, errorType || null, model || null, metadata ? JSON.stringify(metadata) : '{}'
    );
  }

  public async completeTrace(status: string, errorType?: string) {
    const totalDuration = performance.now() - this.traceStartTime;
    const db = getDb();
    await db.prepare(`
      UPDATE traces 
      SET total_duration_ms = ?, status = ?, error_type = ?
      WHERE trace_id = ?
    `).run(totalDuration, status, errorType || null, this.traceId);
  }

  public get traceIdVal() { return this.traceId; }
}
