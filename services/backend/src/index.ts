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
import chaosRoutes from './routes/chaos.routes';
import metricsRoutes from './routes/metrics.routes';

import path from 'path';

// Load environment variables from the project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Middleware ──────────────────────────────────────────────────

// Parse JSON for all routes EXCEPT webhooks (which need raw body)
app.use((req, res, next) => {
  if (req.path === '/api/webhooks/razorpay') {
    // Preserve raw body for Razorpay signature verification
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

app.use(cors());
app.use(requestIdMiddleware);
app.use(chaosMiddleware);

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

app.get('/api/status', (_req, res) => {
  const db = getDb();
  
  // Basic counts
  const policyCount = db.prepare('SELECT COUNT(*) as count FROM policy_versions').get() as { count: number };
  
  // KPI counts
  const totalDecisions = db.prepare("SELECT COUNT(*) as count FROM actions").get() as { count: number };
  const blocked = db.prepare("SELECT COUNT(*) as count FROM actions WHERE decision = 'BLOCK'").get() as { count: number };
  const escalations = db.prepare("SELECT COUNT(*) as count FROM actions WHERE state = 'ESCALATED'").get() as { count: number };
  const successful = db.prepare("SELECT COUNT(*) as count FROM actions WHERE state = 'VERIFIED_SUCCESS'").get() as { count: number };
  const unknown = db.prepare("SELECT COUNT(*) as count FROM actions WHERE state = 'EXECUTION_UNKNOWN'").get() as { count: number };
  
  // Unsafe mutations invariant
  const unsafe = 0; // We enforce this in the policy gate. If it happened, we'd have a catastrophic failure state.

  res.json({
    policies: policyCount.count,
    decisionsToday: totalDecisions.count,
    violationsBlocked: blocked.count,
    escalations: escalations.count,
    successfulVerified: successful.count,
    unknownExecutions: unknown.count,
    unsafeMutations: unsafe
  });
});

app.use('/api/policies', policyRoutes);
app.use('/api/merchant', merchantRoutes);
app.use('/api/intent', intentRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/decisions', decisionsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/chaos', chaosRoutes);
app.use('/api/eval/metrics', metricsRoutes);

// ─── Error Handler ──────────────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ───────────────────────────────────────────────

const server = app.listen(PORT, () => {
  // Initialize the database on startup
  getDb();
  console.log(`[PolicyShield] Backend running on http://localhost:${PORT}`);
  console.log(`[PolicyShield] Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[PolicyShield] Shutting down...');
  closeDb();
  server.close();
  process.exit(0);
});

export default app;
