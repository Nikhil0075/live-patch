import './style.css';
import type { GameAdapter, GameEvent } from './game-api';
import type { GameManifest } from './manifest/schema';
import { MutationHost, type MutationFile } from './mutation/host';

let host: MutationHost | undefined;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main><header><div><p class="eyebrow">LIVE PATCH / PHASE ONE</p><h1 id="game-title"></h1></div><div id="status">Connecting…</div></header><div class="layout"><section><div id="game"></div><p class="hint" id="game-hint"></p></section><aside><h2>Active patches</h2><ul id="mutations"></ul><p id="notice" role="status"></p><p class="aside-note">Add or remove a .js file in the game's mutations folder to change this run live.</p></aside></div></main>`;

async function start() {
  const info = await fetch('/api/game').then(r => r.json()) as GameManifest & { entry: string };
  document.querySelector('#game-title')!.textContent = info.name.toUpperCase();
  document.querySelector('#game-hint')!.textContent = info.hint;
  const module = await import(/* @vite-ignore */ info.entry) as { createGame: (element: HTMLElement, emit: (event: GameEvent) => void) => GameAdapter };
  let dispatch = (_event: GameEvent) => {};
  const game = module.createGame(document.querySelector('#game')!, event => dispatch(event));
  host = new MutationHost(game, info, document.querySelector('#mutations')!, document.querySelector('#notice')!);
  dispatch = event => host?.emit(event);
  const selected = new URLSearchParams(location.search).get('mutation');
  let version = 0;
  const sync = async () => {
    const current = ++version;
    const files = await fetch('/api/mutations').then(r => r.json()) as MutationFile[];
    if (current === version) host?.sync(selected ? files.filter(file => file.name === selected) : files);
  };
  if (info.reload.type === 'websocket') {
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
