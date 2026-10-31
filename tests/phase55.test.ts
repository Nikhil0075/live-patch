import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SettingsStore } from '../engine/studio/settings';
import { generatedCover } from '../engine/manifest/cover-art';
import { practiceDemoEligible } from '../engine/twitch/practice-demo';
import { mutationTitle } from '../engine/mutation/metadata';
import { bannerY } from '../games/arena-survivor/src/layout';
import { clearPlacement, keepClearZones, minimumWidgetSize, overlaps } from '../engine/studio/overlay-placement';
import { timelineState } from '../engine/overlay/timeline';
import { smokeInfrastructureFailure } from '../engine/runner/runner';
import { publicFailure } from '../engine/runner/store';
import { TwitchAuth } from '../engine/twitch/auth';
import { IdeaStore } from '../engine/pipeline/ideas';
import { ChatPipeline } from '../engine/pipeline/commands';
import { handleRunnerOutcome } from '../engine/twitch/runner-outcome';

const css = fs.readFileSync(path.resolve('engine/tokens.css'), 'utf8');
it('documents the actual mutation load deadline for live Codex', () => {
  const host = fs.readFileSync(path.resolve('engine/mutation/host.ts'), 'utf8');
  const api = fs.readFileSync(path.resolve('games/arena-survivor/docs/mutation-api.md'), 'utf8');
  const deadline = Number(/LOAD_DEADLINE_MS = (\d+)/.exec(host)?.[1]);
  expect(deadline).toBeGreaterThan(0);
  expect(api).toContain(`Each load has a ${deadline / 1000} second deadline`);
});
function token(name: string) { return new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1] ?? ''; }
function light(hex: string) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a: string, b: string) { const values = [light(a), light(b)].sort((x,y) => y - x); return (values[0] + .05) / (values[1] + .05); }

describe('Phase 5.5 studio tokens', () => {
  it('defines the planned canvas, surfaces, type, accent and corner radius', () => {
    expect(token('bg')).toBe('#0e0e10');
    expect(token('surface')).toBe('#18181b');
    expect(token('raised')).toBe('#1f1f23');
    expect(token('accent')).toBe('#9146ff');
    expect(css).toContain('--radius: 4px');
    expect(css).toContain('@fontsource/inter/latin-400.css');
  });
  it('keeps text and primary button colours above WCAG AA contrast', () => {
    expect(contrast(token('text'), token('bg'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('text'), token('surface'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('muted'), token('surface'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', token('accent'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#bf94ff', token('surface'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('accent-text'), token('surface'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('text-soft'), token('surface'))).toBeGreaterThanOrEqual(4.5);
  });
});

describe('user-configurable overlay and generated game art', () => {
  it('persists a removed widget and bounds resized widgets to the OBS canvas', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-layout-'));
    try {
      const file = path.join(folder, 'settings.json');
      const store = new SettingsStore(file);
      expect(store.snapshot().overlayWidgets).toHaveLength(4);
      store.update({ overlayWidgets: [{ type: 'ballot', x: 1900, y: 1070, width: 800, height: 300 }] });
      const saved = new SettingsStore(file).snapshot().overlayWidgets;
      expect(saved).toEqual([{ type: 'ballot', x: 1120, y: 760, width: 800, height: 320 }]);
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  });
  it('moves the previous untouched default layout below the ship toast', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-layout-upgrade-'));
    try {
      const file = path.join(folder, 'settings.json');
      fs.writeFileSync(file, JSON.stringify({ overlayWidgets: [
        { type: 'patches', x: 24, y: 120, width: 1080, height: 110 },
        { type: 'codex', x: 1546, y: 165, width: 350, height: 590 },
        { type: 'ballot', x: 24, y: 725, width: 1010, height: 235 },
        { type: 'ticker', x: 560, y: 998, width: 1336, height: 58 }
      ] }));
      const widgets = new SettingsStore(file).snapshot().overlayWidgets;
      expect(widgets.find(item => item.type === 'patches')).toMatchObject({ x: 24, y: 180, width: 420, height: 430 });
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  });
  it('creates unique, escaped artwork for games without a supplied cover', () => {
    const a = generatedCover('New <Game> & Friends');
    expect(a).toContain('width="720" height="960"');
    expect(a).toContain('New &lt;Game&gt; &amp; Friends');
    expect(a).not.toContain('New <Game>');
    expect(a).not.toBe(generatedCover('Another game'));
  });
});

describe('first live-stream regressions', () => {
  it('marks smoke complete only after passed and marks its own failure', () => {
    const started = new Set(['sandbox_verified', 'file', 'testing']);
    expect(timelineState('testing', started, 'building')).toBe('In progress');
    expect(timelineState('testing', started, 'failed')).toBe('Failed');
    expect(timelineState('shipped', started, 'failed')).toBe('Pending');
    expect(timelineState('testing', new Set([...started, 'passed']), 'shipped')).toBe('Done');
  });
  it('distinguishes missing test browser from a patch failing smoke', () => {
    const launch = "Smoke test failed (1): browserType.launch: Executable doesn't exist at C:/ms-playwright/chrome.exe";
    expect(smokeInfrastructureFailure(launch)).toBe(true);
    expect(publicFailure(launch)).toContain("Couldn't start the test browser");
    expect(smokeInfrastructureFailure('Smoke test failed (1): mutation crashed')).toBe(false);
    expect(publicFailure('Smoke test failed (1): mutation crashed')).toBe('Patch failed its smoke test');
  });
  it('moves a narrow ballot and a misplaced patch clear of protected game regions', () => {
    const patch = clearPlacement({ type: 'patches', x: 0, y: 2, width: 420, height: 430 });
    expect(keepClearZones.every(zone => !overlaps(patch, zone))).toBe(true);
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-narrow-layout-'));
    try {
      const store = new SettingsStore(path.join(folder, 'settings.json'));
      const layout = store.update({ overlayWidgets: [{ type: 'ballot', x: 24, y: 500, width: 501, height: 320 }] }).overlayWidgets[0];
      expect(layout).toMatchObject({ width: 501, height: 700 });
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  });
  it('keeps a migrated narrow ballot clear of the patch card', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-overlap-'));
    try {
      const store = new SettingsStore(path.join(folder, 'settings.json'));
      const widgets = store.update({ overlayWidgets: [
        { type: 'patches', x: 0, y: 2, width: 420, height: 352 },
        { type: 'ballot', x: 24, y: 380, width: 501, height: 320 }
      ] }).overlayWidgets;
      expect(widgets[1].height).toBe(700);
      expect(overlaps(widgets[0], widgets[1])).toBe(false);
      expect(widgets.every(widget => keepClearZones.every(zone => !overlaps(widget, zone)))).toBe(true);
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  });
  it('keeps all four operator widgets clear when the narrow ballot needs three rows', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-full-overlay-'));
    try {
      const file = path.join(folder, 'settings.json');
      fs.writeFileSync(file, JSON.stringify({ overlayWidgets: [
        { type: 'patches', x: 0, y: 2, width: 420, height: 430 },
        { type: 'codex', x: 1546, y: 165, width: 350, height: 590 },
        { type: 'ballot', x: 24, y: 380, width: 501, height: 320 },
        { type: 'ticker', x: 560, y: 998, width: 1336, height: 58 }
      ] }));
      const widgets = new SettingsStore(file).snapshot().overlayWidgets;
      expect(widgets.find(widget => widget.type === 'ballot')?.height).toBe(700);
      for (const [index, widget] of widgets.entries()) {
        expect(widget.width).toBeGreaterThanOrEqual(minimumWidgetSize[widget.type][0]);
        expect(keepClearZones.some(zone => overlaps(widget, zone))).toBe(false);
        expect(widgets.slice(index + 1).some(other => overlaps(widget, other))).toBe(false);
      }
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  });
  it('identifies the account missing new Twitch scopes without a network call', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-old-token-'));
    try {
      const file = path.join(folder, 'tokens.json');
      fs.writeFileSync(file, JSON.stringify({ broadcaster: { accessToken: 'fake', refreshToken: 'fake', userId: 'one', login: 'streamer', scopes: ['channel:manage:redemptions'], expiresAt: Date.now() + 100000, validatedAt: Date.now() } }));
      const auth = new TwitchAuth({ clientId: 'fake', clientSecret: 'fake', redirectUri: 'https://localhost/callback', rewardId: '' }, file);
      expect(auth.reconnectNeeded()).toEqual({ role: 'broadcaster', reason: 'Broadcaster needs new permissions — reconnect' });
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  });
  it('refuses approval with a setup explanation and leaves the idea pending', async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-browser-guard-'));
    try {
      const ideas = new IdeaStore(path.join(folder, 'ideas.json'));
      const idea = ideas.add('viewer', 'Viewer', 'Make coins sparkle', 'chat');
      const replies: string[] = [];
      const pipeline = new ChatPipeline(ideas, { rewardId: '', reply: async message => { replies.push(message); }, canApprove: async () => "Couldn't start the test browser. Open Setup." });
      const result = await pipeline.ingest({ kind: 'chat', origin: 'simulator', id: 'mod-approve', viewer: { id: 'mod', login: 'mod', name: 'Mod', moderator: true, broadcaster: false }, text: `!approve ${idea.id}` });
      expect(result.accepted).toBe(false);
      expect(result.message).toContain("Couldn't start the test browser");
      expect(replies[0]).toContain('Open Setup');
      expect(ideas.list()[0].status).toBe('submitted');
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  });
  it('cancels a prediction and sends setup chat after a simulated missing browser', async () => {
    const calls: string[] = [];
    const predictions = { cancel: async () => { calls.push('cancel'); }, settle: async () => { calls.push('settle'); } };
    const event = { runId: 'run', ideaId: 'idea', type: 'failed', at: new Date().toISOString(), message: "Couldn't start the test browser" } as const;
    await handleRunnerOutcome(event, { failureKind: 'infrastructure', stopReason: 'setup' }, predictions, async message => { calls.push(message); });
    expect(calls).toEqual(['cancel', expect.stringContaining('The idea is still available')]);
  });
  it('still announces the setup problem when Twitch prediction cancellation fails', async () => {
    const notices: string[] = [];
    const event = { runId: 'run', ideaId: 'idea', type: 'failed', at: new Date().toISOString() } as const;
    await expect(handleRunnerOutcome(event, { failureKind: 'infrastructure', stopReason: 'setup' }, { cancel: async () => { throw Error('Twitch unavailable'); }, settle: async () => {} }, async message => { notices.push(message); })).rejects.toThrow('Twitch unavailable');
    expect(notices[0]).toContain('check Setup');
  });
});

describe('Practice demo boundary', () => {
  const practice = { id: 'practice', practice: true };
  it('accepts only an all-Practice approval ballot with live chat disconnected', () => {
    expect(practiceDemoEligible('approval', [practice], practice.id, false)).toBe(true);
    expect(practiceDemoEligible('vote', [practice], practice.id, false)).toBe(false);
    expect(practiceDemoEligible('approval', [practice, { id: 'twitch' }], practice.id, false)).toBe(false);
    expect(practiceDemoEligible('approval', [practice], practice.id, true)).toBe(false);
  });
  it('uses each game demo module title instead of an engine-owned name', () => {
    expect(mutationTitle("export const meta = { id: 'demo', title: 'Demo patch: Fire Rain', author: 'Studio' }; export function onStart() {}"))
      .toBe('Demo patch: Fire Rain');
    expect(mutationTitle("export const meta = { id: 'demo', title: 'Demo patch: Moon Gravity', author: 'Studio' };"))
      .toBe('Demo patch: Moon Gravity');
    expect(mutationTitle("// title: 'Spoofed'\nexport const meta = { id: 'demo', author: 'Studio' };"))
      .toBeNull();
  });
});

it('keeps the Arena Survivor banner below the ship toast in a 1920 × 1080 capture', () => {
  const bannerTop = (bannerY - 11) * 1080 / 648;
  expect(bannerTop).toBeGreaterThan(170);
});
