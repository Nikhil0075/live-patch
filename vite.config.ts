import { defineConfig, type Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'node:fs';
import path from 'node:path';
import { defaultGame, loadGame } from './engine/manifest/load';
import { validateMutation } from './engine/mutation/validate';
import { configureTwitchServer } from './engine/twitch/server';

const root = process.cwd();
const gamePath = process.env.LIVE_PATCH_GAME || defaultGame(root);
const { directory, manifest } = loadGame(root, gamePath);
const manifestFile = path.join(directory, 'live-patch.json');
const mutationDirectory = path.resolve(directory, manifest.mutationDir);
const gameEntry = path.resolve(directory, manifest.entry);
const savedBundle = path.join(path.dirname(directory), 'game-entry.js');
const entryUrl = directory.startsWith(path.join(root, 'builds') + path.sep) && fs.existsSync(savedBundle)
  ? '/' + path.relative(root, savedBundle).replaceAll('\\', '/')
  : gameEntry.startsWith(root + path.sep)
    ? '/' + path.relative(root, gameEntry).replaceAll('\\', '/')
    : '/@fs/' + gameEntry.replaceAll('\\', '/');

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
      server.middlewares.use((req, res, next) => {
        const redirects: Record<string, string> = { '/control.html': 'go-live', '/simulator.html': 'practice' };
        const url = new URL(req.url ?? '/', 'http://localhost');
        const view = redirects[url.pathname];
        if (!view || (req.method !== 'GET' && req.method !== 'HEAD')) { next(); return; }
        url.searchParams.set('view', view);
        res.statusCode = 302;
        res.setHeader('Location', `/${url.search}`);
        res.end();
      });
      configureTwitchServer(server, root, directory, manifest);
      server.watcher.add([mutationDirectory, manifestFile]);
      server.watcher.on('change', file => { if (path.resolve(file) === manifestFile) void server.restart(); });
      const changed = (file: string) => {
        if (path.dirname(path.resolve(file)) === mutationDirectory && file.endsWith('.js'))
          server.ws.send({ type: 'custom', event: manifest.reload.event, data: mutationList() });
      };
      server.watcher.on('add', changed).on('change', changed).on('unlink', changed);
      server.middlewares.use('/api/game', (_req, res) => {
        const address = server.httpServer?.address();
        const reload = new URL(manifest.reload.url);
        if (address && typeof address !== 'string') reload.port = String(address.port);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ...manifest, entry: entryUrl, reload: { ...manifest.reload, url: reload.toString() } }));
      });
      server.middlewares.use('/api/mutations', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mutationList()));
      });
    }
  };
}

export default defineConfig({ envDir: false, define: { __LIVE_PATCH_TEST_SERVER__: JSON.stringify(process.env.LIVE_PATCH_TEST_SERVER === '1') }, plugins: [...(process.env.LIVE_PATCH_TEST_SERVER === '1' ? [] : [basicSsl({ domains: ['localhost', '127.0.0.1'] })]), livePatchPlugin()], build: { rollupOptions: { input: { game: path.join(root, 'index.html'), simulator: path.join(root, 'simulator.html'), overlay: path.join(root, 'overlay.html'), preview: path.join(root, 'preview.html'), compare: path.join(root, 'compare.html'), control: path.join(root, 'control.html') } } }, server: { port: Number(process.env.LIVE_PATCH_HTTP_PORT ?? new URL(manifest.reload.url).port), strictPort: true, fs: { allow: [root, directory], deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.live-patch/**', '**/tokens.json', '**/ideas.json', '**/runs.json', '**/rounds.json', '**/settings.json', '**/refunds.json', '**/predictions.json', '**/rollback-votes.json', '**/smoke-results.json', '**/imported-games.json', '**/active-game.json'] } } });
