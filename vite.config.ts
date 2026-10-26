import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { loadGame } from './engine/manifest/load';
import { validateMutation } from './engine/mutation/validate';

const root = process.cwd();
const gamePath = process.env.LIVE_PATCH_GAME || 'games/arena-survivor';
if (!gamePath) throw new Error('--game requires a directory');
const { directory, manifest } = loadGame(root, gamePath);
const mutationDirectory = path.resolve(directory, manifest.mutationDir);

function files() {
  return fs.readdirSync(mutationDirectory).filter(name => name.endsWith('.js') && !name.startsWith('.'));
}
function mutationList() {
  return files().map(name => {
    const source = fs.readFileSync(path.join(mutationDirectory, name), 'utf8');
    return { name, source, error: validateMutation(source, manifest) };
  });
}
function livePatchPlugin(): Plugin {
  return {
    name: 'live-patch',
    configureServer(server) {
      const reload = new URL(manifest.reload.url);
      const relay = new WebSocketServer({ host: reload.hostname, port: Number(reload.port), path: reload.pathname });
      server.httpServer?.once('close', () => { for (const client of relay.clients) client.terminate(); relay.close(); });
      server.watcher.add(mutationDirectory);
      const changed = (file: string) => {
        if (path.dirname(path.resolve(file)) === mutationDirectory && file.endsWith('.js')) {
          const payload = JSON.stringify(mutationList());
          for (const client of relay.clients) if (client.readyState === client.OPEN) client.send(payload);
        }
      };
      server.watcher.on('add', changed).on('change', changed).on('unlink', changed);
      server.middlewares.use('/api/game', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ name: manifest.name, entry: '/' + path.relative(root, path.resolve(directory, manifest.entry)).replaceAll('\\', '/'), reload: manifest.reload }));
      });
      server.middlewares.use('/api/mutations', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mutationList()));
      });
    }
  };
}

export default defineConfig({ plugins: [livePatchPlugin()], server: { port: 5173, strictPort: true } });
