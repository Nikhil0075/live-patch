import fs from 'node:fs';
import path from 'node:path';

export interface StudioSettings {
  pitchSeconds: number; voteSeconds: number;
  masterVolume: number; musicVolume: number; effectsVolume: number; muted: boolean;
  effectsIntensity: number; reduceFlashing: boolean; overlayCompact: boolean;
}
export const defaultSettings: StudioSettings = { pitchSeconds: 60, voteSeconds: 45, masterVolume: 1, musicVolume: .25, effectsVolume: .7, muted: false, effectsIntensity: 1, reduceFlashing: false, overlayCompact: false };
const clamp = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
export class SettingsStore {
  private settings: StudioSettings;
  constructor(private file: string) {
    let input: Partial<StudioSettings> = {};
    if (fs.existsSync(file)) try { input = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<StudioSettings>; } catch { /* restore safe defaults */ }
    this.settings = this.normalize(input);
  }
  snapshot(): StudioSettings { return { ...this.settings }; }
  update(input: Partial<StudioSettings>): StudioSettings {
    this.settings = this.normalize({ ...this.settings, ...input });
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.settings, null, 2), { mode: 0o600 });
    fs.renameSync(temp, this.file);
    return this.snapshot();
  }
  private normalize(input: Partial<StudioSettings>): StudioSettings {
    return {
      pitchSeconds: clamp(input.pitchSeconds, 60, 15, 600), voteSeconds: clamp(input.voteSeconds, 45, 10, 300),
      masterVolume: clamp(input.masterVolume, 1, 0, 1), musicVolume: clamp(input.musicVolume, .25, 0, 1), effectsVolume: clamp(input.effectsVolume, .7, 0, 1),
      muted: input.muted === true, effectsIntensity: clamp(input.effectsIntensity, 1, 0, 1), reduceFlashing: input.reduceFlashing === true, overlayCompact: input.overlayCompact === true
    };
  }
}
