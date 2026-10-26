import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const fallback = (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { livePatch: { defaultGame: string } }).livePatch.defaultGame;
const gameDirectory = process.env.LIVE_PATCH_TEST_GAME_DIR || path.resolve(root, process.env.LIVE_PATCH_GAME || fallback);
export default defineConfig({
  testDir: path.join(gameDirectory, 'tests/smoke'), testMatch: '**/*.spec.ts',
  timeout: 30_000,
  use: { baseURL: process.env.LIVE_PATCH_BASE_URL || 'http://127.0.0.1:5173', headless: true },
  webServer: process.env.LIVE_PATCH_TEST_SERVER ? undefined : { command: 'node scripts/dev.mjs', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI, timeout: 30_000 }
});
