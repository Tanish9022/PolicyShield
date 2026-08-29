-- PolicyShield SQLite Schema
-- Tables for the audit ledger, action state, policies, and idempotency.

-- ─── Policies ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS policy_versions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id   TEXT    NOT NULL,
  version       TEXT    NOT NULL UNIQUE,
  source_text   TEXT    NOT NULL,
  rules_json    TEXT    NOT NULL,  -- JSON array of PolicyRule
  compiled_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(merchant_id, version)
);

CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    currency TEXT DEFAULT 'INR'
);

CREATE TABLE IF NOT EXISTS inventory (
    product_id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    stock_level INTEGER NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(product_id)
);

-- ─── Intents ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intents (
  intent_id     TEXT    PRIMARY KEY,
  request_id    TEXT    NOT NULL,
  merchant_id   TEXT    NOT NULL,
  buyer_input   TEXT    NOT NULL,
  customer_id   TEXT,
  received_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Actions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS actions (
  action_id         TEXT    PRIMARY KEY,
  intent_id         TEXT    NOT NULL REFERENCES intents(intent_id),
  merchant_id       TEXT    NOT NULL,
  idempotency_key   TEXT    NOT NULL UNIQUE,
  action_type       TEXT    NOT NULL,
  state             TEXT    NOT NULL DEFAULT 'PROPOSED',
  decision          TEXT    NOT NULL,
  policy_version    TEXT    NOT NULL,
  parameters_json   TEXT    NOT NULL DEFAULT '{}',
  razorpay_order_id TEXT,
  reason_codes_json TEXT    NOT NULL DEFAULT '[]',
  evidence_json     TEXT    NOT NULL DEFAULT '[]',
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Audit Events ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_events (
  event_id        TEXT    PRIMARY KEY,
  event_type      TEXT    NOT NULL,
  intent_id       TEXT    NOT NULL,
  action_id       TEXT    NOT NULL DEFAULT '',
  policy_version  TEXT    NOT NULL DEFAULT '',
  model_version   TEXT    NOT NULL DEFAULT '',
  decision        TEXT    NOT NULL DEFAULT '',
  policy_ids_json TEXT    NOT NULL DEFAULT '[]',
  evidence_json   TEXT    NOT NULL DEFAULT '[]',
  action_type     TEXT    NOT NULL DEFAULT '',
  result          TEXT    NOT NULL DEFAULT '',
  metadata_json   TEXT    NOT NULL DEFAULT '{}',
  timestamp       TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Webhook Events (deduplication) ─────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id      TEXT    PRIMARY KEY,
  event_type    TEXT    NOT NULL,
  payload_json  TEXT    NOT NULL,
  processed     INTEGER NOT NULL DEFAULT 0,
  received_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── Indexes ────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_actions_intent     ON actions(intent_id);
CREATE INDEX IF NOT EXISTS idx_actions_idempotency ON actions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_audit_intent        ON audit_events(intent_id);
CREATE INDEX IF NOT EXISTS idx_audit_action        ON audit_events(action_id);
CREATE INDEX IF NOT EXISTS idx_policy_merchant     ON policy_versions(merchant_id);

-- ─── Metrics & Tracing ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS metric_events (
  event_id        TEXT    PRIMARY KEY,
  trace_id        TEXT    NOT NULL,
  request_id      TEXT    NOT NULL,
  intent_id       TEXT    NOT NULL,
  action_id       TEXT,
  stage           TEXT    NOT NULL,
  start_time      INTEGER NOT NULL,
  end_time        INTEGER NOT NULL,
  duration_ms     REAL    NOT NULL,
  result          TEXT    NOT NULL,
  decision        TEXT,
  error_type      TEXT,
  model           TEXT,
  metadata        TEXT    NOT NULL DEFAULT '{}',
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS traces (
  trace_id        TEXT    PRIMARY KEY,
  request_id      TEXT    NOT NULL,
  intent_id       TEXT    NOT NULL,
  action_id       TEXT,
  total_duration_ms REAL,
  status          TEXT    NOT NULL,
  error_type      TEXT,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_metrics_trace ON metric_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_metrics_intent ON metric_events(intent_id);
CREATE INDEX IF NOT EXISTS idx_traces_request ON traces(request_id);

-- ─── Agent Runs ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_runs (
  agent_run_id        TEXT    PRIMARY KEY,
  intent_id           TEXT    NOT NULL REFERENCES intents(intent_id),
  merchant_id         TEXT    NOT NULL,
  state               TEXT    NOT NULL DEFAULT 'NEW',
  current_step        TEXT    NOT NULL DEFAULT 'DISCOVERY',
  policy_version      TEXT,
  selected_product_id TEXT,
  selected_action_id  TEXT,
  adaptation_count    INTEGER NOT NULL DEFAULT 0,
  trace_id            TEXT    NOT NULL,
  trace_events_json   TEXT    NOT NULL DEFAULT '[]',
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at        TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_intent ON agent_runs(intent_id);
