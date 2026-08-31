const db = require('better-sqlite3')('policyshield.db');
const events = db.prepare('SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT 10').all();
console.log(JSON.stringify(events, null, 2));
