import fs from 'node:fs';
import path from 'node:path';
import { defaultOverlayWidgets, type OverlayWidget, type StudioSettings } from './settings-defaults';
import { clearPlacement, keepClearZones, minimumWidgetHeight, minimumWidgetSize, placeWidget, type KeepClearZone } from './overlay-placement';
const previousDefaultWidgets: OverlayWidget[] = [
  { type: 'patches', x: 24, y: 120, width: 1080, height: 110 },
  { type: 'codex', x: 1546, y: 165, width: 350, height: 590 },
  { type: 'ballot', x: 24, y: 725, width: 1010, height: 235 },
  { type: 'ticker', x: 560, y: 998, width: 1336, height: 58 }
];
function isPreviousDefault(value: unknown): boolean {
  return Array.isArray(value) && value.length === previousDefaultWidgets.length && previousDefaultWidgets.every((expected, index) => {
    const item = value[index] as OverlayWidget;
    return item?.type === expected.type && item.x === expected.x && item.y === expected.y && item.width === expected.width && item.height === expected.height;
  });
}
export { defaultSettings, defaultOverlayWidgets } from './settings-defaults';
export type { StudioSettings, OverlayWidget } from './settings-defaults';
const clamp = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export interface SettingsGameOptions {
  gameKey?: string;
  migrationGameKey?: string;
  defaultLayout?: OverlayWidget[];
  keepClear?: readonly KeepClearZone[];
}
export class SettingsStore {
  private settings: StudioSettings;
  private layouts: Record<string, OverlayWidget[]>;
  private readonly gameKey: string;
  private readonly defaultLayout: OverlayWidget[];
  private readonly zones: readonly KeepClearZone[];
  constructor(private file: string, options: SettingsGameOptions = {}) {
    this.gameKey = options.gameKey ?? 'default';
    this.defaultLayout = options.defaultLayout ?? defaultOverlayWidgets;
    this.zones = [...keepClearZones, ...(options.keepClear ?? [])];
    let input: Partial<StudioSettings> & { overlayLayouts?: Record<string, OverlayWidget[]> } = {};
    if (fs.existsSync(file)) try { input = JSON.parse(fs.readFileSync(file, 'utf8')) as typeof input; } catch { /* restore safe defaults */ }
    this.layouts = input.overlayLayouts && typeof input.overlayLayouts === 'object' && !Array.isArray(input.overlayLayouts) ? { ...input.overlayLayouts } : {};
    const migrationKey = options.migrationGameKey ?? this.gameKey;
    if (!Object.hasOwn(input, 'overlayLayouts') && Array.isArray(input.overlayWidgets) && !this.layouts[migrationKey]) {
      this.layouts[migrationKey] = input.overlayWidgets;
      const { overlayWidgets: _legacy, ...saved } = input;
      fs.writeFileSync(file, JSON.stringify({ ...saved, overlayLayouts: this.layouts }, null, 2), { mode: 0o600 });
    }
    this.settings = this.normalize({ ...input, overlayWidgets: this.layouts[this.gameKey] ?? this.defaultLayout });
  }
  snapshot(): StudioSettings { return { ...this.settings, overlayWidgets: this.settings.overlayWidgets.map(widget => ({ ...widget })) }; }
  update(input: Partial<StudioSettings>): StudioSettings {
    this.settings = this.normalize({ ...this.settings, ...input });
    if (input.overlayWidgets) this.layouts[this.gameKey] = this.settings.overlayWidgets;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    const { overlayWidgets: _active, ...globalSettings } = this.settings;
    fs.writeFileSync(temp, JSON.stringify({ ...globalSettings, overlayLayouts: this.layouts }, null, 2), { mode: 0o600 });
    fs.renameSync(temp, this.file);
    return this.snapshot();
  }
  private normalize(input: Partial<StudioSettings>): StudioSettings {
    const types = new Set(['patches', 'codex', 'ballot', 'ticker']);
    const seen = new Set<string>();
    const source = Array.isArray(input.overlayWidgets) && !isPreviousDefault(input.overlayWidgets) ? input.overlayWidgets : this.defaultLayout;
    const overlayWidgets: OverlayWidget[] = [];
    for (const item of source) {
      if (!item || typeof item !== 'object' || !types.has(item.type) || seen.has(item.type)) continue;
      seen.add(item.type);
      const [minWidth, minHeight] = minimumWidgetSize[item.type];
      const width = clamp(item.width, 350, minWidth, 1920);
      const height = clamp(item.height, 200, Math.max(minHeight, minimumWidgetHeight(item.type, width)), 1080);
      overlayWidgets.push(placeWidget(clearPlacement({ type: item.type, width, height, x: clamp(item.x, 0, 0, 1920 - width), y: clamp(item.y, 0, 0, 1080 - height) }, this.zones), overlayWidgets, this.zones));
    }
    return {
      pitchSeconds: clamp(input.pitchSeconds, 60, 15, 600), voteSeconds: clamp(input.voteSeconds, 45, 10, 300),
      masterVolume: clamp(input.masterVolume, 1, 0, 1), musicVolume: clamp(input.musicVolume, .25, 0, 1), effectsVolume: clamp(input.effectsVolume, .7, 0, 1),
      muted: input.muted === true, effectsIntensity: clamp(input.effectsIntensity, 1, 0, 1), reduceFlashing: input.reduceFlashing === true, overlayCompact: input.overlayCompact === true,
      hudSize: ['small', 'normal', 'large'].includes(input.hudSize ?? '') ? input.hudSize! : 'normal', overlayWidgets
    };
  }
}
