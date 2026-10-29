import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

function freePort() { return new Promise(resolve => { const server = http.createServer(); server.listen(0, '127.0.0.1', () => { const address = server.address(); server.close(() => resolve(address.port)); }); }); }
const root = process.cwd();
const output = path.join(root, 'docs', 'phases', 'phase-5.5-visual');
async function waitForStudioStatus(page) { await page.waitForFunction(() => !document.querySelector('#codex-connection')?.textContent?.toLowerCase().includes('checking'), null, { timeout: 25_000 }); }
const temporary = fs.mkdtempSync(path.join(root, '.live-patch-visual-'));
const game = path.join(temporary, 'game');
const defaultGame = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).livePatch.defaultGame;
fs.cpSync(path.resolve(root, defaultGame), game, { recursive: true });
process.env.LIVE_PATCH_GAME = game;
process.env.LIVE_PATCH_DATA_DIR = path.join(temporary, 'data');
process.env.LIVE_PATCH_HTTP_PORT = String(await freePort());
delete process.env.LIVE_PATCH_TEST_SERVER;
process.env.TWITCH_CLIENT_ID = '';
process.env.TWITCH_CLIENT_SECRET = '';
process.env.TWITCH_PITCH_REWARD_ID = '';
let server; let browser;
try {
  server = await createServer({ server: { host: '127.0.0.1' } }); await server.listen();
  const origin = `https://localhost:${process.env.LIVE_PATCH_HTTP_PORT}`;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, ignoreHTTPSErrors: true });
  const studio = await context.newPage();
  fs.mkdirSync(output, { recursive: true });
  await studio.goto(`${origin}/?first-run=1`);
  await studio.locator('.welcome-dialog').waitFor({ state: 'visible' });
  await studio.screenshot({ path: path.join(output, '06-welcome.png') });
  await studio.locator('#welcome-close').click();
  await studio.locator('#home-game').getByText('Arena Survivor').waitFor();
  await waitForStudioStatus(studio);
  await studio.screenshot({ path: path.join(output, '01-home.png') });
  await studio.goto(`${origin}/?view=practice`);
  await studio.locator('#practice-phase').waitFor({ state: 'visible' });
  await waitForStudioStatus(studio);
  await studio.screenshot({ path: path.join(output, '08-practice.png') });
  await studio.getByRole('button', { name: 'Run a full round automatically' }).click();
  await studio.locator('#demo-ship').waitFor({ state: 'visible' });
  const play = await context.newPage(); await play.goto(`${origin}/play`);
  await play.locator('#status').getByText('LIVE', { exact: false }).waitFor();
  await studio.goto(`${origin}/?view=go-live`);
  await studio.locator('#play-mirror').waitFor({ state: 'visible', timeout: 10_000 });
  await waitForStudioStatus(studio);
  await studio.frameLocator('#overlay-mirror').locator('#phase').getByText('ROUND', { exact: false }).waitFor();
  await studio.screenshot({ path: path.join(output, '02-go-live.png') });
  await studio.getByRole('link', { name: /Customize OBS overlay/ }).click();
  await studio.locator('.overlay-editor').screenshot({ path: path.join(output, '09-overlay-editor.png') });
  await studio.goto(`${origin}/?view=library`);
  await studio.locator('.library-card img').waitFor({ state: 'visible' });
  await waitForStudioStatus(studio);
  await studio.screenshot({ path: path.join(output, '05-library.png') });
  await studio.goto(`${origin}/?view=practice`);
  await studio.locator('#demo-ship').waitFor({ state: 'visible' });
  await studio.locator('#demo-ship').click();
  await studio.locator('#quick-result').getByText('Done.', { exact: false }).waitFor();
  await play.waitForFunction(() => document.querySelector('#mutations')?.textContent?.includes('Demo patch: Coin Shower'), null, { timeout: 10_000 });
  await play.waitForTimeout(3200);
  await play.screenshot({ path: path.join(output, '03-game-window.png') });
  await play.keyboard.press('p');
  await play.locator('#play-menu').waitFor({ state: 'visible' });
  await play.locator('#menu-tabs button[data-tab="patches"]').click();
  await play.screenshot({ path: path.join(output, '04-pause-menu.png') });
  await play.keyboard.press('p');
  await studio.evaluate(async () => {
    for (let index = 0; index < 3; index++) {
      await fetch('/api/simulator/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: crypto.randomUUID(), kind: 'chat', text: `!idea A practice vote idea ${index + 1}`, viewer: { id: `capture-${index}-${crypto.randomUUID()}`, login: `capture${index}`, name: `Capture viewer ${index + 1}`, moderator: false, broadcaster: false } }) });
    }
    await fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'advance' }) });
  });
  await studio.goto(`${origin}/?view=go-live`);
  await studio.locator('#round-phase').getByText('VOTE').waitFor();
  await play.bringToFront();
  await play.waitForTimeout(1200);
  await studio.bringToFront();
  await studio.locator('#play-mirror').waitFor({ state: 'visible', timeout: 10_000 });
  await studio.waitForTimeout(1200);
  await studio.screenshot({ path: path.join(output, '02-go-live.png') });
  await play.evaluate(() => { const overlay = document.createElement('iframe'); overlay.src = '/overlay.html'; overlay.title = 'OBS overlay composite'; Object.assign(overlay.style, { position: 'absolute', inset: '0', width: '1920px', height: '1080px', border: '0', pointerEvents: 'none', zIndex: '12' }); document.querySelector('#play-shell').append(overlay); });
  await play.frameLocator('iframe[title="OBS overlay composite"]').locator('#pitch-ticker').waitFor({ state: 'visible' });
  await play.waitForTimeout(3500);
  await play.screenshot({ path: path.join(output, '07-stream-overlay.png') });
  console.log(`Captured eight Phase 5.5 concept screens and the overlay editor in ${output}`);
} finally {
  await browser?.close(); await server?.close();
  if (!path.resolve(temporary).startsWith(path.resolve(root) + path.sep)) throw Error('Unexpected temporary visual path');
  fs.rmSync(temporary, { recursive: true, force: true });
}
