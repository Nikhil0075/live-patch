import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(root, '.live-patch-phase6-fps-'));
const data = path.join(temp, 'data');
fs.mkdirSync(data, { recursive: true });
fs.writeFileSync(path.join(data, 'tokens.json'), '{}');
Object.assign(process.env, { LIVE_PATCH_GAME: path.join(root, 'games', 'lantern-run'), LIVE_PATCH_DATA_DIR: data,
  LIVE_PATCH_BUILDS_DIR: path.join(temp, 'builds'), LIVE_PATCH_TEST_SERVER: '1' });
let server, browser;
try {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw Error('No probe server address');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`http://127.0.0.1:${address.port}/play`);
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Lantern Run · LIVE'));
  await page.waitForTimeout(2000);
  const baseline = await page.evaluate(() => window.__livePatch.game.snapshot().frameRate);
  await page.evaluate(() => {
    const game = window.__livePatch.game;
    game.apply({ type: 'setWeather', args: ['rain'] }, 'fps-probe');
    for (const [kind, count] of [['firefly', 40], ['acorn', 10], ['owl', 6], ['pinecone', 10], ['log', 12], ['ledge', 10], ['spring', 4], ['shield', 4]])
      for (let i = 0; i < count; i++) game.apply({ type: 'spawn', args: [kind, 700 + i % 7 * 50, 260 + i % 4 * 40] }, 'fps-probe');
    for (let i = 0; i < 20; i++) game.apply({ type: 'burst', args: ['sparks', 720, 330] }, 'fps-probe');
  });
  await page.waitForTimeout(1600);
  const after = await page.evaluate(() => window.__livePatch.game.snapshot());
  console.log(JSON.stringify({ baselineFps: Number(baseline.toFixed(1)), crowdedFps: Number(after.frameRate.toFixed(1)),
    maxFrameGapMs: Number(after.maxFrameGap.toFixed(1)), entities: after.activeEntities, particles: after.particles }));
} finally {
  await browser?.close(); await server?.close();
  if (!path.resolve(temp).startsWith(path.resolve(root) + path.sep)) throw Error(`Unsafe probe path: ${temp}`);
  fs.rmSync(temp, { recursive: true, force: true });
}
