import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:5173';
const apiBaseURL = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:7071/api';
const isFullStack = process.env.FULLSTACK_E2E === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: isFullStack
          ? `VITE_API_BASE=${apiBaseURL} npm run dev -- --host 127.0.0.1`
          : 'npm run dev -- --host 127.0.0.1',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: 'chromium',
      testIgnore: /fullstack-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'fullstack',
      testMatch: /fullstack-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
