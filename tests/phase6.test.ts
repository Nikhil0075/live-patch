import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { manifestSchema } from '../engine/manifest/schema';
import { SettingsStore } from '../engine/studio/settings';
import { keepClearZones, overlaps } from '../engine/studio/overlay-placement';

const arena = manifestSchema.parse(JSON.parse(fs.readFileSync(path.resolve('games/arena-survivor/live-patch.json'), 'utf8')));

describe('Phase 6 platform manifest', () => {
  it('validates game-specific pitches and overlay rectangles', () => {
    expect(arena.samplePitches).toHaveLength(3);
    expect(arena.overlay?.keepClear?.[0].label).toBe('Game HUD');
    expect(arena.overlay?.defaultLayout).toHaveLength(4);
    expect(manifestSchema.safeParse({ ...arena, samplePitches: ['one'] }).success).toBe(false);
    expect(manifestSchema.safeParse({ ...arena, overlay: { keepClear: Array(7).fill({ label: 'too many', x: 0, y: 0, width: 1, height: 1 }) } }).success).toBe(false);
  });

  it('migrates a saved layout to the default game while another game starts', () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-layout-migrate-'));
    try {
      const file = path.join(folder, 'settings.json');
      const saved = [{ type: 'ballot' as const, x: 24, y: 500, width: 600, height: 700 }];
      fs.writeFileSync(file, JSON.stringify({ musicVolume: .31, overlayWidgets: saved }));
      const otherLayout = [{ type: 'ticker' as const, x: 560, y: 1004, width: 1336, height: 58 }];
      const other = new SettingsStore(file, { gameKey: 'games/other-game', migrationGameKey: 'games/arena-survivor', defaultLayout: otherLayout });
      expect(other.snapshot().overlayWidgets).toEqual(otherLayout);
      const migrated = JSON.parse(fs.readFileSync(file, 'utf8')) as { musicVolume: number; overlayLayouts: Record<string, typeof saved> };
      expect(migrated.musicVolume).toBe(.31);
      expect(migrated.overlayLayouts['games/arena-survivor']).toEqual(saved);
      other.update({ overlayWidgets: [{ type: 'ticker', x: 500, y: 1004, width: 1336, height: 58 }] });
      const current = new SettingsStore(file, { gameKey: 'games/arena-survivor', defaultLayout: arena.overlay!.defaultLayout!, keepClear: arena.overlay!.keepClear });
      expect(current.snapshot().overlayWidgets[0]).toMatchObject({ type: 'ballot', width: 600, height: 700 });
      expect(current.snapshot().overlayWidgets.every(widget => [...keepClearZones, ...arena.overlay!.keepClear!].every(zone => !overlaps(widget, zone)))).toBe(true);
      expect((JSON.parse(fs.readFileSync(file, 'utf8')) as typeof migrated).overlayLayouts['games/other-game']).toHaveLength(1);
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  });
});
