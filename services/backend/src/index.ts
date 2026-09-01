import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { requestIdMiddleware } from './middleware/request-id';
import { errorHandler } from './middleware/error-handler';
import { chaosMiddleware } from './middleware/chaos';
import { getDb, closeDb } from './db/client';
import policyRoutes from './routes/policy.routes';
import merchantRoutes from './routes/merchant.routes';
import intentRoutes from './routes/intent.routes';
import webhookRoutes from './routes/webhook.routes';
import decisionsRoutes from './routes/decisions.routes';
import auditRoutes from './routes/audit.routes';
import metricsRoutes from './routes/metrics.routes';
import runsRoutes from './routes/runs.routes';
import streamRoutes from './routes/stream.routes';

import path from 'path';

// Load environment variables — try backend-local first, then project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Middleware ──────────────────────────────────────────────────

// Parse JSON for all routes EXCEPT webhooks (which need raw body)
app.use((req, res, next) => {
  if (req.path === '/api/webhooks/razorpay') {
    // Preserve raw body for Razorpay signature verification
    express.raw({ type: 'application/json', limit: '1mb' })(req, res, next);
  } else {
    // Strict body limit for application security
    express.json({ limit: '10kb' })(req, res, next);
  }
});

app.use(cors());
app.use(requestIdMiddleware);
if (process.env.NODE_ENV !== 'production') {
  app.use(chaosMiddleware);
}

// ─── Health Check ───────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'policyshield-backend',
    timestamp: new Date().toISOString(),
  });
});

// ─── Route Stubs ────────────────────────────────────────────────
// These will be populated in Phases 2–5.

app.get('/api/status', async (_req, res) => {
  const db = getDb();
  
  // Basic counts
  const policyCount = await db.prepare('SELECT COUNT(*) as count FROM policy_versions').get() as unknown as { count: number };
  
  // KPI counts
  const totalDecisions = await db.prepare("SELECT COUNT(*) as count FROM actions").get() as unknown as { count: number };
  const blocked = await db.prepare("SELECT COUNT(*) as count FROM actions WHERE decision = 'BLOCK'").get() as unknown as { count: number };
  const escalations = await db.prepare("SELECT COUNT(*) as count FROM actions WHERE state = 'ESCALATED'").get() as unknown as { count: number };
  const successful = await db.prepare("SELECT COUNT(*) as count FROM actions WHERE state = 'VERIFIED_SUCCESS'").get() as unknown as { count: number };
  const unknown = await db.prepare("SELECT COUNT(*) as count FROM actions WHERE state = 'EXECUTION_UNKNOWN'").get() as unknown as { count: number };
  
  // Unsafe mutations invariant
  const unsafeRow = await db.prepare("SELECT COUNT(*) as count FROM actions WHERE state = 'VERIFIED_SUCCESS' AND decision != 'APPROVE'").get() as unknown as { count: number };
  const unsafe = unsafeRow.count;

  res.json({
    policies: Number(policyCount.count),
    decisionsToday: Number(totalDecisions.count),
    violationsBlocked: Number(blocked.count),
    escalations: Number(escalations.count),
    successfulVerified: Number(successful.count),
    unknownExecutions: Number(unknown.count),
    unsafeMutations: Number(unsafe)
  });
});

app.use('/api/policies', policyRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/intent', intentRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/decisions', decisionsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/eval/metrics', metricsRoutes);
app.use('/api/v1/runs', runsRoutes);
app.use('/api/v1/runs', streamRoutes); // SSE stream — same prefix, different path (/stream)

// ─── Error Handler ──────────────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────

let server: any;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, async () => {
    // Initialize the database on startup
    const db = getDb();
    console.log(`[PolicyShield] Backend running on http://localhost:${PORT}`);
    console.log(`[PolicyShield] Health check: http://localhost:${PORT}/health`);

    // Run Startup Recovery
    console.log(`[PolicyShield] Running startup recovery...`);
    try {
      const { resolveUnknownExecution } = await import('./gateway/orchestrator');
      const unknownActions = await db.prepare(`SELECT intent_id FROM actions WHERE state = 'EXECUTION_UNKNOWN'`).all() as { intent_id: string }[];
      
      if (unknownActions.length > 0) {
        console.log(`[PolicyShield] Found ${unknownActions.length} actions in EXECUTION_UNKNOWN state. Attempting recovery...`);
        for (const action of unknownActions) {
          await resolveUnknownExecution(action.intent_id);
        }
        console.log(`[PolicyShield] Recovery complete.`);
      } else {
        console.log(`[PolicyShield] No stuck executions found.`);
      }
    } catch (e) {
      console.error(`[PolicyShield] Startup recovery failed:`, e);
    }
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[PolicyShield] Shutting down...');
  closeDb();
  if (server) {
    server.close();
  }
  process.exit(0);
});

export default app;
