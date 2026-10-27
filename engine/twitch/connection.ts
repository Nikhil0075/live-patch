import { TwitchCredentialError, type TwitchAuth } from './auth';
import type { EventSubClient } from './eventsub';

const hourlyMs = 60 * 60_000;

export function rejectedTwitchCredentials(error: unknown): boolean {
  return error instanceof TwitchCredentialError;
}

export class TwitchConnection {
  private hourly?: NodeJS.Timeout;
  private retry?: NodeJS.Timeout;
  private pending?: Promise<void>;
  private running = false;
  private failures = 0;
  private issue = '';

  constructor(private auth: Pick<TwitchAuth, 'connected' | 'validateStored'>, private eventsub: Pick<EventSubClient, 'start' | 'stop'>) {}
  status() { return this.issue; }

  start() {
    if (this.running) return this.check();
    this.running = true;
    this.hourly = setInterval(() => { void this.check(); }, hourlyMs);
    this.hourly.unref();
    return this.check();
  }

  check(): Promise<void> {
    if (!this.running || !this.auth.connected('broadcaster') || !this.auth.connected('bot')) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = this.validate().finally(() => { this.pending = undefined; });
    return this.pending;
  }

  stop() {
    this.running = false;
    if (this.hourly) clearInterval(this.hourly);
    if (this.retry) clearTimeout(this.retry);
    this.eventsub.stop();
  }

  private async validate() {
    try {
      await this.auth.validateStored();
      if (!this.running) return;
      this.issue = '';
      this.failures = 0;
      if (this.retry) { clearTimeout(this.retry); this.retry = undefined; }
      this.eventsub.start();
    } catch (error) {
      if (!this.running) return;
      this.issue = String(error);
      console.error('Twitch authorization needs attention:', this.issue);
      if (rejectedTwitchCredentials(error)) { this.eventsub.stop(); return; }
      if (this.retry) return;
      const delay = Math.min(5 * 60_000, 5_000 * 2 ** Math.min(this.failures++, 6));
      this.retry = setTimeout(() => { this.retry = undefined; void this.check(); }, delay);
      this.retry.unref();
    }
  }
}
