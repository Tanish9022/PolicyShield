import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/eval/vitest.setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    passWithNoTests: false, // Ensure CI fails if no tests run
    pool: 'forks', // Use forks for better isolated execution or better-sqlite3 compatibility
    testTimeout: 30000
  }
});
