import { getDb, closeDb } from './client';

console.log('Running database migrations...');
// getDb() automatically runs the current schema.sql
const db = getDb();
console.log('Database schema successfully migrated/initialized.');
closeDb();
