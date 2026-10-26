import { createServer } from 'vite';

const args = process.argv.slice(2);
const flag = args.findIndex(arg => arg === '--game');
const equals = args.find(arg => arg.startsWith('--game='));
const game = flag >= 0 ? args[flag + 1] : equals ? equals.slice(7) : args.find(arg => !arg.startsWith('-'));
if (flag >= 0 && !game) throw new Error('--game requires a directory');
if (game) process.env.LIVE_PATCH_GAME = game;
try {
  const server = await createServer({ server: { host: '127.0.0.1' } });
  await server.listen();
  server.printUrls();
} catch (error) {
  if (error?.code === 'EADDRINUSE' || String(error).includes('already in use')) console.error('Live Patch port is already in use. Stop the other server or choose different ports.');
  else console.error(error);
  process.exitCode = 1;
}
