import { describe, expect, it } from 'vitest';
import { generateStretch, jumpReach, stretchIsClearable } from '../games/lantern-run/src/generator';

describe('Lantern Run generator fairness', () => {
  it('makes every stretch clearable across 250 seeds at default parameters', () => {
    const ability = { speed: 260, jumpPower: 720, gravity: 1600 };
    for (let seed = 0; seed < 250; seed++) {
      for (let index = 0; index < 30; index++) {
        const stretch = generateStretch(seed, index, ability);
        expect(stretchIsClearable(stretch, ability), `seed ${seed}, stretch ${index}`).toBe(true);
        expect(stretch.gap).toBeLessThan(jumpReach(ability));
      }
    }
  });

  it('closes gaps when jump reach is reduced', () => {
    const limited = { speed: 120, jumpPower: 300, gravity: 2400 };
    for (let seed = 0; seed < 250; seed++) {
      const stretch = generateStretch(seed, 10, limited);
      expect(stretchIsClearable(stretch, limited)).toBe(true);
    }
  });
});
