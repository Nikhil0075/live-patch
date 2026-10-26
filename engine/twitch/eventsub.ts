import WebSocket from 'ws';
import { normalizeEventSub } from './events';
import type { InboundEvent } from '../pipeline/commands';
import { TwitchAuth } from './auth';

interface Envelope {
  metadata?: { message_id?: string; message_type?: string; subscription_type?: string };
  payload?: { session?: { id?: string; reconnect_url?: string; keepalive_timeout_seconds?: number }; event?: unknown; subscription?: { type?: string; status?: string } };
}

export class EventSubClient {
  private socket?: WebSocket;
  private handoff?: WebSocket;
  private watchdog?: NodeJS.Timeout;
  private retry?: NodeJS.Timeout;
  private attempts = 0;
  private stopped = true;
  private state = 'offline';
  private keepaliveSeconds = 10;
  constructor(private auth: TwitchAuth, private rewardId: string, private onEvent: (event: InboundEvent) => Promise<unknown>, private socketFactory: (url: string) => WebSocket = url => new WebSocket(url)) {}
  status() { return this.state; }
  start() { if (!this.stopped) return; this.stopped = false; this.connect('wss://eventsub.wss.twitch.tv/ws', false); }
  stop() {
    this.stopped = true; this.state = 'offline';
    if (this.retry) clearTimeout(this.retry);
    if (this.watchdog) clearTimeout(this.watchdog);
    this.socket?.close(); this.handoff?.close();
    this.socket = undefined; this.handoff = undefined;
  }
  private connect(url: string, handoff: boolean) {
    if (this.stopped) return;
    this.state = handoff ? 'reconnecting' : 'connecting';
    const socket = this.socketFactory(url);
    if (handoff) this.handoff = socket;
    else this.socket = socket;
    socket.on('message', data => { void this.handle(socket, data.toString(), handoff); });
    socket.on('error', () => { /* close handles the retry without exposing URLs or tokens */ });
    socket.on('close', () => {
      if (this.stopped) return;
      if (this.handoff === socket) { this.handoff = undefined; if (!this.socket || this.socket.readyState !== WebSocket.OPEN) this.scheduleRetry(); }
      else if (this.socket === socket) { this.socket = undefined; if (!this.handoff) this.scheduleRetry(); }
    });
  }
  private async handle(socket: WebSocket, raw: string, handoff: boolean) {
    let message: Envelope;
    try { message = JSON.parse(raw) as Envelope; } catch { return; }
    const type = message.metadata?.message_type;
    if (type === 'session_welcome') {
      const session = message.payload?.session;
      if (!session?.id) return;
      if (handoff) {
        const old = this.socket;
        this.socket = socket; this.handoff = undefined;
        old?.close();
      } else {
        try { await this.subscribe(session.id); }
        catch (error) { this.state = `subscription failed: ${String(error)}`; socket.close(); return; }
      }
      this.attempts = 0; this.state = 'connected'; this.keepaliveSeconds = session.keepalive_timeout_seconds ?? 10; this.resetWatchdog(socket);
      return;
    }
    if (socket !== this.socket) return;
    if (type === 'session_reconnect' && message.payload?.session?.reconnect_url) {
      if (!this.handoff) this.connect(message.payload.session.reconnect_url, true);
      return;
    }
    if (type === 'session_keepalive' || type === 'notification') this.resetWatchdog(socket);
    if (type === 'revocation') { this.state = `revoked: ${message.payload?.subscription?.type ?? 'subscription'}`; return; }
    if (type !== 'notification') return;
    const broadcaster = this.auth.identity('broadcaster');
    if (!broadcaster) return;
    const event = normalizeEventSub(message.metadata?.subscription_type ?? '', message.metadata?.message_id ?? '', message.payload?.event, broadcaster.id);
    if (event) try { await this.onEvent(event); } catch (error) { console.error('EventSub event processing failed:', error); }
  }
  private async subscribe(sessionId: string) {
    const broadcaster = this.auth.identity('broadcaster');
    const bot = this.auth.identity('bot');
    if (!broadcaster || !bot) throw Error('Both Twitch accounts must be connected');
    const transport = { method: 'websocket', session_id: sessionId };
    const create = async (role: 'bot' | 'broadcaster', type: string, condition: Record<string, string>) => {
      const response = await this.auth.helix(role, 'eventsub/subscriptions', { type, version: '1', condition, transport });
      if (!response.ok) throw Error(`${type} subscription returned ${response.status}`);
    };
    await Promise.all([
      create('bot', 'channel.chat.message', { broadcaster_user_id: broadcaster.id, user_id: bot.id }),
      ...(this.rewardId ? [create('broadcaster', 'channel.channel_points_custom_reward_redemption.add', { broadcaster_user_id: broadcaster.id, reward_id: this.rewardId })] : [])
    ]);
  }
  private resetWatchdog(socket: WebSocket) {
    if (this.watchdog) clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => { if (this.socket === socket) { this.state = 'timed out'; socket.terminate(); } }, (this.keepaliveSeconds + 5) * 1000);
  }
  private scheduleRetry() {
    if (this.stopped || this.retry) return;
    this.state = 'reconnecting';
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(this.attempts++, 5));
    this.retry = setTimeout(() => { this.retry = undefined; this.connect('wss://eventsub.wss.twitch.tv/ws', false); }, delay);
  }
}
