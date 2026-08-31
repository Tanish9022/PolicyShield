import Database from 'better-sqlite3';

const db = new Database('policyshield.db');

const rows = db.prepare("SELECT intent_id, stage, result, error_type FROM metric_events WHERE stage = 'SCHEMA'").all();
console.log(rows);
