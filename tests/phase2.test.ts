import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { IdeaStore } from '../engine/pipeline/ideas';
import { ChatPipeline, type InboundEvent } from '../engine/pipeline/commands';
import { forwardToGame, normalizeEventSub, normalizeSimulator } from '../engine/twitch/events';
import { TwitchAuth, TwitchCredentialError, authorizationError, defaultTwitchRedirectUri } from '../engine/twitch/auth';
import { EventSubClient } from '../engine/twitch/eventsub';
import { chatDeliveryIssue } from '../engine/twitch/chat';
import { TwitchConnection, rejectedTwitchCredentials } from '../engine/twitch/connection';

function tempStore(run: (store: IdeaStore, file: string) => Promise<void> | void) {
  const directory = fs.mkdtempSync(path.join(process.cwd(), '.test-ideas-'));
  const file = path.join(directory, 'ideas.json');
  return Promise.resolve().then(() => run(new IdeaStore(file), file)).finally(() => fs.rmSync(directory, { recursive: true, force: true }));
}
const viewer = { id: '42', login: 'viewer', name: 'Viewer', moderator: false, broadcaster: false };
const inbound = (id: string, text: string): Extract<InboundEvent, { kind: 'chat' }> => ({ kind: 'chat', origin: 'simulator', id, viewer, text });

describe('Phase 2 idea pipeline', () => {
  it('keeps chat alive during a network blip and recovers from a startup failure', async () => {
    vi.useFakeTimers();
    const validateStored = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValue(undefined);
    const stream = { start: vi.fn(), stop: vi.fn() };
    const connection = new TwitchConnection({ connected: () => true, validateStored }, stream);
    try {
      await connection.start();
      expect(connection.status()).toContain('fetch failed');
      expect(stream.start).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(validateStored).toHaveBeenCalledTimes(2);
      expect(stream.start).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(60 * 60_000 - 5_000);
      expect(connection.status()).toContain('fetch failed');
      expect(stream.stop).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(connection.status()).toBe('');
      expect(stream.start).toHaveBeenCalledTimes(2);
      expect(rejectedTwitchCredentials(new TwitchCredentialError('credentials revoked'))).toBe(true);
      expect(rejectedTwitchCredentials(new Error('Twitch token refresh failed (401)'))).toBe(false);
      validateStored.mockRejectedValueOnce(new TwitchCredentialError('credentials revoked'));
      await connection.check();
      expect(stream.stop).toHaveBeenCalledTimes(1);
      expect(connection.status()).toContain('credentials revoked');
      await connection.check();
      expect(connection.status()).toBe('');
      expect(stream.start).toHaveBeenCalledTimes(3);
    } finally { connection.stop(); vi.useRealTimers(); }
  });
  it('reports a rejected Twitch chat send even when the API returns HTTP 200', async () => {
    const rejected = new Response(JSON.stringify({ data: [{ is_sent: false, drop_reason: { code: 'msg_rejected', message: 'Your message could not be sent' } }] }));
    expect(await chatDeliveryIssue(rejected)).toContain('msg_rejected');
    const sent = new Response(JSON.stringify({ data: [{ is_sent: true, drop_reason: null }] }));
    expect(await chatDeliveryIssue(sent)).toBe('');
    expect(await chatDeliveryIssue(new Response('', { status: 403 }))).toContain('HTTP 403');
  });
  it('explains a Twitch redirect mismatch using the configured callback URL', () => {
    expect(authorizationError('redirect_mismatch', defaultTwitchRedirectUri)).toContain(`Register ${defaultTwitchRedirectUri} exactly`);
    expect(authorizationError('redirect_mismatch', defaultTwitchRedirectUri)).toContain('localhost and 127.0.0.1');
    expect(authorizationError('access_denied', defaultTwitchRedirectUri)).toContain('denied by the account');
  });
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
  it('calls refund handling once when a Twitch reward pitch is rejected', async () => tempStore(async store => {
    const onRejectedReward = vi.fn().mockResolvedValue('Twitch confirmed points were returned.');
    const pipeline = new ChatPipeline(store, { rewardId: 'reward-1', reply: async () => {}, onRejectedReward });
    const event: Extract<InboundEvent, { kind: 'reward' }> = { kind: 'reward', origin: 'twitch', id: 'message-1', redemptionId: 'redemption-1', viewer, rewardId: 'reward-1', text: 'x'.repeat(201) };
    expect((await pipeline.ingest(event)).message).toContain('points were returned');
    await pipeline.ingest(event);
    expect(onRejectedReward).toHaveBeenCalledTimes(1);
    expect(onRejectedReward).toHaveBeenCalledWith(event, expect.stringContaining('Ideas must be'));
  }));

  it('immediately accepts moderator rollback with no viewer ballot', async () => tempStore(async store => {
    const onControl = vi.fn();
    const pipeline = new ChatPipeline(store, { rewardId: 'reward-1', reply: async () => {}, onControl, onRollbackVote: () => ({ accepted: false, votes: 0, threshold: 3, ready: false }) });
    const mod = { ...viewer, id: 'mod', moderator: true };
    expect((await pipeline.ingest({ ...inbound('rollback-zero-votes', '!rollback'), viewer: mod })).accepted).toBe(true);
    expect(onControl).toHaveBeenCalledWith('rollback');
    expect(store.rollbackRequests()).toHaveLength(1);
  }));
  it('does not claim rollback when no patch has shipped', async () => tempStore(async store => {
    const onControl = vi.fn();
    const replies: string[] = [];
    const pipeline = new ChatPipeline(store, { rewardId: 'reward-1', reply: async text => { replies.push(text); }, onControl, canRollback: () => false });
    const mod = { ...viewer, id: 'mod', moderator: true };
    const result = await pipeline.ingest({ ...inbound('empty-rollback', '!rollback'), viewer: mod });
    expect(result).toMatchObject({ accepted: false, message: 'Nothing to roll back. Ship a patch first.' });
    expect(replies[0]).toContain('Nothing to roll back');
    expect(onControl).not.toHaveBeenCalled();
    expect(store.rollbackRequests()).toHaveLength(0);
  }));

  it('fulfills an accepted reward once after storing its idea', async () => tempStore(async store => {
    const onAcceptedReward = vi.fn(async () => { expect(store.list()).toHaveLength(1); });
    const pipeline = new ChatPipeline(store, { rewardId: 'reward-1', reply: async () => {}, onAcceptedReward });
    const reward: Extract<InboundEvent, { kind: 'reward' }> = { kind: 'reward', origin: 'twitch', id: 'accepted-1', redemptionId: 'redemption-1', viewer, rewardId: 'reward-1', text: 'Coins glow' };
    expect((await pipeline.ingest(reward)).accepted).toBe(true);
    await pipeline.ingest(reward);
    expect(onAcceptedReward).toHaveBeenCalledTimes(1);
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

  it('does not amplify denied commands into bot spam and rate-limits error replies', async () => tempStore(async store => {
    let now = 1_000_000;
    const replies: string[] = [];
    const pipeline = new ChatPipeline(store, { rewardId: 'r', now: () => now, reply: async text => { replies.push(text); } });
    for (let index = 0; index < 5; index++) await pipeline.ingest(inbound(`denied-${index}`, '!approve 1'));
    expect(replies).toHaveLength(0);
    for (let index = 0; index < 5; index++) await pipeline.ingest(inbound(`invalid-${index}`, '!vote 9'));
    expect(replies).toHaveLength(1);
    now += 30_000;
    await pipeline.ingest(inbound('later', '!vote 9'));
    expect(replies).toHaveLength(2);
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

  it('keeps bot replies and control commands out of the game chat hook', () => {
    expect(forwardToGame({ ...inbound('bot', 'Idea received'), origin: 'twitch', viewer: { ...viewer, id: 'bot' } }, 'bot')).toBe(false);
    expect(forwardToGame(inbound('command', '!approve 1'), 'bot')).toBe(false);
    expect(forwardToGame(inbound('viewer', 'What if coins chased us?'), 'bot')).toBe(true);
  });

  it('checks OAuth state, scopes and identity and refreshes stored tokens', async () => {
    expect(defaultTwitchRedirectUri).toBe('https://localhost:5173/api/twitch/auth/callback');
    const directory = fs.mkdtempSync(path.join(process.cwd(), '.test-auth-'));
    try {
      const file = path.join(directory, 'tokens.json');
      let exchange = 0;
      const request = vi.fn(async (url: string, options?: RequestInit) => {
        if (url.endsWith('/validate')) return new Response(JSON.stringify({ client_id: 'client', user_id: '100', login: 'streamer', scopes: ['channel:manage:redemptions', 'channel:manage:predictions'] }), { status: 200 });
        exchange++;
        expect(String(options?.body)).toContain(exchange === 1 ? 'authorization_code' : 'refresh_token');
        return new Response(JSON.stringify({ access_token: `access-${exchange}`, refresh_token: `refresh-${exchange}`, expires_in: exchange === 1 ? 0 : 3600, scope: ['channel:manage:redemptions', 'channel:manage:predictions'] }), { status: 200 });
      }) as unknown as typeof fetch;
      const auth = new TwitchAuth({ clientId: 'client', clientSecret: 'secret', redirectUri: defaultTwitchRedirectUri, rewardId: 'r' }, file, request);
      const url = new URL(auth.authorizeUrl('broadcaster'));
      expect(url.searchParams.get('redirect_uri')).toBe('https://localhost:5173/api/twitch/auth/callback');
      expect(url.searchParams.get('force_verify')).toBe('true');
      await expect(auth.complete('code', 'wrong')).rejects.toThrow(/state/);
      await auth.complete('code', url.searchParams.get('state')!);
      expect(await auth.token('broadcaster')).toBe('access-2');
      expect(fs.readFileSync(file, 'utf8')).toContain('refresh-2');
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
  it('types rejected token responses without treating server failures as revoked credentials', async () => {
    const directory = fs.mkdtempSync(path.join(process.cwd(), '.test-auth-'));
    try {
      const file = path.join(directory, 'tokens.json');
      fs.writeFileSync(file, JSON.stringify({ broadcaster: { accessToken: 'expired', refreshToken: 'refresh', userId: '100', login: 'streamer', scopes: ['channel:manage:redemptions', 'channel:manage:predictions'], expiresAt: 0, validatedAt: 0 } }));
      for (const status of [401, 503]) {
        const request = vi.fn(async () => new Response('', { status })) as unknown as typeof fetch;
        const auth = new TwitchAuth({ clientId: 'client', clientSecret: 'secret', redirectUri: defaultTwitchRedirectUri, rewardId: 'r' }, file, request);
        try { await auth.token('broadcaster'); expect.fail('expected token refresh to fail'); }
        catch (error) { expect(rejectedTwitchCredentials(error)).toBe(status === 401); }
      }
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});

class MockSocket extends EventEmitter {
  readyState = 1;
  close() { this.readyState = 3; this.emit('close'); }
  terminate() { this.close(); }
  receive(message: unknown) { this.emit('message', Buffer.from(JSON.stringify(message))); }
}

it('keeps chat subscribed when the custom reward subscription is rejected', async () => {
  vi.useFakeTimers();
  const sockets: MockSocket[] = [];
  const events: InboundEvent[] = [];
  const subscriptions: { role: string; type: string; sessionId: string }[] = [];
  const auth = {
    identity: (role: string) => role === 'bot' ? { id: '2' } : { id: '1' },
    helix: async (role: string, _route: string, body: { type: string; transport: { session_id: string } }) => {
      subscriptions.push({ role, type: body.type, sessionId: body.transport.session_id });
      return new Response('', { status: body.type === 'channel.chat.message' ? 202 : 403 });
    }
  } as unknown as TwitchAuth;
  const client = new EventSubClient(auth, 'missing-reward', async event => { events.push(event); }, () => { const socket = new MockSocket(); sockets.push(socket); return socket as never; });
  try {
    client.start();
    sockets[0].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'first' } } });
    sockets[1].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'second' } } });
    await vi.waitFor(() => expect(client.status()).toMatch(/^connected · reward events unavailable: .*subscription returned 403/));
    expect(client.status()).toContain('connected');
    expect(sockets).toHaveLength(2);
    expect(subscriptions).toEqual([
      { role: 'bot', type: 'channel.chat.message', sessionId: 'first' },
      { role: 'broadcaster', type: 'channel.channel_points_custom_reward_redemption.add', sessionId: 'second' }
    ]);
    sockets[0].receive({ metadata: { message_type: 'notification', subscription_type: 'channel.chat.message', message_id: 'event-1' }, payload: { event: { broadcaster_user_id: '1', chatter_user_id: '3', chatter_user_login: 'viewer', chatter_user_name: 'Viewer', message_id: 'chat-1', message: { text: '!idea Test' } } } });
    await vi.waitFor(() => expect(events).toHaveLength(1));
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(subscriptions.filter(item => item.type === 'channel.channel_points_custom_reward_redemption.add')).toHaveLength(1);
    client.resetAfterAuthChange();
    client.start();
    expect(sockets.length).toBeGreaterThan(2);
  } finally { client.stop(); vi.useRealTimers(); }
});

it('retries a temporary reward subscription failure without interrupting chat', async () => {
  vi.useFakeTimers();
  const sockets: MockSocket[] = [];
  let rewardAttempts = 0;
  const auth = {
    identity: (role: string) => role === 'bot' ? { id: '2' } : { id: '1' },
    helix: async (_role: string, _route: string, body: { type: string }) => {
      if (body.type === 'channel.chat.message') return new Response('', { status: 202 });
      rewardAttempts++;
      return new Response('', { status: rewardAttempts === 1 ? 503 : 202 });
    }
  } as unknown as TwitchAuth;
  const client = new EventSubClient(auth, 'reward-1', async () => {}, () => { const socket = new MockSocket(); sockets.push(socket); return socket as never; });
  try {
    client.start();
    sockets[0].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'chat' } } });
    sockets[1].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'reward-first' } } });
    await vi.waitFor(() => expect(client.status()).toContain('reward events unavailable'));
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets).toHaveLength(3);
    sockets[2].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'reward-second' } } });
    await vi.waitFor(() => expect(client.status()).toBe('connected'));
    expect(rewardAttempts).toBe(2);
  } finally { client.stop(); vi.useRealTimers(); }
});

it('subscribes bot chat and broadcaster rewards on separate sessions and receives both events', async () => {
  const sockets: MockSocket[] = [];
  const events: InboundEvent[] = [];
  const owners = new Map<string, string>();
  const auth = {
    identity: (role: string) => role === 'bot' ? { id: '2' } : { id: '1' },
    helix: async (role: string, _route: string, body: { transport: { session_id: string } }) => {
      const session = body.transport.session_id;
      if (owners.has(session) && owners.get(session) !== role) return new Response(JSON.stringify({ message: 'websocket transport cannot have subscriptions created by different users' }), { status: 400 });
      owners.set(session, role);
      return new Response('', { status: 202 });
    }
  } as unknown as TwitchAuth;
  const client = new EventSubClient(auth, 'reward-1', async event => { events.push(event); }, () => { const socket = new MockSocket(); sockets.push(socket); return socket as never; });
  try {
    client.start();
    sockets[0].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'chat-session' } } });
    sockets[1].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'reward-session' } } });
    await vi.waitFor(() => expect(client.status()).toBe('connected'));
    expect([...owners]).toEqual([['chat-session', 'bot'], ['reward-session', 'broadcaster']]);
    sockets[0].receive({ metadata: { message_type: 'notification', subscription_type: 'channel.chat.message', message_id: 'chat-event' }, payload: { event: { broadcaster_user_id: '1', chatter_user_id: '3', chatter_user_login: 'viewer', chatter_user_name: 'Viewer', message_id: 'chat-1', message: { text: '!idea Weather' } } } });
    sockets[1].receive({ metadata: { message_type: 'notification', subscription_type: 'channel.channel_points_custom_reward_redemption.add', message_id: 'reward-event' }, payload: { event: { id: 'redemption-1', broadcaster_user_id: '1', user_id: '4', user_login: 'viewer2', user_name: 'Viewer2', reward: { id: 'reward-1' }, user_input: 'Fleeing coins' } } });
    await vi.waitFor(() => expect(events).toHaveLength(2));
    expect(events.map(event => event.kind)).toEqual(['chat', 'reward']);
  } finally { client.stop(); }
});

it('reconnects and resubscribes after an EventSub socket drop', async () => {
  vi.useFakeTimers();
  const sockets: MockSocket[] = [];
  const calls: string[] = [];
  const auth = { identity: (role: string) => role === 'bot' ? { id: '2' } : { id: '1' }, helix: async (_role: string, route: string) => { calls.push(route); return { ok: true }; } } as unknown as TwitchAuth;
  const client = new EventSubClient(auth, 'reward-1', async () => {}, () => { const socket = new MockSocket(); sockets.push(socket); return socket as never; });
  try {
    client.start();
    sockets[0].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'first', keepalive_timeout_seconds: 10 } } });
    sockets[1].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'reward', keepalive_timeout_seconds: 10 } } });
    await vi.waitFor(() => expect(client.status()).toBe('connected'));
    sockets[0].close();
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(3);
    sockets[2].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'second', keepalive_timeout_seconds: 10 } } });
    await vi.waitFor(() => expect(client.status()).toBe('connected'));
    expect(calls).toHaveLength(3);
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
    sockets[1].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'reward' } } });
    await vi.waitFor(() => expect(client.status()).toBe('connected'));
    sockets[0].receive({ metadata: { message_type: 'session_reconnect' }, payload: { session: { reconnect_url: 'wss://eventsub.wss.twitch.tv/ws?handoff=1' } } });
    expect(sockets).toHaveLength(3);
    sockets[2].receive({ metadata: { message_type: 'session_welcome' }, payload: { session: { id: 'second' } } });
    expect(client.status()).toBe('connected');
    expect(sockets[0].readyState).toBe(3);
    expect(calls).toHaveLength(2);
  } finally { client.stop(); }
});
