import fs from 'fs';
import path from 'path';

console.warn('⚠️ WARNING: DB RESET INITIATED. THIS WILL DESTROY ALL DATA.');

const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'policyshield.db');

if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log(`Deleted existing database at ${dbPath}`);
}
if (fs.existsSync(dbPath + '-wal')) {
  fs.unlinkSync(dbPath + '-wal');
}
if (fs.existsSync(dbPath + '-shm')) {
  fs.unlinkSync(dbPath + '-shm');
}

console.log('Running migrations...');
require('./migrate');

console.log('Seeding initial data...');
require('./seed');

console.log('✅ Database reset complete.');
