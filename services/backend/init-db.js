require('dotenv').config({ path: '../../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const schemaPath = path.join(__dirname, 'src', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
    console.log("Schema applied successfully.");
  } catch (err) {
    console.error("Schema init error:", err.message);
  } finally {
    pool.end();
  }
}

run();
