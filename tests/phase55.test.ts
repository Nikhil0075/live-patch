import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SettingsStore } from '../engine/studio/settings';
import { generatedCover } from '../engine/manifest/cover-art';
import { practiceDemoEligible } from '../engine/twitch/practice-demo';
import { mutationTitle } from '../engine/mutation/metadata';
import { bannerY } from '../games/arena-survivor/src/layout';

const css = fs.readFileSync(path.resolve('engine/tokens.css'), 'utf8');
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
      expect(saved).toEqual([{ type: 'ballot', x: 1120, y: 780, width: 800, height: 300 }]);
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
