import { describe, expect, it } from 'vitest';
import { CLIFF_WIDTH, cliffCentreY, pitWallsVisible } from '../games/lantern-run/src/ground-visibility';
import { LEDGE_SPAWN_OFFSET, MAX_SPAWN_OFFSET, OBSTACLE_SPAWN_OFFSET, OWL_SPAWN_OFFSET } from '../games/lantern-run/src/generator';
import { STICK_GRIP_Y, stickLineYAtGrip } from '../games/lantern-run/src/fox-grip';

describe('Lantern Run edge geometry', () => {
  it('keeps pit walls until their outer edges leave either side of the viewport', () => {
    const width = 1152, gap = 120;
    expect(pitWallsVisible(-gap - 52, -52, width)).toBe(true);
    expect(pitWallsVisible(-gap - CLIFF_WIDTH - 1, -CLIFF_WIDTH - 1, width)).toBe(false);
    expect(pitWallsVisible(width + 52, width + gap + 52, width)).toBe(true);
    expect(pitWallsVisible(width + CLIFF_WIDTH + 1, width + gap + CLIFF_WIDTH + 1, width)).toBe(false);
    expect(cliffCentreY(518) - 71).toBe(517);
  });

  it('derives the despawn offset from all generated placements', () => {
    expect(MAX_SPAWN_OFFSET).toBe(Math.max(OWL_SPAWN_OFFSET, LEDGE_SPAWN_OFFSET, OBSTACLE_SPAWN_OFFSET));
    expect(MAX_SPAWN_OFFSET).toBeGreaterThanOrEqual(OWL_SPAWN_OFFSET);
  });

  it('puts the holding paw around the branch, within two unscaled pixels', () => {
    expect(Math.abs(STICK_GRIP_Y - stickLineYAtGrip())).toBeLessThan(2);
  });
});
