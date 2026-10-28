export const maxParticles = 64;

// A crowded hit shares one visual budget; later hits get smaller bursts.
export class ParticleBudget {
  private frame = -1;
  private bursts = 0;

  take(frame: number, currentParticles: number, requested: number): number {
    if (this.frame !== frame) { this.frame = frame; this.bursts = 0; }
    const allowance = [8, 5, 3, 2][this.bursts] ?? 0;
    if (allowance === 0) return 0;
    this.bursts++;
    return Math.max(0, Math.min(requested, allowance, maxParticles - currentParticles));
  }
}
