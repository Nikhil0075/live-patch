import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
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
  const freePort = await new Promise((resolve, reject) => {
    const socket = net.createServer(); socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const address = socket.address(); socket.close(() => resolve(address.port)); });
  });
  server = await createServer({ server: { host: '127.0.0.1', port: freePort } });
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw Error('No capture server address');
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const base = `http://127.0.0.1:${address.port}`;
  await page.goto(`${base}/play`);
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Lantern Run · LIVE'));
  await page.waitForFunction(() => document.querySelector('#mutations')?.textContent?.includes('Forest Breeze · active'));
  await page.evaluate(() => {
    const game = window.__livePatch.game;
    game.apply({ type: 'setParameter', args: ['runSpeed', 600] }, 'capture');
    game.apply({ type: 'heal', args: [3] }, 'capture');
  });
  await page.waitForFunction(() => {
    const visible = window.__livePatch.game.snapshot().entities.filter(item => item.x > 550 && item.x < 1080);
    return visible.some(item => ['firefly', 'acorn'].includes(item.kind)) && visible.some(item => ['log', 'thorns', 'boulder', 'owl'].includes(item.kind));
  }, undefined, { timeout: 40_000 });
  await page.evaluate(() => { const game = window.__livePatch.game; game.apply({ type: 'setParameter', args: ['runSpeed', 260] }, 'capture'); game.apply({ type: 'heal', args: [3] }, 'capture'); });
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
  await page.evaluate(() => { const game = window.__livePatch.game; game.apply({ type: 'setParameter', args: ['runSpeed', 120] }, 'capture'); game.apply({ type: 'setParameter', args: ['speedRamp', 0] }, 'capture'); });
  await page.waitForFunction(() => { const state = window.__livePatch.game.snapshot(); return state.runElapsed > 3.1 && state.player.grounded; }, undefined, { timeout: 12000 });
  for (let hearts = 2; hearts >= 0; hearts--) {
    let hit = false;
    for (let attempt = 0; attempt < 4 && !hit; attempt++) {
      await page.evaluate(() => { const game = window.__livePatch.game, state = game.snapshot();
        game.apply({ type: 'spawn', args: ['boulder', 510, state.player.y] }, 'capture');
        const boulder = game.snapshot().entities.filter(entity => entity.kind === 'boulder').at(-1);
        if (boulder) game.apply({ type: 'setVelocity', args: [boulder.id, -300, 0] }, 'capture'); });
      try { await page.waitForFunction(target => window.__livePatch.game.snapshot().player.hearts <= target, hearts, { timeout: 1500 }); hit = true; }
      catch { await page.waitForTimeout(250); }
    }
    if (!hit) throw Error(`Run-over capture could not show hit ${3 - hearts}`);
    if (hearts > 0) await page.waitForTimeout(1150);
  }
  await page.waitForFunction(() => window.__livePatch.game.snapshot().runOver, undefined, { timeout: 2000 });
  await page.screenshot({ path: path.join(output, '05-run-over.png') });

  await page.goto(`${base}/?view=library`);
  await page.locator('.library-card').getByText('Lantern Run').waitFor();
  await page.screenshot({ path: path.join(output, '06-library.png') });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${base}/play`);
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Lantern Run · LIVE'));
  const cleanRunAt = await page.evaluate(() => {
    const game = window.__livePatch.game;
    window.__livePatch.host.sync([]);
    for (const item of game.snapshot().entities.filter(item => ['log', 'thorns', 'boulder', 'owl', 'pinecone'].includes(item.kind)))
      game.apply({ type: 'removeEntity', args: [item.id] }, 'capture');
    game.apply({ type: 'setParameter', args: ['runSpeed', 120] }, 'capture');
    game.apply({ type: 'setParameter', args: ['maxHearts', 5] }, 'capture'); game.apply({ type: 'heal', args: [2] }, 'capture');
    return game.snapshot().elapsed;
  });
  const crop = async (x, y, w, h) => {
    const box = await page.locator('#game canvas').boundingBox();
    return page.screenshot({ clip: { x: box.x + (x - w / 2) * box.width / 1152, y: box.y + (y - h / 2) * box.height / 648,
      width: w * box.width / 1152, height: h * box.height / 648 } });
  };
  const strip = async (name, frames) => {
    const encoded = frames.map(frame => frame.toString('base64'));
    const base64 = await page.evaluate(async images => {
      const decoded = await Promise.all(images.map(async image => createImageBitmap(await (await fetch(`data:image/png;base64,${image}`)).blob())));
      const canvas = document.createElement('canvas'); canvas.width = decoded.reduce((sum, image) => sum + image.width, 0);
      canvas.height = Math.max(...decoded.map(image => image.height));
      const c = canvas.getContext('2d'); let x = 0;
      for (const image of decoded) { c.drawImage(image, x, 0); x += image.width; image.close(); }
      return canvas.toDataURL('image/png').split(',')[1];
    }, encoded);
    fs.writeFileSync(path.join(output, name), Buffer.from(base64, 'base64'));
  };
  const foxFrames = [];
  await page.waitForFunction(cleanedAt => { const state = window.__livePatch.game.snapshot(); return state.elapsed - cleanedAt > .6 && state.elapsed % 4.4 > .5 && state.elapsed % 4.4 < 2 && state.player.hearts === state.player.maxHearts; }, cleanRunAt);
  for (let i = 0; i < 8; i++) { foxFrames.push(await crop(346, 462, 170, 165)); await page.waitForTimeout(37); }
  await strip('07-fox-run-cycle.png', foxFrames);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Lantern Run · LIVE'));
  await page.evaluate(() => { const game = window.__livePatch.game;
    game.apply({ type: 'setParameter', args: ['runSpeed', 120] }, 'capture'); game.apply({ type: 'setParameter', args: ['maxJumps', 2] }, 'capture');
    game.apply({ type: 'setParameter', args: ['jumpPower', 320] }, 'capture'); game.apply({ type: 'setParameter', args: ['gravity', 300] }, 'capture'); });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => !window.__livePatch.game.snapshot().player.grounded);
  await page.waitForFunction(() => window.__livePatch.game.snapshot().player.grounded, undefined, { timeout: 4000 });
  await page.keyboard.down('Space');
  const jumpFrames = [];
  for (const [i, delay] of [40, 120, 180, 140, 130, 300, 650, 750, 850].entries()) {
    await page.waitForTimeout(delay);
    if (i === 8) await page.waitForFunction(() => window.__livePatch.game.snapshot().player.grounded, undefined, { timeout: 5000 });
    await page.evaluate(() => window.__livePatch.game.pause());
    const y = await page.evaluate(() => window.__livePatch.game.snapshot().player.y);
    jumpFrames.push(await crop(346, Math.max(110, y), 220, 210));
    await page.evaluate(() => window.__livePatch.game.resume());
    if (i === 3) {
      await page.keyboard.up('Space'); await page.waitForTimeout(80); await page.locator('#game canvas').click({ position: { x: 700, y: 200 } });
      const state = await page.evaluate(() => window.__livePatch.game.snapshot());
      if (state.player.jumpsLeft !== 0) throw Error(`Double-jump capture missed input: ${JSON.stringify({ jumpsLeft: state.player.jumpsLeft, grounded: state.player.grounded })}`);
    }
  }
  await page.keyboard.up('Space'); await strip('08-fox-jump.png', jumpFrames);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Lantern Run · LIVE'));
  const owlId = await page.evaluate(() => {
    const game = window.__livePatch.game;
    game.apply({ type: 'setParameter', args: ['runSpeed', 120] }, 'capture');
    game.apply({ type: 'setParameter', args: ['maxHearts', 5] }, 'capture'); game.apply({ type: 'heal', args: [2] }, 'capture');
    for (const item of game.snapshot().entities.filter(entity => entity.kind === 'owl')) game.apply({ type: 'removeEntity', args: [item.id] }, 'capture');
    game.apply({ type: 'spawn', args: ['owl', 760, 250] }, 'capture');
    const id = game.snapshot().entities.filter(entity => entity.kind === 'owl').at(-1).id;
    game.apply({ type: 'setVelocity', args: [id, 120, 0] }, 'capture'); return id;
  });
  const owlFrames = [];
  for (let i = 0; i < 6; i++) {
    const owl = await page.evaluate(id => window.__livePatch.game.snapshot().entities.find(entity => entity.id === id), owlId);
    if (!owl) throw Error(`Owl animation subject despawned on frame ${i}: ${JSON.stringify(await page.evaluate(() => {
      const state = window.__livePatch.game.snapshot(); return { run: state.run.number, runOver: state.runOver, hearts: state.player.hearts, owls: state.entities.filter(entity => entity.kind === 'owl') };
    }))}`);
    owlFrames.push(await crop(owl.x, owl.y, 170, 135)); await page.waitForTimeout(90);
  }
  await strip('09-owl-flight.png', owlFrames);
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Lantern Run · LIVE'));
  const propIds = await page.evaluate(() => {
    const game = window.__livePatch.game, ids = [];
    game.apply({ type: 'setParameter', args: ['runSpeed', 120] }, 'capture');
    for (const [kind, x, y] of [['firefly', 650, 330], ['spring', 750, 480], ['ledge', 910, 370], ['shield', 1060, 340]])
      { for (const item of game.snapshot().entities.filter(entity => entity.kind === kind)) game.apply({ type: 'removeEntity', args: [item.id] }, 'capture');
        game.apply({ type: 'spawn', args: [kind, x, y] }, 'capture'); const id = game.snapshot().entities.filter(entity => entity.kind === kind).at(-1).id;
        game.apply({ type: 'setVelocity', args: [id, 120, 0] }, 'capture'); ids.push(id); }
    return ids;
  });
  const props = [];
  for (const id of propIds) {
    const item = await page.evaluate(id => window.__livePatch.game.snapshot().entities.find(entity => entity.id === id), id);
    props.push(await crop(item.x, item.y, 165, 125));
  }
  await strip('10-props.png', props);
  await page.close();

  const videoContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1,
    recordVideo: { dir: temp, size: { width: 1280, height: 720 } } });
  const videoPage = await videoContext.newPage();
  await videoPage.goto(`${base}/play`);
  await videoPage.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Lantern Run · LIVE'));
  await videoPage.evaluate(() => {
    const { game, host } = window.__livePatch;
    window.__captureLands = [];
    const original = host.emit.bind(host);
    host.emit = event => { if (event.type === 'land') window.__captureLands.push(event.on); original(event); };
    game.apply({ type: 'setParameter', args: ['maxJumps', 2] }, 'capture');
    game.apply({ type: 'setParameter', args: ['runSpeed', 120] }, 'capture');
    game.apply({ type: 'setParameter', args: ['speedRamp', 0] }, 'capture');
    game.apply({ type: 'spawn', args: ['ledge', 520, 400] }, 'capture');
    game.apply({ type: 'spawn', args: ['firefly', 570, 350] }, 'capture');
    game.apply({ type: 'spawn', args: ['owl', 820, 290] }, 'capture');
  });
  await videoPage.waitForTimeout(450);
  await videoPage.keyboard.down('Space'); await videoPage.waitForTimeout(300); await videoPage.keyboard.up('Space');
  try { await videoPage.waitForFunction(() => window.__captureLands.includes('ledge'), undefined, { timeout: 3000 }); }
  catch { throw Error(`Motion capture missed ledge: ${JSON.stringify(await videoPage.evaluate(() => ({ lands: window.__captureLands, state: window.__livePatch.game.snapshot() })))}`); }
  await videoPage.waitForTimeout(150); await videoPage.keyboard.press('Space');
  await videoPage.waitForTimeout(230); await videoPage.keyboard.press('Space');
  await videoPage.waitForFunction(() => { const state = window.__livePatch.game.snapshot(); return state.runElapsed > 3.1 && state.player.grounded; }, undefined, { timeout: 12000 });
  await videoPage.evaluate(() => { const game = window.__livePatch.game, state = game.snapshot();
    game.apply({ type: 'spawn', args: ['firefly', 510, state.player.y] }, 'capture');
    const firefly = game.snapshot().entities.filter(entity => entity.kind === 'firefly').at(-1);
    if (firefly) game.apply({ type: 'setVelocity', args: [firefly.id, -300, 0] }, 'capture'); });
  await videoPage.waitForFunction(() => window.__livePatch.game.snapshot().run.fireflies >= 1, undefined, { timeout: 1800 });
  for (let target = 2; target >= 0; target--) {
    let hit = false;
    for (let attempt = 0; attempt < 4 && !hit; attempt++) {
      await videoPage.evaluate(() => {
        const game = window.__livePatch.game, state = game.snapshot();
        game.apply({ type: 'spawn', args: ['boulder', 510, state.player.y] }, 'capture');
        const boulder = game.snapshot().entities.filter(entity => entity.kind === 'boulder').at(-1);
        if (boulder) game.apply({ type: 'setVelocity', args: [boulder.id, -300, 0] }, 'capture');
      });
      try { await videoPage.waitForFunction(target => window.__livePatch.game.snapshot().player.hearts <= target, target, { timeout: 1500 }); hit = true; }
      catch { await videoPage.waitForTimeout(250); }
    }
    if (!hit) throw Error(`Motion capture could not show hit ${3 - target}`);
    if (target > 0) await videoPage.waitForTimeout(1150);
  }
  await videoPage.waitForFunction(() => window.__livePatch.game.snapshot().runOver, undefined, { timeout: 2000 });
  await videoPage.waitForTimeout(1050);
  const video = videoPage.video();
  await videoContext.close();
  const sourceVideo = fs.readFileSync(await video.path()).toString('base64');
  const encoderPage = await browser.newPage();
  const clip = await encoderPage.evaluate(async source => {
    const video = document.createElement('video'); video.src = `data:video/webm;base64,${source}`; video.muted = true;
    await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; });
    const start = Math.max(0, video.duration - 9.8), end = video.duration;
    video.currentTime = start; await new Promise(resolve => { video.onseeked = resolve; });
    video.playbackRate = 1.08;
    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
    const context = canvas.getContext('2d'); context.drawImage(video, 0, 0, 1280, 720);
    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 2_400_000 });
    const chunks = []; recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start(); await video.play();
    await new Promise(resolve => {
      const draw = () => { context.drawImage(video, 0, 0, 1280, 720); if (video.currentTime >= end || video.ended) resolve(); else requestAnimationFrame(draw); };
      requestAnimationFrame(draw);
    });
    recorder.stop(); await stopped; video.pause();
    const blob = new Blob(chunks, { type: 'video/webm' });
    const base64 = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob); });
    return { base64, duration: (end - start) / 1.08 };
  }, sourceVideo);
  fs.writeFileSync(path.join(output, 'lantern-run-motion.webm'), Buffer.from(clip.base64, 'base64'));
  await encoderPage.close();
  if (fs.statSync(path.join(output, 'lantern-run-motion.webm')).size > 4_000_000) throw Error('Motion video exceeds 4 MB');
  console.log(`Captured four 1920×1080 views, four animation strips and motion video in ${output}`);
} finally {
  await browser?.close();
  await server?.close();
  const resolved = path.resolve(temp);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw Error(`Unsafe capture directory: ${resolved}`);
  fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
}
