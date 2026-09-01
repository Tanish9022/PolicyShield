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

export async function getPolicies(merchantId: string, version?: string): Promise<PolicyGraph | null> {
  const db = getDb();
  let row;
  
  if (version) {
    row = await db.prepare('SELECT * FROM policy_versions WHERE merchant_id = ? AND version = ?').get(merchantId, version);
  } else {
    // Get latest
    row = await db.prepare('SELECT * FROM policy_versions WHERE merchant_id = ? ORDER BY id DESC LIMIT 1').get(merchantId);
  }

  if (!row) return null;
  
  return {
    merchant_id: (row as any).merchant_id,
    version: (row as any).version,
    rules: JSON.parse((row as any).rules_json),
    compiled_at: (row as any).compiled_at,
    source_text: (row as any).source_text
  };
}
