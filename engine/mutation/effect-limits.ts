import type { GameAction } from '../game-api';
import type { GameManifest } from '../manifest/schema';

export class EffectLimits {
  private times = new Map<string, number[]>();
  constructor(private manifest: GameManifest, private now: () => number = Date.now) {}
  allow(action: GameAction, origin: string): boolean {
    if (!['playSound', 'burst', 'shake', 'flash'].includes(action.type)) return true;
    const name = action.args[0];
    if (action.type === 'playSound' && (typeof name !== 'string' || !this.manifest.audio?.includes(name))) return false;
    if (action.type === 'burst' && (typeof name !== 'string' || !this.manifest.effects?.includes(name))) return false;
    const max = action.type === 'playSound' ? 4 : action.type === 'burst' ? 8 : action.type === 'shake' ? 1 : 3;
    const key = `${origin}:${action.type}`;
    if (!this.reserve(key, max)) return false;
    if (action.type === 'flash' && !this.reserve('global:flash', 3)) return false;
    if (action.type === 'shake' && !this.reserve('global:shake', 1)) return false;
    return true;
  }
  private reserve(key: string, limit: number): boolean {
    const now = this.now();
    const recent = (this.times.get(key) ?? []).filter(time => now - time < 1000);
    if (recent.length >= limit) { this.times.set(key, recent); return false; }
    recent.push(now); this.times.set(key, recent); return true;
  }
}
