import assert from 'node:assert/strict';
import fs from 'node:fs';
import http2 from 'node:http2';
import net from 'node:net';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      if (!address || typeof address === 'string') { socket.close(); reject(Error('No free port')); return; }
      socket.close(() => resolve(address.port));
    });
  });
}

function h2Post(origin, requestOrigin) {
  return new Promise((resolve, reject) => {
    const client = http2.connect(origin, { rejectUnauthorized: false });
    client.once('error', reject);
    const request = client.request({ ':method': 'POST', ':path': '/api/control', ':authority': new URL(origin).host, origin: requestOrigin, 'content-type': 'application/json' });
    let status;
    request.on('response', headers => { status = headers[':status']; });
    request.on('data', () => {});
    request.on('end', () => { client.close(); resolve(status); });
    request.once('error', error => { client.close(); reject(error); });
    request.end(JSON.stringify({ action: 'pause' }));
  });
}

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(root, '.live-patch-https-test-'));
const game = path.join(temp, 'game');
const defaultGame = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).livePatch.defaultGame;
fs.cpSync(path.resolve(root, defaultGame), game, { recursive: true });
process.env.LIVE_PATCH_GAME = game;
process.env.LIVE_PATCH_DATA_DIR = path.join(temp, 'data');
process.env.LIVE_PATCH_HTTP_PORT = String(await freePort());
process.env.TWITCH_CLIENT_ID = '';
process.env.TWITCH_CLIENT_SECRET = '';
process.env.TWITCH_PITCH_REWARD_ID = '';
delete process.env.LIVE_PATCH_TEST_SERVER;

let server;
let browser;
try {
  server = await createServer({ server: { host: '127.0.0.1' } });
  await server.listen();
  const origin = `https://localhost:${process.env.LIVE_PATCH_HTTP_PORT}`;
  assert.equal(await h2Post(origin, origin), 200, 'same-origin HTTP/2 control request');
  assert.equal(await h2Post(origin, 'https://outside.example'), 403, 'cross-origin HTTP/2 request');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto(`${origin}/?view=practice`);
  await page.getByRole('button', { name: 'Generate sample pitch' }).click();
  await page.locator('#send button:not([type])').click();
  await page.locator('#result').getByText('Idea received', { exact: false }).waitFor();
  const ideas = await page.evaluate(() => fetch('/api/ideas').then(response => response.json()));
  assert.equal(ideas.ideas.length, 1, 'Practice pitch is persisted');
  await page.goto(`${origin}/?view=go-live`);
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pause' }) });
    return { status: response.status, phase: (await response.json()).phase };
  });
  assert.deepEqual(result, { status: 200, phase: 'paused' }, 'Go Live control works in Chromium over HTTPS');
  await page.goto(`${origin}/`);
  if (await page.locator('#welcome-close').isVisible()) await page.locator('#welcome-close').click();
  const opened = page.waitForEvent('popup');
  await page.locator('#home-play').click();
  const play = await opened;
  await play.locator('#game canvas').waitFor({ state: 'visible', timeout: 15_000 });
  assert.match(await play.title(), /^Live Patch · /, 'named Play window has a stable title');
  await play.keyboard.press('p');
  await play.locator('#play-menu').waitFor({ state: 'visible' });
  await play.close();
  console.log('HTTPS regression passed: HTTP/2 same-origin, cross-origin denial, Practice, Go Live and Play window');
} finally {
  await browser?.close();
  await server?.close();
  if (!path.resolve(temp).startsWith(path.resolve(root) + path.sep)) throw Error('Unexpected temporary test path');
  fs.rmSync(temp, { recursive: true, force: true });
}
