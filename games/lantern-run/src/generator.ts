export interface RunningAbility { speed: number; jumpPower: number; gravity: number }
export interface Stretch { groundLength: number; gap: number; hazard: 'log' | 'thorns' | 'boulder' | 'owl' | 'none'; pickup: 'firefly' | 'acorn'; ledge: boolean }
export const GENERATION_LEAD = 500;
export const MAX_GAP = 150;
export const OWL_SPAWN_OFFSET = 350;
export const LEDGE_SPAWN_OFFSET = 350;
export const OBSTACLE_SPAWN_OFFSET = 220;
export const MAX_SPAWN_OFFSET = Math.max(OWL_SPAWN_OFFSET, LEDGE_SPAWN_OFFSET, OBSTACLE_SPAWN_OFFSET);
export const DESPAWN_MARGIN = 100;

function random(seed: number): number {
  let value = (seed ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x85ebca6b);
  value = Math.imul(value ^ value >>> 13, 0xc2b2ae35);
  return ((value ^ value >>> 16) >>> 0) / 0x100000000;
}

export function jumpReach(ability: RunningAbility): number {
  return ability.speed * 2 * ability.jumpPower / ability.gravity;
}

export function owlFlightHeight(seed: number, index: number): number { return 518 - [140, 165, 190][Math.abs(seed + index) % 3]; }
export function owlFlightY(base: number, seconds: number, phase: number): number { return base + Math.sin(seconds * 2.4 + phase) * 11; }

export function generateStretch(seed: number, index: number, ability: RunningAbility): Stretch {
  const roll = random(seed + index * 7919);
  const reach = jumpReach(ability);
  const margin = Math.min(36, reach * .2);
  const maxGap = Math.max(0, Math.min(MAX_GAP, Math.floor(reach - margin)));
  const gap = index < 2 ? 0 : Math.min(maxGap, Math.floor((40 + roll * 110) * Math.min(1, reach / 190)));
  const hazardRoll = random(seed * 31 + index * 151);
  const hazard: Stretch['hazard'] = index < 2 ? 'none' : hazardRoll < .22 ? 'log' : hazardRoll < .4 ? 'thorns' : hazardRoll < .54 ? 'boulder' : hazardRoll < .65 ? 'owl' : 'none';
  return { groundLength: 520 + Math.floor(random(seed + index * 631) * 260), gap, hazard,
    pickup: random(seed + index * 173) < .12 ? 'acorn' : 'firefly', ledge: index > 1 && random(seed + index * 277) < .28 };
}

export function stretchIsClearable(stretch: Stretch, ability: RunningAbility): boolean {
  return stretch.gap + Math.min(36, jumpReach(ability) * .2) <= jumpReach(ability) && stretch.groundLength >= 500;
}
