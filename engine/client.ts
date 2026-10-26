import './style.css';
import type { GameAdapter, GameEvent } from './game-api';
import { MutationHost, type MutationFile } from './mutation/host';

let host: MutationHost | undefined;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main><header><div><p class="eyebrow">LIVE PATCH / PHASE ONE</p><h1>ARENA SURVIVOR</h1></div><div id="status">Connecting…</div></header><div class="layout"><section><div id="game"></div><p class="hint">Move with WASD or arrow keys · Collect coins · Avoid enemies</p></section><aside><h2>Active patches</h2><ul id="mutations"></ul><p id="notice" role="status"></p><p class="aside-note">Add or remove a .js file in the game's mutations folder to change this run live.</p></aside></div></main>`;

async function start() {
  const info = await fetch('/api/game').then(r => r.json()) as { name: string; entry: string; reload: { type: 'websocket'; url: string } };
  const module = await import(/* @vite-ignore */ info.entry) as { createGame: (element: HTMLElement, emit: (event: GameEvent) => void) => GameAdapter };
  let dispatch = (_event: GameEvent) => {};
  const game = module.createGame(document.querySelector('#game')!, event => dispatch(event));
  host = new MutationHost(game, document.querySelector('#mutations')!, document.querySelector('#notice')!);
  dispatch = event => host?.emit(event);
  const files = await fetch('/api/mutations').then(r => r.json()) as MutationFile[];
  const selected = new URLSearchParams(location.search).get('mutation');
  host.sync(selected ? files.filter(file => file.name === selected) : files);
  if (info.reload.type === 'websocket') {
    const socket = new WebSocket(info.reload.url);
    socket.addEventListener('message', event => {
      const changed = JSON.parse(event.data) as MutationFile[];
      host?.sync(selected ? changed.filter(file => file.name === selected) : changed);
    });
    socket.addEventListener('close', () => { document.querySelector('#notice')!.textContent = 'Patch connection lost. Refresh to reconnect.'; });
  }
  document.querySelector('#status')!.textContent = info.name + ' · LIVE';
  (window as Window & { __livePatch?: { game: GameAdapter; host: MutationHost } }).__livePatch = { game, host };
}
start().catch(error => { document.querySelector('#status')!.textContent = `Startup failed: ${error}`; console.error(error); });
