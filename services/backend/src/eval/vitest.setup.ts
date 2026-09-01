import { beforeEach, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, resetTestDatabase } from './test-db';

beforeAll(() => {
  process.env.STUB_AI = 'true';
  process.env.STUB_RAZORPAY = 'true';
  setupTestDatabase();
});

beforeEach(async () => {
  await resetTestDatabase();
});

afterAll(() => {
  teardownTestDatabase();
});
