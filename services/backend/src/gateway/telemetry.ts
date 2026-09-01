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
      VALUES ($1, $2, $3, 'STARTED')
    `).run(this.traceId, this.requestId, this.intentId).catch(console.error);
  }

  public async setActionId(actionId: string) {
    this.actionId = actionId;
    const db = getDb();
    await db.prepare(`UPDATE traces SET action_id = $1 WHERE trace_id = $2`).run(this.actionId, this.traceId);
  }

  public async recordStage(stage: string, startTime: number, result: string, decision?: string, errorType?: string, model?: string, metadata?: any) {
    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const db = getDb();
    
    await db.prepare(`
      INSERT INTO metric_events (
        event_id, trace_id, request_id, intent_id, action_id, 
        stage, start_time, end_time, duration_ms, 
        result, decision, error_type, model, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `).run(
      uuidv4(), this.traceId, this.requestId, this.intentId, this.actionId,
      stage, Math.round(startTime), Math.round(endTime), Math.round(durationMs),
      result, decision || null, errorType || null, model || null, metadata ? JSON.stringify(metadata) : '{}'
    );
  }

  public async completeTrace(status: string, errorType?: string) {
    const totalDuration = performance.now() - this.traceStartTime;
    const db = getDb();
    await db.prepare(`
      UPDATE traces 
      SET total_duration_ms = $1, status = $2, error_type = $3
      WHERE trace_id = $4
    `).run(Math.round(totalDuration), status, errorType || null, this.traceId);
  }

  public get traceIdVal() { return this.traceId; }
}
