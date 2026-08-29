import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/eval/vitest.setup.ts'],
    pool: 'forks', // Use forks for better isolated execution or better-sqlite3 compatibility
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
