import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = process.cwd(), output = path.join(root, 'docs', 'phases', 'phase-6-audio');
fs.mkdirSync(output, { recursive: true });
const temp = fs.mkdtempSync(path.join(root, '.live-patch-audio-'));
fs.mkdirSync(path.join(temp, 'data'));
fs.writeFileSync(path.join(temp, 'data', 'tokens.json'), '{}');
Object.assign(process.env, { LIVE_PATCH_GAME: path.join(root, 'games', 'lantern-run'), LIVE_PATCH_DATA_DIR: path.join(temp, 'data'),
  LIVE_PATCH_BUILDS_DIR: path.join(temp, 'builds'), LIVE_PATCH_TEST_SERVER: '1' });
const port = await new Promise((resolve, reject) => {
  const socket = net.createServer(); socket.once('error', reject);
  socket.listen(0, '127.0.0.1', () => { const address = socket.address(); socket.close(() => resolve(address.port)); });
});
let server, browser;
try {
  server = await createServer({ server: { host: '127.0.0.1', port } }); await server.listen();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/play`);
  for (const kind of ['music', 'sfx']) {
    const base64 = await page.evaluate(async kind => {
      const audioPath = '/games/lantern-run/src/audio.ts', settingsPath = '/engine/studio/settings-defaults.ts';
      const { LanternAudio, MUSIC_BAR, sounds } = await import(/* @vite-ignore */ audioPath);
      const { defaultSettings } = await import(/* @vite-ignore */ settingsPath);
      const rate = 22050, seconds = kind === 'music' ? 20 : 14, count = rate * seconds;
      const context = new OfflineAudioContext(1, count, rate);
      const audio = new LanternAudio(defaultSettings, context);
      if (kind === 'music') audio.scheduleMusic(.1, 8, { melody: true, rhythm: true });
      else for (let i = 0; i < sounds.length; i++) audio.scheduleEffect(sounds[i], .15 + i * .96);
      const samples = (await context.startRendering()).getChannelData(0);
      const bytes = new Uint8Array(44 + count * 2), view = new DataView(bytes.buffer);
      const word = (offset, value) => view.setUint32(offset, value, true);
      const short = (offset, value) => view.setUint16(offset, value, true);
      for (const [offset, label] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']])
        for (let i = 0; i < 4; i++) bytes[offset + i] = label.charCodeAt(i);
      word(4, bytes.length - 8); word(16, 16); short(20, 1); short(22, 1); word(24, rate);
      word(28, rate * 2); short(32, 2); short(34, 16); word(40, count * 2);
      for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
      let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(binary);
    }, kind);
    const filename = kind === 'music' ? 'music-20s.wav' : 'sfx-all.wav';
    fs.writeFileSync(path.join(output, filename), Buffer.from(base64, 'base64'));
    if (fs.statSync(path.join(output, filename)).size >= 1_000_000) throw Error(`${filename} exceeds 1 MB`);
    console.log(`${filename}: ${fs.statSync(path.join(output, filename)).size} bytes, mono 22050 Hz`);
  }
} finally {
  await browser?.close(); await server?.close();
  const resolved = path.resolve(temp);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw Error(`Unsafe audio temp directory: ${resolved}`);
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
}
