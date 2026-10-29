export type OverlayWidgetType = 'patches' | 'codex' | 'ballot' | 'ticker';
export interface OverlayWidget { type: OverlayWidgetType; x: number; y: number; width: number; height: number }
export const defaultOverlayWidgets: OverlayWidget[] = [
  { type: 'patches', x: 24, y: 180, width: 420, height: 430 },
  { type: 'codex', x: 1546, y: 165, width: 350, height: 590 },
  { type: 'ballot', x: 24, y: 650, width: 1010, height: 320 },
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
