import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';

export default defineConfig({
  testDir: './e2e', fullyParallel: false, retries: process.env.CI ? 2 : 0, workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'list',
  use: { baseURL, trace: 'retain-on-failure', video: 'off', ...devices['Desktop Chrome'] },
  webServer: { command: 'npm run start', url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
