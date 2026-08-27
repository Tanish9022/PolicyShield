import { PolicyGraph, PolicyRule } from '@policyshield/shared';
import { getDb } from '../db/client';

export function storePolicies(graph: PolicyGraph): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO policy_versions (merchant_id, version, source_text, rules_json, compiled_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  
  stmt.run(
    graph.merchant_id,
    graph.version,
    graph.source_text,
    JSON.stringify(graph.rules),
    graph.compiled_at
  );
}

export function getPolicies(merchantId: string, version?: string): PolicyGraph | null {
  const db = getDb();
  let row;
  
  if (version) {
    row = db.prepare('SELECT * FROM policy_versions WHERE merchant_id = ? AND version = ?').get(merchantId, version);
  } else {
    // Get latest
    row = db.prepare('SELECT * FROM policy_versions WHERE merchant_id = ? ORDER BY id DESC LIMIT 1').get(merchantId);
  }

  if (!row) return null;
  
  return {
    merchant_id: row.merchant_id,
    version: row.version as any,
    rules: JSON.parse(row.rules_json) as any,
    compiled_at: row.compiled_at,
    source_text: row.source_text
  };
}
