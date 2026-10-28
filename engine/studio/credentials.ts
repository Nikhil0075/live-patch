import fs from 'node:fs';
import path from 'node:path';
import type { TwitchConfig } from '../twitch/auth';

const names = ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'TWITCH_REDIRECT_URI', 'TWITCH_PITCH_REWARD_ID'] as const;
type Name = typeof names[number];
export interface CredentialInput { clientId?: string; clientSecret?: string; redirectUri?: string; rewardId?: string }
const fields: Record<keyof CredentialInput, Name> = { clientId: 'TWITCH_CLIENT_ID', clientSecret: 'TWITCH_CLIENT_SECRET', redirectUri: 'TWITCH_REDIRECT_URI', rewardId: 'TWITCH_PITCH_REWARD_ID' };
export function publicCredentials(config: TwitchConfig) { return { clientId: config.clientId, redirectUri: config.redirectUri, rewardId: config.rewardId, secretSet: Boolean(config.clientSecret) }; }

export function saveCredentials(root: string, input: CredentialInput, remove = false): TwitchConfig {
  const file = path.join(root, '.env');
  const example = path.join(root, '.env.example');
  const original = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : fs.existsSync(example) ? fs.readFileSync(example, 'utf8') : '';
  const values = new Map<Name, string>();
  for (const [field, name] of Object.entries(fields) as [keyof CredentialInput, Name][]) {
    const value = remove ? '' : input[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || /[\r\n\0]/.test(value) || value.length > 512) throw Error('Invalid credential field');
    values.set(name, value.trim());
  }
  const redirect = values.get('TWITCH_REDIRECT_URI');
  if (redirect && (!/^https:\/\/(?:localhost|127\.0\.0\.1):\d+\/api\/twitch\/auth\/callback$/.test(redirect))) throw Error('Use the exact local HTTPS Twitch callback URL');
  const lines = original.split(/\r?\n/);
  const written = new Set<Name>();
  const updated = lines.map(line => {
    const match = /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    const name = match?.[1] as Name | undefined;
    if (!name || !values.has(name)) return line;
    written.add(name);
    return `${name}=${values.get(name)}`;
  });
  for (const [name, value] of values) if (!written.has(name)) updated.push(`${name}=${value}`);
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, updated.join('\n'), { mode: 0o600 });
  fs.renameSync(temp, file);
  for (const name of names) if (values.has(name)) process.env[name] = values.get(name)!;
  return { clientId: process.env.TWITCH_CLIENT_ID ?? '', clientSecret: process.env.TWITCH_CLIENT_SECRET ?? '', redirectUri: process.env.TWITCH_REDIRECT_URI ?? '', rewardId: process.env.TWITCH_PITCH_REWARD_ID ?? '' };
}
