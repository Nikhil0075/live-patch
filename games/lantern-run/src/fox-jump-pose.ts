export function jumpLegPose(vy: number, index: number): { upper: number; lower: number } {
  if (vy < 0) return index === 0 ? { upper: 52, lower: -8 } : { upper: 32, lower: 18 };
  return index === 0 ? { upper: 24, lower: 8 } : { upper: 38, lower: -4 };
}
