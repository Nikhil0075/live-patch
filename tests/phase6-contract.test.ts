import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { manifestSchema } from '../engine/manifest/schema';
import { keepClearZones, overlaps, minimumWidgetHeight, placeWidget } from '../engine/studio/overlay-placement';
import { SettingsStore } from '../engine/studio/settings';

const game = path.resolve('games/lantern-run');
const manifest = manifestSchema.parse(JSON.parse(fs.readFileSync(path.join(game, 'live-patch.json'), 'utf8')));
const docs = fs.readFileSync(path.join(game, 'docs/mutation-api.md'), 'utf8');

describe('Lantern Run manifest and API documentation', () => {
  it('does not migrate Lantern settings into Arena after a fresh Lantern save', () => {
    const folder = fs.mkdtempSync(path.join(process.cwd(), '.phase6-layout-test-'));
    const file = path.join(folder, 'settings.json');
    try {
      const lantern = new SettingsStore(file, { gameKey: 'games/lantern-run', migrationGameKey: 'games/arena-survivor', defaultLayout: manifest.overlay!.defaultLayout, keepClear: manifest.overlay!.keepClear });
      lantern.update({ muted: true });
      const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as { overlayWidgets?: unknown; overlayLayouts: Record<string, unknown> };
      expect(saved.overlayWidgets).toBeUndefined();
      expect(saved.overlayLayouts['games/arena-survivor']).toBeUndefined();
      const arenaManifest = manifestSchema.parse(JSON.parse(fs.readFileSync(path.resolve('games/arena-survivor/live-patch.json'), 'utf8')));
      const arena = new SettingsStore(file, { gameKey: 'games/arena-survivor', migrationGameKey: 'games/arena-survivor', defaultLayout: arenaManifest.overlay!.defaultLayout, keepClear: arenaManifest.overlay!.keepClear });
      expect(arena.snapshot().overlayWidgets).toEqual(arenaManifest.overlay!.defaultLayout);
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  });

  it('documents exactly the declared mutation actions and hooks', () => {
    const actions = [...docs.matchAll(/^\| `([a-zA-Z]+)\([^`]*\)` \|/gm)].map(match => match[1]).sort();
    const hooks = [...docs.matchAll(/^\| `([a-zA-Z]+)` \| `(on[A-Za-z]+)` \|/gm)].map(match => [match[1], match[2]]);
    expect(actions).toEqual(Object.keys(manifest.actions).sort());
    expect(Object.fromEntries(hooks)).toEqual(manifest.hooks);
  });

  it('has three distinct built-in patches and six runnable fixture sketches', () => {
    const builtIns = fs.readdirSync(path.join(game, 'mutations')).filter(file => file.endsWith('.js'));
    const fixtures = fs.readdirSync(path.join(game, 'tests/fixtures')).filter(file => file.endsWith('.js'));
    expect(builtIns).toHaveLength(3);
    expect(fixtures).toHaveLength(6);
    for (const file of [...builtIns.map(name => path.join(game, 'mutations', name)), ...fixtures.map(name => path.join(game, 'tests/fixtures', name))]) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).toContain('export const meta');
      expect(source).toMatch(/export function on[A-Z]/);
    }
  });

  it('keeps all four default OBS widgets separate from each other and game zones at maximum ballot height', () => {
    const zones = [...keepClearZones, ...(manifest.overlay?.keepClear ?? [])];
    const layout = manifest.overlay?.defaultLayout ?? [];
    expect(layout).toHaveLength(4);
    expect(new Set(layout.map(widget => widget.type)).size).toBe(4);
    const effective = new SettingsStore(path.join(game, 'tests', 'nonexistent-settings.json'), {
      gameKey: 'lantern-run', defaultLayout: layout, keepClear: manifest.overlay?.keepClear
    }).snapshot().overlayWidgets;
    for (const widgets of [layout, effective]) for (const [index, widget] of widgets.entries()) {
      expect(widget.height).toBeGreaterThanOrEqual(minimumWidgetHeight(widget.type, widget.width));
      expect(widget.x + widget.width).toBeLessThanOrEqual(1920);
      expect(widget.y + widget.height).toBeLessThanOrEqual(1080);
      for (const zone of zones) expect(overlaps(widget, zone), `${widget.type} overlaps ${zone.label}`).toBe(false);
      for (const prior of widgets.slice(0, index)) expect(overlaps(widget, prior), `${widget.type} overlaps ${prior.type}`).toBe(false);
    }
  });

  it('does not shrink a narrow stacked ballot below its readable height', () => {
    const ballot = { type: 'ballot' as const, x: 24, y: 380, width: 500, height: 700 };
    const placed = placeWidget(ballot, [], [...keepClearZones, ...(manifest.overlay?.keepClear ?? [])]);
    expect(placed.height).toBeGreaterThanOrEqual(700);
  });
});
