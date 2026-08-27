import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

/**
 * Get or create the SQLite database connection.
 * Reads DB_PATH from environment, defaults to ./policyshield.db.
 */
export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = process.env.DB_PATH || './policyshield.db';
  db = new Database(dbPath);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Initialize schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  return db;
}

/**
 * Close the database connection (for graceful shutdown).
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
