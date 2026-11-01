export const CLIFF_WIDTH = 70;
export const CLIFF_HEIGHT = 142;

export function pitWallsVisible(left: number, right: number, viewportWidth: number): boolean {
  return right - left > 1 && right >= -CLIFF_WIDTH && left <= viewportWidth + CLIFF_WIDTH;
}

export function cliffCentreY(ground: number): number {
  return ground - 1 + CLIFF_HEIGHT / 2;
}
