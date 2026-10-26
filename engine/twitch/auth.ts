import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export type Role = 'broadcaster' | 'bot';
export const defaultTwitchRedirectUri = 'https://localhost:5173/api/twitch/auth/callback';
export interface TwitchConfig { clientId: string; clientSecret: string; redirectUri: string; rewardId: string }
interface Token { accessToken: string; refreshToken: string; userId: string; login: string; scopes: string[]; expiresAt: number; validatedAt: number }
const scopes: Record<Role, string[]> = { broadcaster: ['channel:read:redemptions'], bot: ['user:read:chat', 'user:write:chat'] };
const endpoint = 'https://id.twitch.tv/oauth2';

export class TwitchAuth {
  private tokens: Partial<Record<Role, Token>>;
  private pending = new Map<string, { role: Role; expires: number }>();
  constructor(private config: TwitchConfig, private file: string, private request: typeof fetch = fetch) {
    this.tokens = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Record<Role, Token>> : {};
  }
  configured() { return Boolean(this.config.clientId && this.config.clientSecret && this.config.redirectUri); }
  connected(role: Role) { return Boolean(this.tokens[role]); }
  identity(role: Role) { const token = this.tokens[role]; return token ? { id: token.userId, login: token.login } : null; }
  async validateStored() {
    for (const role of ['broadcaster', 'bot'] as const) if (this.tokens[role]) {
      this.tokens[role]!.validatedAt = 0;
      await this.token(role);
    }
  }
  authorizeUrl(role: Role) {
    if (!this.configured()) throw Error('Twitch app credentials are not configured');
    const state = randomBytes(24).toString('hex');
    this.pending.set(state, { role, expires: Date.now() + 5 * 60_000 });
    const url = new URL(`${endpoint}/authorize`);
    url.search = new URLSearchParams({ response_type: 'code', client_id: this.config.clientId, redirect_uri: this.config.redirectUri, scope: scopes[role].join(' '), state }).toString();
    return url.toString();
  }
  async complete(code: string, state: string) {
    const pending = this.pending.get(state);
    this.pending.delete(state);
    if (!pending || pending.expires < Date.now() || !code) throw Error('Invalid or expired OAuth state');
    const response = await this.request(`${endpoint}/token`, { method: 'POST', body: new URLSearchParams({ client_id: this.config.clientId, client_secret: this.config.clientSecret, code, grant_type: 'authorization_code', redirect_uri: this.config.redirectUri }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error(`Twitch token exchange failed (${response.status})`);
    const result = await response.json() as { access_token: string; refresh_token: string; expires_in: number; scope: string[] };
    const identity = await this.validateRaw(result.access_token);
    if (identity.client_id !== this.config.clientId || !identity.user_id || !identity.login || !scopes[pending.role].every(scope => identity.scopes.includes(scope))) throw Error('OAuth account or scopes do not match the requested role');
    const other = this.tokens[pending.role === 'bot' ? 'broadcaster' : 'bot'];
    if (other?.userId === identity.user_id) throw Error('Use separate broadcaster and bot Twitch accounts');
    this.tokens[pending.role] = { accessToken: result.access_token, refreshToken: result.refresh_token, userId: identity.user_id, login: identity.login, scopes: identity.scopes, expiresAt: Date.now() + result.expires_in * 1000, validatedAt: Date.now() };
    this.save();
    return { role: pending.role, id: identity.user_id, login: identity.login };
  }
  async token(role: Role): Promise<string> {
    const token = this.tokens[role];
    if (!token) throw Error(`${role} account is not connected`);
    if (token.expiresAt < Date.now() + 60_000) return this.refresh(role);
    if (token.validatedAt < Date.now() - 60 * 60_000) {
      try {
        const identity = await this.validateRaw(token.accessToken);
        if (identity.client_id !== this.config.clientId || identity.user_id !== token.userId || !scopes[role].every(scope => identity.scopes.includes(scope))) throw Error('Twitch token identity or scopes changed');
        token.validatedAt = Date.now(); this.save();
      } catch { return this.refresh(role); }
    }
    return token.accessToken;
  }
  async refresh(role: Role): Promise<string> {
    const token = this.tokens[role];
    if (!token) throw Error(`${role} account is not connected`);
    const response = await this.request(`${endpoint}/token`, { method: 'POST', body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refreshToken, client_id: this.config.clientId, client_secret: this.config.clientSecret }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error(`Twitch token refresh failed (${response.status}); reconnect the ${role} account`);
    const result = await response.json() as { access_token: string; refresh_token: string; expires_in: number; scope: string[] };
    const identity = await this.validateRaw(result.access_token);
    if (identity.user_id !== token.userId || identity.client_id !== this.config.clientId || !scopes[role].every(scope => identity.scopes.includes(scope))) throw Error('Refreshed token identity or scopes changed');
    Object.assign(token, { accessToken: result.access_token, refreshToken: result.refresh_token, scopes: identity.scopes, expiresAt: Date.now() + result.expires_in * 1000, validatedAt: Date.now() });
    this.save();
    return token.accessToken;
  }
  async helix(role: Role, route: string, body?: unknown): Promise<Response> {
    const send = async (access: string) => this.request(`https://api.twitch.tv/helix/${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${access}`, 'Client-Id': this.config.clientId, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(10000) });
    let response = await send(await this.token(role));
    if (response.status === 401) response = await send(await this.refresh(role));
    return response;
  }
  private async validateRaw(access: string): Promise<{ client_id: string; user_id: string; login: string; scopes: string[] }> {
    const response = await this.request(`${endpoint}/validate`, { headers: { Authorization: `OAuth ${access}` }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error(`Twitch token validation failed (${response.status})`);
    return response.json() as Promise<{ client_id: string; user_id: string; login: string; scopes: string[] }>;
  }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.tokens), { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }
}
