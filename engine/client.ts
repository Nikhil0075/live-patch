import './style.css';
import './play.css';
import type { GameAdapter, GameEvent } from './game-api';
import type { GameManifest } from './manifest/schema';
import { MutationHost, type MutationFile } from './mutation/host';
import { createPlayMenu } from './play-menu';
import type { StudioSettings } from './studio/settings-defaults';

let host: MutationHost | undefined;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main class="play-shell" id="play-shell"><div id="game"></div><div class="play-top"><div class="play-title"><strong id="game-title">Loading game…</strong><span id="status">Connecting…</span></div><div class="play-tools"><button id="enable-sound" class="play-tool" aria-label="Sound" title="Enable sound or mute · M">♪</button><button id="fullscreen" class="play-tool" aria-label="Full screen" title="Full screen · F">⛶</button><button id="menu-button" class="play-tool" aria-label="Menu" title="Pause menu · Esc or P">☰</button></div></div><p id="play-only-label" hidden>Play-only build</p><div id="play-toast" role="status" aria-live="polite"></div><div id="key-hint">Esc Menu · F Full screen · M Mute</div><p id="game-hint" class="sr-only"></p><div id="play-menu" class="play-menu" role="dialog" aria-modal="true" aria-label="Pause menu" hidden><div class="menu-card"><div class="menu-head"><div><p>LIVE PATCH</p><h1>Paused</h1><small>The game is paused. Chat rounds keep running.</small></div><button id="menu-close" class="secondary" aria-label="Close menu">✕</button></div><div class="menu-body"><nav id="menu-tabs" aria-label="Pause menu sections"><button data-tab="resume" id="resume-button">Resume</button><button data-tab="patches">Patches</button><button data-tab="controls">Controls</button><button data-tab="sound">Sound</button><button data-tab="accessibility">Accessibility</button><a href="/">Back to studio</a></nav><section id="menu-panel" aria-live="polite"></section></div></div></div><ul id="mutations" hidden></ul><p id="notice" class="sr-only" role="status"></p></main>`;

async function start() {
  const params = new URLSearchParams(location.search);
  const comparison = params.get('compare');
  const info = await fetch(comparison ? `/api/compare/game?id=${encodeURIComponent(comparison)}` : '/api/game').then(r => r.json()) as GameManifest & { entry: string };
  const settings = await fetch('/api/settings').then(r => r.json()).catch(() => ({})) as StudioSettings;
  document.title = `Live Patch · ${info.name}`;
  document.querySelector('#game-title')!.textContent = info.name;
  document.querySelector('#game-hint')!.textContent = info.hint;
  const module = await import(/* @vite-ignore */ info.entry) as { createGame: (element: HTMLElement, emit: (event: GameEvent) => void, options?: unknown) => GameAdapter };
  let dispatch = (_event: GameEvent) => {};
  const game = module.createGame(document.querySelector('#game')!, event => dispatch(event), { manifest: info, settings });
  if (!comparison && 'BroadcastChannel' in window) {
    const mirror = new BroadcastChannel('live-patch-play-mirror');
    let capturing = false;
    const mirrorTimer = window.setInterval(async () => {
      if (capturing) return;
      const canvas = document.querySelector<HTMLCanvasElement>('#game canvas'); if (!canvas) return;
      capturing = true;
      try { const bitmap = await createImageBitmap(canvas); mirror.postMessage({ type: 'frame', bitmap }); bitmap.close(); } catch { /* mirror is optional */ }
      finally { capturing = false; }
    }, 1000);
    window.addEventListener('beforeunload', () => { clearInterval(mirrorTimer); mirror.close(); });
  }
  let lastVoteBucket = -1;
  window.setInterval(async () => {
    try {
      const round = await fetch('/api/round').then(response => response.json()) as { phase: string; remainingMs: number | null };
      if (round.phase !== 'vote' || round.remainingMs === null) { lastVoteBucket = -1; return; }
      const bucket = Math.floor(round.remainingMs / 10_000);
      if (bucket !== lastVoteBucket) { lastVoteBucket = bucket; game.apply({ type: 'systemEvent', args: ['vote-tick'] }, 'system'); }
    } catch { /* a server restart may briefly interrupt the clock */ }
  }, 1000);
  host = new MutationHost(game, info, document.querySelector('#mutations')!, document.querySelector('#notice')!);
  createPlayMenu(game, host, info, settings);
  if (comparison || (await fetch('/api/library').then(r => r.json()).catch(() => ({})) as { playOnly?: boolean }).playOnly) document.querySelector<HTMLElement>('#play-only-label')!.hidden = false;
  dispatch = event => host?.emit(event);
  const selected = params.get('mutation');
  let version = 0;
  const sync = async () => {
    const current = ++version;
    const files = await fetch(comparison ? `/api/compare/mutations?id=${encodeURIComponent(comparison)}` : '/api/mutations').then(r => r.json()) as MutationFile[];
    if (current === version) host?.sync(params.has('original') ? [] : selected ? files.filter(file => file.name === selected) : files);
  };
  if (!comparison && info.reload.type === 'websocket') {
    import.meta.hot?.on('live-patch:chat', (message: { text: string; author: string }) => {
      host?.emit({ type: 'chat', text: message.text, author: message.author });
    });
    import.meta.hot?.on('live-patch:settings', (value: unknown) => game.configure?.(value));
    import.meta.hot?.on('live-patch:runner', (event: { type: string; author?: string }) => {
      if (['shipped', 'failed', 'rolled_back'].includes(event.type)) game.apply({ type: 'systemEvent', args: [event.type] }, 'system');
      const message = event.type === 'shipped' ? `Patch shipped${event.author ? ` — by @${event.author}` : ''}` : event.type === 'rolled_back' ? 'Patch rolled back' : event.type === 'failed' ? 'Patch failed safely' : '';
      if (message) { const toast = document.querySelector<HTMLElement>('#play-toast')!; toast.textContent = message; setTimeout(() => { if (toast.textContent === message) toast.textContent = ''; }, 5000); }
    });
    import.meta.hot?.on('live-patch:round', (round: { phase: string }) => {
      if (round.phase === 'pitch') game.apply({ type: 'systemEvent', args: ['round-start'] }, 'system');
    });
    import.meta.hot?.on(info.reload.event, (changed: MutationFile[]) => {
      version++;
      host?.sync(selected ? changed.filter(file => file.name === selected) : changed);
    });
    import.meta.hot?.on('vite:ws:connect', () => { void sync().then(() => { document.querySelector('#status')!.textContent = info.name + ' · LIVE'; }); });
    import.meta.hot?.on('vite:ws:disconnect', () => { document.querySelector('#status')!.textContent = info.name + ' · RECONNECTING'; });
  }
  await sync();
  document.querySelector('#status')!.textContent = info.name + ' · LIVE';
  (window as Window & { __livePatch?: { game: GameAdapter; host: MutationHost } }).__livePatch = { game, host };
}
start().catch(error => { document.querySelector('#status')!.textContent = `Startup failed: ${error}`; console.error(error); });
