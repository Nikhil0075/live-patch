import { describe, expect, it } from 'vitest';
import { CLIFF_WIDTH, cliffCentreY, cliffTopY, pitWallsVisible, visibleGroundRects } from '../games/lantern-run/src/ground-visibility';
import { jumpLegPose } from '../games/lantern-run/src/fox-jump-pose';

describe('Lantern Run edge geometry', () => {
  it('keeps pit walls until their outer edges leave either side of the viewport', () => {
    const width = 1152, gap = 120;
    expect(pitWallsVisible(-gap - 52, -52, width)).toBe(true);
    expect(pitWallsVisible(-gap - CLIFF_WIDTH - 1, -CLIFF_WIDTH - 1, width)).toBe(false);
    expect(pitWallsVisible(width + 52, width + gap + 52, width)).toBe(true);
    expect(pitWallsVisible(width + CLIFF_WIDTH + 1, width + gap + CLIFF_WIDTH + 1, width)).toBe(false);
    expect(cliffCentreY(518) - 71).toBe(cliffTopY(518));
    expect(cliffTopY(518)).toBe(517);
  });

  it('masks the ground strip through each visible pit', () => {
    expect(visibleGroundRects([{ from: 0, to: 400 }, { from: 520, to: 900 }], 100, 700)).toEqual([
      { x: 0, width: 300 }, { x: 420, width: 280 }
    ]);
  });

  it('trails both paws behind the fox through a jump', () => {
    for (const vy of [-200, 120]) for (const index of [0, 1]) {
      const pose = jumpLegPose(vy, index);
      expect(pose.upper).toBeGreaterThan(0);
      expect(pose.upper + pose.lower).toBeGreaterThan(0);
    }
  });
});
