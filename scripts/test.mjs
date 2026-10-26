import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { createServer } from 'vite';

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
const args = process.argv.slice(2);
const smoke = args.includes('--smoke');
const flag = args.indexOf('--mutation');
const selected = flag >= 0 ? args[flag + 1] : args.find(arg => !arg.startsWith('-'));
if (smoke && !selected) throw new Error('Usage: npm run smoke -- --mutation <file>');
const gamePath = process.env.LIVE_PATCH_GAME || JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).livePatch.defaultGame;
const directory = path.resolve(root, gamePath);
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'live-patch.json'), 'utf8'));
if (smoke && !fs.existsSync(path.join(directory, manifest.mutationDir, path.basename(selected)))) throw new Error(`Mutation does not exist: ${selected}`);

if (!smoke && await run('node_modules/vitest/vitest.mjs', ['run', '--config', 'vitest.config.ts'], { ...process.env, LIVE_PATCH_GAME: directory })) process.exit(1);

const temp = fs.mkdtempSync(path.join(root, '.live-patch-test-'));
process.env.LIVE_PATCH_DATA_DIR = path.join(temp, 'data');
const isolatedGame = path.join(temp, 'game');
fs.cpSync(directory, isolatedGame, { recursive: true });
process.env.LIVE_PATCH_GAME = isolatedGame;
process.env.LIVE_PATCH_HTTP_PORT = String(await freePort());
let server;
try {
  server = await createServer({ server: { host: '127.0.0.1' } });
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('No test server address');
  const env = { ...process.env, LIVE_PATCH_TEST_SERVER: '1', LIVE_PATCH_BASE_URL: `http://127.0.0.1:${address.port}`, LIVE_PATCH_TEST_GAME_DIR: isolatedGame, ...(selected ? { MUTATION_FILE: path.basename(selected) } : {}) };
  const code = await run('node_modules/@playwright/test/cli.js', ['test', ...(smoke ? ['--grep', 'game plays'] : [])], env);
  process.exitCode = code;
} finally {
  await server?.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
