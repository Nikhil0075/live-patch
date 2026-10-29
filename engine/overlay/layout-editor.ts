import type { OverlayWidget, OverlayWidgetType, StudioSettings } from '../studio/settings-defaults';

const labels: Record<OverlayWidgetType, string> = { patches: 'Patch credits', codex: 'Codex progress', ballot: 'Chat ballot', ticker: 'Pitch ticker' };
const sizes: Record<OverlayWidgetType, [number, number]> = { patches: [420, 430], codex: [350, 590], ballot: [1010, 320], ticker: [1336, 58] };
const keepClear = [
  { label: 'Game HUD', x: 0, y: 0, width: 430, height: 165 },
  { label: 'Patch toast', x: 685, y: 60, width: 550, height: 110 }
];
function overlap(a: OverlayWidget, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export async function createLayoutEditor(parent: HTMLElement): Promise<void> {
  const root = document.createElement('section'); root.className = 'live-card overlay-editor';
  root.innerHTML = '<div class="live-card-heading"><h3>OBS overlay layout</h3><a href="/overlay.html" target="_blank" rel="noopener">Open overlay ↗</a></div><p class="hint">Add or remove widgets. Drag to move; drag a corner to resize. Use the fields for precise placement. Changes appear in OBS automatically.</p><div class="overlay-edit-stage" aria-label="Overlay layout preview"></div><div class="overlay-edit-toolbar"><label>Add widget <select id="overlay-add-select"></select></label><button id="overlay-add">Add</button><button id="overlay-reset" class="secondary">Reset layout</button><span id="overlay-edit-status" role="status"></span></div><div class="overlay-edit-list"></div>';
  parent.append(root);
  const stage = root.querySelector<HTMLElement>('.overlay-edit-stage')!;
  const list = root.querySelector<HTMLElement>('.overlay-edit-list')!;
  const select = root.querySelector<HTMLSelectElement>('#overlay-add-select')!;
  const status = root.querySelector<HTMLElement>('#overlay-edit-status')!;
  let widgets = (await fetch('/api/settings').then(r => r.json()) as StudioSettings).overlayWidgets;
  const save = async () => {
    status.textContent = 'Saving…';
    try {
      const response = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overlayWidgets: widgets }) });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      widgets = (await response.json() as StudioSettings).overlayWidgets;
      status.textContent = 'Saved for OBS'; render();
    } catch (error) { status.textContent = `Could not save: ${String(error)}`; }
  };
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(value)));
  function render() {
    stage.replaceChildren(); list.replaceChildren(); select.replaceChildren();
    for (const zone of keepClear) {
      const marker = document.createElement('div'); marker.className = 'overlay-keep-clear'; marker.textContent = `${zone.label} · keep clear`;
      Object.assign(marker.style, { left: `${zone.x / 1920 * 100}%`, top: `${zone.y / 1080 * 100}%`, width: `${zone.width / 1920 * 100}%`, height: `${zone.height / 1080 * 100}%` });
      stage.append(marker);
    }
    const collisions = widgets.flatMap(widget => keepClear.filter(zone => overlap(widget, zone)).map(zone => `${labels[widget.type]} covers ${zone.label}`));
    if (collisions.length) status.textContent = `Warning: ${collisions.join('; ')}. Move it before streaming.`;
    for (const [type, label] of Object.entries(labels) as [OverlayWidgetType, string][]) if (!widgets.some(item => item.type === type)) {
      const option = document.createElement('option'); option.value = type; option.textContent = label; select.append(option);
    }
    const available = select.options.length;
    if (!available) { const option = document.createElement('option'); option.value = ''; option.textContent = 'All widgets added'; select.append(option); }
    root.querySelector<HTMLButtonElement>('#overlay-add')!.disabled = !available;
    for (const widget of widgets) {
      const box = document.createElement('div'); box.className = 'overlay-edit-widget'; box.dataset.type = widget.type;
      box.style.left = `${widget.x / 1920 * 100}%`; box.style.top = `${widget.y / 1080 * 100}%`;
      box.style.width = `${widget.width / 1920 * 100}%`; box.style.height = `${widget.height / 1080 * 100}%`;
      box.textContent = labels[widget.type];
      const grip = document.createElement('span'); grip.className = 'overlay-resize-grip'; grip.setAttribute('aria-hidden', 'true'); box.append(grip); stage.append(box);
      box.addEventListener('pointerdown', event => {
        const resize = event.target === grip;
        const initial = { ...widget }, startX = event.clientX, startY = event.clientY;
        box.setPointerCapture(event.pointerId);
        const move = (next: PointerEvent) => {
          const scaleX = 1920 / stage.getBoundingClientRect().width, scaleY = 1080 / stage.getBoundingClientRect().height;
          if (resize) { widget.width = clamp(initial.width + (next.clientX - startX) * scaleX, 180, 1920 - widget.x); widget.height = clamp(initial.height + (next.clientY - startY) * scaleY, 48, 1080 - widget.y); }
          else { widget.x = clamp(initial.x + (next.clientX - startX) * scaleX, 0, 1920 - widget.width); widget.y = clamp(initial.y + (next.clientY - startY) * scaleY, 0, 1080 - widget.height); }
          box.style.left = `${widget.x / 1920 * 100}%`; box.style.top = `${widget.y / 1080 * 100}%`;
          box.style.width = `${widget.width / 1920 * 100}%`; box.style.height = `${widget.height / 1080 * 100}%`;
        };
        const end = () => { box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', end); void save(); };
        box.addEventListener('pointermove', move); box.addEventListener('pointerup', end, { once: true });
      });
      const row = document.createElement('div'); row.className = 'overlay-edit-row';
      const title = document.createElement('strong'); title.textContent = labels[widget.type]; row.append(title);
      for (const [key, max] of [['x', 1920 - widget.width], ['y', 1080 - widget.height], ['width', 1920 - widget.x], ['height', 1080 - widget.y]] as const) {
        const label = document.createElement('label'); label.textContent = key === 'width' ? 'W' : key === 'height' ? 'H' : key.toUpperCase();
        const input = document.createElement('input'); input.type = 'number'; input.value = String(widget[key]); input.min = String(key === 'width' ? 180 : key === 'height' ? 48 : 0); input.max = String(max); input.setAttribute('aria-label', `${labels[widget.type]} ${key}`);
        input.addEventListener('change', () => { widget[key] = clamp(Number(input.value), Number(input.min), Number(input.max)); if (key === 'width') widget.x = Math.min(widget.x, 1920 - widget.width); if (key === 'height') widget.y = Math.min(widget.y, 1080 - widget.height); void save(); });
        label.append(input); row.append(label);
      }
      const remove = document.createElement('button'); remove.className = 'secondary'; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${labels[widget.type]}`);
      remove.addEventListener('click', () => { widgets = widgets.filter(item => item !== widget); void save(); }); row.append(remove); list.append(row);
    }
  }
  root.querySelector('#overlay-add')!.addEventListener('click', () => { const type = select.value as OverlayWidgetType; if (!type || widgets.some(item => item.type === type)) return; const [width, height] = sizes[type]; widgets.push({ type, x: Math.max(0, 960 - width / 2), y: Math.max(0, 540 - height / 2), width, height }); void save(); });
  root.querySelector('#overlay-reset')!.addEventListener('click', async () => { const { defaultOverlayWidgets } = await import('../studio/settings-defaults'); widgets = defaultOverlayWidgets.map(item => ({ ...item })); void save(); });
  render();
}
