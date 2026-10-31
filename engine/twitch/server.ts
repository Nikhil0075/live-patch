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
import { practiceDemoEligible } from './practice-demo';
import { TwitchConnection } from './connection';
import { forwardToGame, normalizeSimulator } from './events';
import type { GameManifest } from '../manifest/schema';
import { LiveRunner } from '../runner/runner';
import { RunStore, publicRun, type RunnerEvent } from '../runner/store';
import { RoundCoordinator } from '../pipeline/rounds';
import { saveBuild } from '../overlay/builds';
import { CodexTriage } from '../pipeline/triage';
import { discoverGames, validateImport, smokeGame, addImport, makeActive } from '../manifest/library';
import { generatedCover } from '../manifest/cover-art';
import { loadGame } from '../manifest/load';
import { execFileSync } from 'node:child_process';
import { SettingsStore, type StudioSettings } from '../studio/settings';
import { publicCredentials, saveCredentials, type CredentialInput } from '../studio/credentials';
import { setupChecks, probeBrowser, sandboxSelfTest, runSandboxSetup, classifySandboxError, type SetupCheck } from '../studio/setup';
import { createManagedPitchReward, fetchPitchReward, refundRedemption, fulfillRedemption, type RewardState, type TwitchReward } from './rewards';
import { RefundStore } from './refunds';
import { validateMutation } from '../mutation/validate';
import { mutationTitle } from '../mutation/metadata';
import { RollbackVotes } from '../pipeline/rollback-votes';
import { PatchPredictions } from './predictions';
import { handleRunnerOutcome } from './runner-outcome';
import { loadLocalEnv } from '../studio/local-env';

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
    const host = req.headers.host ?? req.headers[':authority'];
    return (url.hostname === '127.0.0.1' || url.hostname === 'localhost') && url.host === host;
  } catch { return false; }
}

export function configureTwitchServer(server: ViteDevServer, root: string, gameDirectory: string, manifest: GameManifest) {
  loadLocalEnv(root);
  const config: TwitchConfig = { clientId: process.env.TWITCH_CLIENT_ID ?? '', clientSecret: process.env.TWITCH_CLIENT_SECRET ?? '', redirectUri: process.env.TWITCH_REDIRECT_URI ?? defaultTwitchRedirectUri, rewardId: process.env.TWITCH_PITCH_REWARD_ID ?? '' };
  const dataDir = path.resolve(process.env.LIVE_PATCH_DATA_DIR ?? path.join(root, '.live-patch'));
  const buildsDir = path.resolve(process.env.LIVE_PATCH_BUILDS_DIR || path.join(root, 'builds'));
  const settings = new SettingsStore(path.join(dataDir, 'settings.json'));
  let lastSandbox: SetupCheck | undefined;
  let diagnostics = '';
  let setupCache: Promise<SetupCheck[]> | undefined;
  let setupCacheAt = 0;
  let rewardCache: Promise<RewardState> | undefined;
  let rewardCacheAt = 0;
  const checkedReward = (fresh = false) => {
    if (fresh || !rewardCache || Date.now() - rewardCacheAt > 30_000) {
      rewardCacheAt = Date.now();
      rewardCache = fetchPitchReward(auth, config);
    }
    return rewardCache;
  };
  const checkedSetup = (fresh = false) => {
    if (fresh || !setupCache || Date.now() - setupCacheAt > 30_000) {
      setupCacheAt = Date.now();
      setupCache = checkedReward(fresh).then(reward => setupChecks(root, config, { broadcaster: Boolean(auth.identity('broadcaster')), bot: Boolean(auth.identity('bot')) }, lastSandbox, reward));
    }
    return setupCache;
  };
  const tokenFile = path.join(dataDir, 'tokens.json');
  let auth = new TwitchAuth(config, tokenFile);
  if (process.env.LIVE_PATCH_TEST_SERVER !== '1') void checkedSetup().catch(error => { setupCache = undefined; console.error('Setup precheck failed:', error); });
  const store = new IdeaStore(path.join(dataDir, 'ideas.json'));
  const refunds = new RefundStore(path.join(dataDir, 'refunds.json'));
  const refundInFlight = new Set<string>();
  const tryRefund = async (redemptionId: string, rewardId: string, reason: string): Promise<string> => {
    const prior = refunds.find(redemptionId);
    if (prior?.status === 'refunded' || refundInFlight.has(redemptionId)) return prior?.message ?? 'Refund is already being checked.';
    refundInFlight.add(redemptionId);
    refunds.upsert({ redemptionId, rewardId, reason, action: 'refund', status: 'pending', message: 'Checking refund with Twitch.' });
    try {
      const result = await refundRedemption(auth, rewardId, redemptionId);
      refunds.upsert({ redemptionId, rewardId, reason, action: 'refund', ...result });
      return result.message;
    } finally { refundInFlight.delete(redemptionId); }
  };
  const tryFulfill = async (redemptionId: string, rewardId: string): Promise<void> => {
    const prior = refunds.find(redemptionId);
    if (prior?.status === 'fulfilled' || refundInFlight.has(redemptionId)) return;
    refundInFlight.add(redemptionId);
    const reason = 'Idea accepted';
    refunds.upsert({ redemptionId, rewardId, reason, action: 'fulfill', status: 'pending', message: 'Checking fulfillment with Twitch.' });
    try {
      const result = await fulfillRedemption(auth, rewardId, redemptionId);
      refunds.upsert({ redemptionId, rewardId, reason, action: 'fulfill', ...result });
    } finally { refundInFlight.delete(redemptionId); }
  };
  const runs = new RunStore(path.join(dataDir, 'runs.json'));
  const predictions = new PatchPredictions(path.join(dataDir, 'predictions.json'), auth);
  const rollbackVotes = new RollbackVotes(path.join(dataDir, 'rollback-votes.json'));
  const progress: RunnerEvent[] = [];
  let rounds: RoundCoordinator;
  const runner = new LiveRunner(root, gameDirectory, manifest, store, runs, event => {
    progress.push(event); if (progress.length > 120) progress.shift();
    server.ws.send({ type: 'custom', event: 'live-patch:runner', data: event });
    if (event.type === 'shipped' || event.type === 'failed') {
      rounds?.runFinished(event.ideaId);
      void handleRunnerOutcome(event, runs.get(event.runId), predictions, async message => {
        replies.push({ at: new Date().toISOString(), text: message });
        if (auth.identity('bot') && auth.identity('broadcaster')) void auth.helix('bot', 'chat/messages', { broadcaster_id: auth.identity('broadcaster')!.id, sender_id: auth.identity('bot')!.id, message }).catch(error => console.error(`Runner setup chat notice for idea ${event.ideaId} failed:`, error));
      }).catch(error => console.error(`Runner outcome for idea ${event.ideaId} failed:`, error));
    }
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
    onChat: event => {
      const fromBot = event.origin === 'twitch' && event.viewer.id === auth.identity('bot')?.id;
      if (!fromBot && event.viewer.id !== 'local-operator') {
        const message = { at: new Date().toISOString(), text: event.text, author: event.viewer.name };
        recentChat.push(message); if (recentChat.length > 30) recentChat.shift();
        if (forwardToGame(event, auth.identity('bot')?.id)) server.ws.send({ type: 'custom', event: 'live-patch:chat', data: message });
      }
    },
    onIdea: idea => rounds.triage(idea),
    onRejectedReward: async (event, reason) => event.origin === 'twitch' && event.redemptionId
      ? tryRefund(event.redemptionId, event.rewardId, reason)
      : 'Practice reward: no points were spent.',
    onAcceptedReward: async event => {
      if (event.origin === 'twitch' && event.redemptionId) await tryFulfill(event.redemptionId, event.rewardId);
    },
    onRollbackVote: viewer => {
      const shipped = runs.lastShipped(gameDirectory);
      if (!shipped) return undefined;
      const vote = rollbackVotes.vote(shipped.id, viewer.id);
      return { accepted: vote.accepted, ...vote.state };
    },
    candidate: number => rounds.candidate(number),
    canVote: () => rounds.canVote(),
    canRollback: () => Boolean(runs.lastShipped(gameDirectory)),
    canApprove: async () => {
      const browser = await probeBrowser(root);
      setupCache = undefined;
      return browser.state === 'Ready' ? undefined : `${browser.reason} Open Setup, run npx playwright install chromium, then try again.`;
    },
    onControl: (action, idea) => {
      if (action === 'approve' && idea) {
        if (predictions.active() && predictions.active()?.ideaId !== idea.id) void predictions.cancel().catch(error => console.error('Prediction for unselected idea could not cancel:', error));
        rounds.approved(idea); void runner.enqueue(idea).catch(error => console.error(`Runner idea ${idea.id} failed:`, error));
      }
      if (action === 'reject' && idea) {
        rounds.rejected(idea.id);
        if (predictions.active()?.ideaId === idea.id) void predictions.cancel().catch(error => console.error(`Prediction for rejected idea ${idea.id} could not cancel:`, error));
      }
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
    predictions.setAuth(auth);
    rewardCache = undefined;
    eventsub = new EventSubClient(auth, config.rewardId, event => pipeline.ingest(event));
    connection = new TwitchConnection(auth, eventsub);
    void connection.start();
  };
  void connection.start();
  if (process.env.LIVE_PATCH_TEST_SERVER !== '1') void (async () => {
    await predictions.reconcile();
    const active = predictions.active();
    if (!active) return;
    const outcome = runs.list().filter(run => run.ideaId === active.ideaId).at(-1);
    if (outcome?.status === 'shipped') await predictions.settle(active.ideaId, true);
    else if (outcome?.status === 'failed' && outcome.failureKind === 'patch') await predictions.settle(active.ideaId, false);
    else if (outcome?.status === 'failed') await predictions.cancel();
  })().catch(error => console.error('Prediction restart check failed:', error));
  server.httpServer?.on('close', () => { connection.stop(); runner.stop(); rounds.stop(); });
  server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    const route = url.pathname;
    const isolatedEntry = process.env.LIVE_PATCH_BUILDS_DIR && /^\/builds\/([\w-]+)\/game-entry\.js$/.exec(route);
    if (isolatedEntry && req.method === 'GET') {
      const file = path.join(buildsDir, isolatedEntry[1], 'game-entry.js');
      if (!fs.existsSync(file)) { json(res, 404, { error: 'Build not found' }); return; }
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      res.end(fs.readFileSync(file)); return;
    }
    if (route === '/api/ideas' && req.method === 'GET') { json(res, 200, { ideas: store.list(), candidateIds: [1, 2, 3].map(number => rounds.candidate(number)?.id ?? null), rollbackRequests: store.rollbackRequests(), rollbackVote: rollbackVotes.snapshot(runs.lastShipped(gameDirectory)?.id), replies }); return; }
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
      json(res, 200, { active: gameDirectory, playOnly: gameDirectory.startsWith(buildsDir + path.sep), returnGame: games.find(game => game.directory === previous && game.valid)?.directory ?? games.find(game => game.valid)?.directory, games }); return;
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
      if (!selected.manifest.cover) { res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(generatedCover(item.name)); return; }
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
      const folder = buildsDir;
      const builds = fs.existsSync(folder) ? fs.readdirSync(folder).filter(name => /^[\w-]+$/.test(name) && fs.existsSync(path.join(folder, name, 'build.json'))).sort().reverse().slice(0, 20).map(name => JSON.parse(fs.readFileSync(path.join(folder, name, 'build.json'), 'utf8')) as unknown) : [];
      json(res, 200, { builds }); return;
    }
    if (route === '/api/builds/notes' && req.method === 'GET') {
      const id = url.searchParams.get('id') ?? '';
      if (!/^[\w-]+$/.test(id)) { json(res, 400, { error: 'Invalid build ID' }); return; }
      const file = path.join(buildsDir, id, 'patch-notes.md');
      if (!fs.existsSync(file)) { json(res, 404, { error: 'Build not found' }); return; }
      res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end(fs.readFileSync(file, 'utf8')); return;
    }
    if ((route === '/api/compare/game' || route === '/api/compare/mutations') && req.method === 'GET') {
      const id = url.searchParams.get('id') ?? '';
      if (!/^[\w-]+$/.test(id)) { json(res, 400, { error: 'Invalid build ID' }); return; }
      const saved = path.join(buildsDir, id);
      if (!fs.existsSync(path.join(saved, 'build.json'))) { json(res, 404, { error: 'Build not found' }); return; }
      try {
        const selected = loadGame(root, path.join(saved, 'game'));
        if (route === '/api/compare/game') {
          const entry = `/builds/${id}/game-entry.js`;
          json(res, 200, { ...selected.manifest, entry });
        } else {
          const folder = path.resolve(selected.directory, selected.manifest.mutationDir);
          json(res, 200, fs.readdirSync(folder).filter(name => name.endsWith('.js') && !name.startsWith('.')).map(name => {
            const source = fs.readFileSync(path.join(folder, name), 'utf8');
            return { name, source, error: validateMutation(source, selected.manifest) };
          }));
        }
      } catch (error) { json(res, 400, { error: String(error) }); }
      return;
    }
    if (route === '/api/builds/play' && req.method === 'POST') {
      if (!req.headers.origin || !localOrigin(req) || !String(req.headers['content-type'] ?? '').startsWith('application/json')) { json(res, 403, { error: 'Same-origin JSON request required' }); return; }
      try {
        const body = await readJson(req) as { id?: string };
        if (!body.id || !/^[\w-]+$/.test(body.id)) throw Error('Invalid build ID');
        const selected = path.join(buildsDir, body.id, 'game');
        loadGame(root, selected);
        process.env.LIVE_PATCH_GAME = selected;
        json(res, 200, { message: 'Opening play-only build' });
        setTimeout(() => { void server.restart(); }, 150);
      } catch (error) { json(res, 400, { error: String(error) }); }
      return;
    }
    if (route === '/api/practice/demo' && req.method === 'POST') {
      if (!simulator || !req.headers.origin || !localOrigin(req) || !String(req.headers['content-type'] ?? '').startsWith('application/json')) { json(res, 403, { error: 'Practice demo requires a same-origin JSON request' }); return; }
      try {
        const body = await readJson(req) as { ideaId?: string };
        const state = rounds.snapshot();
        const selected = state.candidates.find(idea => idea.id === body.ideaId);
        if (!selected || !practiceDemoEligible(state.phase, state.candidates, selected.id, Boolean(auth.identity('broadcaster') && auth.identity('bot') && eventsub.status().startsWith('connected')))) throw Error('Demo patches require an all-Practice ballot at approval with live Twitch chat disconnected');
        if (!manifest.demoMutation || gameDirectory.startsWith(buildsDir + path.sep)) throw Error('This game has no Practice demo patch');
        const sourcePath = path.resolve(gameDirectory, manifest.demoMutation);
        const mutationDir = path.resolve(gameDirectory, manifest.mutationDir);
        if (!sourcePath.startsWith(gameDirectory + path.sep) || !fs.statSync(sourcePath).isFile()) throw Error('Invalid demo patch path');
        const source = fs.readFileSync(sourcePath, 'utf8');
        const issue = validateMutation(source, manifest);
        if (issue) throw Error(`Demo patch failed validation: ${issue}`);
        const demoTitle = mutationTitle(source);
        if (!demoTitle) throw Error('Demo patch needs a literal title in exported metadata');
        const name = `demo-${randomUUID().slice(0, 8)}.js`;
        const target = path.join(mutationDir, name);
        const temporary = `${target}.${process.pid}.tmp`;
        fs.writeFileSync(temporary, source, { flag: 'wx' });
        try { fs.renameSync(temporary, target); } catch (error) { fs.rmSync(temporary, { force: true }); throw error; }
        for (const previous of runs.list().filter(run => run.gameDirectory === gameDirectory && run.demo && run.status === 'shipped' && /^demo-[a-f0-9]{8}\.js$/.test(run.mutationName ?? ''))) {
          fs.rmSync(path.join(mutationDir, previous.mutationName!), { force: true });
          runs.upsert({ ...previous, status: 'rolled_back', finishedAt: new Date().toISOString() });
          store.setStatus(previous.ideaId, 'rolled_back');
        }
        rounds.approved(selected);
        store.setStatus(selected.id, 'demo');
        const now = new Date().toISOString();
        const runId = randomUUID();
        runs.upsert({ id: runId, ideaId: selected.id, gameDirectory, status: 'shipped', startedAt: now, finishedAt: now, mutationName: name, mutationTitle: demoTitle, demo: true, durationMs: 0 });
        rounds.runFinished(selected.id);
        const event: RunnerEvent = { runId, ideaId: selected.id, type: 'shipped', at: now, message: `${demoTitle} (stands in for “${selected.text}”)` };
        progress.push(event); server.ws.send({ type: 'custom', event: 'live-patch:runner', data: event });
        json(res, 200, { message: `${demoTitle} (stands in for “${selected.text}”). Open Play to see it.`, name, demo: true });
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
        else if (body.action === 'force-next') { rounds.forceNext(); runner.cancelBuild(); if (predictions.active()) void predictions.cancel().catch(error => console.error('Prediction cancel after force-next failed:', error)); }
        else if (body.action === 'save') { json(res, 200, await saveBuild(root, gameDirectory, manifest, store, runs, buildsDir)); return; }
        else if (body.action === 'remove-demo') {
          const demos = runs.list().filter(run => run.gameDirectory === gameDirectory && run.demo && run.status === 'shipped' && /^demo-[a-f0-9]{8}\.js$/.test(run.mutationName ?? ''));
          for (const run of demos) {
            fs.rmSync(path.join(gameDirectory, manifest.mutationDir, run.mutationName!), { force: true });
            runs.upsert({ ...run, status: 'rolled_back', finishedAt: new Date().toISOString() });
            store.setStatus(run.ideaId, 'rolled_back');
          }
          json(res, 200, { message: demos.length ? `Removed ${demos.length} Practice demo patch${demos.length === 1 ? '' : 'es'}` : 'No Practice demo patches are active' }); return;
        }
        else if (body.action === 'bet-start') {
          const candidate = rounds.snapshot().candidates.find(idea => idea.id === body.ideaId);
          if (rounds.snapshot().phase !== 'approval' || !candidate) throw Error('Open a points bet for an idea in the approval stage');
          const prediction = await predictions.start(candidate.id, candidate.spec ?? candidate.text);
          json(res, 200, { message: `Prediction opened on Twitch for ${candidate.authorName}`, prediction }); return;
        }
        else if (body.action === 'bet-cancel') { const prediction = await predictions.cancel(); json(res, 200, { message: prediction ? 'Prediction canceled; Twitch returns the points' : 'No prediction is active' }); return; }
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
    if (route === '/api/predictions' && req.method === 'GET') { json(res, 200, { predictions: predictions.list(), active: predictions.active() }); return; }
    if (route === '/api/twitch/status' && req.method === 'GET') {
      json(res, 200, { configured: auth.configured(), rewardConfigured: Boolean(config.rewardId), reward: await checkedReward(), refundIssue: refunds.list().filter(item => !['refunded', 'fulfilled'].includes(item.status)).at(-1)?.message ?? '', broadcaster: auth.identity('broadcaster'), bot: auth.identity('bot'), eventsub: eventsub.status(), authIssue: connection.status(), reconnect: auth.reconnectNeeded(), chatIssue, simulator }); return;
    }
    if (route === '/api/twitch/refunds' && req.method === 'GET') { json(res, 200, { refunds: refunds.list().slice(-20) }); return; }
    if (route === '/api/twitch/refunds' && req.method === 'POST') {
      if (!req.headers.origin || !localOrigin(req) || !String(req.headers['content-type'] ?? '').startsWith('application/json')) { json(res, 403, { error: 'Same-origin JSON request required' }); return; }
      try {
        const body = await readJson(req) as { redemptionId?: string };
        const record = body.redemptionId ? refunds.find(body.redemptionId) : undefined;
        if (!record || record.status === 'not_manageable' || record.status === 'fulfilled' || record.status === 'refunded') { json(res, 400, { error: 'No retryable reward action found' }); return; }
        if (record.action === 'fulfill') await tryFulfill(record.redemptionId, record.rewardId);
        else await tryRefund(record.redemptionId, record.rewardId, record.reason);
        json(res, 200, { message: refunds.find(record.redemptionId)?.message, refund: refunds.find(record.redemptionId) });
      } catch (error) { json(res, 400, { error: String(error) }); }
      return;
    }
    if (route === '/api/twitch/rewards' && req.method === 'GET') {
      const broadcaster = auth.identity('broadcaster');
      if (!broadcaster) { json(res, 400, { error: 'Connect the broadcaster first' }); return; }
      try {
        const response = await auth.helix('broadcaster', `channel_points/custom_rewards?broadcaster_id=${encodeURIComponent(broadcaster.id)}`);
        if (!response.ok) { json(res, response.status, { error: `Twitch reward lookup returned ${response.status}` }); return; }
        const result = await response.json() as { data?: TwitchReward[] };
        json(res, 200, { rewards: result.data?.map(reward => ({ id: reward.id, title: reward.title, requiresInput: reward.is_user_input_required, enabled: reward.is_enabled, paused: reward.is_paused, inStock: reward.is_in_stock })) ?? [] });
      } catch (error) { json(res, 502, { error: String(error) }); }
      return;
    }
    if (route === '/api/twitch/rewards' && req.method === 'POST') {
      if (!req.headers.origin || !localOrigin(req) || !String(req.headers['content-type'] ?? '').startsWith('application/json')) { json(res, 403, { error: 'Same-origin JSON request required' }); return; }
      try {
        const body = await readJson(req) as { action?: string };
        if (body.action !== 'create-managed-pitch') { json(res, 400, { error: 'Unknown reward action' }); return; }
        const id = await createManagedPitchReward(auth);
        Object.assign(config, saveCredentials(root, { rewardId: id }));
        setupCache = undefined; rewardCache = undefined;
        reloadTwitch(false);
        json(res, 200, { rewardId: id, message: 'Managed pitch reward selected. It costs 1 point and can be refunded when rejected.' });
      } catch (error) { json(res, 400, { error: String(error) }); }
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
