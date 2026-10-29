import type { GameAdapter } from './game-api';
import type { GameManifest } from './manifest/schema';
import type { MutationHost } from './mutation/host';
import type { StudioSettings } from './studio/settings-defaults';

export function createPlayMenu(game: GameAdapter, host: MutationHost, manifest: GameManifest, initialSettings: StudioSettings) {
  let settings = initialSettings;
  let paused = false;
  let current = 'resume';
  const shell = document.querySelector<HTMLElement>('#play-shell')!;
  const menu = document.querySelector<HTMLElement>('#play-menu')!;
  const panel = document.querySelector<HTMLElement>('#menu-panel')!;
  const sound = document.querySelector<HTMLButtonElement>('#enable-sound')!;
  const hint = document.querySelector<HTMLElement>('#key-hint')!;
  let hintTimer: number;
  let keyboardLock = false;

  function showTools() {
    shell.classList.remove('stream-clean');
    clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => { if (!paused) shell.classList.add('stream-clean'); }, 3000);
  }
  async function save(next: Partial<StudioSettings>) {
    settings = { ...settings, ...next };
    game.configure?.(settings);
    sound.querySelector('span')!.textContent = settings.muted ? '♪̸' : '♪';
    sound.setAttribute('aria-label', settings.muted ? 'Unmute' : 'Mute');
    const response = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
    if (!response.ok) document.querySelector('#notice')!.textContent = 'Sound or accessibility setting was not saved. Try again.';
  }
  function toggleMute() { void save({ muted: !settings.muted }); }
  function close() {
    paused = false; menu.hidden = true; shell.classList.remove('is-paused');
    host.setPaused(false); game.resume?.(); showTools();
    document.querySelector<HTMLButtonElement>('#menu-button')!.focus();
  }
  function open() {
    paused = true; game.pause?.(); host.setPaused(true);
    menu.hidden = false; shell.classList.add('is-paused'); shell.classList.remove('stream-clean');
    render('resume');
    document.querySelector<HTMLButtonElement>('#resume-button')!.focus();
  }
  function toggle() { if (paused) close(); else open(); }
  function text(tag: string, content: string) { const element = document.createElement(tag); element.textContent = content; panel.append(element); return element; }
  function render(tab: string) {
    current = tab; panel.replaceChildren();
    for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('#menu-tabs button'))) button.classList.toggle('selected', button.dataset.tab === tab);
    if (tab === 'resume') { text('h2', 'Ready when you are'); text('p', 'Your game is paused. The chat round and votes continue.'); const button = text('button', 'Resume game'); button.addEventListener('click', close); }
    if (tab === 'patches') {
      text('h2', 'Patches in this run');
      const entries = host.entries(); if (!entries.length) text('p', 'No patches yet. Viewers can pitch one in Practice or live chat.');
      for (const item of entries) { const card = text('article', ''); card.className = 'menu-patch'; const icon = document.createElement('span'); icon.className = 'menu-patch-icon'; icon.textContent = '✦'; const body = document.createElement('div'); const title = document.createElement('strong'); title.textContent = item.title; const credit = document.createElement('small'); credit.textContent = `@${item.author}`; const description = document.createElement('p'); description.textContent = item.reason ?? item.description; body.append(title, credit, description); const state = document.createElement('div'); state.className = 'menu-patch-state'; const pill = document.createElement('b'); pill.textContent = item.status; const age = document.createElement('small'); age.textContent = item.startedAt ? `active ${Math.max(0,Math.floor((Date.now()-item.startedAt)/60000))} min` : 'starting'; state.append(pill, age); card.append(icon, body, state); }
    }
    if (tab === 'controls') { text('h2', 'Controls'); const header = text('div', ''); header.className = 'menu-control menu-control-head'; for (const label of ['ACTION', 'KEY']) { const heading = document.createElement('strong'); heading.textContent = label; header.append(heading); } for (const control of manifest.controls ?? []) { const row = text('div', ''); row.className = 'menu-control'; const action = document.createElement('strong'); action.textContent = control.action; const keys = document.createElement('span'); for (const key of control.keys) { const cap = document.createElement('kbd'); cap.textContent = key; keys.append(cap); } row.append(action, keys); } }
    if (tab === 'sound') { text('h2', 'Sound'); for (const [key, label] of [['masterVolume','Master'],['musicVolume','Music'],['effectsVolume','Effects']] as const) { const wrapper = text('label', label); const input = document.createElement('input'); input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '.01'; input.value = String(settings[key]); input.setAttribute('aria-label', `${label} volume`); const percent = document.createElement('output'); percent.textContent = `${Math.round(settings[key] * 100)}%`; input.addEventListener('input', () => { percent.textContent = `${Math.round(Number(input.value) * 100)}%`; }); input.addEventListener('change', () => { void save({ [key]: Number(input.value) }); }); wrapper.append(input, percent); } const mute = text('button', settings.muted ? 'Sound OFF' : 'Sound ON'); mute.setAttribute('role', 'switch'); mute.setAttribute('aria-checked', String(!settings.muted)); mute.addEventListener('click', () => { toggleMute(); render('sound'); }); }
    if (tab === 'accessibility') { text('h2', 'Accessibility'); const wrapper = text('label', 'Reduce flashing and shake'); const check = document.createElement('input'); check.type = 'checkbox'; check.checked = settings.reduceFlashing; check.addEventListener('change', () => { void save({ reduceFlashing: check.checked }); }); wrapper.prepend(check); const hud = text('label', 'HUD size'); const select = document.createElement('select'); select.setAttribute('aria-label','HUD size'); for (const [value,label] of [['small','Small'],['normal','Normal'],['large','Large']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option); } select.value = settings.hudSize; select.addEventListener('change', () => { void save({ hudSize: select.value as StudioSettings['hudSize'] }); shell.dataset.hudSize = select.value; }); hud.append(select); }
  }
  document.querySelector('#menu-tabs')!.addEventListener('click', event => { const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-tab]'); if (!target) return; if (target.dataset.tab === 'resume') close(); else render(target.dataset.tab!); });
  document.querySelector('#menu-close')!.addEventListener('click', close);
  document.querySelector('#back-to-studio')!.addEventListener('click', () => {
    if (window.opener && !window.opener.closed) { window.opener.focus(); return; }
    if (window.confirm('Opening Studio here will end this game run and change the OBS capture window. Continue?')) location.href = '/';
  });
  document.querySelector('#menu-button')!.addEventListener('click', toggle);
  sound.addEventListener('click', () => { game.enableSound?.(); toggleMute(); });
  document.querySelector('#fullscreen')!.addEventListener('click', () => { void fullScreen(); });
  async function fullScreen() {
    if (document.fullscreenElement) { await document.exitFullscreen(); return; }
    try { await shell.requestFullscreen({ navigationUI: 'hide' });
      const keyboard = (navigator as Navigator & { keyboard?: { lock: (keys?: string[]) => Promise<void>; unlock: () => void } }).keyboard;
      if (keyboard?.lock) { try { await keyboard.lock(['Escape']); keyboardLock = true; } catch { keyboardLock = false; } }
      if (!keyboardLock && !sessionStorage.getItem('live-patch:escape-hint')) { hint.textContent = 'Your browser uses Esc to leave full screen. Press P for the menu.'; hint.classList.add('persistent'); sessionStorage.setItem('live-patch:escape-hint','1'); }
    } catch { document.querySelector('#notice')!.textContent = 'Full screen was unavailable. Try the corner button again.'; }
  }
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) { keyboardLock = false; (navigator as Navigator & { keyboard?: { unlock: () => void } }).keyboard?.unlock?.(); hint.classList.remove('persistent'); hint.textContent = 'Esc Menu · F Full screen · M Mute'; } });
  window.addEventListener('keydown', event => {
    const tag = (event.target as HTMLElement).tagName;
    if (['INPUT','SELECT','TEXTAREA'].includes(tag)) return;
    if (event.key === 'Escape') { if (document.fullscreenElement && !keyboardLock) return; event.preventDefault(); toggle(); }
    if (event.key.toLowerCase() === 'p') { event.preventDefault(); toggle(); }
    if (event.key.toLowerCase() === 'm') { event.preventDefault(); toggleMute(); }
    if (event.key.toLowerCase() === 'f') { event.preventDefault(); void fullScreen(); }
    if (paused && event.key === 'Tab') { const focusables = Array.from(menu.querySelectorAll<HTMLElement>('button,a,input,select')).filter(item => item.getBoundingClientRect().width > 0); const index = focusables.indexOf(document.activeElement as HTMLElement); if (event.shiftKey && index === 0) { event.preventDefault(); focusables.at(-1)?.focus(); } else if (!event.shiftKey && index === focusables.length - 1) { event.preventDefault(); focusables[0]?.focus(); } }
    if (['Escape', 'Tab', 'p', 'P', 'm', 'M', 'f', 'F'].includes(event.key)) showTools();
  });
  shell.addEventListener('mousemove', showTools);
  shell.dataset.hudSize = settings.hudSize;
  showTools();
  return { open, close, isPaused: () => paused, currentTab: () => current };
}
