export const STICK_GRIP_X = 13;
export const STICK_GRIP_Y = -2.4;
export const STICK_TEXTURE_WIDTH = 72;
export const STICK_TEXTURE_HEIGHT = 22;
export const STICK_DISPLAY_WIDTH = 68;
export const STICK_DISPLAY_HEIGHT = 23;
export const STICK_DRAW_X = 31;
export const STICK_DRAW_Y = -8;
export const STICK_LINE = { x1: 3, y1: 20, x2: 49, y2: 8 } as const;

export function stickLineYAt(pawX: number, imageX: number, imageY: number, displayWidth: number, displayHeight: number): number {
  const sourceX = (pawX - imageX + displayWidth / 2) / displayWidth * STICK_TEXTURE_WIDTH;
  const sourceY = STICK_LINE.y1 + (sourceX - STICK_LINE.x1) * (STICK_LINE.y2 - STICK_LINE.y1) / (STICK_LINE.x2 - STICK_LINE.x1);
  return imageY - displayHeight / 2 + sourceY / STICK_TEXTURE_HEIGHT * displayHeight;
}

export function stickLineYAtGrip(): number {
  return stickLineYAt(STICK_GRIP_X, STICK_DRAW_X, STICK_DRAW_Y, STICK_DISPLAY_WIDTH, STICK_DISPLAY_HEIGHT);
}
