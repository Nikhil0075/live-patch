import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createServer } from 'vite';
import { copyTestGame } from './copy-test-game.mjs';

function run(script, args, env = process.env) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [script, ...args], { stdio: 'inherit', env });
    child.on('exit', code => resolve(code ?? 1));
  });
}
function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const address = socket.address();
      if (!address || typeof address === 'string') { socket.close(); reject(new Error('No free port')); return; }
      socket.close(() => resolve(address.port));
    });
  });
}

const root = process.cwd();
const buildsBefore = fs.existsSync(path.join(root, 'builds')) ? fs.readdirSync(path.join(root, 'builds')).sort() : [];
const args = process.argv.slice(2);
const smoke = args.includes('--smoke');
const browserOnly = args.includes('--browser-only');
const browserGrepIndex = args.indexOf('--browser-grep');
const browserGrep = browserGrepIndex >= 0 ? args[browserGrepIndex + 1] : undefined;
const flag = args.indexOf('--mutation');
const selected = smoke ? (flag >= 0 ? args[flag + 1] : args.find(arg => !arg.startsWith('-'))) : undefined;
if (smoke && !selected) throw new Error('Usage: npm run smoke -- --mutation <file>');
const gamePath = process.env.LIVE_PATCH_GAME || JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).livePatch.defaultGame;
const directory = path.resolve(root, gamePath);
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'live-patch.json'), 'utf8'));
if (smoke && !fs.existsSync(path.join(directory, manifest.mutationDir, path.basename(selected)))) throw new Error(`Mutation does not exist: ${selected}`);

if (!smoke && !browserOnly && await run('node_modules/vitest/vitest.mjs', ['run', '--config', 'vitest.config.ts'], { ...process.env, LIVE_PATCH_GAME: directory })) process.exit(1);

async function runBrowserSuite(source, suite, mutation) {
  const gameManifest = JSON.parse(fs.readFileSync(path.join(source, 'live-patch.json'), 'utf8'));
  const temp = fs.mkdtempSync(path.join(root, '.live-patch-test-'));
  const dataDir = path.join(temp, 'data');
  // Keep each copied game two folders below the repository root so its
  // relative imports of the shared engine resolve exactly as in games/.
  const catalogDir = temp;
  const builtIns = fs.readdirSync(path.join(root, 'games'), { withFileTypes: true })
    .filter(item => item.isDirectory() && fs.existsSync(path.join(root, 'games', item.name, 'live-patch.json')))
    .map(item => path.join(root, 'games', item.name));
  const sourceBuiltIn = builtIns.find(game => path.resolve(game) === path.resolve(source));
  const isolatedGame = path.join(catalogDir, sourceBuiltIn ? path.basename(source) : 'active');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'tokens.json'), '{}');
  fs.writeFileSync(path.join(dataDir, 'public-probe.txt'), 'safe fixture');
  for (const game of builtIns) {
    const gameCopy = path.join(catalogDir, path.basename(game));
    const item = JSON.parse(fs.readFileSync(path.join(game, 'live-patch.json'), 'utf8'));
    copyTestGame(root, game, gameCopy, item.mutationDir, game === sourceBuiltIn ? mutation : undefined, Boolean(mutation && game === sourceBuiltIn));
  }
  if (!sourceBuiltIn) copyTestGame(root, source, isolatedGame, gameManifest.mutationDir, mutation, Boolean(mutation));
  const testDir = suite === 'studio' ? path.join(root, 'tests/browser') : path.join(isolatedGame, 'tests/smoke');
  const originalEnv = Object.fromEntries(['LIVE_PATCH_GAME', 'LIVE_PATCH_DATA_DIR', 'LIVE_PATCH_BUILDS_DIR', 'LIVE_PATCH_HTTP_PORT', 'LIVE_PATCH_TEST_SERVER', 'LIVE_PATCH_TEST_CATALOG_DIR'].map(key => [key, process.env[key]]));
  Object.assign(process.env, { LIVE_PATCH_GAME: isolatedGame, LIVE_PATCH_DATA_DIR: dataDir, LIVE_PATCH_BUILDS_DIR: path.join(temp, 'builds'), LIVE_PATCH_HTTP_PORT: String(await freePort()), LIVE_PATCH_TEST_SERVER: '1', LIVE_PATCH_TEST_CATALOG_DIR: catalogDir });
  let server;
  try {
    server = await createServer({ server: { host: '127.0.0.1' } });
    await server.listen();
    const address = server.httpServer.address();
    if (!address || typeof address === 'string') throw new Error('No test server address');
    console.log(`Browser suite: ${suite} · ${gameManifest.name}`);
    const env = { ...process.env, LIVE_PATCH_BASE_URL: `http://127.0.0.1:${address.port}`, LIVE_PATCH_TEST_DIR: testDir, LIVE_PATCH_TEST_GAME_DIR: isolatedGame, LIVE_PATCH_TEST_DATA_DIR: dataDir, ...(mutation ? { MUTATION_FILE: path.basename(mutation) } : {}) };
    return await run('node_modules/@playwright/test/cli.js', ['test', ...(mutation ? ['--grep', 'game plays'] : browserGrep ? ['--grep', browserGrep] : [])], env);
  } finally {
    await server?.close();
    for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    if (!path.resolve(temp).startsWith(path.resolve(root) + path.sep)) throw Error('Unexpected temporary test path');
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

if (smoke) process.exitCode = await runBrowserSuite(directory, 'game', selected);
else if (browserOnly) process.exitCode = await runBrowserSuite(directory, args.includes('--game-suite') ? 'game' : 'studio');
else {
  process.exitCode = await runBrowserSuite(directory, 'studio');
  const games = fs.readdirSync(path.join(root, 'games'), { withFileTypes: true })
    .filter(item => item.isDirectory() && fs.existsSync(path.join(root, 'games', item.name, 'live-patch.json')))
    .map(item => path.join(root, 'games', item.name));
  for (const game of games) {
    if (process.exitCode !== 0) break;
    process.exitCode = await runBrowserSuite(game, 'game');
  }
  if (process.exitCode === 0) process.exitCode = await run('scripts/test-https.mjs', []);
}
const buildsAfter = fs.existsSync(path.join(root, 'builds')) ? fs.readdirSync(path.join(root, 'builds')).sort() : [];
if (JSON.stringify(buildsAfter) !== JSON.stringify(buildsBefore)) throw Error('npm test changed the repository builds/ folder');
