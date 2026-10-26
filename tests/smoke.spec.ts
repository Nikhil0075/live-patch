import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const mutationDir = path.join(process.cwd(), 'games/arena-survivor/mutations');
const examples = fs.readdirSync(mutationDir).filter(name => name.endsWith('.js'));
const chosen = process.env.MUTATION_FILE ? path.basename(process.env.MUTATION_FILE) : undefined;

for (const example of chosen ? [chosen] : examples) test(`game plays for five seconds with ${example}`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
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
  await expect(page.locator('#mutations li')).toContainText('active');
  await expect(page.locator('#notice')).toBeEmpty();
  expect(errors).toEqual([]);
  expect(examples).toContain(example);
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
