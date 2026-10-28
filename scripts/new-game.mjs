import fs from 'node:fs';
import path from 'node:path';

export function createTemplate(root, name) {
  const title = String(name ?? '').trim();
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug || slug.length > 50 || title.length > 80) throw Error('Use a game name with letters or numbers, up to 80 characters');
  const game = path.join(root, 'games', slug);
  if (fs.existsSync(game)) throw Error(`Game already exists: ${slug}`);
  fs.mkdirSync(path.join(root, 'games'), { recursive: true });
  fs.mkdirSync(game, { recursive: false });
  try {
    for (const folder of ['src', 'docs', 'mutations', 'tests/smoke']) fs.mkdirSync(path.join(game, folder), { recursive: true });
    const manifest = {
      name: title, hint: 'Move with arrow keys or WASD', description: 'A new game ready for live patches.', tags: ['Template'], version: '0.1.0', author: 'Live Patch',
      entry: 'src/main.ts', mutationDir: 'mutations/', apiDocs: 'docs/mutation-api.md', examples: ['mutations/'], forbidden: ['fetch', 'eval', 'document', 'window', 'import('],
      testCommand: 'npm run smoke -- --mutation {file}',
      actions: { showMessage: [{ type: 'string', maxLength: 100 }] }, hooks: { start: 'onStart', tick: 'onTick' },
      reload: { type: 'websocket', url: 'ws://127.0.0.1:5173', event: 'live-patch:changed' }, maxFileLines: 120
    };
    fs.writeFileSync(path.join(game, 'live-patch.json'), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(path.join(game, 'docs', 'mutation-api.md'), '# Mutation API\n\nExport `meta` and optional `onStart(game)` / `onTick(game, event)` hooks. `game.showMessage(text)` shows a short message.\n');
    fs.writeFileSync(path.join(game, 'mutations', '01-hello.js'), "export const meta = { id: 'hello', title: 'Hello', author: 'Built-in', description: 'Shows a greeting.' };\nexport function onStart(game) { game.showMessage('Hello, chat!'); }\n");
    fs.writeFileSync(path.join(game, 'src', 'main.ts'), `export function createGame(parent: HTMLElement, _emit: (event: { type: string }) => void) {
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 640; parent.append(canvas);
  const ctx = canvas.getContext('2d')!; const player = { x: 480, y: 320 }; let frame = 0; let message = '';
  const keys = new Set<string>(); const down = (event: KeyboardEvent) => keys.add(event.key.toLowerCase()); const up = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
  window.addEventListener('keydown', down); window.addEventListener('keyup', up);
  let running = true; const draw = () => { if (!running) return; frame++;
    if (keys.has('arrowleft') || keys.has('a')) player.x -= 3; if (keys.has('arrowright') || keys.has('d')) player.x += 3;
    if (keys.has('arrowup') || keys.has('w')) player.y -= 3; if (keys.has('arrowdown') || keys.has('s')) player.y += 3;
    player.x = Math.max(15, Math.min(945, player.x)); player.y = Math.max(15, Math.min(625, player.y));
    ctx.fillStyle = '#102437'; ctx.fillRect(0, 0, 960, 640); ctx.fillStyle = '#78e9cb'; ctx.beginPath(); ctx.arc(player.x, player.y, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f4f7ff'; ctx.font = '20px Arial'; ctx.fillText(message || 'Your game begins here', 26, 42); requestAnimationFrame(draw); };
  requestAnimationFrame(draw);
  return { apply(action: { type: string; args: unknown[] }) { if (action.type === 'showMessage' && typeof action.args?.[0] === 'string') message = action.args[0].slice(0, 100); }, removeMutation() { message = ''; }, snapshot() { return { frame, player: { ...player }, maxFrameGap: 0, frameRate: 60, enemies: 0, coins: 0, entities: [] }; }, destroy() { running = false; canvas.remove(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); } };
}\n`);
    fs.writeFileSync(path.join(game, 'tests', 'smoke', 'smoke.spec.ts'), `import { test, expect } from '@playwright/test';\ntest('game plays for five seconds with template mutation', async ({ page }) => { const errors: string[] = []; page.on('pageerror', error => errors.push(String(error))); await page.goto('/'); await page.locator('canvas').waitFor({ state: 'visible', timeout: 5000 }).catch(async () => { throw Error('Canvas missing: ' + errors.join(' | ') + ' status=' + await page.locator('#status').textContent() + ' game=' + JSON.stringify(await page.evaluate(() => ({ html: document.querySelector('#game')?.outerHTML, state: (window as any).__livePatch?.game?.snapshot() })))); }); await page.waitForTimeout(5000); const state = await page.evaluate(() => (window as Window & { __livePatch?: { game: { snapshot(): { frame: number } } } }).__livePatch?.game.snapshot()); expect(state?.frame).toBeGreaterThan(60); });\n`);
    return game;
  } catch (error) { fs.rmSync(game, { recursive: true, force: true }); throw error; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))) {
  try { console.log(createTemplate(process.cwd(), process.argv.slice(2).join(' '))); }
  catch (error) { console.error(String(error)); process.exitCode = 1; }
}
