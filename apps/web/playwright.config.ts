import { defineConfig, devices } from '@playwright/test';

// Page tests at two viewports against the test database. Run through `pnpm test:e2e`, which
// loads `.env.test`. Locally the server is `next dev`; in CI it is a production build.
const PORT = 3301;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'phone',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: CI ? `NODE_ENV=production next build && next start -p ${PORT}` : `next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // The tests sign in, and sign-in is off unless OPENAUDIT_SIGN_IN is "1".
    env: { OPENAUDIT_SIGN_IN: '1' },
    reuseExistingServer: !CI,
    timeout: 120_000,
    stdout: 'pipe',
  },
});
