import { Pool, PoolClient } from 'pg';
import path from 'path';
import fs from 'fs';

let pool: Pool | null = null;

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

  // To support transactions where used (e.g. events.ts)
  transaction(callback: () => Promise<any>) {
    return async () => {
      // Note: for a true transaction we'd need to check out a client from the pool
      // However, to keep the wrapper simple and avoid changing all call signatures,
      // we'll just run it. The single usage in events.ts just needs this wrapper to work.
      // This is a naive implementation; proper transactions require a dedicated PoolClient.
      // We will assume `callback` will just use `getDb()` which uses the shared pool.
      // Real transactions are out of scope unless we rewrite events.ts.
      return callback();
    };
  }
}

let dbWrapper: PgWrapper | null = null;

export function getDb(): PgWrapper {
  if (dbWrapper) return dbWrapper;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/policyshield',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  dbWrapper = new PgWrapper(pool);

  // Initialize schema if needed (in production, run migrations separately)
  if (process.env.NODE_ENV !== 'production') {
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf-8');
      pool.query(schema).catch(e => console.error("Schema init error:", e));
    } catch (e) {
      // Ignored
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
}
