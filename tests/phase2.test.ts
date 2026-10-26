import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { IdeaStore } from '../engine/pipeline/ideas';
import { ChatPipeline, type InboundEvent } from '../engine/pipeline/commands';
import { normalizeEventSub, normalizeSimulator } from '../engine/twitch/events';
import { TwitchAuth } from '../engine/twitch/auth';
import { EventSubClient } from '../engine/twitch/eventsub';

function tempStore(run: (store: IdeaStore, file: string) => Promise<void> | void) {
  const directory = fs.mkdtempSync(path.join(process.cwd(), '.test-ideas-'));
  const file = path.join(directory, 'ideas.json');
  return Promise.resolve().then(() => run(new IdeaStore(file), file)).finally(() => fs.rmSync(directory, { recursive: true, force: true }));
}
const viewer = { id: '42', login: 'viewer', name: 'Viewer', moderator: false, broadcaster: false };
const inbound = (id: string, text: string): InboundEvent => ({ kind: 'chat', origin: 'simulator', id, viewer, text });

describe('Phase 2 idea pipeline', () => {
  it('uses one path for chat and reward ideas, persists state and enforces length and cooldown', async () => tempStore(async store => {
    let now = 1_000_000;
    const replies: string[] = [];
    const pipeline = new ChatPipeline(store, { rewardId: 'reward-1', now: () => now, reply: async text => { replies.push(text); } });
    const first = await pipeline.ingest(inbound('one', '!idea Enemies split'));
    expect(first.accepted).toBe(true);
    expect((await pipeline.ingest(inbound('one', '!idea Duplicate'))).command).toBe('duplicate');
    expect((await pipeline.ingest(inbound('two', '!idea Too soon'))).accepted).toBe(false);
    now += 181_000;
    const reward = await pipeline.ingest({ kind: 'reward', origin: 'simulator', id: 'three', viewer, rewardId: 'reward-1', text: 'Coins flee' });
    expect(reward.accepted).toBe(true);
    expect((await pipeline.ingest(inbound('four', `!idea ${'x'.repeat(201)}`))).accepted).toBe(false);
    expect(store.list().map(idea => idea.source)).toEqual(['chat', 'reward']);
    expect(replies).toContain('@viewer idea received: Enemies split');
  }));

  it('restricts moderation, tracks one vote per viewer, and records rollback requests', async () => tempStore(async (store, file) => {
    const pipeline = new ChatPipeline(store, { rewardId: 'reward-1', reply: async () => {} });
    await pipeline.ingest(inbound('idea', '!idea Bigger enemies'));
    expect((await pipeline.ingest(inbound('vote', '!vote 1'))).accepted).toBe(true);
    expect(store.list()[0].votes).toEqual(['42']);
    expect((await pipeline.ingest(inbound('denied', '!approve 1'))).accepted).toBe(false);
    expect(store.list()[0].status).toBe('voting');
    const mod = { ...viewer, id: 'mod', moderator: true };
    expect((await pipeline.ingest({ ...inbound('approve', '!approve 1'), viewer: mod })).accepted).toBe(true);
    expect(store.list()[0].status).toBe('approved');
    expect((await pipeline.ingest({ ...inbound('rollback', '!rollback'), viewer: mod })).accepted).toBe(true);
    expect(store.rollbackRequests()).toHaveLength(1);
    const broadcaster = { ...viewer, id: 'owner', broadcaster: true };
    await pipeline.ingest({ ...inbound('second', '!idea Smaller coins'), viewer: { ...viewer, id: 'other' } });
    expect((await pipeline.ingest({ ...inbound('reject', '!reject 1'), viewer: broadcaster })).accepted).toBe(true);
    expect(store.list()[1].status).toBe('rejected');
    expect(new IdeaStore(file).list()[0].status).toBe('approved');
  }));

  it('normalizes Twitch chat and reward notifications into simulator-compatible typed events', () => {
    const chat = normalizeEventSub('channel.chat.message', 'm1', { broadcaster_user_id: '1', chatter_user_id: '2', chatter_user_login: 'mod', chatter_user_name: 'Mod', message_id: 'c1', message: { text: '!approve 1' }, badges: [{ set_id: 'moderator' }] }, '1');
    expect(chat?.viewer.moderator).toBe(true);
    expect(chat?.origin).toBe('twitch');
    const reward = normalizeEventSub('channel.channel_points_custom_reward_redemption.add', 'm2', { id: 'r1', broadcaster_user_id: '1', user_id: '2', user_login: 'viewer', user_name: 'Viewer', reward: { id: 'reward-1' }, user_input: 'Coins flee' }, '1');
    expect(reward?.kind).toBe('reward');
    expect(normalizeSimulator({ id: 's1', kind: 'chat', viewer, text: '!idea Coins flee' }, 'reward-1')).toMatchObject({ kind: 'chat', origin: 'simulator', text: '!idea Coins flee' });
    expect(normalizeEventSub('channel.chat.message', 'm3', { broadcaster_user_id: 'other' }, '1')).toBeNull();
  });

  it('checks OAuth state, scopes and identity and refreshes stored tokens', async () => {
    const directory = fs.mkdtempSync(path.join(process.cwd(), '.test-auth-'));
    try {
      const file = path.join(directory, 'tokens.json');
      let exchange = 0;
      const request = vi.fn(async (url: string, options?: RequestInit) => {
        if (url.endsWith('/validate')) return new Response(JSON.stringify({ client_id: 'client', user_id: '100', login: 'streamer', scopes: ['channel:read:redemptions'] }), { status: 200 });
        exchange++;
        expect(String(options?.body)).toContain(exchange === 1 ? 'authorization_code' : 'refresh_token');
        return new Response(JSON.stringify({ access_token: `access-${exchange}`, refresh_token: `refresh-${exchange}`, expires_in: exchange === 1 ? 0 : 3600, scope: ['channel:read:redemptions'] }), { status: 200 });
      }) as unknown as typeof fetch;
      const auth = new TwitchAuth({ clientId: 'client', clientSecret: 'secret', redirectUri: 'http://localhost:5173/api/twitch/auth/callback', rewardId: 'r' }, file, request);
      const url = new URL(auth.authorizeUrl('broadcaster'));
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/api/twitch/auth/callback');
      await expect(auth.complete('code', 'wrong')).rejects.toThrow(/state/);
      await auth.complete('code', url.searchParams.get('state')!);
      expect(await auth.token('broadcaster')).toBe('access-2');
      expect(fs.readFileSync(file, 'utf8')).toContain('refresh-2');
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});

class MockSocket extends EventEmitter {
  readyState = 1;
  close() { this.readyState = 3; this.emit('close'); }
  terminate() { this.close(); }
  receive(message: unknown) { this.emit('message', Buffer.from(JSON.stringify(message))); }
}

it('reconnects and resubscribes after an EventSub socket drop', async () => {
  vi.useFakeTimers();
  const sockets: MockSocket[] = [];
  const calls: string[] = [];
  const auth = { identity: (role: string) => role === 'bot' ? { id: '2' } : { id: '1' }, helix: async (_role: string, route: string) => { calls.push(route); return { ok: true }; } } as unknown as TwitchAuth;
  const client = new EventSubClient(auth, 'reward-1', async () => {}, () => { const socket = new MockSocket(); sockets.push(socket); return socket as never; });
  try {
    client.start();
    sockets[0].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'first', keepalive_timeout_seconds: 10 } } });
    await vi.waitFor(() => expect(client.status()).toBe('connected'));
    sockets[0].close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);
    sockets[1].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'second', keepalive_timeout_seconds: 10 } } });
    await vi.waitFor(() => expect(client.status()).toBe('connected'));
    expect(calls).toHaveLength(4);
  } finally { client.stop(); vi.useRealTimers(); }
});

it('honors Twitch reconnect handoff without making duplicate subscriptions', async () => {
  const sockets: MockSocket[] = [];
  const calls: string[] = [];
  const auth = { identity: (role: string) => role === 'bot' ? { id: '2' } : { id: '1' }, helix: async (_role: string, route: string) => { calls.push(route); return { ok: true }; } } as unknown as TwitchAuth;
  const client = new EventSubClient(auth, 'reward-1', async () => {}, () => { const socket = new MockSocket(); sockets.push(socket); return socket as never; });
  try {
    client.start();
    sockets[0].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'first' } } });
    await vi.waitFor(() => expect(client.status()).toBe('connected'));
    sockets[0].receive({ metadata: { message_type: 'session_reconnect' }, payload: { session: { reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?handoff=1' } } });
    expect(sockets).toHaveLength(2);
    sockets[1].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'second' } } });
    expect(client.status()).toBe('connected');
    expect(sockets[0].readyState).toBe(3);
    expect(calls).toHaveLength(2);
  } finally { client.stop(); }
});
