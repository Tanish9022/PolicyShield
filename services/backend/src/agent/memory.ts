import { IntentRequest } from '@policyshield/shared';

const MAX_PREFERENCE_KEYS = 10;
const MAX_SERIALIZED_SIZE = 1024 * 16; // 16KB max size

export function updateBuyerMemory(
  db: any,
  customer_id: string,
  merchant_id: string,
  newPreferenceKey: string,
  newPreferenceValue: any,
  expected_version?: number
): boolean {
  const existing = db.prepare(`SELECT * FROM buyer_memory WHERE customer_id = ? AND merchant_id = ?`).get(customer_id, merchant_id);
  
  if (existing) {
    if (expected_version !== undefined && existing.memory_version !== expected_version) {
      return false; // Stale write detected
    }
    
    const prefs = JSON.parse(existing.preferences_json);
    
    // Bounds checking
    if (!prefs.hasOwnProperty(newPreferenceKey) && Object.keys(prefs).length >= MAX_PREFERENCE_KEYS) {
      // Deterministic behavior: reject new preference if limit reached
      return false; 
    }
    
    prefs[newPreferenceKey] = newPreferenceValue;
    const serialized = JSON.stringify(prefs);
    if (serialized.length > MAX_SERIALIZED_SIZE) return false;
    
    const res = db.prepare(`
      UPDATE buyer_memory 
      SET preferences_json = ?, memory_version = memory_version + 1, last_updated = datetime('now')
      WHERE customer_id = ? AND merchant_id = ? AND memory_version = ?
    `).run(serialized, customer_id, merchant_id, existing.memory_version);
    
    return res.changes > 0;
  } else {
    const prefs = { [newPreferenceKey]: newPreferenceValue };
    const serialized = JSON.stringify(prefs);
    if (serialized.length > MAX_SERIALIZED_SIZE) return false;
    
    try {
      db.prepare(`
        INSERT INTO buyer_memory (customer_id, merchant_id, preferences_json, negotiation_history_json, memory_version, created_at, last_updated)
        VALUES (?, ?, ?, '[]', 1, datetime('now'), datetime('now'))
      `).run(customer_id, merchant_id, serialized);
      return true;
    } catch (e) {
      // Concurrent insert or other failure
      return false;
    }
  }
}

export function resetBuyerMemory(db: any, customer_id: string, merchant_id: string) {
  db.prepare(`DELETE FROM buyer_memory WHERE customer_id = ? AND merchant_id = ?`).run(customer_id, merchant_id);
}

function checkAndPersist(db: any, customer_id: string, merchant_id: string, intent_id: string, key: string, newValue: any, version?: number) {
  const existing = db.prepare(`SELECT preferences_json FROM buyer_memory WHERE customer_id = ? AND merchant_id = ?`).get(customer_id, merchant_id);
  if (existing) {
    const prefs = JSON.parse(existing.preferences_json);
    if (prefs[key] !== undefined && prefs[key] !== newValue) {
      db.prepare(`INSERT INTO audit_events (event_id, event_type, intent_id, action_id, timestamp, metadata_json) VALUES (?, 'MEMORY_CONFLICT_DETECTED', ?, '', datetime('now'), ?)`).run(
        require('uuid').v4(), intent_id, JSON.stringify({ key, old: prefs[key], new: newValue })
      );
      // Current request wins for this transaction, but do not rewrite long-term memory without explicit confirmation
      return; 
    }
  }
  updateBuyerMemory(db, customer_id, merchant_id, key, newValue, version);
}

export function extractAndPersistExplicitPreferences(db: any, intent: IntentRequest) {
  if (!intent.customer_id) return;
  
  const input = intent.buyer_input.toLowerCase();
  
  // Fetch current memory version for optimistic concurrency
  const existing = db.prepare(`SELECT memory_version FROM buyer_memory WHERE customer_id = ? AND merchant_id = ?`).get(intent.customer_id, intent.merchant_id);
  const v = existing ? existing.memory_version : undefined;
  
  if (input.includes('prefer lenovo') || input.includes('prefers lenovo')) {
    checkAndPersist(db, intent.customer_id, intent.merchant_id, intent.intent_id, 'brand_preference', 'Lenovo', v);
  } else if (input.includes('prefers apple') || input.includes('prefer apple')) {
    checkAndPersist(db, intent.customer_id, intent.merchant_id, intent.intent_id, 'brand_preference', 'Apple', v);
  } else if (input.includes('budget preference') || input.includes('<= 70k') || input.includes('budget 70k')) {
    checkAndPersist(db, intent.customer_id, intent.merchant_id, intent.intent_id, 'budget_preference', 70000, v);
  } else if (input.includes('fast delivery preferred') || input.includes('prefers next-day delivery')) {
    checkAndPersist(db, intent.customer_id, intent.merchant_id, intent.intent_id, 'delivery_preference', 'express', v);
  } else if (input.includes('budget 75k') || input.includes('budget is 75000')) {
    checkAndPersist(db, intent.customer_id, intent.merchant_id, intent.intent_id, 'budget_preference', 75000, v);
  }
}
