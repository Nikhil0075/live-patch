import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(root, '.live-patch-phase6-capture-'));
const data = path.join(temp, 'data');
const output = path.join(root, 'docs', 'phases', 'phase-6-visual');
fs.mkdirSync(data, { recursive: true });
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(data, 'tokens.json'), '{}');
Object.assign(process.env, { LIVE_PATCH_GAME: path.join(root, 'games', 'lantern-run'), LIVE_PATCH_DATA_DIR: data,
  LIVE_PATCH_BUILDS_DIR: path.join(temp, 'builds'), LIVE_PATCH_TEST_SERVER: '1' });
let server, browser;
try {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw Error('No capture server address');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const base = `http://127.0.0.1:${address.port}`;
  await page.goto(`${base}/play`);
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Lantern Run · LIVE'));
  await page.waitForFunction(() => document.querySelector('#mutations')?.textContent?.includes('Forest Breeze · active'));
  await page.waitForTimeout(3600);
  await page.evaluate(() => {
    window.__livePatch.game.apply({ type: 'spawn', args: ['log', 950, 485] }, 'capture');
    window.__livePatch.game.apply({ type: 'spawn', args: ['owl', 1090, 350] }, 'capture');
  });
  await page.screenshot({ path: path.join(output, '01-gameplay.png') });

  const game = path.join(root, 'games', 'lantern-run');
  const names = ['mutations/01-firefly-trail.js', 'mutations/02-forest-breeze.js', 'mutations/03-lantern-keeper.js',
    'demo/firefly-swarm.js', 'tests/fixtures/rainy-forest.js'];
  const files = names.map(file => ({ name: path.basename(file), source: fs.readFileSync(path.join(game, file), 'utf8'), error: null }));
  files.push({ name: 'visual-evolved.js', source: "export const meta={id:'visual-evolved',title:'Evolved Forest',author:'Live Patch',description:'A shield, owl and ledges make this run visibly different.'}; export function onStart(game){game.grantPowerUp('shield',15);game.spawn('owl',1050,305,2);game.spawn('ledge',760,405,1.5);game.spawn('ledge',1000,370,1.5);game.spawn('spring',900,495);game.burst('celebration',720,350);game.showMessage('THE FOREST IS CHANGING')}", error: null });
  await page.evaluate(files => window.__livePatch.host.sync(files), files);
  await page.waitForFunction(() => document.querySelector('#mutations')?.textContent?.includes('Evolved Forest · active'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(output, '04-evolved.png') });

  await page.reload();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Lantern Run · LIVE'));
  await page.evaluate(() => window.__livePatch.game.apply({ type: 'setParameter', args: ['runSpeed', 600] }, 'capture'));
  await page.waitForFunction(() => window.__livePatch.game.snapshot().runElapsed > 3.1, undefined, { timeout: 12000 });
  for (let hearts = 2; hearts >= 0; hearts--) {
    await page.evaluate(() => window.__livePatch.game.apply({ type: 'spawn', args: ['boulder', 520, 480] }, 'capture'));
    await page.waitForFunction(hearts => window.__livePatch.game.snapshot().player.hearts <= hearts, hearts, { timeout: 6000 });
    if (hearts > 0) await page.waitForTimeout(1200);
  }
  await page.waitForFunction(() => window.__livePatch.game.snapshot().runOver, undefined, { timeout: 2000 });
  await page.screenshot({ path: path.join(output, '05-run-over.png') });

  await page.goto(`${base}/?view=library`);
  await page.locator('.library-card').getByText('Lantern Run').waitFor();
  await page.screenshot({ path: path.join(output, '06-library.png') });
  console.log(`Captured four 1920×1080 Phase 6 views in ${output}`);
} finally {
  await browser?.close();
  await server?.close();
  const resolved = path.resolve(temp);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw Error(`Unsafe capture directory: ${resolved}`);
  fs.rmSync(resolved, { recursive: true, force: true });
}
