import type { OverlayWidget, OverlayWidgetType } from './settings-defaults';

export const minimumWidgetSize: Record<OverlayWidgetType, readonly [number, number]> = {
  patches: [300, 180], codex: [300, 260], ballot: [500, 320], ticker: [500, 58]
};
export function minimumWidgetHeight(type: OverlayWidgetType, width: number): number {
  return type === 'ballot' && width < 800 ? 700 : minimumWidgetSize[type][1];
}
export const keepClearZones = [
  { label: 'Game HUD', x: 0, y: 0, width: 430, height: 165 },
  { label: 'Patch toast', x: 685, y: 60, width: 550, height: 110 }
] as const;
export function overlaps(a: OverlayWidget, b: { x: number; y: number; width: number; height: number }): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
export function clearPlacement(widget: OverlayWidget): OverlayWidget {
  const result = { ...widget };
  for (const zone of keepClearZones) {
    if (!overlaps(result, zone)) continue;
    const below = zone.y + zone.height;
    const right = zone.x + zone.width;
    if (below + result.height <= 1080) result.y = below;
    else if (right + result.width <= 1920) result.x = right;
    else result.y = Math.max(0, zone.y - result.height);
  }
  return result;
}
