import { Pool, PoolClient } from 'pg';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

let pool: Pool | null = null;
let sqliteDb: Database.Database | null = null;

class PgStatement {
  constructor(private client: Pool | PoolClient, private sql: string) {}

  private convertSqlAndArgs(args: any[]) {
    let pgSql = this.sql;
    const pgArgs = [...args];
    let count = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${count}`);
      count++;
    }
    return { text: pgSql, values: pgArgs };
  }

  async run(...args: any[]) {
    const { text, values } = this.convertSqlAndArgs(args);
    return this.client.query(text, values);
  }

  async get(...args: any[]) {
    const { text, values } = this.convertSqlAndArgs(args);
    const res = await this.client.query(text, values);
    return res.rows[0];
  }

  async all(...args: any[]) {
    const { text, values } = this.convertSqlAndArgs(args);
    const res = await this.client.query(text, values);
    return res.rows;
  }
}

export class PgWrapper {
  constructor(public client: Pool | PoolClient) {}

  prepare(sql: string) {
    return new PgStatement(this.client, sql);
  }

  async exec(sql: string) {
    return this.client.query(sql);
  }

  transaction(callback: () => Promise<any>) {
    return async () => {
      return callback();
    };
  }
}

let dbWrapper: PgWrapper | null = null;

export function getDb(): any {
  if (process.env.NODE_ENV === 'test' || process.env.USE_SQLITE === 'true' || (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production')) {
    if (sqliteDb) return sqliteDb;
    sqliteDb = new Database(process.env.DB_PATH || './policyshield.db');
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      sqliteDb.exec(schema);
    } catch(e) {}
    return sqliteDb;
  }

  if (dbWrapper) return dbWrapper;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/policyshield',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  dbWrapper = new PgWrapper(pool);

  if (process.env.NODE_ENV !== 'production') {
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      pool.query(schema).catch(e => console.error("Schema init error:", e));
    } catch (e) {
    }
  }

  return dbWrapper;
}

export function closeDb(): void {
  if (pool) {
    pool.end();
    pool = null;
    dbWrapper = null;
  }
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
}
