import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const fallback = (JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as { livePatch: { defaultGame: string } }).livePatch.defaultGame;
const gameDirectory = process.env.LIVE_PATCH_TEST_GAME_DIR || path.resolve(process.cwd(), process.env.LIVE_PATCH_GAME || fallback);
const manifest = JSON.parse(fs.readFileSync(path.join(gameDirectory, 'live-patch.json'), 'utf8')) as { mutationDir: string; demoMutation?: string };
const mutationDir = path.join(gameDirectory, manifest.mutationDir);
const examples = fs.readdirSync(mutationDir).filter(name => name.endsWith('.js'));
const chosen = process.env.MUTATION_FILE ? path.basename(process.env.MUTATION_FILE) : undefined;
const combined = process.env.LIVE_PATCH_SMOKE_COMBINED === '1';

test('Vite refuses the local OAuth token file', async ({ request }) => {
  const dataDir = process.env.LIVE_PATCH_TEST_DATA_DIR;
  expect(dataDir).toBeTruthy();
  const tokenPath = '/' + path.relative(process.cwd(), path.join(dataDir!, 'tokens.json')).replaceAll('\\', '/');
  const publicPath = '/' + path.relative(process.cwd(), path.join(dataDir!, 'public-probe.txt')).replaceAll('\\', '/');
  const publicResponse = await request.get(publicPath);
  expect(publicResponse.status()).toBe(200);
  const response = await request.get(tokenPath);
  expect([403, 404]).toContain(response.status());
});

test('Play fills a 16:9 game capture without cutting off the arena', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/play');
  await expect(page.locator('#status')).toContainText('LIVE');
  const box = await page.locator('#game canvas').boundingBox();
  expect(box).toBeTruthy();
  expect(box!.width).toBeGreaterThan(1900);
  expect(box!.height).toBeGreaterThan(1060);
  expect(box!.x).toBeLessThan(10);
  expect(box!.y).toBeLessThan(10);
});

test('visible Play controls stay in the right corner clear of the HUD and ship toast', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/play');
  await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(() => { document.querySelector<HTMLElement>('#play-toast')!.textContent = 'New patch: Example — by @viewer'; });
  await page.mouse.move(960, 540);
  await expect(page.locator('#play-shell')).not.toHaveClass(/stream-clean/);
  const tools = await page.locator('.play-tools').boundingBox();
  const toast = await page.locator('#play-toast').boundingBox();
  expect(tools).toBeTruthy(); expect(toast).toBeTruthy();
  expect(tools!.x).toBeGreaterThanOrEqual(1480);
  expect(tools!.x + tools!.width).toBeLessThanOrEqual(1896);
  expect(tools!.x).toBeGreaterThan(430);
  expect(tools!.x >= toast!.x + toast!.width || toast!.x >= tools!.x + tools!.width || tools!.y >= toast!.y + toast!.height || toast!.y >= tools!.y + tools!.height).toBe(true);
});

test('Library patch count and details rows reflect the active game', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?view=library');
  await expect(page.locator('.library-patch-count').first()).toBeVisible();
  const expected = await page.evaluate(() => fetch('/api/library').then(response => response.json()).then(data => data.games[0].activePatches));
  await expect(page.locator('.library-patch-count').first()).toHaveText(`${expected} patch${expected === 1 ? '' : 'es'} active`);
  const geometry = await page.evaluate(() => {
    const summary = document.querySelector('.library-detail-row summary')!.getBoundingClientRect();
    const cover = document.querySelector('.library-cover')!.getBoundingClientRect();
    const star = document.querySelector('.library-star')!.getBoundingClientRect();
    return { summaryHeight: summary.height, cover, star };
  });
  expect(geometry.summaryHeight).toBeLessThan(40);
  expect(geometry.star.left).toBeGreaterThanOrEqual(geometry.cover.left);
  expect(geometry.star.right).toBeLessThanOrEqual(geometry.cover.right);
  expect(geometry.star.top).toBeGreaterThanOrEqual(geometry.cover.top);
});

test('OBS widgets can be removed, added and resized across reloads', async ({ page }) => {
  await page.goto('/?view=go-live');
  await page.getByRole('link', { name: /Customize OBS overlay/ }).click();
  const original = await page.evaluate(() => fetch('/api/settings').then(response => response.json()).then(data => data.overlayWidgets));
  try {
    await expect(page.locator('.overlay-edit-widget')).toHaveCount(original.length);
    await page.getByRole('button', { name: 'Remove Chat ballot' }).click();
    await expect(page.locator('.overlay-edit-widget')).toHaveCount(original.length - 1);
    await page.locator('#overlay-add-select').selectOption('ballot');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.locator('.overlay-edit-widget')).toHaveCount(original.length);
    const width = page.getByRole('spinbutton', { name: 'Chat ballot width' });
    await width.fill('750'); await width.blur();
    await expect(width).toHaveValue('750');
    await page.reload();
    await page.getByRole('link', { name: /Customize OBS overlay/ }).click();
    await expect(page.getByRole('spinbutton', { name: 'Chat ballot width' })).toHaveValue('750');
    const overlay = await page.context().newPage();
    try { await overlay.goto('/overlay.html'); await expect(overlay.locator('.stream-shell footer')).toHaveCSS('width', '750px'); }
    finally { await overlay.close(); }
  } finally {
    await page.evaluate(widgets => fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overlayWidgets: widgets }) }), original);
  }
});

test('a 500-pixel OBS ballot stacks three readable ideas without horizontal overflow', async ({ page }) => {
  await page.goto('/?view=practice');
  const original = await page.evaluate(() => fetch('/api/settings').then(r => r.json()).then(data => data.overlayWidgets));
  try {
    await page.evaluate(async widgets => {
      const ballot = widgets.find((widget: any) => widget.type === 'ballot');
      ballot.width = 500; ballot.height = 640; ballot.x = 24; ballot.y = 430;
      await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overlayWidgets: widgets }) });
    }, original);
    await page.getByRole('button', { name: 'Run a full round automatically' }).click();
    await expect(page.locator('#quick-result')).toContainText('Done.', { timeout: 15_000 });
    await page.goto('/overlay.html');
    await expect(page.locator('.candidate')).toHaveCount(3);
    const layout = await page.locator('.stream-shell footer').evaluate(footer => {
      const cards = Array.from(footer.querySelectorAll<HTMLElement>('.candidate'));
      return { width: footer.clientWidth, scrollWidth: footer.scrollWidth, scrollHeight: footer.scrollHeight, height: footer.clientHeight, cards: cards.map(card => ({ x: card.offsetLeft, titleSize: parseFloat(getComputedStyle(card.querySelector('strong')!).fontSize), hint: card.querySelector('.vote-hint')?.textContent })) };
    });
    expect(layout.width).toBe(496);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.height);
    expect(layout.cards.map(card => card.x)).toEqual([layout.cards[0].x, layout.cards[0].x, layout.cards[0].x]);
    for (const card of layout.cards) { expect(card.titleSize).toBeGreaterThanOrEqual(28); expect(card.hint).toContain('!vote'); }
  } finally {
    await page.evaluate(async () => { const round = await fetch('/api/round').then(r => r.json()); if (round.phase === 'approval' || round.phase === 'vote') await fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'advance' }) }); });
    await page.evaluate(widgets => fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overlayWidgets: widgets }) }), original);
  }
});

test('stream patch card shows newest entries and counts those that do not fit', async ({ page }) => {
  const first = path.join(mutationDir, '98-overlay-a.js');
  const second = path.join(mutationDir, '99-overlay-b.js');
  try {
    fs.writeFileSync(first, "export const meta={id:'overlay-a',title:'Overlay A',author:'test',description:'First extra patch'};");
    fs.writeFileSync(second, "export const meta={id:'overlay-b',title:'Overlay B',author:'test',description:'Second extra patch'};");
    await page.goto('/overlay.html');
    await expect(page.locator('#patches .patch-more')).toContainText('+2 more active patches');
    await expect(page.locator('#patches .patch')).toHaveCount(3);
    await expect(page.locator('#patches .patch').first()).toContainText('Overlay B');
  } finally {
    fs.rmSync(first, { force: true }); fs.rmSync(second, { force: true });
  }
});

test('top-bar Practice and Live switch navigates both views', async ({ page }) => {
  await page.goto('/');
  await page.locator('#mode-switch a[data-mode="live"]').click();
  await expect(page).toHaveURL(/view=go-live/);
  await expect(page.locator('#mode-switch a[data-mode="live"]')).toHaveAttribute('aria-current', 'page');
  await page.locator('#mode-switch a[data-mode="practice"]').click();
  await expect(page).toHaveURL(/view=practice/);
  await expect(page.locator('#mode-switch a[data-mode="practice"]')).toHaveAttribute('aria-current', 'page');
});

test('studio navigation works with Tab and Enter and shows focus', async ({ page }) => {
  await page.goto('/');
  for (const destination of ['Practice', 'Go Live']) {
    let focused = false;
    for (let index = 0; index < 18; index++) {
      await page.keyboard.press('Tab');
      focused = await page.evaluate(name => (document.activeElement as HTMLElement)?.textContent?.trim().includes(name) && (document.activeElement as HTMLElement).tagName === 'A', destination);
      if (focused) break;
    }
    expect(focused).toBe(true);
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
    expect(outline).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`view=${destination === 'Practice' ? 'practice' : 'go-live'}`));
  }
});

test('Codex and OBS status resolve on Go Live and Library', async ({ page }) => {
  for (const view of ['go-live', 'library']) {
    await page.goto(`/?view=${view}`);
    await expect(page.locator('#codex-connection')).not.toContainText(/checking/i, { timeout: 20_000 });
    await expect(page.locator('#dot-codex')).toHaveCount(1);
    await expect(page.locator('#dot-obs')).toHaveCount(1);
  }
});

test('play window pauses frames and mutation ticks, then resumes from the same state', async ({ page }) => {
  await page.goto('/play');
  await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(() => (window as any).__livePatch.host.sync([{ name: 'pause-probe.js', source: `export const meta={id:'pause-probe',title:'Pause Probe',author:'test',description:'Counts ticks'}; let ticks=0; export function onTick(game){ticks++; if(ticks%30===0) game.spawn('coin',100,100);}`, error: null }]));
  await expect(page.locator('#mutations')).toContainText('Pause Probe · active');
  await page.keyboard.press('p');
  await expect(page.locator('#play-menu')).toBeVisible();
  await expect(page.locator('#resume-button')).toBeFocused();
  const before = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  const ticksBefore = await page.evaluate(() => (window as any).__livePatch.host.tickDeliveries());
  await page.waitForTimeout(600);
  const during = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(during.frame).toBe(before.frame);
  expect(during.elapsed).toBe(before.elapsed);
  expect(await page.evaluate(() => (window as any).__livePatch.host.tickDeliveries())).toBe(ticksBefore);
  await page.getByRole('button', { name: 'Controls' }).click();
  await expect(page.locator('#menu-panel')).toContainText('Space');
  await page.keyboard.press('Escape');
  await expect(page.locator('#play-menu')).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().frame)).toBeGreaterThan(before.frame + 10);
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.host.tickDeliveries())).toBeGreaterThan(ticksBefore);
});

test('rollback while paused drops in-flight actions and gameplay keys leave tools hidden', async ({ page }) => {
  await page.goto('/play');
  await expect(page.locator('#status')).toContainText('LIVE');
  await expect(page.locator('#play-shell')).toHaveClass(/stream-clean/, { timeout: 5_000 });
  await page.keyboard.press('d');
  await expect(page.locator('#play-shell')).toHaveClass(/stream-clean/);
  await page.evaluate(() => (window as any).__livePatch.host.sync([{ name: 'rolled-back.js', source: "export const meta={id:'rolled-back',title:'Rollback Probe',author:'test',description:'Tests paused removal'}; export function onTick(game){game.setParameter('playerSpeed',500)}", error: null }]));
  await expect(page.locator('#mutations')).toContainText('Rollback Probe · active');
  const applied = await page.evaluate(() => {
    const { game, host } = (window as any).__livePatch;
    const seen: unknown[] = [];
    const original = game.apply.bind(game);
    game.apply = (action: unknown, origin: string) => { seen.push({ action, origin }); return original(action, origin); };
    host.setPaused(true);
    host.deferredActions.push({ action: { type: 'setParameter', args: ['playerSpeed', 500] }, origin: 'rolled-back.js' });
    host.sync([]);
    host.setPaused(false);
    return seen;
  });
  expect(applied).not.toContainEqual({ action: { type: 'setParameter', args: ['playerSpeed', 500] }, origin: 'rolled-back.js' });
});

test('Practice can run a round and ship a labelled demo without Codex', async ({ page }) => {
  await page.goto('/?view=practice');
  await page.getByRole('button', { name: 'Run a full round automatically' }).click();
  await expect(page.locator('#practice-stage')).toContainText('approval', { timeout: 15_000 });
  await expect(page.locator('#demo-ship')).toBeVisible();
  await page.locator('#demo-ship').click();
  await expect(page.locator('#quick-result')).toContainText('Done.', { timeout: 15_000 });
  await expect(page.locator('#practice-chat')).toContainText('Demo patch: Coin Shower', { timeout: 15_000 });
  const demoState = await page.evaluate(async () => {
    const runs = await fetch('/api/runs').then(r => r.json());
    const ideas = await fetch('/api/ideas').then(r => r.json());
    const run = runs.runs.at(-1);
    return { demo: run.demo, ideaStatus: ideas.ideas.find((idea: any) => idea.id === run.ideaId)?.status };
  });
  expect(demoState).toEqual({ demo: true, ideaStatus: 'demo' });
  await page.goto('/play');
  await expect(page.locator('#mutations')).toContainText('Demo patch: Coin Shower · active');
  await expect(page.locator('#play-toast')).toContainText('Demo patch: Coin Shower');
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().coins)).toBeGreaterThan(8);
  await expect(page.locator('#mutations')).not.toContainText('actions skipped');
  const rollback = await page.evaluate(() => fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rollback' }) }).then(r => r.json()));
  expect(rollback.accepted).toBe(true);
  await expect(page.locator('#mutations')).not.toContainText('Demo patch: Coin Shower · active');
});

test('Play opens a reusable popup without browser tab chrome', async ({ page }) => {
  await page.goto('/');
  const popupEvent = page.waitForEvent('popup');
  await page.locator('#top-play').click();
  const popup = await popupEvent;
  try {
    await expect(popup.locator('#status')).toContainText('LIVE');
    expect(await popup.opener()).toBe(page);
    expect(await popup.evaluate(() => window.locationbar.visible)).toBe(false);
    expect(await popup.evaluate(() => window.outerWidth)).toBeGreaterThan(1000);
    await page.locator('#top-play').click();
    await expect.poll(() => page.context().pages().filter(item => item.url().endsWith('/play')).length).toBe(1);
  } finally { await popup.close(); }
});

test('shipping a second Practice demo replaces the first file and run', async ({ page }) => {
  await page.goto('/?view=practice');
  for (let index = 0; index < 2; index++) {
    await page.getByRole('button', { name: 'Run a full round automatically' }).click();
    await expect(page.locator('#demo-ship')).toBeVisible({ timeout: 15_000 });
    await page.locator('#demo-ship').click();
    await expect(page.locator('#quick-result')).toContainText('Done.', { timeout: 15_000 });
  }
  const state = await page.evaluate(async () => ({ runs: (await fetch('/api/runs').then(r => r.json())).runs, mutations: await fetch('/api/mutations').then(r => r.json()) })) as { runs: { demo?: boolean; status: string }[]; mutations: { name: string }[] };
  expect(state.runs.filter(run => run.demo && run.status === 'shipped')).toHaveLength(1);
  expect(state.mutations.filter(item => item.name.startsWith('demo-'))).toHaveLength(1);
});

test('Practice announcement uses a different game demo title from module metadata', async ({ page }) => {
  expect(manifest.demoMutation).toBeTruthy();
  const file = path.join(gameDirectory, manifest.demoMutation!);
  const original = fs.readFileSync(file, 'utf8');
  try {
    fs.writeFileSync(file, original.replace("title: 'Demo patch: Coin Shower'", "title: 'Demo patch: Fire Rain'"));
    await page.goto('/?view=practice');
    await page.getByRole('button', { name: 'Run a full round automatically' }).click();
    await expect(page.locator('#demo-ship')).toBeVisible({ timeout: 15_000 });
    await page.locator('#demo-ship').click();
    await expect(page.locator('#practice-chat')).toContainText('Demo patch: Fire Rain', { timeout: 15_000 });
    const data = await page.evaluate(async () => ({ runs: await fetch('/api/runs').then(r => r.json()), events: await fetch('/api/runner-events').then(r => r.json()) }));
    const run = data.runs.runs.at(-1);
    expect(run.mutationTitle).toBe('Demo patch: Fire Rain');
    expect(data.events.events.some((event: any) => event.runId === run.id && event.message?.includes('Demo patch: Fire Rain'))).toBe(true);
    await page.goto('/overlay.html');
    await expect(page.locator('#work')).toContainText('Demo patch: Fire Rain');
  } finally {
    fs.writeFileSync(file, original);
  }
});

test('Go Live can remove Practice demo patches before a stream', async ({ page }) => {
  await page.goto('/?view=practice');
  await page.getByRole('button', { name: 'Run a full round automatically' }).click();
  await expect(page.locator('#demo-ship')).toBeVisible({ timeout: 15_000 });
  await page.locator('#demo-ship').click();
  await expect(page.locator('#quick-result')).toContainText('Done.', { timeout: 15_000 });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?view=go-live');
  const remove = page.getByRole('button', { name: 'Remove demo patches' });
  await expect(remove).toBeVisible();
  await expect(page.locator('.panel-patches .patch-item')).toHaveCount(4);
  const wide = await page.locator('.panel-patches').evaluate(panel => {
    const list = panel.querySelector('#patches')!.getBoundingClientRect();
    const cards = Array.from(panel.querySelectorAll('.patch-item')).map(item => item.getBoundingClientRect());
    const saved = panel.querySelector('#builds')!.getBoundingClientRect();
    const remove = panel.querySelector('[data-action="remove-demo"]')!.getBoundingClientRect();
    return { thirdBottom: cards[2].bottom, listBottom: list.bottom, savedTop: saved.top, savedBottom: saved.bottom, removeTop: remove.top, removeBottom: remove.bottom, panelBottom: panel.getBoundingClientRect().bottom };
  });
  expect(wide.thirdBottom).toBeLessThanOrEqual(wide.listBottom);
  expect(wide.listBottom).toBeLessThanOrEqual(wide.savedTop);
  expect(wide.savedBottom).toBeLessThanOrEqual(wide.removeTop);
  expect(wide.removeBottom).toBeLessThanOrEqual(wide.panelBottom);
  await page.setViewportSize({ width: 1366, height: 768 });
  const narrow = await page.locator('.panel-patches').evaluate(panel => ({ listBottom: panel.querySelector('#patches')!.getBoundingClientRect().bottom, savedTop: panel.querySelector('#builds')!.getBoundingClientRect().top, savedBottom: panel.querySelector('#builds')!.getBoundingClientRect().bottom, removeTop: panel.querySelector('[data-action="remove-demo"]')!.getBoundingClientRect().top }));
  expect(narrow.listBottom).toBeLessThanOrEqual(narrow.savedTop);
  expect(narrow.savedBottom).toBeLessThanOrEqual(narrow.removeTop);
  const placement = await remove.evaluate(button => ({ buttonBottom: button.getBoundingClientRect().bottom, panelBottom: button.closest('.panel-patches')!.getBoundingClientRect().bottom }));
  expect(placement.buttonBottom).toBeLessThanOrEqual(placement.panelBottom);
  page.once('dialog', dialog => void dialog.accept());
  await remove.click();
  await expect(remove).toBeHidden({ timeout: 10_000 });
  const files = await page.evaluate(() => fetch('/api/mutations').then(r => r.json()) as Promise<{ name: string }[]>);
  expect(files.some(file => file.name.startsWith('demo-'))).toBe(false);
});

test('studio and welcome scrollbars use the violet theme and keep keyboard scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 600 });
  await page.goto('/?first-run=1');
  const welcome = page.getByRole('dialog', { name: 'Welcome to Live Patch' });
  await expect(welcome).toBeVisible();
  expect(await welcome.evaluate(element => getComputedStyle(element).scrollbarColor)).toContain('rgb(107, 60, 161)');
  await page.locator('#welcome-close').click();
  for (const view of ['home', 'practice', 'go-live', 'library', 'builds', 'setup', 'settings']) {
    await page.goto(`/?view=${view}`);
    const colours = await page.evaluate(() => [document.documentElement, document.body, document.querySelector('.app-content')!].map(element => getComputedStyle(element).scrollbarColor));
    expect(colours.every(colour => colour.includes('rgb(107, 60, 161)'))).toBe(true);
  }
  await page.goto('/?view=library');
  await page.keyboard.press('PageDown');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

test('Go Live rejects pitches and vote candidates and keeps ballot actions open across refresh', async ({ page }) => {
  await page.goto('/?view=go-live');
  await page.evaluate(async () => {
    const action = (name: string) => fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name }) });
    for (let attempt = 0; attempt < 5; attempt++) {
      const round = await fetch('/api/round').then(r => r.json());
      if (round.phase === 'pitch') break;
      await action(round.phase === 'paused' ? 'resume' : 'advance');
    }
    await fetch('/api/simulator/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: crypto.randomUUID(), kind: 'chat', viewer: { id: crypto.randomUUID(), login: 'rejecter', name: 'Rejecter', moderator: false, broadcaster: false }, text: `!idea reject-in-pitch-${Date.now()}` }) });
  });
  const pitch = page.locator('#pitch-queue .queue-item').filter({ hasText: 'reject-in-pitch-' });
  await expect(pitch).toBeVisible();
  const pitchReject = pitch.getByRole('button', { name: 'Reject' });
  await pitchReject.focus();
  await page.waitForTimeout(2200);
  await expect(pitchReject).toBeFocused();
  page.once('dialog', dialog => void dialog.accept());
  await pitchReject.click();
  await expect(pitch).toHaveCount(0);
  await expect(page.locator('#notice')).toContainText('@Rejecter: reject-in-pitch-');
  expect(await page.locator('#notice').innerText()).not.toMatch(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}/);
  await page.evaluate(async () => {
    for (let i = 0; i < 3; i++) await fetch('/api/simulator/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: crypto.randomUUID(), kind: 'chat', viewer: { id: crypto.randomUUID(), login: `voter${i}`, name: `Voter${i}`, moderator: false, broadcaster: false }, text: `!idea vote-reject-${i}-${Date.now()}` }) });
    await fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'advance' }) });
  });
  await expect(page.locator('#round')).toContainText('VOTE');
  const candidate = page.locator('#candidates .ballot-item').first();
  await expect(candidate.getByRole('button', { name: 'Reject' })).toBeVisible();
  page.once('dialog', dialog => void dialog.accept());
  await candidate.getByRole('button', { name: 'Reject' }).click();
  await expect.poll(() => page.locator('#candidates .ballot-item').count()).toBeLessThan(3);
  await page.evaluate(() => fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'advance' }) }));
  await expect(page.locator('#round')).toContainText('APPROVAL');
  const approval = page.locator('#candidates .ballot-item').first();
  await approval.getByText('More actions').click();
  await page.waitForTimeout(2200);
  await expect(approval.locator('details')).toHaveAttribute('open', '');
  page.once('dialog', dialog => void dialog.accept());
  await approval.getByRole('button', { name: 'Reject' }).click();
  await expect.poll(() => page.locator('#candidates .ballot-item').count()).toBeLessThan(2);
  const recent = await page.evaluate(async () => await (await fetch('/api/chat/recent')).json() as { messages: { author: string; text: string }[] });
  expect(recent.messages.some(message => message.author === 'Operator' && message.text.startsWith('!reject'))).toBe(false);
});

test('Go Live recent chat includes viewer commands and keeps text safely wrapped', async ({ page }) => {
  await page.goto('/?view=go-live');
  const text = `!idea chat-panel-${Date.now()} <b>plain text</b>`;
  await page.evaluate(async message => {
    await fetch('/api/simulator/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: crypto.randomUUID(), kind: 'chat', viewer: { id: crypto.randomUUID(), login: 'chatviewer', name: 'Chat viewer', moderator: false, broadcaster: false }, text: message }) });
  }, text);
  await expect(page.locator('#chat-strip')).toContainText(text);
  await expect(page.locator('#chat-strip p').last().locator('b')).toHaveText('!idea');
  expect(await page.locator('#chat-strip img').count()).toBe(0);
});

test('Go Live quick tiles fit and Setup links to Twitch registration', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?view=go-live');
  const geometry = await page.locator('.quick-tiles button:visible').evaluateAll(buttons => buttons.map(button => ({ width: button.clientWidth, scrollWidth: button.scrollWidth, height: button.clientHeight, scrollHeight: button.scrollHeight })));
  expect(geometry.every(tile => tile.scrollWidth <= tile.width + 1 && tile.scrollHeight <= tile.height + 1)).toBe(true);
  expect(await page.locator('.panel-actions').evaluate(panel => panel.scrollHeight <= panel.clientHeight + 1)).toBe(true);
  await page.goto('/?view=setup');
  await page.locator('.setup-step').nth(3).click();
  await expect(page.locator('a[href="https://dev.twitch.tv/console/apps"]')).toHaveAttribute('target', '_blank');
  await expect(page.locator('a[href="https://dev.twitch.tv/docs/authentication/register-app/"]')).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.locator('#copy-redirect')).toBeVisible();
});

test('top bar offers the correct one-click Twitch permission reconnect', async ({ page }) => {
  await page.route('**/api/twitch/status', async route => {
    const response = await route.fetch();
    const data = await response.json();
    await route.fulfill({ response, json: { ...data, broadcaster: { login: 'streamer' }, bot: { login: 'bot' }, eventsub: 'offline', reconnect: { role: 'broadcaster', reason: 'Broadcaster needs new permissions — reconnect' } } });
  });
  await page.goto('/?view=go-live');
  const button = page.locator('.top-actions > a.button.primary');
  await expect(button).toHaveText('Reconnect Twitch');
  await expect(button).toHaveAttribute('href', '/api/twitch/auth/broadcaster/start');
  await expect(page.locator('#app-connection')).toContainText('Broadcaster needs new permissions');
  await expect(page.locator('#twitch-pill')).toContainText('Twitch chat disconnected');
});

test('Go Live fits a 1080p studio view and shows every quick-action explanation', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?view=go-live');
  await expect(page.locator('.nav-group-label')).toHaveText('STUDIO');
  await expect(page.locator('#app-nav svg')).toHaveCount(5);
  await expect(page.locator('#rollback-vote')).toContainText('moderator');
  const bounds = await page.evaluate(() => {
    const panel = document.querySelector('[data-panel="actions"]')!.getBoundingClientRect();
    const note = document.querySelector('#rollback-vote')!.getBoundingClientRect();
    return { page: document.documentElement.scrollHeight, viewport: innerHeight, noteBottom: note.bottom, panelBottom: panel.bottom };
  });
  expect(bounds.page).toBeLessThanOrEqual(bounds.viewport);
  expect(bounds.noteBottom).toBeLessThanOrEqual(bounds.panelBottom);
  const codex = await page.locator('[data-panel="codex"]').boundingBox();
  const steps = await page.locator('#runs .timeline-step').all();
  expect(codex).not.toBeNull();
  expect(steps).toHaveLength(4);
  for (const step of steps) {
    const box = await step.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(codex!.y + codex!.height);
  }
  expect(await page.locator('.panel-actions').evaluate(panel => panel.scrollHeight <= panel.clientHeight + 1)).toBe(true);
});

test('failed browser launch is shown as a failed smoke step in studio and OBS', async ({ page }) => {
  const run = { id: 'missing-browser', ideaId: 'pitch-browser', status: 'failed', error: "Couldn't start the test browser (setup problem on the streaming PC)", startedAt: new Date().toISOString() };
  const events = ['sandbox_verified', 'file', 'testing', 'failed'].map(type => ({ runId: run.id, ideaId: run.ideaId, type, at: new Date().toISOString() }));
  await page.route('**/api/runs', route => route.fulfill({ json: { runs: [run] } }));
  await page.route('**/api/runner-events', route => route.fulfill({ json: { events } }));
  await page.goto('/?view=go-live');
  await expect(page.locator('#runs')).toContainText("Couldn't start the test browser");
  const smoke = page.locator('#runs .timeline-step').filter({ hasText: 'Smoke test' });
  await expect(smoke).toContainText('Failed');
  await expect(smoke).not.toHaveClass(/complete/);
  await page.goto('/overlay.html');
  await expect(page.locator('#work')).toContainText("Couldn't start the test browser");
  await expect(page.locator('#work .work-step').filter({ hasText: 'Smoke test' })).toContainText('Failed');
  await expect(page.locator('#work .work-step').filter({ hasText: 'Patch shipped' })).not.toHaveClass(/complete/);
});

test('Go Live mirrors one Play window and persists panel layout', async ({ page }) => {
  await page.goto('/?view=go-live');
  const play = await page.context().newPage();
  try {
    await play.goto('/play');
    await expect(play.locator('#status')).toContainText('LIVE');
    await expect(page.locator('#play-mirror')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('iframe[src="/preview.html"]')).toHaveCount(0);
    await page.locator('#layout-preset').selectOption('chat-focus');
    await page.getByLabel('Options for Recent chat').click();
    await page.getByRole('button', { name: 'Collapse Recent chat' }).click();
    await page.reload();
    await expect(page.locator('#layout-preset')).toHaveValue('chat-focus');
    await expect(page.locator('[data-panel="chat"]')).toHaveClass(/collapsed/);
  } finally { await play.close(); }
});

test('OBS widgets keep the 1920px HUD and toast zones clear', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/overlay.html');
  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { x:r.x, y:r.y, right:r.right, bottom:r.bottom }; };
    return { patches: rect('.stream-shell header'), work: rect('.stream-shell aside'), ballot: rect('.stream-shell footer'), ticker: rect('#pitch-ticker'), ballotText: parseFloat(getComputedStyle(document.querySelector('.candidate strong') ?? document.querySelector('#candidates p')!).fontSize), secondary: parseFloat(getComputedStyle(document.querySelector('.candidate small') ?? document.querySelector('#candidates p')!).fontSize), clock: parseFloat(getComputedStyle(document.querySelector('#clock')!).fontSize) };
  });
  expect(geometry.patches.y).toBeGreaterThanOrEqual(110);
  expect(geometry.work.y).toBeGreaterThanOrEqual(150);
  expect(geometry.ballot.bottom).toBeLessThanOrEqual(970);
  expect(geometry.ticker.x).toBeGreaterThanOrEqual(500);
  expect(geometry.ballotText).toBeGreaterThanOrEqual(28);
  expect(geometry.secondary).toBeGreaterThanOrEqual(20);
  expect(geometry.clock).toBeGreaterThanOrEqual(42);
  const play = await page.context().newPage();
  try {
    await play.setViewportSize({ width: 1920, height: 1080 });
    await play.goto('/play');
    await expect(play.locator('#status')).toContainText('LIVE');
    const toast = await play.evaluate(() => {
      const element = document.querySelector<HTMLElement>('#play-toast')!;
      element.textContent = 'New patch: Coin Shower — by @Live Patch Demo';
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
    });
    for (const widget of [geometry.patches, geometry.work, geometry.ballot, geometry.ticker]) {
      expect(widget.x >= toast.right || widget.right <= toast.x || widget.y >= toast.bottom || widget.bottom <= toast.y).toBe(true);
    }
  } finally { await play.close(); }
});

for (const example of chosen ? [chosen] : examples) test(`game plays for five seconds with ${example}`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/play?mutation=__none__');
  await expect(page.locator('#status')).toContainText('LIVE');
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().frame)).toBeGreaterThan(60);
  const baseline = await page.evaluate(() => (window as any).__livePatch.game.snapshot().frameRate as number);
  await page.goto(combined ? '/play' : `/play?mutation=${encodeURIComponent(example)}`);
  await expect(page.locator('#status')).toContainText('LIVE');
  await expect(page.locator('#mutations li')).toHaveCount(combined ? examples.length : 1);
  await expect.poll(async () => (await page.locator('#mutations li').allTextContents()).every(text => text.includes('· active'))).toBe(true);
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
  expect((await page.locator('#mutations li').allTextContents()).every(text => text.includes('· active'))).toBe(true);
  await expect(page.locator('#notice')).toBeEmpty();
  expect(errors).toEqual([]);
  expect(examples).toContain(example);
});

test('combined smoke detects a conflict that candidate-only smoke misses', async ({ page }) => {
  const watcher = path.join(mutationDir, 'zz-conflict-watcher.js');
  const candidate = path.join(mutationDir, 'zz-conflict-candidate.js');
  try {
    fs.writeFileSync(watcher, "export const meta={id:'watch',title:'Conflict Watch',author:'test',description:'test'}; export function onSpawn(game,e){if(e.origin==='zz-conflict-candidate.js')throw Error('patch conflict');}");
    fs.writeFileSync(candidate, "export const meta={id:'candidate',title:'Conflict Candidate',author:'test',description:'test'};let done=false;export function onTick(game){if(!done&&game.state.elapsed>2){done=true;game.spawn('coin',100,100);}}");
    await page.goto('/play?mutation=zz-conflict-candidate.js');
    await expect(page.locator('#mutations')).toContainText('Conflict Candidate · active');
    await page.waitForTimeout(2500);
    await expect(page.locator('#mutations')).toContainText('Conflict Candidate · active');
    await page.goto('/play');
    await expect(page.locator('#mutations')).toContainText('Conflict Watch · active');
    await expect(page.locator('#mutations')).toContainText('Conflict Watch · failed', { timeout: 8000 });
    await expect(page.locator('#mutations')).toContainText('Conflict Candidate · active');
  } finally { fs.rmSync(watcher, { force: true }); fs.rmSync(candidate, { force: true }); }
});

test('an endless hook loop is stopped without freezing the game', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-loop-test.js');
  try {
    await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
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
    await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
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
    await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(file, `export const meta = { id:'stall', title:'Stall', author:'test', description:'slow' }; export function onTick(game) { if(game.state.elapsed > .3) { const start=Date.now(); while(Date.now()-start<3000) {} } }`);
    await expect(page.locator('#mutations')).toContainText('Stall · failed', { timeout: 5000 });
    const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
    expect(state.maxFrameGap).toBeLessThan(350);
  } finally { fs.rmSync(file, { force: true }); }
});

test('an asynchronous hook rejection disables its module', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-async-test.js');
  try {
    await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(file, `export const meta = { id:'async', title:'Async', author:'test', description:'throws' }; export async function onTick() { await Promise.resolve(); throw Error('async fault'); }`);
    await expect(page.locator('#notice')).toContainText('async fault', { timeout: 5000 });
    await expect(page.locator('#mutations')).toContainText('failed');
  } finally { fs.rmSync(file, { force: true }); }
});

test('unrelated reloads do not repeat another module start effect', async ({ page }) => {
  const source = path.join(mutationDir, 'zz-once-test.js');
  const unrelated = path.join(mutationDir, 'zz-unrelated-test.js');
  try {
    await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
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
  await page.goto('/play'); await expect(page.locator('#mutations')).toContainText('Quick Feet · active');
  const frame = page.frames().find(item => item.url() === 'about:srcdoc');
  expect(frame).toBeDefined();
  await frame!.evaluate(() => window.postMessage({ type: 'load', source: `export const meta = {id:'spoof',title:'Spoof',author:'test',description:'bad'}` }, '*'));
  await page.waitForTimeout(200);
  await expect(page.locator('#mutations')).not.toContainText('Spoof');
  await expect(page.locator('#mutations')).toContainText('Quick Feet · active');
});

test('a burst of matching events reaches one module in order', async ({ page }) => {
  await page.goto('/play');
  await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(() => (window as any).__livePatch.host.sync([{ name: 'batch.js', source: `export const meta={id:'batch',title:'Batch',author:'test',description:'order'}; let next=0; export function onChat(game,event){ if(Number(event.text)!==next) throw Error('event order'); next++; if(next===30) game.spawn('coin',100,100); }`, error: null }]));
  await expect(page.locator('#mutations')).toContainText('Batch · active');
  await page.evaluate(() => { for (let i = 0; i < 30; i++) (window as any).__livePatch.host.emit({ type: 'chat', text: String(i), author: 'test' }); });
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().coins)).toBeGreaterThanOrEqual(5);
  await expect(page.locator('#mutations')).toContainText('Batch · active');
});

test('a slow but bounded event batch stays active during a busy moment', async ({ page }) => {
  await page.goto('/play');
  await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(() => (window as any).__livePatch.host.sync([{ name: 'bounded-batch.js', source: `export const meta={id:'bounded-batch',title:'Bounded Batch',author:'test',description:'busy'}; let seen=0; export function onChat(game){const until=Date.now()+15; while(Date.now()<until){} seen++; if(seen===17) game.spawn('coin',100,100);}`, error: null }]));
  await expect(page.locator('#mutations')).toContainText('Bounded Batch · active');
  await page.evaluate(() => { for (let i = 0; i < 17; i++) (window as any).__livePatch.host.emit({ type: 'chat', text: String(i), author: 'test' }); });
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().coins), { timeout: 5_000 }).toBeGreaterThanOrEqual(5);
  await expect(page.locator('#mutations')).toContainText('Bounded Batch · active');
});

test('an action storm is throttled before it fills the arena', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-storm-test.js');
  try {
    await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
    fs.writeFileSync(file, `export const meta = { id:'storm', title:'Storm', author:'test', description:'storm' }; export function onTick(game) { for (let i=0;i<10;i++) game.spawn('coin',100+i*25,200); }`);
    await expect(page.locator('#mutations')).toContainText('Storm · active', { timeout: 5000 });
    await expect(page.locator('#mutations')).toContainText('actions skipped', { timeout: 5000 });
    const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
    expect(state.enemies).toBeGreaterThan(0);
    expect(state.coins).toBeLessThan(40);
  } finally { fs.rmSync(file, { force: true }); }
});

test('the arena caps enemies and clears a swarm on a new run', async ({ page }) => {
  await page.goto('/play?mutation=__none__'); await expect(page.locator('#status')).toContainText('LIVE');
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
    await page.goto('/play?mutation=zz-entity-test.js'); await expect(page.locator('#status')).toContainText('LIVE');
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
    await page.goto('/play');
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
    await page.goto('/play');
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
    await page.goto('/play');
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

test('rollback restores another entity and removes patch-earned score', async ({ page }) => {
  await page.goto('/play');
  await expect(page.locator('#status')).toContainText('LIVE');
  const result = await page.evaluate(async () => {
    const game = (window as any).__livePatch.game;
    game.apply({ type: 'spawn', args: ['coin', 100, 100] }, 'system');
    const coin = game.snapshot().entities.find((entity: any) => entity.kind === 'coin' && entity.x === 100 && entity.y === 100);
    game.apply({ type: 'setTag', args: [coin.id, 'changed'] }, 'patch-test');
    game.apply({ type: 'setRadius', args: [coin.id, 25] }, 'patch-test');
    game.apply({ type: 'removeEntity', args: [coin.id] }, 'patch-test');
    await new Promise(resolve => setTimeout(resolve, 100));
    game.removeMutation('patch-test');
    const restored = game.snapshot().entities.find((entity: any) => entity.id === coin.id);
    const { x, y } = game.snapshot().player;
    game.apply({ type: 'spawn', args: ['coin', x, y] }, 'patch-score');
    await new Promise(resolve => setTimeout(resolve, 150));
    const earned = game.snapshot().score;
    game.removeMutation('patch-score');
    return { restored, earned, after: game.snapshot().score };
  });
  expect(result.restored).toMatchObject({ tag: '', radius: 12 });
  expect(result.earned).toBeGreaterThan(result.after);
});

test('rollback does not resurrect hostile enemies on the player', async ({ page }) => {
  await page.goto('/play');
  await expect(page.locator('#status')).toContainText('LIVE');
  const result = await page.evaluate(() => {
    const game = (window as any).__livePatch.game;
    const { x, y } = game.snapshot().player;
    game.apply({ type: 'spawn', args: ['enemy', x + 60, y] }, 'system');
    const enemy = game.snapshot().entities.find((entity: any) => entity.kind === 'enemy' && Math.abs(entity.x - (x + 60)) < 1);
    game.apply({ type: 'removeEntity', args: [enemy.id] }, 'patch-test');
    game.removeMutation('patch-test');
    return game.snapshot().entities.some((entity: any) => entity.id === enemy.id);
  });
  expect(result).toBe(false);
});

test('one crowded Space attack keeps unrelated patches active', async ({ page }) => {
  await page.goto('/play');
  await expect(page.locator('#mutations li')).toHaveCount(3);
  await page.evaluate(() => {
    const game = (window as any).__livePatch.game;
    const { x, y } = game.snapshot().player;
    for (let i = 0; i < 28; i++) game.apply({ type: 'spawn', args: ['enemy', x + 48 + i % 3, y + i % 3] }, 'crowd');
  });
  await page.keyboard.down('Space'); await page.waitForTimeout(100); await page.keyboard.up('Space');
  expect(await page.evaluate(() => (window as any).__livePatch.game.snapshot().particles)).toBeLessThanOrEqual(64);
  await page.waitForTimeout(600);
  await expect(page.locator('#mutations li')).toHaveCount(3);
  for (const patch of ['Quick Feet', 'Gold Rush', 'Danger Zone']) await expect(page.locator('#mutations')).toContainText(`${patch} · active`);
  await expect(page.locator('#notice')).toBeEmpty();
});

test('WebGL crowd keeps patches active', async ({ page }) => {
  test.skip(process.env.LIVE_PATCH_WEBGL !== '1', 'Opt-in WebGL renderer check');
  await page.goto('/play');
  await expect(page.locator('#mutations li')).toHaveCount(3);
  expect(await page.evaluate(() => (window as any).__livePatch.game.snapshot().renderer)).toBe('webgl');
  await page.evaluate(() => {
    const game = (window as any).__livePatch.game;
    const { x, y } = game.snapshot().player;
    for (let i = 0; i < 28; i++) game.apply({ type: 'spawn', args: ['enemy', x + 48 + i % 3, y + i % 3] }, 'crowd');
  });
  await page.keyboard.down('Space'); await page.waitForTimeout(100); await page.keyboard.up('Space');
  await page.waitForTimeout(700);
  for (const patch of ['Quick Feet', 'Gold Rush', 'Danger Zone']) await expect(page.locator('#mutations')).toContainText(`${patch} · active`);
  expect(await page.evaluate(() => (window as any).__livePatch.game.snapshot().particles)).toBeLessThanOrEqual(64);
});

test('out-of-range text and parameter arguments are bounded', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-bounds-test.js');
  try {
    await page.goto('/play?mutation=zz-bounds-test.js');
    fs.writeFileSync(file, `export const meta = {id:'bounds',title:'Bounds',author:'test',description:'bounds'}; export function onStart(game) { game.setParameter('enemySpeed', 600); } export function onChat(game,e) { game.drawText(e.text, 30, -25); }`);
    await expect(page.locator('#mutations')).toContainText('Bounds · active');
    await page.evaluate(() => (window as any).__livePatch.host.emit({ type: 'chat', text: 'x'.repeat(120), author: 'test' }));
    await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().floatingTexts)).toBeGreaterThan(0);
    await expect(page.locator('#mutations')).toContainText('Bounds · active');
  } finally { fs.rmSync(file, { force: true }); }
});

test('mutation Worker cannot create nested Workers', async ({ page }) => {
  await page.goto('/play?mutation=__none__');
  await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(() => (window as any).__livePatch.host.sync([{ name: 'probe.js', source: `export const meta = {id:'probe',title:'Probe',author:'test',description:'worker'}; export function onStart() { if (typeof Worker !== 'undefined' || typeof SharedWorker !== 'undefined' || typeof importScripts !== 'undefined') throw Error('nested worker available'); }`, error: null }]));
  await expect(page.locator('#mutations')).toContainText('Probe · active');
});

test('skipped ticks contribute to the next delivered delta', async ({ page }) => {
  await page.goto('/play?mutation=__none__');
  await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(() => (window as any).__livePatch.host.sync([{ name: 'delta.js', source: `export const meta = {id:'delta',title:'Delta',author:'test',description:'clock'}; let total = 0; export function onTick(game,e) { total += e.delta; if (game.state.elapsed < 1.2) { const start = Date.now(); while (Date.now()-start < 25) {} } if (game.state.elapsed > 1.4 && total < .7) throw Error('lost tick time'); }`, error: null }]));
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
      await page.goto(`/play?mutation=${path.basename(file)}`);
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
    await page.goto('/play?mutation=zz-simulator-chat.js');
    await expect(page.locator('#mutations')).toContainText('Sim Chat · active');
    await simulator.goto('/simulator.html');
    await simulator.locator('.practice-advanced summary').click();
    await simulator.locator('textarea[name="text"]').fill('hello from simulator');
    await simulator.locator('#send button:not([type])').click();
    await expect(simulator.locator('#result')).toContainText('No command');
    await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().floatingTexts)).toBeGreaterThan(0);
    await simulator.locator('textarea[name="text"]').fill('!idea <img src=x onerror=alert(1)>');
    await simulator.locator('#send button:not([type])').click();
    await expect(simulator.locator('#result')).toContainText('Idea received');
    await expect(simulator.locator('#ideas')).toContainText('<img src=x onerror=alert(1)>');
    await expect(simulator.locator('#ideas img')).toHaveCount(0);
    await simulator.locator('input[name="id"]').fill('viewer-2');
    await simulator.locator('input[name="login"]').fill('viewer2');
    await simulator.locator('select[name="kind"]').selectOption('reward');
    await simulator.locator('textarea[name="text"]').fill('Coins flee from the player');
    await simulator.locator('#send button:not([type])').click();
    await expect(simulator.locator('#ideas')).toContainText('Coins flee from the player');
    const ideas = await simulator.request.get('/api/ideas').then(response => response.json()) as { ideas: { id: string; text: string; status: string; source: string }[] };
    const unsafeText = ideas.ideas.find(item => item.text === '<img src=x onerror=alert(1)>');
    const rewardIdea = ideas.ideas.find(item => item.text === 'Coins flee from the player');
    expect(unsafeText).toBeTruthy();
    expect(rewardIdea?.source).toBe('reward');
    await simulator.locator('select[name="kind"]').selectOption('chat');
    await simulator.locator('select[name="role"]').selectOption('broadcaster');
    await simulator.locator('textarea[name="text"]').fill(`!reject ${unsafeText!.id}`);
    await simulator.locator('#send button:not([type])').click();
    await expect.poll(async () => (await simulator.request.get('/api/ideas').then(response => response.json()) as { ideas: { id: string; status: string }[] }).ideas.find(item => item.id === unsafeText!.id)?.status).toBe('rejected');
    expect((await simulator.request.get('/api/ideas').then(response => response.json()) as { ideas: { id: string; status: string }[] }).ideas.find(item => item.id === rewardIdea!.id)?.status).not.toBe('rejected');
  } finally { await simulator.close(); fs.rmSync(file, { force: true }); }
});

test('operator controls timed voting and the OBS overlay renders viewer text safely', async ({ page }) => {
  await page.goto('/?view=go-live');
  await expect(page.getByRole('heading', { name: 'Go Live' })).toBeVisible();
  const denied = await page.request.post('/api/control', { headers: { Origin: 'https://outside.example', 'Content-Type': 'application/json' }, data: { action: 'advance' } });
  expect(denied.status()).toBe(403);
  const phase = async () => page.evaluate(async () => (await fetch('/api/round').then(response => response.json())).phase as string);
  if (await phase() === 'paused') await page.getByRole('button', { name: 'Resume' }).click();
  if (await phase() === 'vote' || await phase() === 'approval') {
    await page.getByRole('button', { name: 'Next stage' }).click();
    if (await phase() === 'approval') await page.getByRole('button', { name: 'Next stage' }).click();
  }
  expect(await phase()).toBe('pitch');
  const pitch = `Glow <img src=x onerror=alert(1)> ${Date.now()}`;
  const result = await page.evaluate(async text => {
    const response = await fetch('/api/simulator/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: crypto.randomUUID(), kind: 'chat', viewer: { id: crypto.randomUUID(), login: 'overlayviewer', name: '<b>Viewer</b>', moderator: false, broadcaster: false }, text: `!idea ${text}` }) });
    return response.json();
  }, pitch) as { accepted: boolean };
  expect(result.accepted).toBe(true);
  await page.getByRole('button', { name: 'Next stage' }).click();
  await expect(page.locator('#round')).toContainText('VOTE');
  const overlay = await page.context().newPage();
  try {
    await overlay.setViewportSize({ width: 1920, height: 1080 });
    await overlay.goto('/overlay.html');
    await expect(overlay.locator('#candidates')).toContainText(pitch);
    await expect(overlay.locator('#candidates img')).toHaveCount(0);
    await expect(overlay.locator('#candidates b').filter({ hasText: 'Viewer' })).toHaveCount(0);
    await expect(overlay.locator('#candidates')).toContainText('!vote 1');
    await expect(overlay.locator('#candidates')).toContainText('%');
    const pitchSize = await overlay.locator('#candidates .candidate strong').first().evaluate(element => parseFloat(getComputedStyle(element).fontSize));
    expect(pitchSize).toBeGreaterThanOrEqual(28);
  } finally { await overlay.close(); }
  await page.getByRole('button', { name: 'Next stage' }).click();
  await expect(page.locator('#round')).toContainText('APPROVAL');
  const runsBefore = await page.evaluate(async () => (await fetch('/api/runs').then(response => response.json())).runs.length as number);
  const ballot = page.locator('#candidates article').filter({ hasText: pitch });
  await ballot.locator('summary').click();
  await page.waitForTimeout(2200);
  await expect(ballot.locator('details')).toHaveAttribute('open', '');
  page.once('dialog', dialog => void dialog.accept());
  await ballot.locator('.actions > button[data-action="reject"]').click();
  await expect(page.locator('#notice')).toContainText('rejected');
  const runsAfter = await page.evaluate(async () => (await fetch('/api/runs').then(response => response.json())).runs.length as number);
  expect(runsAfter).toBe(runsBefore);
});

test('studio navigation, setup and build library keep viewer data plain text', async ({ page }) => {
  test.setTimeout(45_000);
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  for (const name of ['Home', 'Practice', 'Go Live', 'Library', 'Builds']) await expect(page.locator('#app-nav a').filter({ hasText: name })).toBeVisible();
  await expect(page.locator('.rail-setup')).toContainText('Twitch');
  await expect(page.locator('.rail-settings')).toBeVisible();
  await page.locator('#app-nav a').filter({ hasText: 'Library' }).click();
  await expect(page.locator('#game-cards')).toContainText('Arena Survivor');
  await expect(page.getByRole('button', { name: 'Add your game' })).toBeVisible();
  await expect(page.locator('#game-detail')).toContainText('Hooks');
  await expect(page.locator('.library-card img')).toHaveCount(1);
  await page.getByRole('button', { name: 'Templates' }).click();
  await expect(page.locator('#game-cards')).toContainText('No games match this filter');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('#game-cards')).toContainText('Arena Survivor');
  await page.locator('#library-sort').selectOption('shipped');
  expect(await page.locator('.library-card').first().evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(24, 24, 27)');
  expect(await page.locator('.library-card img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.locator('#game-search').fill('no matching world');
  await expect(page.locator('#game-cards')).toContainText('No games match your search');
  await page.locator('.rail-setup a').filter({ hasText: 'Codex' }).click();
  await expect(page.locator('#setup-checks')).toContainText('Codex CLI and sign-in', { timeout: 20_000 });
  await expect(page.locator('.setup-step')).toHaveCount(6);
  await page.getByRole('button', { name: '3 Sandbox' }).click();
  await expect(page.locator('#setup-checks')).toHaveAttribute('aria-busy', 'false', { timeout: 25_000 });
  await expect(page.getByRole('button', { name: 'Run sandbox self-test' })).toBeVisible();
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByRole('button', { name: '2 Codex sign-in' })).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('input[name="clientSecret"]')).toHaveValue('');
  const denied = await page.request.post('/api/twitch/credentials', { headers: { Origin: 'https://outside.example', 'Content-Type': 'application/json' }, data: { clientSecret: 'fake-secret' } });
  expect(denied.status()).toBe(403);
  const nonJson = await page.request.post('/api/twitch/credentials', { headers: { Origin: new URL(page.url()).origin, 'Content-Type': 'text/plain' }, data: 'clientSecret=fake-secret' });
  expect(nonJson.status()).toBe(403);
  await page.locator('#app-nav a').filter({ hasText: 'Builds' }).click();
  await expect(page.getByRole('heading', { name: 'Saved builds' })).toBeVisible();
  await page.locator('#app-nav a').filter({ hasText: 'Go Live' }).click();
  await expect(page.locator('.dashboard-panels > section')).toHaveCount(7);
  await expect(page.locator('#runs')).toContainText('Sandbox verified');
  await expect(page.locator('#chat-strip')).toBeVisible();
  await expect(page.locator('.game-preview iframe')).toHaveAttribute('src', '/overlay.html');
  await expect(page.locator('iframe[src="/preview.html"]')).toHaveCount(0);
  const firstRun = await page.context().newPage();
  try {
    await firstRun.goto('/?first-run=1');
    await expect(firstRun.getByRole('dialog', { name: 'Welcome to Live Patch' })).toBeVisible();
  } finally { await firstRun.close(); }
});

test('saved build compares original and evolved games without changing the live run', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/play');
  await expect(page.locator('#mutations')).toContainText('Quick Feet');
  const before = await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame);
  const saved = await page.evaluate(async () => fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save' }) }).then(response => response.json())) as { id: string; directory: string };
  expect(saved).toHaveProperty('id');
  expect(saved.id).toMatch(/^[\w-]+$/);
  expect(saved.directory).toBe(path.join(path.dirname(process.env.LIVE_PATCH_TEST_DATA_DIR!), 'builds', saved.id));
  const compare = await page.context().newPage();
  try {
    await compare.goto(`/compare.html?id=${encodeURIComponent(saved.id)}`);
    await expect(compare.frameLocator('#original').locator('#status')).toContainText('LIVE', { timeout: 40_000 });
    await expect(compare.frameLocator('#original').locator('#mutations')).toContainText('No mutations yet');
    await expect(compare.frameLocator('#evolved').locator('#mutations')).toContainText('Quick Feet', { timeout: 40_000 });
    expect(await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame)).toBeGreaterThan(before);
    await expect(page.locator('#mutations')).toContainText('Quick Feet');
  } finally { await compare.close(); }
});

test('Practice generates three distinct pitches and one-click votes', async ({ page }) => {
  await page.goto('/?view=practice');
  await page.locator('.practice-advanced summary').click();
  await page.evaluate(async () => {
    const action = (name: string) => fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name }) });
    for (let attempt = 0; attempt < 4; attempt++) {
      const round = await fetch('/api/round').then(response => response.json()) as { phase: string };
      if (round.phase === 'pitch') break;
      await action(round.phase === 'paused' ? 'resume' : 'advance');
    }
  });
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Generate sample pitch' }).click();
    await page.locator('#send button:not([type])').click();
    await expect(page.locator('#result')).toContainText('Idea received');
  }
  const round = await page.evaluate(async () => fetch('/api/round').then(response => response.json())) as { phase: string };
  if (round.phase === 'pitch') await page.evaluate(() => fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'advance' }) }));
  for (let i = 1; i <= 3; i++) {
    await page.getByRole('button', { name: `Vote ${i} as new viewer` }).click();
    await expect(page.locator('#result')).toContainText('Vote recorded');
  }
});

test('setup shows checks while loading and keeps step labels readable', async ({ page }) => {
  await page.route('**/api/setup', async route => { await new Promise(resolve => setTimeout(resolve, 1200)); await route.continue(); });
  await page.goto('/?view=setup');
  await expect(page.locator('.setup-check-row').first()).toContainText('Checking…');
  await expect(page.locator('#setup-continue')).toBeDisabled();
  await expect(page.locator('#setup-checks')).toHaveAttribute('aria-busy', 'false', { timeout: 20_000 });
  await page.getByRole('button', { name: '2 Codex sign-in' }).click();
  const done = page.locator('.setup-step.done').first();
  await expect(done).toContainText('Requirements');
  await expect(done).toHaveCSS('color', 'rgb(180, 255, 224)');
});

test('mutation sound and visual requests are throttled while the game keeps running', async ({ page }) => {
  const file = path.join(mutationDir, 'zz-effects-spam.js');
  try {
    fs.writeFileSync(file, `export const meta={id:'effects-spam',title:'Effects spam',author:'test',description:'test'}; export function onTick(game){for(let i=0;i<20;i++){game.playSound('coin');game.burst('spark',480,320);game.flash('#ffffff');game.shake(.01);}}`);
    await page.goto('/play?mutation=zz-effects-spam.js');
    await expect(page.locator('#mutations')).toContainText('Effects spam · active');
    await page.waitForTimeout(1200);
    const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
    expect(state.flashesLastSecond).toBeLessThanOrEqual(3);
    expect(state.frame).toBeGreaterThan(40);
    await expect(page.locator('#mutations')).toContainText('actions skipped');
  } finally { fs.rmSync(file, { force: true }); }
});
