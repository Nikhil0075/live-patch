export const STICK_GRIP_X = 13;
export const STICK_GRIP_Y = -2.4;

export function stickLineYAtGrip(): number {
  const sourceX = (STICK_GRIP_X + 3) / 68 * 72;
  const sourceY = 20 + (sourceX - 3) * (8 - 20) / (49 - 3);
  return -8 - 23 / 2 + sourceY / 22 * 23;
}
