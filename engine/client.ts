import './style.css';
import type { GameAdapter, GameEvent } from './game-api';
import type { GameManifest } from './manifest/schema';
import { MutationHost, type MutationFile } from './mutation/host';

let host: MutationHost | undefined;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main><header><div><p class="eyebrow">LIVE PATCH / GAME</p><h1 id="game-title"></h1></div><div id="status">Connecting…</div></header><div class="layout"><section><div id="game"></div><button id="enable-sound" class="secondary">Click to enable sound ♪</button><p class="hint" id="game-hint"></p></section><aside><h2>Active patches</h2><ul id="mutations"></ul><p id="notice" role="status"></p><p class="aside-note">Every shipped viewer idea becomes a patch in this run.</p><a href="/?view=practice">Practice with chat →</a><br><a href="/?view=go-live">Open stream controls →</a></aside></div></main>`;

async function start() {
  const params = new URLSearchParams(location.search);
  const comparison = params.get('compare');
  const info = await fetch(comparison ? `/api/compare/game?id=${encodeURIComponent(comparison)}` : '/api/game').then(r => r.json()) as GameManifest & { entry: string };
  const settings = await fetch('/api/settings').then(r => r.json()).catch(() => ({}));
  document.querySelector('#game-title')!.textContent = info.name.toUpperCase();
  document.querySelector('#game-hint')!.textContent = info.hint;
  const module = await import(/* @vite-ignore */ info.entry) as { createGame: (element: HTMLElement, emit: (event: GameEvent) => void, options?: unknown) => GameAdapter };
  let dispatch = (_event: GameEvent) => {};
  const game = module.createGame(document.querySelector('#game')!, event => dispatch(event), { manifest: info, settings });
  let lastVoteBucket = -1;
  window.setInterval(async () => {
    try {
      const round = await fetch('/api/round').then(response => response.json()) as { phase: string; remainingMs: number | null };
      if (round.phase !== 'vote' || round.remainingMs === null) { lastVoteBucket = -1; return; }
      const bucket = Math.floor(round.remainingMs / 10_000);
      if (bucket !== lastVoteBucket) { lastVoteBucket = bucket; game.apply({ type: 'systemEvent', args: ['vote-tick'] }, 'system'); }
    } catch { /* a server restart may briefly interrupt the clock */ }
  }, 1000);
  document.querySelector('#enable-sound')!.addEventListener('click', () => { game.enableSound?.(); document.querySelector('#enable-sound')!.textContent = 'Sound enabled ♪'; });
  host = new MutationHost(game, info, document.querySelector('#mutations')!, document.querySelector('#notice')!);
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
    import.meta.hot?.on('live-patch:runner', (event: { type: string }) => {
      if (['shipped', 'failed', 'rolled_back'].includes(event.type)) game.apply({ type: 'systemEvent', args: [event.type] }, 'system');
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
