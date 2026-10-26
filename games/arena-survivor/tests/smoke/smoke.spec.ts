import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const fallback = (JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as { livePatch: { defaultGame: string } }).livePatch.defaultGame;
const gameDirectory = process.env.LIVE_PATCH_TEST_GAME_DIR || path.resolve(process.cwd(), process.env.LIVE_PATCH_GAME || fallback);
const manifest = JSON.parse(fs.readFileSync(path.join(gameDirectory, 'live-patch.json'), 'utf8')) as { mutationDir: string };
const mutationDir = path.join(gameDirectory, manifest.mutationDir);
const examples = fs.readdirSync(mutationDir).filter(name => name.endsWith('.js'));
const chosen = process.env.MUTATION_FILE ? path.basename(process.env.MUTATION_FILE) : undefined;

for (const example of chosen ? [chosen] : examples) test(`game plays for five seconds with ${example}`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?mutation=__none__');
  await expect(page.locator('#status')).toContainText('LIVE');
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().frame)).toBeGreaterThan(60);
  const baseline = await page.evaluate(() => (window as any).__livePatch.game.snapshot().frameRate as number);
  await page.goto(`/?mutation=${encodeURIComponent(example)}`);
  await expect(page.locator('#status')).toContainText('LIVE');
  await expect(page.locator('#mutations li')).toHaveCount(1);
  await expect(page.locator('#mutations li')).toContainText('active');
  const start = await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(2500);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(2500);
  await page.keyboard.up('ArrowDown');
  await page.evaluate(() => {
    const { game, host } = (window as any).__livePatch;
    const { x, y } = game.snapshot().player;
    game.apply({ type: 'spawn', args: ['enemy', x + 45, y] }, 'smoke');
    game.apply({ type: 'spawn', args: ['enemy', x + 70, y] }, 'smoke');
    host.emit({ type: 'chat', text: 'viewer says '.repeat(10), author: 'smoke' });
  });
  await page.keyboard.down('Space'); await page.waitForTimeout(100); await page.keyboard.up('Space');
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().elapsed), { timeout: 15000 }).toBeGreaterThan(5);
  const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(state.frame - start).toBeGreaterThan(100);
  expect([state.player.x, state.player.y, state.player.lives, state.score, state.elapsed, state.frame, state.enemies, state.coins].every(Number.isFinite)).toBe(true);
  expect(state.entities.every((entity: {x:number;y:number;radius:number}) => [entity.x, entity.y, entity.radius].every(Number.isFinite))).toBe(true);
  expect(state.maxFrameGap).toBeLessThan(350);
  expect(state.frameRate).toBeGreaterThan(baseline * .55);
  await expect(page.locator('#mutations li')).toContainText('active');
  await expect(page.locator('#notice')).toBeEmpty();
  expect(errors).toEqual([]);
  expect(examples).toContain(example);
});

test('an endless hook loop is stopped without freezing the game', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-loop-test.js');
  try {
    await page.goto('/'); await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(file, `export const meta = { id:'loop', title:'Loop', author:'test', description:'loop' }; export function onTick(game) { if (game.state.elapsed > .3) while (true) {} }`);
    await expect(page.locator('#notice')).toContainText('deadline exceeded', { timeout: 5000 });
    const first = await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame)).toBeGreaterThan(first);
    await expect(page.locator('#mutations')).toContainText('failed');
  } finally { fs.rmSync(file, { force: true }); }
});

test('a top-level loop is stopped at load time', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-load-loop-test.js');
  try {
    await page.goto('/'); await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(file, `export const meta = { id:'load-loop', title:'Load Loop', author:'test', description:'loop' }; while (true) {}`);
    await expect(page.locator('#notice')).toContainText('Load deadline exceeded', { timeout: 5000 });
    const first = await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame)).toBeGreaterThan(first);
  } finally { fs.rmSync(file, { force: true }); }
});

test('a three-second hook stall is rejected without a long host frame gap', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-stall-test.js');
  try {
    await page.goto('/'); await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(file, `export const meta = { id:'stall', title:'Stall', author:'test', description:'slow' }; export function onTick(game) { if(game.state.elapsed > .3) { const start=Date.now(); while(Date.now()-start<3000) {} } }`);
    await expect(page.locator('#mutations')).toContainText('Stall · failed', { timeout: 5000 });
    const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
    expect(state.maxFrameGap).toBeLessThan(350);
  } finally { fs.rmSync(file, { force: true }); }
});

test('an asynchronous hook rejection disables its module', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-async-test.js');
  try {
    await page.goto('/'); await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(file, `export const meta = { id:'async', title:'Async', author:'test', description:'throws' }; export async function onTick() { await Promise.resolve(); throw Error('async fault'); }`);
    await expect(page.locator('#notice')).toContainText('async fault', { timeout: 5000 });
    await expect(page.locator('#mutations')).toContainText('failed');
  } finally { fs.rmSync(file, { force: true }); }
});

test('unrelated reloads do not repeat another module start effect', async ({ page }) => {
  const source = path.join(mutationDir, 'zz-once-test.js');
  const unrelated = path.join(mutationDir, 'zz-unrelated-test.js');
  try {
    await page.goto('/'); await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(source, `export const meta = { id:'once', title:'Once', author:'test', description:'spawns' }; export function onStart(game) { for (let i=0;i<10;i++) game.spawn('enemy',80+i*30,80); }`);
    await expect(page.locator('#mutations')).toContainText('Once · active');
    await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().enemies)).toBeGreaterThanOrEqual(12);
    const before = await page.evaluate(() => (window as any).__livePatch.game.snapshot().enemies);
    fs.writeFileSync(unrelated, `export const meta = { id:'unrelated', title:'Unrelated', author:'test', description:'empty' };`);
    await expect(page.locator('#mutations')).toContainText('Unrelated · active');
    const afterAdd = await page.evaluate(() => (window as any).__livePatch.game.snapshot().enemies);
    expect(afterAdd - before).toBeLessThan(4);
    fs.rmSync(unrelated);
    await expect(page.locator('#mutations')).not.toContainText('Unrelated');
    const afterRemove = await page.evaluate(() => (window as any).__livePatch.game.snapshot().enemies);
    expect(afterRemove - before).toBeLessThan(5);
  } finally { fs.rmSync(source, { force: true }); fs.rmSync(unrelated, { force: true }); }
});

test('a frame ignores a load message that did not come from its parent', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#mutations')).toContainText('Quick Feet · active');
  const frame = page.frames().find(item => item.url() === 'about:srcdoc');
  expect(frame).toBeDefined();
  await frame!.evaluate(() => window.postMessage({ type: 'load', source: `export const meta = {id:'spoof',title:'Spoof',author:'test',description:'bad'}` }, '*'));
  await page.waitForTimeout(200);
  await expect(page.locator('#mutations')).not.toContainText('Spoof');
  await expect(page.locator('#mutations')).toContainText('Quick Feet · active');
});

test('an action storm is throttled before it fills the arena', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-storm-test.js');
  try {
    await page.goto('/'); await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(file, `export const meta = { id:'storm', title:'Storm', author:'test', description:'storm' }; export function onTick(game) { for (let i=0;i<10;i++) game.spawn('coin',100+i*25,200); }`);
    await expect(page.locator('#mutations')).toContainText('Storm · active', { timeout: 5000 });
    await expect(page.locator('#mutations')).toContainText('actions skipped', { timeout: 5000 });
    const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
    expect(state.enemies).toBeGreaterThan(0);
    expect(state.coins).toBeLessThan(40);
  } finally { fs.rmSync(file, { force: true }); }
});

test('the arena caps enemies and clears a swarm on a new run', async ({ page }) => {
  await page.goto('/?mutation=__none__'); await expect(page.locator('#status')).toContainText('LIVE');
  const capped = await page.evaluate(() => {
    const game = (window as any).__livePatch.game;
    const { x, y } = game.snapshot().player;
    for (let i = 0; i < 50; i++) game.apply({ type: 'spawn', args: ['enemy', x + i % 5, y] }, 'test');
    return game.snapshot().enemies;
  });
  expect(capped).toBe(28);
  await expect.poll(() => page.evaluate(() => {
    const state = (window as any).__livePatch.game.snapshot();
    return state.elapsed > 2.5 && state.player.lives === 3 && state.runElapsed < 1 && state.enemies < 5;
  }), { timeout: 25000 }).toBe(true);
});

test('entity hit and chat hooks can express split enemies and speech bubbles', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-entity-test.js');
  try {
    await page.goto('/?mutation=zz-entity-test.js'); await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(file, `export const meta = { id:'entity', title:'Entity Ideas', author:'test', description:'split and speak' }; export function onHit(game,e) { if(e.target==='enemy') { game.spawn('enemy',e.x-15,e.y,8); game.spawn('enemy',e.x+15,e.y,8); } } export function onChat(game,e) { const foe=game.state.entities.find(x=>x.kind==='enemy'); if(foe) game.drawText(e.text,foe.x,foe.y-25); }`);
    await expect(page.locator('#mutations')).toContainText('Entity Ideas · active');
    const before = await page.evaluate(() => {
      const game = (window as any).__livePatch.game;
      const { x, y } = game.snapshot().player;
      game.apply({ type: 'spawn', args: ['enemy', x + 40, y] }, 'probe');
      return game.snapshot().enemies;
    });
    await page.keyboard.down('Space'); await page.waitForTimeout(100); await page.keyboard.up('Space');
    await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().enemies)).toBeGreaterThan(before);
    await page.evaluate(() => (window as any).__livePatch.host.emit({ type: 'chat', text: 'hello viewer', author: 'viewer' }));
    await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().floatingTexts)).toBeGreaterThan(0);
  } finally { fs.rmSync(file, { force: true }); }
});

test('a broken mutation disables itself while the game continues', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-broken-test.js');
  try {
    await page.goto('/');
    await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(file, `export const meta = { id: 'broken', title: 'Broken', author: 'test', description: 'throws' }; export function onTick() { throw Error('test fault'); }`);
    await expect(page.locator('#notice')).toContainText('disabled', { timeout: 5000 });
    const before = await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame);
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame);
    expect(after).toBeGreaterThan(before);
  } finally { fs.rmSync(file, { force: true }); }
});

test('adding and removing a mutation updates the list without navigation', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-reload-test.js');
  try {
    await page.goto('/');
    await expect(page.locator('#status')).toContainText('LIVE');
    const before = await page.evaluate(() => performance.getEntriesByType('navigation').length);
    const addedAt = Date.now();
    fs.writeFileSync(file, `export const meta = { id: 'reload', title: 'Reload Test', author: 'test', description: 'hot reload' }; export function onStart(game) { game.showMessage('RELOADED'); }`);
    await expect(page.locator('#mutations')).toContainText('Reload Test', { timeout: 5000 });
    expect(Date.now() - addedAt).toBeLessThan(2000);
    const removedAt = Date.now();
    fs.rmSync(file);
    await expect(page.locator('#mutations')).not.toContainText('Reload Test', { timeout: 5000 });
    expect(Date.now() - removedAt).toBeLessThan(2000);
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(before);
  } finally { fs.rmSync(file, { force: true }); }
});

test('removing a mutation reverses its parameter change', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-gravity-test.js');
  try {
    await page.goto('/');
    await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(file, `export const meta = { id: 'gravity', title: 'Gravity Test', author: 'test', description: 'drift' }; export function onStart(game) { game.setParameter('gravityX', 100); }`);
    await expect(page.locator('#mutations')).toContainText('Gravity Test');
    await page.waitForTimeout(300);
    const start = await page.evaluate(() => (window as any).__livePatch.game.snapshot().player.x);
    await page.waitForTimeout(500);
    const shifted = await page.evaluate(() => (window as any).__livePatch.game.snapshot().player.x);
    expect(shifted - start).toBeGreaterThan(15);
    fs.rmSync(file);
    await expect(page.locator('#mutations')).not.toContainText('Gravity Test');
    const stopped = await page.evaluate(() => (window as any).__livePatch.game.snapshot().player.x);
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => (window as any).__livePatch.game.snapshot().player.x);
    expect(Math.abs(after - stopped)).toBeLessThan(3);
  } finally { fs.rmSync(file, { force: true }); }
});

test('one crowded Space attack keeps unrelated patches active', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#mutations li')).toHaveCount(3);
  await page.evaluate(() => {
    const game = (window as any).__livePatch.game;
    const { x, y } = game.snapshot().player;
    for (let i = 0; i < 28; i++) game.apply({ type: 'spawn', args: ['enemy', x + 48 + i % 3, y + i % 3] }, 'crowd');
  });
  await page.keyboard.down('Space'); await page.waitForTimeout(100); await page.keyboard.up('Space');
  await page.waitForTimeout(600);
  await expect(page.locator('#mutations li')).toHaveCount(3);
  for (const patch of ['Quick Feet', 'Gold Rush', 'Danger Zone']) await expect(page.locator('#mutations')).toContainText(`${patch} · active`);
  await expect(page.locator('#notice')).toBeEmpty();
});

test('out-of-range text and parameter arguments are bounded', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-bounds-test.js');
  try {
    await page.goto('/?mutation=zz-bounds-test.js');
    fs.writeFileSync(file, `export const meta = {id:'bounds',title:'Bounds',author:'test',description:'bounds'}; export function onStart(game) { game.setParameter('enemySpeed', 600); } export function onChat(game,e) { game.drawText(e.text, 30, -25); }`);
    await expect(page.locator('#mutations')).toContainText('Bounds · active');
    await page.evaluate(() => (window as any).__livePatch.host.emit({ type: 'chat', text: 'x'.repeat(120), author: 'test' }));
    await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().floatingTexts)).toBeGreaterThan(0);
    await expect(page.locator('#mutations')).toContainText('Bounds · active');
  } finally { fs.rmSync(file, { force: true }); }
});

test('mutation Worker cannot create nested Workers', async ({ page }) => {
  await page.goto('/?mutation=__none__');
  await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(() => (window as any).__livePatch.host.sync([{ name: 'probe.js', source: `export const meta = {id:'probe',title:'Probe',author:'test',description:'worker'}; export function onStart() { if (typeof Worker !== 'undefined' || typeof SharedWorker !== 'undefined' || typeof importScripts !== 'undefined') throw Error('nested worker available'); }`, error: null }]));
  await expect(page.locator('#mutations')).toContainText('Probe · active');
});

test('skipped ticks contribute to the next delivered delta', async ({ page }) => {
  await page.goto('/?mutation=__none__');
  await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(() => (window as any).__livePatch.host.sync([{ name: 'delta.js', source: `export const meta = {id:'delta',title:'Delta',author:'test',description:'clock'}; let total = 0; export function onTick(game,e) { total += e.delta; if (game.state.elapsed < 1.2) { const start = Date.now(); while (Date.now()-start < 70) {} } if (game.state.elapsed > 1.4 && total < .7) throw Error('lost tick time'); }`, error: null }]));
  await expect(page.locator('#mutations')).toContainText('Delta · active');
  await page.waitForTimeout(1500);
  await expect(page.locator('#mutations')).toContainText('Delta · active');
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().elapsed)).toBeGreaterThan(1.5);
  await expect(page.locator('#mutations')).toContainText('Delta · active');
});

for (const idea of ['split-enemy', 'flip-gravity', 'fleeing-coins', 'fire-trail', 'chat-bubble', 'merge-enemies']) {
  test(`documented ${idea} idea survives its trigger`, async ({ page }) => {
    const file = path.join(mutationDir, `zz-${idea}-fixture.js`);
    try {
      fs.copyFileSync(path.join(gameDirectory, 'tests', 'fixtures', `${idea}.js`), file);
      await page.goto(`/?mutation=${path.basename(file)}`);
      await expect(page.locator('#status')).toContainText('LIVE');
      await expect(page.locator('#mutations')).toContainText('active');
      await page.evaluate((name) => {
        const { game, host } = (window as any).__livePatch;
        const { x, y } = game.snapshot().player;
        if (name === 'split-enemy') game.apply({ type: 'spawn', args: ['enemy', x + 45, y] }, 'fixture');
        if (name === 'fleeing-coins') for (let i = 0; i < 20; i++) game.apply({ type: 'spawn', args: ['coin', 100 + i * 30, 100] }, 'fixture');
        if (name === 'chat-bubble') {
          const foe = game.snapshot().entities.find((e: any) => e.kind === 'enemy');
          if (foe) game.apply({ type: 'moveEntity', args: [foe.id, foe.x, 20] }, 'fixture');
          host.emit({ type: 'chat', text: 'long chat '.repeat(12), author: 'fixture' });
        }
        if (name === 'merge-enemies') {
          game.apply({ type: 'spawn', args: ['enemy', x + 80, y] }, 'fixture');
          game.apply({ type: 'spawn', args: ['enemy', x + 82, y] }, 'fixture');
        }
      }, idea);
      if (idea === 'split-enemy') { await page.keyboard.down('Space'); await page.waitForTimeout(100); await page.keyboard.up('Space'); }
      if (idea === 'chat-bubble') await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().floatingTexts)).toBeGreaterThan(0);
      await page.waitForTimeout(1200);
      await expect(page.locator('#mutations')).toContainText('active');
      await expect(page.locator('#notice')).toBeEmpty();
    } finally { fs.rmSync(file, { force: true }); }
  });
}

test('simulator submits ideas and chat through the live game path as plain text', async ({ page, context }) => {
  const file = path.join(mutationDir, 'zz-simulator-chat.js');
  const simulator = await context.newPage();
  try {
    fs.writeFileSync(file, `export const meta={id:'sim-chat',title:'Sim Chat',author:'test',description:'chat'}; export function onChat(game,e){game.drawText(e.text,100,100);}`);
    await page.goto('/?mutation=zz-simulator-chat.js');
    await expect(page.locator('#mutations')).toContainText('Sim Chat · active');
    await simulator.goto('/simulator.html');
    await simulator.locator('textarea[name="text"]').fill('hello from simulator');
    await simulator.getByRole('button', { name: 'Send' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().floatingTexts)).toBeGreaterThan(0);
    await simulator.locator('textarea[name="text"]').fill('!idea <img src=x onerror=alert(1)>');
    await simulator.getByRole('button', { name: 'Send' }).click();
    await expect(simulator.locator('#ideas')).toContainText('<img src=x onerror=alert(1)>');
    await expect(simulator.locator('#ideas img')).toHaveCount(0);
    await simulator.locator('input[name="id"]').fill('viewer-2');
    await simulator.locator('input[name="login"]').fill('viewer2');
    await simulator.locator('select[name="kind"]').selectOption('reward');
    await simulator.locator('textarea[name="text"]').fill('Coins flee from the player');
    await simulator.getByRole('button', { name: 'Send' }).click();
    await expect(simulator.locator('#ideas')).toContainText('Coins flee from the player');
    const ideas = await simulator.request.get('/api/ideas').then(response => response.json()) as { ideas: unknown[] };
    expect(ideas.ideas).toHaveLength(2);
  } finally { await simulator.close(); fs.rmSync(file, { force: true }); }
});
