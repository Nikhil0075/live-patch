import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { IdeaStore } from '../pipeline/ideas';
import { ChatPipeline } from '../pipeline/commands';
import { TwitchAuth, authorizationError, defaultTwitchRedirectUri, type Role, type TwitchConfig } from './auth';
import { chatDeliveryIssue } from './chat';
import { EventSubClient } from './eventsub';
import { TwitchConnection } from './connection';
import { forwardToGame, normalizeSimulator } from './events';
import type { GameManifest } from '../manifest/schema';
import { LiveRunner } from '../runner/runner';
import { RunStore, publicRun, type RunnerEvent } from '../runner/store';
import { RoundCoordinator } from '../pipeline/rounds';
import { saveBuild } from '../overlay/builds';
import { CodexTriage } from '../pipeline/triage';
import { discoverGames, validateImport, smokeGame, addImport, makeActive } from '../manifest/library';
import { loadGame } from '../manifest/load';
import { execFileSync } from 'node:child_process';
import { SettingsStore, type StudioSettings } from '../studio/settings';
import { publicCredentials, saveCredentials, type CredentialInput } from '../studio/credentials';
import { setupChecks, sandboxSelfTest, runSandboxSetup, classifySandboxError, type SetupCheck } from '../studio/setup';

function loadLocalEnv(root: string) {
  const file = path.join(root, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
function json(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
async function readJson(req: IncomingMessage): Promise<unknown> {
  let text = '';
  for await (const chunk of req) { text += String(chunk); if (text.length > 4096) throw Error('Request too large'); }
  return JSON.parse(text) as unknown;
}
function localOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = req.headers.host;
    return (url.hostname === '127.0.0.1' || url.hostname === 'localhost') && url.host === host;
  } catch { return false; }
}

export function configureTwitchServer(server: ViteDevServer, root: string, gameDirectory: string, manifest: GameManifest) {
  loadLocalEnv(root);
  const config: TwitchConfig = { clientId: process.env.TWITCH_CLIENT_ID ?? '', clientSecret: process.env.TWITCH_CLIENT_SECRET ?? '', redirectUri: process.env.TWITCH_REDIRECT_URI ?? defaultTwitchRedirectUri, rewardId: process.env.TWITCH_PITCH_REWARD_ID ?? '' };
  const dataDir = path.resolve(process.env.LIVE_PATCH_DATA_DIR ?? path.join(root, '.live-patch'));
  const settings = new SettingsStore(path.join(dataDir, 'settings.json'));
  let lastSandbox: SetupCheck | undefined;
  let diagnostics = '';
  let setupCache: Promise<SetupCheck[]> | undefined;
  let setupCacheAt = 0;
  const checkedSetup = (fresh = false) => {
    if (fresh || !setupCache || Date.now() - setupCacheAt > 30_000) {
      setupCacheAt = Date.now();
      setupCache = setupChecks(root, config, { broadcaster: Boolean(auth.identity('broadcaster')), bot: Boolean(auth.identity('bot')) }, lastSandbox);
    }
    return setupCache;
  };
  const tokenFile = path.join(dataDir, 'tokens.json');
  let auth = new TwitchAuth(config, tokenFile);
  if (process.env.LIVE_PATCH_TEST_SERVER !== '1') void checkedSetup().catch(error => { setupCache = undefined; console.error('Setup precheck failed:', error); });
  const store = new IdeaStore(path.join(dataDir, 'ideas.json'));
  const runs = new RunStore(path.join(dataDir, 'runs.json'));
  const progress: RunnerEvent[] = [];
  let rounds: RoundCoordinator;
  const runner = new LiveRunner(root, gameDirectory, manifest, store, runs, event => {
    progress.push(event); if (progress.length > 120) progress.shift();
    server.ws.send({ type: 'custom', event: 'live-patch:runner', data: event });
    if (event.type === 'shipped' || event.type === 'failed') rounds?.runFinished(event.ideaId);
  });
  rounds = new RoundCoordinator(path.join(dataDir, 'rounds.json'), store, state => server.ws.send({ type: 'custom', event: 'live-patch:round', data: state }), Date.now, settings.snapshot());
  const replies: { at: string; text: string }[] = [];
  const recentChat: { at: string; author: string; text: string }[] = [];
  const simulator = process.env.LIVE_PATCH_SIMULATOR_ENABLED !== '0';
  let chatIssue = '';
  const pipeline = new ChatPipeline(store, {
    rewardId: config.rewardId || 'sim-pitch',
    reply: async (message, event) => {
      if (event.origin === 'simulator') {
        replies.push({ at: new Date().toISOString(), text: message });
        if (replies.length > 50) replies.shift();
        return;
      }
      const bot = auth.identity('bot'); const broadcaster = auth.identity('broadcaster');
      if (!bot || !broadcaster) return;
      try {
        const response = await auth.helix('bot', 'chat/messages', { broadcaster_id: broadcaster.id, sender_id: bot.id, message: message.slice(0, 500) });
        chatIssue = await chatDeliveryIssue(response);
      } catch (error) { chatIssue = `Twitch chat reply failed: ${String(error)}`; }
      if (chatIssue) console.error(chatIssue);
    },
    onChat: event => { if (forwardToGame(event, auth.identity('bot')?.id)) { const message = { at: new Date().toISOString(), text: event.text, author: event.viewer.name }; recentChat.push(message); if (recentChat.length > 30) recentChat.shift(); server.ws.send({ type: 'custom', event: 'live-patch:chat', data: message }); } },
    onIdea: idea => rounds.triage(idea),
    candidate: number => rounds.candidate(number),
    canVote: () => rounds.canVote(),
    onControl: (action, idea) => {
      if (action === 'approve' && idea) { rounds.approved(idea); void runner.enqueue(idea).catch(error => console.error(`Runner idea ${idea.id} failed:`, error)); }
      if (action === 'rollback') void runner.requestRollback().catch(error => console.error('Runner rollback failed:', error));
    }
  });
  let eventsub = new EventSubClient(auth, config.rewardId, event => pipeline.ingest(event));
  let connection = new TwitchConnection(auth, eventsub);
  const reloadTwitch = (clearTokens: boolean) => {
    connection.stop();
    if (clearTokens && fs.existsSync(tokenFile)) fs.rmSync(tokenFile);
    pipeline.setRewardId(config.rewardId || 'sim-pitch');
    auth = new TwitchAuth(config, tokenFile);
    eventsub = new EventSubClient(auth, config.rewardId, event => pipeline.ingest(event));
    connection = new TwitchConnection(auth, eventsub);
    void connection.start();
  };
  void connection.start();
  server.httpServer?.on('close', () => { connection.stop(); runner.stop(); rounds.stop(); });
  server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    const route = url.pathname;
    if (route === '/api/ideas' && req.method === 'GET') { json(res, 200, { ideas: store.list(), candidateIds: [1, 2, 3].map(number => rounds.candidate(number)?.id ?? null), rollbackRequests: store.rollbackRequests(), replies }); return; }
    if (route === '/api/chat/recent' && req.method === 'GET') { json(res, 200, { messages: recentChat.slice(-8) }); return; }
    if (route === '/api/round' && req.method === 'GET') { json(res, 200, rounds.snapshot()); return; }
    if (route === '/api/settings' && req.method === 'GET') { json(res, 200, settings.snapshot()); return; }
    if (route === '/api/settings' && req.method === 'POST') {
      if (!req.headers.origin || !localOrigin(req) || !String(req.headers['content-type'] ?? '').startsWith('application/json')) { json(res, 403, { error: 'Same-origin JSON request required' }); return; }
      try {
        const updated = settings.update(await readJson(req) as Partial<StudioSettings>);
        rounds.setTimings(updated);
        server.ws.send({ type: 'custom', event: 'live-patch:settings', data: updated });
        json(res, 200, updated);
      } catch { json(res, 400, { error: 'Invalid settings' }); }
      return;
    }
    if (route === '/api/twitch/credentials' && req.method === 'GET') { json(res, 200, publicCredentials(config)); return; }
    if (route === '/api/twitch/credentials' && req.method === 'POST') {
      if (!req.headers.origin || !localOrigin(req) || !String(req.headers['content-type'] ?? '').startsWith('application/json')) { json(res, 403, { error: 'Same-origin JSON request required' }); return; }
      try {
        const body = await readJson(req) as CredentialInput & { remove?: boolean };
        const previousId = config.clientId;
        const next = saveCredentials(root, body, body.remove === true);
        Object.assign(config, next);
        reloadTwitch(body.remove === true || previousId !== config.clientId);
        setupCache = undefined;
        json(res, 200, { ...publicCredentials(config), message: body.remove ? 'Twitch credentials removed' : 'Twitch settings saved and reloaded' });
      } catch { json(res, 400, { error: 'Could not save Twitch settings; check field formats and try again' }); }
      return;
    }
    if (route === '/api/setup' && req.method === 'GET') {
      if (req.headers['sec-fetch-site'] === 'cross-site') { json(res, 403, { error: 'Local setup only' }); return; }
      json(res, 200, { checks: await checkedSetup(), credentials: publicCredentials(config), diagnostics }); return;
    }
    if (route === '/api/setup' && req.method === 'POST') {
      if (!req.headers.origin || !localOrigin(req) || !String(req.headers['content-type'] ?? '').startsWith('application/json')) { json(res, 403, { error: 'Same-origin JSON request required' }); return; }
      try {
        const body = await readJson(req) as { action?: string };
        if (body.action === 'refresh') { json(res, 200, { checks: await checkedSetup(true), credentials: publicCredentials(config), diagnostics }); return; }
        if (body.action === 'self-test') lastSandbox = await sandboxSelfTest(root);
        else if (body.action === 'sandbox-setup') {
          const result = await runSandboxSetup();
          lastSandbox = result.success ? await sandboxSelfTest(root) : classifySandboxError(result.error ?? 'Setup failed');
          const detail = result.error ?? 'Setup failed';
          diagnostics = result.success ? '' : (config.clientSecret ? detail.replaceAll(config.clientSecret, '[redacted]') : detail).replace(/(?:Bearer|OAuth)\s+[A-Za-z0-9._~-]+/gi, '[redacted token]').slice(0, 500);
        } else { json(res, 400, { error: 'Unknown setup action' }); return; }
        setupCache = undefined;
        json(res, 200, { check: lastSandbox, diagnostics });
      } catch { json(res, 500, { error: 'Setup check failed' }); }
      return;
    }
    if (route === '/api/library' && req.method === 'GET') {
      const games = discoverGames(root, dataDir);
      const selection = path.join(dataDir, 'active-game.json');
      const previous = fs.existsSync(selection) ? (JSON.parse(fs.readFileSync(selection, 'utf8')) as { directory?: string }).directory : undefined;
      json(res, 200, { active: gameDirectory, playOnly: gameDirectory.startsWith(path.join(root, 'builds') + path.sep), returnGame: games.find(game => game.directory === previous && game.valid)?.directory ?? games.find(game => game.valid)?.directory, games }); return;
    }
    if (route === '/api/library/docs' && req.method === 'GET') {
      const item = discoverGames(root, dataDir).find(game => game.directory === url.searchParams.get('directory') && game.valid);
      if (!item) { json(res, 404, { error: 'Game not found' }); return; }
      const selected = loadGame(root, item.directory);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(fs.readFileSync(path.join(item.directory, selected.manifest.apiDocs), 'utf8')); return;
    }
    if (route === '/api/library/cover' && req.method === 'GET') {
      const item = discoverGames(root, dataDir).find(game => game.directory === url.searchParams.get('directory') && game.valid);
      if (!item) { res.statusCode = 404; res.end(); return; }
      const selected = loadGame(root, item.directory);
      if (!selected.manifest.cover) { res.statusCode = 404; res.end(); return; }
      const file = path.join(item.directory, selected.manifest.cover);
      res.setHeader('Content-Type', file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg'); res.end(fs.readFileSync(file)); return;
    }
    if (route === '/api/library' && req.method === 'POST') {
      if (!req.headers.origin || !localOrigin(req) || !String(req.headers['content-type'] ?? '').startsWith('application/json')) { json(res, 403, { error: 'Same-origin JSON request required' }); return; }
      try {
        const body = await readJson(req) as { action?: string; directory?: string; name?: string };
        if (body.action === 'inspect' && body.directory) {
          const candidate = validateImport(root, body.directory);
          json(res, 200, { directory: candidate.directory, name: candidate.manifest.name, testCommand: candidate.manifest.testCommand, example: candidate.example }); return;
        }
        if (body.action === 'import' && body.directory) {
          const candidate = validateImport(root, body.directory);
          await smokeGame(root, dataDir, candidate.directory, candidate.example);
          addImport(dataDir, candidate.directory);
          json(res, 200, { message: `Imported ${candidate.manifest.name}` }); return;
        }
        if (body.action === 'template' && body.name) {
          const created = execFileSync(process.execPath, [path.join(root, 'scripts', 'new-game.mjs'), body.name], { cwd: root, encoding: 'utf8', timeout: 10_000 }).trim();
          const candidate = validateImport(root, created);
          await smokeGame(root, dataDir, candidate.directory, candidate.example);
          json(res, 200, { message: `Created ${candidate.manifest.name}`, directory: candidate.directory }); return;
        }
        if (body.action === 'active' && body.directory) {
          const wanted = path.resolve(body.directory);
          const candidate = discoverGames(root, dataDir).find(item => item.directory === wanted && item.valid);
          if (!candidate) throw Error('Choose a valid game from the library');
          makeActive(root, candidate.directory);
          process.env.LIVE_PATCH_GAME = candidate.directory;
          json(res, 200, { message: `Switching to ${candidate.name}` });
          setTimeout(() => { void server.restart(); }, 150);
          return;
        }
        json(res, 400, { error: 'Invalid library action' });
      } catch (error) { json(res, 400, { error: String(error) }); }
      return;
    }
    if (route === '/api/builds' && req.method === 'GET') {
      const folder = path.join(root, 'builds');
      const builds = fs.existsSync(folder) ? fs.readdirSync(folder).filter(name => /^[\w-]+$/.test(name) && fs.existsSync(path.join(folder, name, 'build.json'))).sort().reverse().slice(0, 20).map(name => JSON.parse(fs.readFileSync(path.join(folder, name, 'build.json'), 'utf8')) as unknown) : [];
      json(res, 200, { builds }); return;
    }
    if (route === '/api/builds/notes' && req.method === 'GET') {
      const id = url.searchParams.get('id') ?? '';
      if (!/^[\w-]+$/.test(id)) { json(res, 400, { error: 'Invalid build ID' }); return; }
      const file = path.join(root, 'builds', id, 'patch-notes.md');
      if (!fs.existsSync(file)) { json(res, 404, { error: 'Build not found' }); return; }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(fs.readFileSync(file, 'utf8')); return;
    }
    if (route === '/api/builds/play' && req.method === 'POST') {
      if (!req.headers.origin || !localOrigin(req) || !String(req.headers['content-type'] ?? '').startsWith('application/json')) { json(res, 403, { error: 'Same-origin JSON request required' }); return; }
      try {
        const body = await readJson(req) as { id?: string };
        if (!body.id || !/^[\w-]+$/.test(body.id)) throw Error('Invalid build ID');
        const selected = path.join(root, 'builds', body.id, 'game');
        loadGame(root, selected);
        process.env.LIVE_PATCH_GAME = selected;
        json(res, 200, { message: 'Opening play-only build' });
        setTimeout(() => { void server.restart(); }, 150);
      } catch (error) { json(res, 400, { error: String(error) }); }
      return;
    }
    if (route === '/api/control' && req.method === 'POST') {
      if (!req.headers.origin || !localOrigin(req) || !String(req.headers['content-type'] ?? '').startsWith('application/json')) { json(res, 403, { error: 'Same-origin JSON request required' }); return; }
      try {
        const body = await readJson(req) as { action?: string; ideaId?: string };
        if (body.action === 'pause') rounds.pause();
        else if (body.action === 'resume') rounds.resume();
        else if (body.action === 'advance') rounds.advance();
        else if (body.action === 'triage') { const preview = await rounds.aiTriage(new CodexTriage()); json(res, 200, { preview, round: rounds.snapshot() }); return; }
        else if (body.action === 'triage-apply') { const applied = rounds.applyTriagePreview(); json(res, 200, { applied, round: rounds.snapshot() }); return; }
        else if (body.action === 'triage-discard') rounds.discardTriagePreview();
        else if (body.action === 'force-next') { rounds.forceNext(); runner.cancelBuild(); }
        else if (body.action === 'save') { json(res, 200, saveBuild(root, gameDirectory, manifest, store, runs)); return; }
        else if (['approve', 'reject', 'rollback'].includes(body.action ?? '')) {
          const text = body.action === 'rollback' ? '!rollback' : `!${body.action} ${body.ideaId ?? ''}`;
          const result = await pipeline.ingest({ kind: 'chat', origin: 'simulator', id: randomUUID(), viewer: { id: 'local-operator', login: 'operator', name: 'Operator', moderator: true, broadcaster: false }, text });
          json(res, result.accepted ? 200 : 400, result); return;
        } else { json(res, 400, { error: 'Unknown control action' }); return; }
        json(res, 200, rounds.snapshot());
      } catch (error) { json(res, 400, { error: String(error) }); }
      return;
    }
    if (route === '/api/runs' && req.method === 'GET') {
      json(res, 200, { runs: runs.list().map(publicRun) }); return;
    }
    if (route === '/api/runner-events' && req.method === 'GET') { json(res, 200, { events: progress }); return; }
    if (route === '/api/twitch/status' && req.method === 'GET') {
      json(res, 200, { configured: auth.configured(), rewardConfigured: Boolean(config.rewardId), broadcaster: auth.identity('broadcaster'), bot: auth.identity('bot'), eventsub: eventsub.status(), authIssue: connection.status(), chatIssue, simulator }); return;
    }
    if (route === '/api/twitch/rewards' && req.method === 'GET') {
      const broadcaster = auth.identity('broadcaster');
      if (!broadcaster) { json(res, 400, { error: 'Connect the broadcaster first' }); return; }
      try {
        const response = await auth.helix('broadcaster', `channel_points/custom_rewards?broadcaster_id=${encodeURIComponent(broadcaster.id)}`);
        if (!response.ok) { json(res, response.status, { error: `Twitch reward lookup returned ${response.status}` }); return; }
        const result = await response.json() as { data?: { id: string; title: string; is_user_input_required: boolean }[] };
        json(res, 200, { rewards: result.data?.map(reward => ({ id: reward.id, title: reward.title, requiresInput: reward.is_user_input_required })) ?? [] });
      } catch (error) { json(res, 502, { error: String(error) }); }
      return;
    }
    const start = /^\/api\/twitch\/auth\/(broadcaster|bot)\/start$/.exec(route);
    if (start && req.method === 'GET') {
      try { res.statusCode = 302; res.setHeader('Location', auth.authorizeUrl(start[1] as Role)); res.end(); }
      catch (error) { json(res, 400, { error: String(error) }); }
      return;
    }
    if (route === '/api/twitch/auth/callback' && req.method === 'GET') {
      try {
        if (url.searchParams.has('error')) throw Error(authorizationError(url.searchParams.get('error'), config.redirectUri));
        const identity = await auth.complete(url.searchParams.get('code') ?? '', url.searchParams.get('state') ?? '');
        eventsub.resetAfterAuthChange();
        void connection.check();
        res.statusCode = 303; res.setHeader('Location', `/simulator.html?connected=${identity.role}`); res.end();
      } catch (error) { json(res, 400, { error: String(error) }); }
      return;
    }
    if (route === '/api/simulator/events' && req.method === 'POST') {
      if (!simulator) { json(res, 403, { error: 'Simulator disabled' }); return; }
      if (!localOrigin(req) || !String(req.headers['content-type'] ?? '').startsWith('application/json')) { json(res, 403, { error: 'Local JSON request required' }); return; }
      try {
        const event = normalizeSimulator(await readJson(req), config.rewardId || 'sim-pitch');
        if (!event) { json(res, 400, { error: 'Invalid simulator event' }); return; }
        const result = await pipeline.ingest(event);
        json(res, 200, result);
      } catch (error) { json(res, 400, { error: String(error) }); }
      return;
    }
    next();
  });
}
