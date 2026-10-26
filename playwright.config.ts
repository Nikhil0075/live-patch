import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5173', headless: true },
  webServer: process.env.LIVE_PATCH_TEST_SERVER ? undefined : { command: 'node scripts/dev.mjs', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 30_000 }
});
