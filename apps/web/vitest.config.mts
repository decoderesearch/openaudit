import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Two fast layers: logic in node, components in happy-dom. Pages are Playwright (e2e/).
// `db` needs the test database: run it with `pnpm test:db`.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'logic',
          environment: 'node',
          include: ['lib/**/*.test.ts', 'scripts/**/*.test.ts'],
          exclude: ['**/*.db.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'components',
          environment: 'happy-dom',
          include: ['components/**/*.test.tsx', 'app/**/*.test.tsx'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          environment: 'node',
          include: ['**/*.db.test.ts'],
          exclude: ['node_modules/**'],
          // The files share one database, and some delete whole tables.
          fileParallelism: false,
          globalSetup: ['./e2e/global-setup.ts'],
        },
      },
    ],
  },
});
