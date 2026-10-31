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

export function placeWidget(widget: OverlayWidget, placed: OverlayWidget[]): OverlayWidget {
  const blocked = [...keepClearZones, ...placed];
  const find = (size: OverlayWidget): OverlayWidget | undefined => {
  const maxX = 1920 - size.width, maxY = 1080 - size.height;
  const xs = new Set([Math.min(size.x, maxX), 0, maxX]);
  const ys = new Set([Math.min(size.y, maxY), 0, maxY]);
  for (const item of blocked) {
    xs.add(Math.max(0, Math.min(maxX, item.x + item.width)));
    xs.add(Math.max(0, Math.min(maxX, item.x - size.width)));
    ys.add(Math.max(0, Math.min(maxY, item.y + item.height)));
    ys.add(Math.max(0, Math.min(maxY, item.y - size.height)));
  }
  const candidates = [...xs].flatMap(x => [...ys].map(y => ({ ...size, x, y })));
  candidates.sort((a, b) => Math.abs(a.x - size.x) + Math.abs(a.y - size.y) - Math.abs(b.x - size.x) - Math.abs(b.y - size.y));
  return candidates.find(candidate => blocked.every(item => !overlaps(candidate, item)));
  };
  const full = find(widget);
  if (full) return full;
  const [minimumWidth, minimumHeight] = minimumWidgetSize[widget.type];
  const widths = new Set([minimumWidth, ...blocked.flatMap(item => [item.x, 1920 - item.x - item.width])]);
  for (const width of [...widths].filter(value => value >= minimumWidth && value < widget.width && widget.height >= minimumWidgetHeight(widget.type, value)).sort((a, b) => b - a)) {
    const resized = find({ ...widget, width });
    if (resized) return resized;
  }
  const heights = new Set([Math.max(minimumHeight, minimumWidgetHeight(widget.type, widget.width)), ...blocked.flatMap(item => [item.y, 1080 - item.y - item.height])]);
  for (const height of [...heights].filter(value => value >= minimumHeight && value < widget.height).sort((a, b) => b - a)) {
    const resized = find({ ...widget, height });
    if (resized) return resized;
  }
  return widget;
}
