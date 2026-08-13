import { defineConfig, devices } from '@playwright/test';

const CONSOLE_URL = process.env.CONSOLE_URL ?? 'http://localhost:3001';

/**
 * The suite runs against a real backend with seeded data — there are no network
 * mocks. A console that renders correctly against a mock proves nothing about
 * whether coverage is actually being reported.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: CONSOLE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // 1280px is the narrowest width the console must work at (PRD §10.6).
    viewport: { width: 1280, height: 900 },
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: process.env.CONSOLE_URL
    ? undefined
    : {
        command: 'npm run start',
        url: CONSOLE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
