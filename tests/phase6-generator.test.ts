import { describe, expect, it } from 'vitest';
import { generateStretch, jumpReach, owlFlightHeight, owlFlightY, stretchIsClearable } from '../games/lantern-run/src/generator';
import { advanceFoxFlight } from '../games/lantern-run/src/physics';

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
  it('glides generated owls at seeded safe heights', () => {
    const heights = new Set<number>();
    for (let seed = 0; seed < 250; seed++) {
      const base = owlFlightHeight(seed, 5);
      heights.add(base);
      for (const seconds of [0, .4, .8, 1.2]) expect(owlFlightY(base, seconds, seed % 19)).toBeLessThan(425);
      expect(owlFlightY(base, 0, 0)).not.toBe(owlFlightY(base, 1, 0));
    }
    expect(heights.size).toBe(3);
  });
  it('leaves room to land after every generated gap before an owl reaches the fox', () => {
    const dt = 1 / 60, speed = 260;
    for (let seed = 0; seed < 250; seed++) for (let index = 2; index < 30; index++) {
      const stretch = generateStretch(seed, index, { speed, jumpPower: 720, gravity: 1600 });
      if (stretch.hazard !== 'owl') continue;
      for (const wavePhase of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        let fox = { y: 480, vy: -720, jumpLift: 0 };
        let landed = false;
        for (let step = 1; step < 120; step++) {
          const time = step * dt, foxX = speed * time;
          fox = advanceFoxFlight(fox, dt, 1600, time < .16, false);
          if (foxX >= stretch.gap && fox.y + 38 >= 518 && fox.vy >= 0) { fox = { y: 480, vy: 0, jumpLift: fox.jumpLift }; landed = true; }
          const owlX = stretch.gap + 350 - 24 * time;
          const owlY = owlFlightY(owlFlightHeight(seed, index), time, wavePhase);
          if (Math.abs(owlX - foxX) < 49) {
            expect(landed, `seed ${seed}, stretch ${index}, phase ${wavePhase}`).toBe(true);
            expect(Math.abs(owlY - fox.y), `seed ${seed}, stretch ${index}, phase ${wavePhase}`).toBeGreaterThan(55);
          }
        }
      }
    }
  });
  it('a held jump clears generated gaps and reaches the generated ledge across 250 seeds', () => {
    const dt = 1 / 60;
    for (let seed = 0; seed < 250; seed++) for (let index = 2; index < 30; index++) {
      const stretch = generateStretch(seed, index, { speed: 260, jumpPower: 720, gravity: 1600 });
      let state = { y: 518 - 38, vy: -720, jumpLift: 0 };
      let crossedGap = false, reachedLedge = false;
      let x = 0;
      for (let step = 0; step < 90; step++) {
        const previous = state;
        state = advanceFoxFlight(state, dt, 1600, step * dt < .16, false);
        x += 260 * dt;
        if (x >= stretch.gap && state.y + 38 <= 518) crossedGap = true;
        if (previous.y + 38 <= 347 && state.y + 38 >= 347 && state.vy >= 0) reachedLedge = true;
      }
      expect(crossedGap, `seed ${seed}, stretch ${index}, gap ${stretch.gap}`).toBe(true);
      if (stretch.ledge) expect(reachedLedge, `seed ${seed}, stretch ${index} ledge`).toBe(true);
      expect(stretch.groundLength - 220).toBeGreaterThan(260 * .8);
    }
  });
});
