import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const fallback = (JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as { livePatch: { defaultGame: string } }).livePatch.defaultGame;
const gameDirectory = process.env.LIVE_PATCH_TEST_GAME_DIR || path.resolve(process.cwd(), process.env.LIVE_PATCH_GAME || fallback);
const manifest = JSON.parse(fs.readFileSync(path.join(gameDirectory, 'live-patch.json'), 'utf8')) as { name: string; mutationDir: string; demoMutation?: string; samplePitches?: string[]; overlay?: { keepClear?: { label: string }[] } };
const mutationDir = path.join(gameDirectory, manifest.mutationDir);
const examples = fs.readdirSync(mutationDir).filter(name => name.endsWith('.js'));
const demoSource = manifest.demoMutation ? fs.readFileSync(path.join(gameDirectory, manifest.demoMutation), 'utf8') : '';
const demoTitle = /title\s*:\s*['"`]([^'"`]+)['"`]/.exec(demoSource)?.[1];

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

test('Play fills a 16:9 game capture without cutting off the game', async ({ page }) => {
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

test('sidebar settings and local status stay in view while the page scrolls', async ({ page }) => {
  for (const height of [900, 768]) {
    await page.setViewportSize({ width: height === 900 ? 1920 : 1366, height });
    await page.goto('/?view=home');
    const settings = page.locator('.rail-settings');
    const status = page.locator('.rail-foot');
    await expect(settings).toBeVisible();
    await expect(status).toContainText('LOCAL STUDIO');
    const before = { settings: await settings.boundingBox(), status: await status.boundingBox() };
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    const after = { settings: await settings.boundingBox(), status: await status.boundingBox() };
    for (const key of ['settings', 'status'] as const) {
      expect(after[key]).toBeTruthy();
      expect(Math.abs(after[key]!.y - before[key]!.y)).toBeLessThan(2);
      expect(after[key]!.y).toBeGreaterThanOrEqual(0);
      expect(after[key]!.y + after[key]!.height).toBeLessThanOrEqual(height);
    }
  }
});

test('Library covers crop to equal frames and cards align', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?view=library');
  const cards = page.locator('.library-select:has(img)');
  await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(2);
  await expect.poll(() => cards.locator('img').evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const layout = await cards.evaluateAll(cards => cards.slice(0, 2).map(card => {
    const cover = card.querySelector('.library-cover')!;
    const image = cover.querySelector('img')!;
    return { card: card.getBoundingClientRect().toJSON(), cover: cover.getBoundingClientRect().toJSON(), image: image.getBoundingClientRect().toJSON(), fit: getComputedStyle(image).objectFit };
  }));
  expect(Math.abs(layout[0].cover.height - layout[1].cover.height)).toBeLessThan(2);
  expect(Math.abs(layout[0].cover.top - layout[1].cover.top)).toBeLessThan(2);
  expect(Math.abs(layout[0].card.bottom - layout[1].card.bottom)).toBeLessThan(2);
  for (const item of layout) {
    expect(item.fit).toBe('cover');
    expect(Math.abs(item.image.width - item.cover.width)).toBeLessThan(2);
    expect(Math.abs(item.image.height - item.cover.height)).toBeLessThan(2);
  }
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

test('Practice uses the active game manifest for sample pitches', async ({ page }) => {
  await page.goto('/?view=practice');
  const expected = manifest.samplePitches?.[0] ?? 'The player can jump twice';
  await expect(page.locator('textarea[name="text"]')).toHaveAttribute('placeholder', `!idea ${expected}`);
  await page.locator('.practice-advanced summary').click();
  await page.getByRole('button', { name: 'Generate sample pitch' }).click();
  await expect(page.locator('textarea[name="text"]')).toHaveValue(`!idea ${expected}`);
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

test('Practice can run a round and ship a labelled demo without Codex', async ({ page }) => {
  expect(demoTitle).toBeTruthy();
  await page.goto('/?view=practice');
  await page.getByRole('button', { name: 'Run a full round automatically' }).click();
  await expect(page.locator('#practice-stage')).toContainText('approval', { timeout: 15_000 });
  await expect(page.locator('#demo-ship')).toBeVisible();
  await page.locator('#demo-ship').click();
  await expect(page.locator('#quick-result')).toContainText('Done.', { timeout: 15_000 });
  await expect(page.locator('#practice-chat')).toContainText(demoTitle!, { timeout: 15_000 });
  const demoState = await page.evaluate(async () => {
    const runs = await fetch('/api/runs').then(r => r.json());
    const ideas = await fetch('/api/ideas').then(r => r.json());
    const run = runs.runs.at(-1);
    return { demo: run.demo, ideaStatus: ideas.ideas.find((idea: any) => idea.id === run.ideaId)?.status };
  });
  expect(demoState).toEqual({ demo: true, ideaStatus: 'demo' });
  await page.goto('/play');
  await expect(page.locator('#mutations')).toContainText(`${demoTitle} · active`);
  await expect(page.locator('#play-toast')).toContainText(demoTitle!);
  await expect(page.locator('#mutations')).not.toContainText('actions skipped');
  const rollback = await page.evaluate(() => fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rollback' }) }).then(r => r.json()));
  expect(rollback.accepted).toBe(true);
  await expect(page.locator('#mutations')).not.toContainText(`${demoTitle} · active`);
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
  expect(demoTitle).toBeTruthy();
  const file = path.join(gameDirectory, manifest.demoMutation!);
  const original = fs.readFileSync(file, 'utf8');
  const changedTitle = 'Demo patch: Browser Test';
  try {
    fs.writeFileSync(file, original.replace(demoTitle!, changedTitle));
    await page.goto('/?view=practice');
    await page.getByRole('button', { name: 'Run a full round automatically' }).click();
    await expect(page.locator('#demo-ship')).toBeVisible({ timeout: 15_000 });
    await page.locator('#demo-ship').click();
    await expect(page.locator('#practice-chat')).toContainText(changedTitle, { timeout: 15_000 });
    const data = await page.evaluate(async () => ({ runs: await fetch('/api/runs').then(r => r.json()), events: await fetch('/api/runner-events').then(r => r.json()) }));
    const run = data.runs.runs.at(-1);
    expect(run.mutationTitle).toBe(changedTitle);
    expect(data.events.events.some((event: any) => event.runId === run.id && event.message?.includes(changedTitle))).toBe(true);
    await page.goto('/overlay.html');
    await expect(page.locator('#work')).toContainText(changedTitle);
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
  await expect(page.locator('.panel-patches .patch-item')).toHaveCount(examples.length + 1);
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
  await expect(page.locator('.library-select').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(600);
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
  // The timeline refreshes on a timer. Measure all four rows in one browser
  // turn so a refresh cannot replace them between locator queries.
  const timeline = await page.evaluate(() => {
    const panel = document.querySelector('[data-panel="codex"]')!.getBoundingClientRect();
    const rows = Array.from(document.querySelectorAll('#runs .timeline-step')).map(row => row.getBoundingClientRect());
    return { panelBottom: panel.bottom, rowBottoms: rows.map(row => row.bottom), visible: rows.every(row => row.height > 0) };
  });
  expect(timeline.rowBottoms).toHaveLength(4);
  expect(timeline.visible).toBe(true);
  for (const bottom of timeline.rowBottoms) expect(bottom).toBeLessThanOrEqual(timeline.panelBottom);
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
      element.textContent = 'New patch: Demo — by @Live Patch Demo';
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
    });
    for (const widget of [geometry.patches, geometry.work, geometry.ballot, geometry.ticker]) {
      expect(widget.x >= toast.right || widget.right <= toast.x || widget.y >= toast.bottom || widget.bottom <= toast.y).toBe(true);
    }
  } finally { await play.close(); }
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
  await expect(page.locator('#game-cards')).toContainText(manifest.name);
  await expect(page.getByRole('button', { name: 'Add your game' })).toBeVisible();
  await expect(page.locator('#game-detail')).toContainText('Hooks');
  expect(await page.locator('.library-card img').count()).toBeGreaterThanOrEqual(1);
  await page.getByRole('button', { name: 'Templates' }).click();
  await expect(page.locator('#game-cards')).toContainText('No games match this filter');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('#game-cards')).toContainText(manifest.name);
  await page.locator('#library-sort').selectOption('shipped');
  expect(await page.locator('.library-card').first().evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgb(24, 24, 27)');
  expect(await page.locator('.library-card img').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
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

test('Library switches both built-in games and the OBS layout follows the active manifest', async ({ page }) => {
  test.setTimeout(90_000);
  const catalog = await page.request.get('/api/library').then(response => response.json()) as { active: string; games: { name: string; directory: string }[] };
  const first = catalog.games.find(game => game.directory === catalog.active)!;
  const other = catalog.games.find(game => game.directory !== catalog.active && ['Arena Survivor', 'Lantern Run'].includes(game.name))!;
  expect(first).toBeTruthy(); expect(other).toBeTruthy();
  const firstSettings = await page.request.get('/api/settings').then(response => response.json()) as { overlayWidgets: { type: string; x: number; y: number }[] };
  await page.goto('/?view=library');
  await expect(page.locator('.library-card').filter({ hasText: first.name })).toBeVisible();
  await expect(page.locator('.library-card').filter({ hasText: other.name })).toBeVisible();
  await page.locator('.library-card').filter({ hasText: other.name }).click();
  await page.getByRole('button', { name: 'Make active for streams' }).click();
  const activeName = async () => { try { return await page.request.get('/api/game').then(response => response.json()).then(game => game.name as string); } catch { return ''; } };
  await expect.poll(activeName, { timeout: 20_000 }).toBe(other.name);
  await expect.poll(async () => {
    try { return (await page.request.get('/overlay.html')).ok(); } catch { return false; }
  }, { timeout: 30_000 }).toBe(true);
  const otherSettings = await page.request.get('/api/settings').then(response => response.json()) as typeof firstSettings;
  expect(otherSettings.overlayWidgets).not.toEqual(firstSettings.overlayWidgets);
  await expect(async () => {
    await page.goto('/overlay.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.stream-shell header')).toBeVisible();
  }).toPass({ timeout: 30_000 });
  const patch = otherSettings.overlayWidgets.find(widget => widget.type === 'patches')!;
  await expect(page.locator('.stream-shell header')).toHaveCSS('top', `${patch.y}px`);
  await page.goto('/?view=library');
  await page.locator('.library-card').filter({ hasText: first.name }).click();
  await page.getByRole('button', { name: 'Make active for streams' }).click();
  await expect.poll(activeName, { timeout: 20_000 }).toBe(first.name);
  const restored = await page.request.get('/api/settings').then(response => response.json()) as typeof firstSettings;
  expect(restored.overlayWidgets).toEqual(firstSettings.overlayWidgets);
});
