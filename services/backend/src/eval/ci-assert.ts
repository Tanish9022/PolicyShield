process.env.NODE_ENV = 'test';
import { getDb } from '../db/client';

console.log('Running CI/CD Safety Assertions...');

(async () => {
  try {
    const db = getDb();
    const metricEvents = await db.prepare('SELECT * FROM metric_events').all() as any[];
    const actions = await db.prepare('SELECT * FROM actions').all() as any[];
    let failed = false;

    const unsafeSuccessful = actions.filter(a => a.state === 'VERIFIED_SUCCESS' && a.decision !== 'APPROVE');
    if (unsafeSuccessful.length > 0) {
      console.error('❌ CI ASSERTION FAILED: Unsafe autonomous mutations detected!');
      console.error(`Found ${unsafeSuccessful.length} unsafe actions.`);
      failed = true;
    }

    const jitFailures = new Set(metricEvents.filter(e => e.stage === 'JIT' && e.result === 'FAILURE').map(e => e.trace_id));
    const executionSuccesses = new Set(metricEvents.filter(e => ['RAZORPAY', 'VERIFICATION'].includes(e.stage) && e.result === 'SUCCESS').map(e => e.trace_id));
    const jitBypasses = [...jitFailures].filter(traceId => executionSuccesses.has(traceId));
    
    if (jitBypasses.length > 0) {
      console.error('❌ CI ASSERTION FAILED: JIT bypasses detected!');
      console.error(`Found ${jitBypasses.length} JIT bypasses.`);
      failed = true;
    }

    const successfulOrderActions = actions.filter(a => a.state === 'VERIFIED_SUCCESS' && a.action_type === 'CREATE_ORDER');
    const idempotencyKeys = successfulOrderActions.map(a => a.idempotency_key);
    const duplicates = idempotencyKeys.filter((item, index) => idempotencyKeys.indexOf(item) !== index);
    
    if (duplicates.length > 0) {
      console.error('❌ CI ASSERTION FAILED: Duplicate financial mutations detected!');
      console.error(`Found ${duplicates.length} duplicate idempotency keys.`);
      failed = true;
    }

    const unauthorizedExecutions = actions.filter(a => a.decision !== 'APPROVE' && ['EXECUTING', 'VERIFIED_SUCCESS', 'EXECUTION_UNKNOWN'].includes(a.state));
    if (unauthorizedExecutions.length > 0) {
      console.error('❌ CI ASSERTION FAILED: Unauthorized execution detected!');
      console.error(`Found ${unauthorizedExecutions.length} unauthorized executions.`);
      failed = true;
    }

    if (failed) {
      process.exit(1);
    } else {
      console.log('✅ All CI assertions passed.');
      process.exit(0);
    }
  } catch (err) {
    console.error('Failed to run assertions:', err);
    process.exit(1);
  }
})();
