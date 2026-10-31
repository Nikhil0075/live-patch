export type OverlayWidgetType = 'patches' | 'codex' | 'ballot' | 'ticker';
export interface OverlayWidget { type: OverlayWidgetType; x: number; y: number; width: number; height: number }
export const defaultOverlayWidgets: OverlayWidget[] = [
  { type: 'patches', x: 24, y: 180, width: 380, height: 300 },
  { type: 'codex', x: 1516, y: 180, width: 380, height: 300 },
  { type: 'ballot', x: 560, y: 650, width: 800, height: 320 },
  { type: 'ticker', x: 560, y: 998, width: 1336, height: 58 }
];
export interface StudioSettings {
  pitchSeconds: number; voteSeconds: number;
  masterVolume: number; musicVolume: number; effectsVolume: number; muted: boolean;
  effectsIntensity: number; reduceFlashing: boolean; overlayCompact: boolean;
  hudSize: 'small' | 'normal' | 'large';
  overlayWidgets: OverlayWidget[];
}

export const defaultSettings: StudioSettings = { pitchSeconds: 60, voteSeconds: 45, masterVolume: 1, musicVolume: .25, effectsVolume: .7, muted: false, effectsIntensity: 1, reduceFlashing: false, overlayCompact: false, hudSize: 'normal', overlayWidgets: defaultOverlayWidgets };
