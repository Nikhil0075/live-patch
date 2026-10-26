import { spawn } from 'node:child_process';
import { createServer } from 'vite';

function run(script, args, env = process.env) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [script, ...args], { stdio: 'inherit', env });
    child.on('exit', code => resolve(code ?? 1));
  });
}
const args = process.argv.slice(2);
const smoke = args.includes('--smoke');
const mutation = args.find(arg => !arg.startsWith('-'));
if (smoke && !mutation) throw new Error('Usage: npm run smoke -- --mutation <file>');
if (!smoke && await run('node_modules/vitest/vitest.mjs', ['run', '--config', 'vitest.config.ts'])) process.exit(1);
const server = await createServer({ server: { host: '127.0.0.1' } });
await server.listen();
try {
  const code = await run('node_modules/@playwright/test/cli.js', ['test', ...(smoke ? ['--grep', 'game plays'] : [])], { ...process.env, LIVE_PATCH_TEST_SERVER: '1', ...(mutation ? { MUTATION_FILE: mutation } : {}) });
  process.exitCode = code;
} finally { await server.close(); }
