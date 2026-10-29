import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { loadGame, defaultGame } from '../engine/manifest/load';
import { discoverGames, validateImport, makeActive, smokeGame } from '../engine/manifest/library';
import { EffectLimits } from '../engine/mutation/effect-limits';
import { SettingsStore } from '../engine/studio/settings';
import { classifySandboxError, codexSignedIn, command, sandboxSetupArgs, sandboxSetupPowerShell } from '../engine/studio/setup';
import { publicCredentials, saveCredentials } from '../engine/studio/credentials';
import { ChatPipeline } from '../engine/pipeline/commands';
import { IdeaStore } from '../engine/pipeline/ideas';

const root = process.cwd();
const temp = async (work: (directory: string) => Promise<void> | void) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-phase45-'));
  try { await work(directory); } finally { fs.rmSync(directory, { recursive: true, force: true }); }
};

describe('Phase 4.5 studio', () => {
  it('recognizes a signed-in Codex CLI when status is written only to stderr', async () => {
    const output = await command(process.execPath, ['-e', 'console.error("Logged in using ChatGPT")']);
    expect(output).toContain('Logged in using ChatGPT');
    expect(codexSignedIn(output)).toBe(true);
    expect(codexSignedIn('Not logged in')).toBe(false);
  });
  it('uses a newly saved reward ID without restarting the idea pipeline', () => temp(directory => {
    const store = new IdeaStore(path.join(directory, 'ideas.json'));
    const pipeline = new ChatPipeline(store, { rewardId: 'old-reward', reply: async () => {} });
    pipeline.setRewardId('new-reward');
    return pipeline.ingest({ kind: 'reward', origin: 'simulator', id: 'new-redemption', viewer: { id: 'viewer', login: 'viewer', name: 'Viewer', moderator: false, broadcaster: false }, rewardId: 'new-reward', text: 'Make coins bounce' }).then(result => {
      expect(result.accepted).toBe(true);
      expect(store.list().some(idea => idea.source === 'reward')).toBe(true);
    });
  }));
  it('caps mutation flashes globally in every rolling second and rejects undeclared sounds', () => {
    const manifest = loadGame(root, path.join(root, 'games', 'arena-survivor')).manifest;
    let now = 1000; const limits = new EffectLimits(manifest, () => now);
    for (let index = 0; index < 3; index++) expect(limits.allow({ type: 'flash', args: ['#ffffff'] }, `module-${index}`)).toBe(true);
    expect(limits.allow({ type: 'flash', args: ['#ffffff'] }, 'module-4')).toBe(false);
    now += 1000; expect(limits.allow({ type: 'flash', args: ['#ffffff'] }, 'module-4')).toBe(true);
    expect(limits.allow({ type: 'playSound', args: ['unknown'] }, 'module-1')).toBe(false);
    for (let index = 0; index < 4; index++) expect(limits.allow({ type: 'playSound', args: ['coin'] }, 'module-1')).toBe(true);
    expect(limits.allow({ type: 'playSound', args: ['coin'] }, 'module-1')).toBe(false);
    expect(limits.allow({ type: 'playSound', args: ['coin'] }, 'module-2')).toBe(true);
  });

  it('keeps settings after restart and clamps volume, intensity and round durations', () => temp(directory => {
    const file = path.join(directory, 'settings.json');
    const saved = new SettingsStore(file).update({ pitchSeconds: 90, voteSeconds: 30, musicVolume: 2, reduceFlashing: true });
    expect(saved.musicVolume).toBe(1);
    expect(new SettingsStore(file).snapshot()).toMatchObject({ pitchSeconds: 90, voteSeconds: 30, reduceFlashing: true });
  }));

  it('writes Twitch credentials without echoing the secret or replacing unrelated env lines', () => temp(directory => {
    const keys = ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'TWITCH_REDIRECT_URI', 'TWITCH_PITCH_REWARD_ID'] as const;
    const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    try {
      fs.writeFileSync(path.join(directory, '.env.example'), 'OTHER_SETTING=keep\nTWITCH_CLIENT_ID=\nTWITCH_CLIENT_SECRET=\n');
      const saved = saveCredentials(directory, { clientId: 'fake-client', clientSecret: 'fake-secret-123', redirectUri: 'https://localhost:5173/api/twitch/auth/callback', rewardId: 'fake-reward' });
      expect(publicCredentials(saved)).toEqual({ clientId: 'fake-client', redirectUri: 'https://localhost:5173/api/twitch/auth/callback', rewardId: 'fake-reward', secretSet: true });
      expect(JSON.stringify(publicCredentials(saved))).not.toContain('fake-secret-123');
      expect(fs.readFileSync(path.join(directory, '.env'), 'utf8')).toContain('OTHER_SETTING=keep');
      expect(() => saveCredentials(directory, { clientSecret: 'bad\nLEAK=value' })).toThrow('Invalid credential field');
      const removed = saveCredentials(directory, {}, true);
      expect(publicCredentials(removed).secretSet).toBe(false);
    } finally { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } }
  }));

  it('maps known Windows sandbox setup failures to clear actions', () => {
    expect(classifySandboxError('Logon failure 1385').fix).toMatch(/Allow log on locally/);
    expect(classifySandboxError('Administrator approval refused').reason).toMatch(/Administrator/);
    expect(classifySandboxError('Access is denied in OneDrive folder').fix).toMatch(/OneDrive/);
    expect(classifySandboxError('Firewall policy blocked setup').reason).toMatch(/Security software/);
    expect(classifySandboxError('different user CODEX_HOME').fix).toMatch(/account/);
    expect(classifySandboxError('Error: Usage: setup [OPTIONS] <--user <USER>|--current-user> --codex-home')).toMatchObject({ reason: 'The installed Codex CLI rejected the sandbox setup command.' });
    expect(sandboxSetupArgs('DESKTOP\\viewer', 'C:\\Users\\Viewer Name\\.codex')).toEqual(['sandbox', 'setup', '--elevated', '--user', 'DESKTOP\\viewer', '--codex-home', 'C:\\Users\\Viewer Name\\.codex']);
    expect(sandboxSetupPowerShell('C:\\Program Files\\Codex\\codex.exe', 'DESKTOP\\viewer', 'C:\\Users\\Viewer Name\\.codex')).toContain('-ArgumentList \'sandbox setup --elevated --user "DESKTOP\\viewer" --codex-home "C:\\Users\\Viewer Name\\.codex"\' -Verb RunAs -Wait');
    const sources = fs.readFileSync(path.join(root, 'engine', 'studio', 'setup.ts'), 'utf8');
    expect(sources).not.toMatch(/Set-MpPreference|Add-MpPreference|Remove-MpPreference/);
  });

  it('creates a manifest-driven template, smoke-tests it, and switches the active game', async () => temp(async directory => {
    const game = execFileSync(process.execPath, [path.join(root, 'scripts', 'new-game.mjs'), 'Test World'], { cwd: directory, encoding: 'utf8' }).trim();
    const candidate = validateImport(directory, game);
    expect(candidate.manifest.name).toBe('Test World');
    await smokeGame(root, path.join(directory, 'data'), game, candidate.example);
    const listed = discoverGames(directory, path.join(directory, 'data'));
    expect(listed[0]).toMatchObject({ name: 'Test World', valid: true, smoke: { status: 'passed' } });
    const before = listed[0].activePatches;
    expect(before).toBeGreaterThan(0);
    expect(listed[0].shipped).toBe(0);
    fs.writeFileSync(path.join(game, candidate.manifest.mutationDir, 'extra-patch.js'), "export const meta={id:'extra',title:'Extra',author:'test',description:'Another patch'};");
    expect(discoverGames(directory, path.join(directory, 'data'))[0].activePatches).toBe(before + 1);
    makeActive(directory, game);
    expect(defaultGame(directory)).toBe(game);
    expect(loadGame(directory, defaultGame(directory)).manifest.testCommand).toContain('{file}');
    fs.writeFileSync(path.join(game, 'too-large.bin'), Buffer.alloc(1_000_001));
    expect(() => validateImport(directory, game)).toThrow(/Oversized/);
  }), 30_000);

  it('rejects a bad manifest and a nested symlink before importing the folder', () => temp(directory => {
    const game = execFileSync(process.execPath, [path.join(root, 'scripts', 'new-game.mjs'), 'Unsafe World'], { cwd: directory, encoding: 'utf8' }).trim();
    const manifest = path.join(game, 'live-patch.json');
    const original = fs.readFileSync(manifest, 'utf8');
    fs.writeFileSync(manifest, '{invalid');
    expect(() => validateImport(directory, game)).toThrow(/Invalid JSON/);
    fs.writeFileSync(manifest, original);
    const link = path.join(game, 'linked-file');
    try { fs.symlinkSync(manifest, link, 'file'); expect(() => validateImport(directory, game)).toThrow(/symlinks/); }
    catch (error) { if (!(error instanceof Error) || !/EPERM|EACCES/.test(error.message)) throw error; }
    expect(discoverGames(directory, path.join(directory, 'data')).some(item => item.name === 'Unsafe World')).toBe(true);
    expect(fs.existsSync(path.join(directory, 'data', 'imported-games.json'))).toBe(false);
  }));
  it('stores the active game in the configured data directory', () => temp(directory => {
    const previous = process.env.LIVE_PATCH_DATA_DIR;
    try {
      process.env.LIVE_PATCH_DATA_DIR = directory;
      const game = path.join(root, 'games', 'arena-survivor');
      makeActive(root, game);
      expect(JSON.parse(fs.readFileSync(path.join(directory, 'active-game.json'), 'utf8'))).toEqual({ directory: game });
      expect(defaultGame(root)).toBe(game);
    } finally {
      if (previous === undefined) delete process.env.LIVE_PATCH_DATA_DIR;
      else process.env.LIVE_PATCH_DATA_DIR = previous;
    }
  }));
});
