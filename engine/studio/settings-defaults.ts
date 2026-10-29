export interface StudioSettings {
  pitchSeconds: number; voteSeconds: number;
  masterVolume: number; musicVolume: number; effectsVolume: number; muted: boolean;
  effectsIntensity: number; reduceFlashing: boolean; overlayCompact: boolean;
  hudSize: 'small' | 'normal' | 'large';
}

export const defaultSettings: StudioSettings = { pitchSeconds: 60, voteSeconds: 45, masterVolume: 1, musicVolume: .25, effectsVolume: .7, muted: false, effectsIntensity: 1, reduceFlashing: false, overlayCompact: false, hudSize: 'normal' };
