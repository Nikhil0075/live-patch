import { describe, expect, it } from 'vitest';
import { maxParticles, ParticleBudget } from '../games/arena-survivor/src/particle-budget';

describe('crowded attack particle budget', () => {
  it('limits 28 kills in one frame, then allows a fresh burst next frame', () => {
    const budget = new ParticleBudget();
    let particles = 0;
    const counts = Array.from({ length: 28 }, () => {
      const count = budget.take(7, particles, 8);
      particles += count;
      return count;
    });
    expect(counts.slice(0, 4)).toEqual([8, 5, 3, 2]);
    expect(counts.slice(4)).toEqual(Array(24).fill(0));
    expect(particles).toBeLessThan(maxParticles);
    expect(budget.take(8, particles, 8)).toBe(8);
  });

  it('never exceeds the total cap, even when a burst requests more', () => {
    const budget = new ParticleBudget();
    expect(budget.take(1, maxParticles - 2, 100)).toBe(2);
    expect(budget.take(1, maxParticles, 8)).toBe(0);
  });
});
