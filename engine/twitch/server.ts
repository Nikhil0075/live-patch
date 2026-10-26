import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { IdeaStore } from '../pipeline/ideas';
import { ChatPipeline } from '../pipeline/commands';
import { TwitchAuth, defaultTwitchRedirectUri, type Role, type TwitchConfig } from './auth';
import { EventSubClient } from './eventsub';
import { normalizeSimulator } from './events';

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

export function configureTwitchServer(server: ViteDevServer, root: string) {
  loadLocalEnv(root);
  const config: TwitchConfig = { clientId: process.env.TWITCH_CLIENT_ID ?? '', clientSecret: process.env.TWITCH_CLIENT_SECRET ?? '', redirectUri: process.env.TWITCH_REDIRECT_URI ?? defaultTwitchRedirectUri, rewardId: process.env.TWITCH_PITCH_REWARD_ID ?? '' };
  const dataDir = path.resolve(process.env.LIVE_PATCH_DATA_DIR ?? path.join(root, '.live-patch'));
  const auth = new TwitchAuth(config, path.join(dataDir, 'tokens.json'));
  const store = new IdeaStore(path.join(dataDir, 'ideas.json'));
  const replies: { at: string; text: string }[] = [];
  const simulator = process.env.LIVE_PATCH_SIMULATOR_ENABLED !== '0';
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
      const response = await auth.helix('bot', 'chat/messages', { broadcaster_id: broadcaster.id, sender_id: bot.id, message: message.slice(0, 500) });
      if (!response.ok) console.error(`Twitch chat reply failed (${response.status})`);
    },
    onChat: event => server.ws.send({ type: 'custom', event: 'live-patch:chat', data: { text: event.text, author: event.viewer.name } })
  });
  const eventsub = new EventSubClient(auth, config.rewardId, event => pipeline.ingest(event));
  let authIssue = '';
  const connect = async (startup = false) => {
    if (!auth.connected('broadcaster') || !auth.connected('bot')) return;
    try {
      if (startup) await auth.validateStored();
      else { await auth.token('broadcaster'); await auth.token('bot'); }
      authIssue = ''; eventsub.start();
    } catch (error) { authIssue = String(error); console.error('Twitch authorization needs attention:', authIssue); }
  };
  void connect(true);
  const validationTimer = setInterval(() => {
    if (!auth.connected('broadcaster') || !auth.connected('bot')) return;
    void auth.validateStored().then(() => { authIssue = ''; }).catch(error => { authIssue = String(error); eventsub.stop(); console.error('Twitch authorization needs attention:', authIssue); });
  }, 60 * 60_000);
  validationTimer.unref();
  server.httpServer?.on('close', () => { clearInterval(validationTimer); eventsub.stop(); });
  server.middlewares.use(async (req, res, next) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);
    const route = url.pathname;
    if (route === '/api/ideas' && req.method === 'GET') { json(res, 200, { ideas: store.list(), rollbackRequests: store.rollbackRequests(), replies }); return; }
    if (route === '/api/twitch/status' && req.method === 'GET') {
      json(res, 200, { configured: auth.configured(), rewardConfigured: Boolean(config.rewardId), broadcaster: auth.identity('broadcaster'), bot: auth.identity('bot'), eventsub: eventsub.status(), authIssue, simulator }); return;
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
        if (url.searchParams.has('error')) throw Error('Twitch authorization was denied');
        const identity = await auth.complete(url.searchParams.get('code') ?? '', url.searchParams.get('state') ?? '');
        void connect();
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
