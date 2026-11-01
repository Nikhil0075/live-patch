import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const directory = process.env.LIVE_PATCH_TEST_GAME_DIR || path.resolve('games/lantern-run');
const builtIns = fs.readdirSync(path.join(directory, 'mutations')).filter(name => name.endsWith('.js'));
const selected = process.env.MUTATION_FILE;
const fixture = (name: string) => fs.readFileSync(path.join(directory, 'tests/fixtures', name), 'utf8');
async function load(page: import('@playwright/test').Page, name: string, source: string) {
  await page.evaluate(({ name, source }) => (window as any).__livePatch.host.sync([{ name, source, error: null }]), { name, source });
  await expect(page.locator('#mutations')).toContainText('active');
}
async function crop(page: import('@playwright/test').Page, x: number, y: number, width: number, height: number): Promise<Buffer> {
  const bounds = await page.locator('#game canvas').boundingBox();
  if (!bounds) throw Error('Game canvas missing');
  return page.screenshot({ clip: { x: bounds.x + (x - width / 2) * bounds.width / 1152, y: bounds.y + (y - height / 2) * bounds.height / 648,
    width: width * bounds.width / 1152, height: height * bounds.height / 648 } });
}
async function subjectChangedPixels(page: import('@playwright/test').Page, a: Buffer, b: Buffer, subject: 'fox' | 'owl' | 'firefly'): Promise<number> {
  return page.evaluate(async ([first, second, kind]) => {
    const decode = async (base64: string) => createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const images = await Promise.all([decode(first), decode(second)]);
    const canvas = document.createElement('canvas'); canvas.width = images[0].width; canvas.height = images[0].height;
    const c = canvas.getContext('2d')!; c.drawImage(images[0], 0, 0); const aPixels = c.getImageData(0, 0, canvas.width, canvas.height).data;
    c.clearRect(0, 0, canvas.width, canvas.height); c.drawImage(images[1], 0, 0); const bPixels = c.getImageData(0, 0, canvas.width, canvas.height).data;
    const belongs = (pixels: Uint8ClampedArray, i: number) => {
      const [red, green, blue] = [pixels[i], pixels[i + 1], pixels[i + 2]];
      if (kind === 'fox') return red > 110 && red > green * 1.24 && red > blue * 1.7;
      if (kind === 'owl') return red > 78 && green > 80 && blue > green + 14 && blue > red + 22;
      return red > 135 && green > 135 && green > blue * 1.45;
    };
    let count = 0;
    for (let i = 0; i < aPixels.length; i += 4) {
      if (!belongs(aPixels, i) && !belongs(bPixels, i)) continue;
      if (Math.abs(aPixels[i] - bPixels[i]) + Math.abs(aPixels[i + 1] - bPixels[i + 1]) + Math.abs(aPixels[i + 2] - bPixels[i + 2]) > 45) count++;
    }
    images.forEach(image => image.close()); return count;
  }, [a.toString('base64'), b.toString('base64'), subject] as const);
}

test('Lantern Run starts and advances', async ({ page }) => {
  await page.goto('/play');
  await expect(page.locator('#status')).toContainText('Lantern Run · LIVE');
  const initial = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  await page.waitForTimeout(800);
  const later = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(later.run.distance).toBeGreaterThan(initial.run.distance);
});

test('generated pickups and hazards enter the playfield after the opening stretch', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(() => {
    const { game, host } = (window as any).__livePatch;
    host.sync([]);
    game.apply({ type: 'setParameter', args: ['runSpeed', 600] }, 'natural-probe');
    game.apply({ type: 'setParameter', args: ['spawnRate', 3] }, 'natural-probe');
    game.apply({ type: 'setParameter', args: ['maxHearts', 5] }, 'natural-probe');
    const ahead = new Set<number>(), entered = new Set<string>();
    (window as any).__natural = { ahead, entered };
    window.setInterval(() => {
      const state = game.snapshot();
      if (state.player.hearts < 4) game.apply({ type: 'heal', args: [2] }, 'natural-probe');
      for (const item of state.entities) {
        if (item.id <= 3) continue;
        if (item.x > 1452) ahead.add(item.id);
        if (ahead.has(item.id) && item.x >= 0 && item.x <= 1152) entered.add(item.kind);
      }
    }, 50);
  });
  await expect.poll(() => page.evaluate(() => {
    const kinds = [...(window as any).__natural.entered];
    return kinds.some(kind => ['firefly', 'acorn'].includes(kind)) && kinds.some(kind => ['log', 'thorns', 'boulder', 'owl'].includes(kind));
  }), { timeout: 20_000 }).toBe(true);
});

for (const name of selected ? [selected] : builtIns) test(`game plays for five seconds with ${name}`, async ({ page }) => {
  await page.goto('/play');
  await expect(page.locator('#mutations')).toContainText('active');
  await page.waitForTimeout(5000);
  const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(state.run.distance).toBeGreaterThan(100);
  expect(state.maxFrameGap).toBeLessThan(350);
  await expect(page.locator('#mutations')).not.toContainText('disabled');
});

test('Space, W, Up and canvas click all jump and pause freezes time', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  for (const key of ['Space', 'KeyW', 'ArrowUp']) {
    await page.reload(); await expect(page.locator('#status')).toContainText('LIVE');
    await page.keyboard.press(key === 'KeyW' ? 'w' : key);
    await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().player.grounded)).toBe(false);
  }
  await page.reload(); await expect(page.locator('#status')).toContainText('LIVE');
  await page.locator('#game canvas').click({ position: { x: 350, y: 400 } });
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().player.grounded)).toBe(false);
  await page.keyboard.press('Escape'); await expect(page.locator('#play-menu')).toBeVisible();
  const before = await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame)).toBe(before);
});

test('fox legs visibly animate while the world scrolls, and pause freezes the picture', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  const firstFox = await crop(page, 346, 493, 112, 50);
  await page.waitForTimeout(125);
  const nextFox = await crop(page, 346, 493, 112, 50);
  expect(await subjectChangedPixels(page, firstFox, nextFox, 'fox')).toBeGreaterThan(150);
  await page.evaluate(async () => {
    const info = await fetch('/api/game').then(response => response.json());
    const url = new URL('./rig.ts', new URL(info.entry, location.origin));
    const rigs = await import(/* @vite-ignore */ url.href);
    rigs.FoxRig.prototype.update = () => {};
  });
  const stillFox = await crop(page, 346, 493, 112, 50);
  await page.waitForTimeout(125);
  expect(await subjectChangedPixels(page, stillFox, await crop(page, 346, 493, 112, 50), 'fox')).toBeLessThan(75);
  await page.keyboard.down('Space');
  expect(await page.evaluate(() => (window as any).__livePatch.game.snapshot().player.grounded)).toBe(false);
  await page.keyboard.up('Space');
  await page.keyboard.press('Escape'); await expect(page.locator('#play-menu')).toBeVisible();
  const frozenA = await page.locator('#game canvas').screenshot();
  await page.waitForTimeout(180);
  const frozenB = await page.locator('#game canvas').screenshot();
  expect(frozenA.equals(frozenB)).toBe(true);
});

for (const subject of ['owl', 'firefly'] as const) test(`${subject} visibly animates and a stopped rig does not`, async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(kind => {
    const game = (window as any).__livePatch.game;
    game.apply({ type: 'setParameter', args: ['runSpeed', 120] }, 'animation-probe');
    game.apply({ type: 'setParameter', args: ['speedRamp', 0] }, 'animation-probe');
    for (const item of game.snapshot().entities.filter((item: { kind: string }) => item.kind === kind))
      game.apply({ type: 'removeEntity', args: [item.id] }, 'animation-probe');
    game.apply({ type: 'spawn', args: [kind, 700, 260] }, 'animation-probe');
    const item = game.snapshot().entities.filter((entity: { kind: string }) => entity.kind === kind).at(-1);
    game.apply({ type: 'setVelocity', args: [item.id, 120, 0] }, 'animation-probe');
  }, subject);
  const first = await crop(page, 700, 260, 160, 130);
  await page.waitForTimeout(subject === 'owl' ? 170 : 95);
  const second = await crop(page, 700, 260, 160, 130);
  const moving = await subjectChangedPixels(page, first, second, subject);
  await page.evaluate(async kind => {
    const info = await fetch('/api/game').then(response => response.json());
    const rigs = await import(/* @vite-ignore */ new URL('./rig.ts', new URL(info.entry, location.origin)).href);
    (kind === 'owl' ? rigs.OwlRig : rigs.FireflyRig).prototype.update = () => {};
  }, subject);
  const still = await crop(page, 700, 260, 160, 130);
  await page.waitForTimeout(subject === 'owl' ? 170 : 95);
  const frozen = await subjectChangedPixels(page, still, await crop(page, 700, 260, 160, 130), subject);
  expect(moving, `${subject} should animate`).toBeGreaterThan(frozen + 30);
  expect(frozen, `${subject} should stop when its rig update stops`).toBeLessThan(moving * .5);
});

test('rollback removes a patch’s weather, power-up, parameter and entities but keeps run progress', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  await expect(page.locator('#mutations')).toContainText('Forest Breeze · active');
  const before = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  await page.evaluate(() => {
    const game = (window as any).__livePatch.game;
    game.apply({ type: 'setWeather', args: ['rain'] }, 'probe');
    game.apply({ type: 'setParameter', args: ['runSpeed', 400] }, 'probe');
    game.apply({ type: 'grantPowerUp', args: ['shield', 10] }, 'probe');
    game.apply({ type: 'spawn', args: ['firefly', 900, 360] }, 'probe');
  });
  const patched = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(patched.weather).toBe('rain'); expect(patched.parameters.runSpeed).toBe(400);
  expect(patched.player.powerUps).toContain('shield');
  await page.evaluate(() => (window as any).__livePatch.game.removeMutation('probe'));
  const after = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(after.weather).toBe(before.weather); expect(after.parameters.runSpeed).toBe(before.parameters.runSpeed);
  expect(after.player.powerUps).not.toContain('shield');
  expect(after.entities.some((entity: any) => entity.id === patched.entities.at(-1).id)).toBe(false);
  expect(after.run.fireflies).toBeGreaterThanOrEqual(before.run.fireflies);
  expect(after.run.distance).toBeGreaterThanOrEqual(before.run.distance);
});

test('removing a five-heart module clamps hearts and keeps the frame loop alive', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  await load(page, 'more-hearts.js', "export const meta={id:'more-hearts',title:'More Hearts',author:'test',description:'Raise the cap'}; export function onStart(game){game.setParameter('maxHearts',5);game.heal(2)}");
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().player.hearts)).toBe(5);
  const before = await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame);
  await page.evaluate(() => (window as any).__livePatch.host.sync([]));
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().frame)).toBeGreaterThan(before + 10);
  const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(state.player.hearts).toBeLessThanOrEqual(state.player.maxHearts);
  expect(state.player.maxHearts).toBe(3);
});

test('the HUD stays inside its protected stream zone at Large size and five hearts', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(async () => {
    const game = (window as any).__livePatch.game;
    game.apply({ type: 'setParameter', args: ['maxHearts', 5] }, 'probe');
    game.apply({ type: 'heal', args: [2] }, 'probe');
    game.configure({ ...await fetch('/api/settings').then(response => response.json()), hudSize: 'large' });
  });
  const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'live-patch.json'), 'utf8'));
  const zone = manifest.overlay.keepClear.find((item: any) => item.label === 'Game HUD');
  for (const bound of state.hudBounds) {
    expect(bound.x * 1920 / 1152).toBeGreaterThanOrEqual(zone.x);
    expect((bound.x + bound.width) * 1920 / 1152).toBeLessThanOrEqual(zone.x + zone.width);
    expect((bound.y + bound.height) * 1080 / 648).toBeLessThanOrEqual(zone.y + zone.height);
  }
});

test('large HUD keeps four-digit firefly totals clear of distance and five hearts', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(async () => {
    const game = (window as any).__livePatch.game;
    game.apply({ type: 'setParameter', args: ['maxHearts', 5] }, 'hud-probe');
    game.apply({ type: 'heal', args: [2] }, 'hud-probe');
    game.apply({ type: 'setParameter', args: ['fireflyValue', 10] }, 'hud-probe');
    game.configure({ ...await fetch('/api/settings').then(response => response.json()), hudSize: 'large' });
  });
  for (let batch = 0; batch < 4; batch++) {
    await page.evaluate(() => {
      const game = (window as any).__livePatch.game;
      for (let i = 0; i < 40; i++) game.apply({ type: 'spawn', args: ['firefly', 346, game.snapshot().player.y] }, 'hud-probe');
    });
    await page.waitForTimeout(120);
  }
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().run.fireflies)).toBeGreaterThanOrEqual(1000);
  const bounds = await page.evaluate(() => (window as any).__livePatch.game.snapshot().hudBounds);
  expect(bounds[0].x + bounds[0].width).toBeLessThanOrEqual(bounds[1].x);
  expect(bounds[1].x + bounds[1].width).toBeLessThanOrEqual(bounds[3].x);
  expect(bounds.at(-1).x + bounds.at(-1).width).toBeLessThanOrEqual(402);
});

test('entity caps and out-of-range actions stay bounded', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(() => {
    const game = (window as any).__livePatch.game;
    for (let i = 0; i < 100; i++) game.apply({ type: 'spawn', args: ['firefly', 1100, 350, 9] }, 'storm');
    game.apply({ type: 'spawn', args: ['dragon', 500, 300] }, 'storm');
    game.apply({ type: 'setParameter', args: ['runSpeed', 9999] }, 'storm');
  });
  const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(state.entities.filter((item: any) => item.kind === 'firefly').length).toBeLessThanOrEqual(40);
  expect(state.entities.some((item: any) => item.kind === 'dragon')).toBe(false);
  expect(state.parameters.runSpeed).toBe(600);
  expect(state.activeEntities).toBeLessThanOrEqual(80);
});

test('a ledge landing and a pit fall both reach mutation hooks', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  await load(page, 'ledge-pit.js', "export const meta={id:'ledge-pit',title:'Ledge and Pit',author:'test',description:'Observe run events'}; export function onLand(game,e){if(e.on==='ledge')game.grantPowerUp('magnet',15)} export function onFall(game){game.grantPowerUp('shield',15)}");
  await page.evaluate(() => (window as any).__livePatch.game.apply({ type: 'spawn', args: ['ledge', 520, 400] }, 'probe'));
  await page.keyboard.press('Space');
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().player.powerUps.includes('magnet')), { timeout: 7000 }).toBe(true);
  await page.evaluate(() => (window as any).__livePatch.game.apply({ type: 'setParameter', args: ['runSpeed', 600] }, 'probe'));
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().player.powerUps.includes('shield')), { timeout: 16000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().player.y), { timeout: 3000 }).toBeLessThan(518);
  const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(state.player.hearts).toBe(2);
});

test('a pit fall recovers on the next ground and emits every crossed milestone', async ({ page }) => {
  test.setTimeout(35_000);
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(() => {
    const { game, host } = (window as any).__livePatch;
    const trace = { milestones: [] as number[], falls: 0, maxJump: 0, prior: 0, recovered: false };
    (window as any).__fallTrace = trace;
    const original = host.emit.bind(host);
    host.emit = (event: any) => {
      if (event.type === 'milestone') trace.milestones.push(event.meters);
      if (event.type === 'fall') trace.falls++;
      original(event);
    };
    window.setInterval(() => {
      const state = game.snapshot();
      if (trace.prior) trace.maxJump = Math.max(trace.maxJump, state.run.distance - trace.prior);
      trace.prior = state.run.distance;
      if (trace.falls && state.groundUnderFox && state.player.y < 518) trace.recovered = true;
    }, 16);
    game.apply({ type: 'setParameter', args: ['runSpeed', 600] }, 'probe');
  });
  await expect.poll(() => page.evaluate(() => (window as any).__fallTrace.falls), { timeout: 22_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => (window as any).__fallTrace.recovered), { timeout: 4000 }).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().run.distance), { timeout: 8000 }).toBeGreaterThan(300);
  const trace = await page.evaluate(() => (window as any).__fallTrace);
  expect(trace.maxJump).toBeLessThan(30);
  expect(trace.milestones.slice(0, 3)).toEqual([100, 200, 300]);
});

test('three hits show run over, then a new run starts after two seconds', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  // Keep this collision check on the first continuous stretch, away from random pits and pickups.
  await page.evaluate(() => (window as any).__livePatch.game.apply({ type: 'setParameter', args: ['runSpeed', 120] }, 'probe'));
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().runElapsed), { timeout: 8000 }).toBeGreaterThan(3.1);
  for (let hearts = 2; hearts >= 0; hearts--) {
    await page.evaluate(() => (window as any).__livePatch.game.apply({ type: 'spawn', args: ['boulder', 520, 480] }, 'probe'));
    await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().player.hearts), { timeout: 5000 }).toBeLessThanOrEqual(hearts);
    if (hearts > 0) await page.waitForTimeout(1200);
  }
  const over = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(over.runOver).toBe(true); expect(over.player.hearts).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().run.number), { timeout: 5000 }).toBeGreaterThan(over.run.number);
  const restarted = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(restarted.player.hearts).toBe(3);
  expect(restarted.run.best).toBeGreaterThan(0);
});

test('a crowded storm stays bounded without disabling an unrelated patch', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#mutations')).toContainText('Forest Breeze · active');
  const baseline = await page.evaluate(() => (window as any).__livePatch.game.snapshot().frameRate as number);
  await page.evaluate(() => {
    const game = (window as any).__livePatch.game;
    game.apply({ type: 'setWeather', args: ['rain'] }, 'storm');
    for (const [kind, count] of [['firefly', 40], ['acorn', 10], ['owl', 6], ['pinecone', 10], ['log', 12], ['ledge', 10], ['spring', 4], ['shield', 4]] as const)
      for (let i = 0; i < count; i++) game.apply({ type: 'spawn', args: [kind, 700 + (i % 7) * 50, 260 + (i % 4) * 40] }, 'storm');
    for (let i = 0; i < 20; i++) game.apply({ type: 'burst', args: ['sparks', 720, 330] }, 'storm');
  });
  await page.waitForTimeout(1600);
  const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(state.activeEntities).toBeLessThanOrEqual(80);
  expect(state.particles).toBeLessThanOrEqual(64);
  expect(state.maxFrameGap).toBeLessThan(350);
  expect(state.frameRate).toBeGreaterThan(baseline * .55);
  await expect(page.locator('#mutations')).toContainText('Forest Breeze · active');
});

test('a mutation action storm is throttled by the host', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  await load(page, 'action-storm.js', "export const meta={id:'action-storm',title:'Action Storm',author:'test',description:'Requests too many spawns'}; export function onStart(game){for(let i=0;i<100;i++)game.spawn('firefly',800,300)}");
  await expect(page.locator('#mutations')).toContainText('actions skipped');
  const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
  expect(state.activeEntities).toBeLessThanOrEqual(80);
});

for (const name of ['double-jump.js', 'firefly-magnet.js', 'owl-pinecones.js', 'rainy-forest.js', 'speech-bubble.js', 'milestone-springs.js'])
  test(`documented ${name} idea survives its trigger`, async ({ page }) => {
    await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
    await load(page, name, fixture(name));
    await page.evaluate(name => {
      const { game, host } = (window as any).__livePatch;
      if (name === 'firefly-magnet.js') host.emit({ type: 'milestone', meters: 300 });
      if (name === 'milestone-springs.js') host.emit({ type: 'milestone', meters: 200 });
      if (name === 'speech-bubble.js') host.emit({ type: 'chat', text: '<img src=x onerror=alert(1)>', author: 'viewer' });
      if (name === 'owl-pinecones.js') { game.apply({ type: 'spawn', args: ['owl', 850, 350] }, 'probe'); host.emit({ type: 'tick', delta: .1, distance: 1 }); }
    }, name);
    await page.waitForTimeout(400);
    await expect(page.locator('#mutations')).toContainText('active');
    const state = await page.evaluate(() => (window as any).__livePatch.game.snapshot());
    if (name === 'double-jump.js') expect(state.parameters.maxJumps).toBe(2);
    if (name === 'firefly-magnet.js') expect(state.player.powerUps).toContain('magnet');
    if (name === 'owl-pinecones.js') expect(state.entities.some((item: any) => item.kind === 'pinecone')).toBe(true);
    if (name === 'rainy-forest.js') expect(state.weather).toBe('rain');
    if (name === 'milestone-springs.js') expect(state.entities.some((item: any) => item.kind === 'spring')).toBe(true);
    if (name === 'speech-bubble.js') expect(await page.locator('img[src="x"]').count()).toBe(0);
  });

test('a crashing module is disabled while the run continues', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(() => (window as any).__livePatch.host.sync([{ name: 'crash.js', source: "export const meta={id:'crash',title:'Crash',author:'test',description:'Crash on tick'}; export function onTick(){throw Error('fixture crash')} ", error: null }]));
  await expect(page.locator('#mutations')).toContainText('failed');
  const before = await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame);
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().frame)).toBeGreaterThan(before + 10);
});

test('a stalling module is disabled while the run continues', async ({ page }) => {
  await page.goto('/play'); await expect(page.locator('#status')).toContainText('LIVE');
  await page.evaluate(() => (window as any).__livePatch.host.sync([{ name: 'stall.js', source: "export const meta={id:'stall',title:'Stall',author:'test',description:'Loops on tick'}; export function onTick(){while(true){}} ", error: null }]));
  await expect(page.locator('#mutations')).toContainText('failed', { timeout: 8000 });
  const before = await page.evaluate(() => (window as any).__livePatch.game.snapshot().frame);
  await expect.poll(() => page.evaluate(() => (window as any).__livePatch.game.snapshot().frame)).toBeGreaterThan(before + 10);
});

test('a saved Lantern Run build reopens its original and evolved views', async ({ page }) => {
  test.setTimeout(70_000);
  await page.goto('/play');
  await expect(page.locator('#mutations')).toContainText('Firefly Trail · active');
  const saved = await page.evaluate(async () => fetch('/api/control', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save' })
  }).then(response => response.json())) as { id: string; directory: string };
  expect(saved.id).toMatch(/^[\w-]+$/);
  expect(saved.directory).toBe(path.join(path.dirname(process.env.LIVE_PATCH_TEST_DATA_DIR!), 'builds', saved.id));
  const compare = await page.context().newPage();
  try {
    await compare.goto(`/compare.html?id=${encodeURIComponent(saved.id)}`);
    await expect(compare.frameLocator('#original').locator('#status')).toContainText('Lantern Run · LIVE', { timeout: 40_000 });
    await expect(compare.frameLocator('#original').locator('#mutations')).toContainText('No mutations yet');
    await expect(compare.frameLocator('#evolved').locator('#mutations')).toContainText('Firefly Trail · active', { timeout: 40_000 });
    await expect(page.locator('#mutations')).toContainText('Forest Breeze · active');
  } finally { await compare.close(); }
});
