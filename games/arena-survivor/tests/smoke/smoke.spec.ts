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

test('a mutation cannot replace code in another module or navigate a frame', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-escape-test.js');
  try {
    await page.goto('/'); await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(file, `export const meta = { id:'escape', title:'Escape', author:'test', description:'escape' }; export function onStart() { const g = ({}).constructor.constructor('return this')(); g['parent']['frames'][0]['postMessage']({type:'load',source:'bad'},'*'); }`);
    await expect(page.locator('#mutations')).toContainText('Escape · failed', { timeout: 5000 });
    await expect(page.locator('#mutations')).toContainText('Quick Feet · active');
    const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
    expect(state.frame).toBeGreaterThan(0);
  } finally { fs.rmSync(file, { force: true }); }
});

test('an action storm is disabled before it fills the arena', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-storm-test.js');
  try {
    await page.goto('/'); await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(file, `export const meta = { id:'storm', title:'Storm', author:'test', description:'storm' }; export function onTick(game) { for (let i=0;i<10;i++) game.spawn('coin',100+i*25,200); }`);
    await expect(page.locator('#notice')).toContainText('Action rate limit exceeded', { timeout: 5000 });
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
