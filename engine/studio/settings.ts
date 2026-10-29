import fs from 'node:fs';
import path from 'node:path';
import { defaultOverlayWidgets, type OverlayWidget, type StudioSettings } from './settings-defaults';
export { defaultSettings, defaultOverlayWidgets } from './settings-defaults';
export type { StudioSettings, OverlayWidget } from './settings-defaults';
const clamp = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export class SettingsStore {
  private settings: StudioSettings;
  constructor(private file: string) {
    let input: Partial<StudioSettings> = {};
    if (fs.existsSync(file)) try { input = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<StudioSettings>; } catch { /* restore safe defaults */ }
    this.settings = this.normalize(input);
  }
  snapshot(): StudioSettings { return { ...this.settings, overlayWidgets: this.settings.overlayWidgets.map(widget => ({ ...widget })) }; }
  update(input: Partial<StudioSettings>): StudioSettings {
    this.settings = this.normalize({ ...this.settings, ...input });
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.settings, null, 2), { mode: 0o600 });
    fs.renameSync(temp, this.file);
    return this.snapshot();
  }
  private normalize(input: Partial<StudioSettings>): StudioSettings {
    const types = new Set(['patches', 'codex', 'ballot', 'ticker']);
    const seen = new Set<string>();
    const source = Array.isArray(input.overlayWidgets) ? input.overlayWidgets : defaultOverlayWidgets;
    const overlayWidgets: OverlayWidget[] = [];
    for (const item of source) {
      if (!item || typeof item !== 'object' || !types.has(item.type) || seen.has(item.type)) continue;
      seen.add(item.type);
      const width = clamp(item.width, 350, 180, 1920);
      const height = clamp(item.height, 200, 48, 1080);
      overlayWidgets.push({ type: item.type, width, height, x: clamp(item.x, 0, 0, 1920 - width), y: clamp(item.y, 0, 0, 1080 - height) });
    }
    return {
      pitchSeconds: clamp(input.pitchSeconds, 60, 15, 600), voteSeconds: clamp(input.voteSeconds, 45, 10, 300),
      masterVolume: clamp(input.masterVolume, 1, 0, 1), musicVolume: clamp(input.musicVolume, .25, 0, 1), effectsVolume: clamp(input.effectsVolume, .7, 0, 1),
      muted: input.muted === true, effectsIntensity: clamp(input.effectsIntensity, 1, 0, 1), reduceFlashing: input.reduceFlashing === true, overlayCompact: input.overlayCompact === true,
      hudSize: ['small', 'normal', 'large'].includes(input.hudSize ?? '') ? input.hudSize! : 'normal', overlayWidgets
    };
  }
}
