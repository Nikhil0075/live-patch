export const CLIFF_WIDTH = 70;
export const CLIFF_HEIGHT = 142;

export function cliffTopY(ground: number): number { return ground - 1; }

export function pitWallsVisible(left: number, right: number, viewportWidth: number): boolean {
  return right - left > 1 && right >= -CLIFF_WIDTH && left <= viewportWidth + CLIFF_WIDTH;
}

export function cliffCentreY(ground: number): number {
  return cliffTopY(ground) + CLIFF_HEIGHT / 2;
}

export function visibleGroundRects(spans: ReadonlyArray<{ from: number; to: number }>, distancePx: number, viewportWidth: number): { x: number; width: number }[] {
  return spans.flatMap(span => {
    const left = Math.max(0, span.from - distancePx);
    const right = Math.min(viewportWidth, span.to - distancePx);
    return right > left ? [{ x: left, width: right - left }] : [];
  });
}
