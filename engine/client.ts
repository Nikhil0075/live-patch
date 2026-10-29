import './style.css';
import './play.css';
import type { GameAdapter, GameEvent } from './game-api';
import type { GameManifest } from './manifest/schema';
import { MutationHost, type MutationFile } from './mutation/host';
import { createPlayMenu } from './play-menu';
import type { StudioSettings } from './studio/settings-defaults';

let host: MutationHost | undefined;
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `<main class="play-shell" id="play-shell"><div id="game"></div><div class="play-top"><div class="play-title"><strong id="game-title">Loading game…</strong><span id="status">Connecting…</span></div><div class="play-tools"><button id="enable-sound" class="play-tool" aria-label="Sound" title="Enable sound or mute · M"><span>♪</span><small>Mute (M)</small></button><button id="fullscreen" class="play-tool" aria-label="Full screen" title="Full screen · F"><span>⛶</span><small>Full screen (F)</small></button><button id="menu-button" class="play-tool" aria-label="Menu" title="Pause menu · Esc or P"><span>☰</span><small>Menu (Esc)</small></button></div></div><p id="play-only-label" hidden>Play-only build</p><div id="play-toast" role="status" aria-live="polite"></div><div id="key-hint"><kbd>Esc</kbd> Menu · <kbd>F</kbd> Full screen · <kbd>M</kbd> Mute</div><p id="game-hint" class="sr-only"></p><div id="play-menu" class="play-menu" role="dialog" aria-modal="true" aria-label="Pause menu" hidden><div class="menu-card"><div class="menu-head"><div><p>LIVE PATCH</p><h1>PAUSED</h1><small>The game is paused. Chat rounds keep running.</small></div><button id="menu-close" class="secondary" aria-label="Close menu">✕</button></div><div class="menu-body"><nav id="menu-tabs" aria-label="Pause menu sections"><button data-tab="resume" id="resume-button">▶ Resume</button><button data-tab="patches">✦ Active patches</button><button data-tab="controls">⌘ Controls</button><button data-tab="sound">♪ Sound</button><button data-tab="accessibility">◉ Accessibility</button><button id="back-to-studio" type="button">↗ Back to studio</button></nav><section id="menu-panel" aria-live="polite"></section></div><div class="menu-hints"><span><kbd>Esc</kbd> Resume</span><span><kbd>Tab</kbd> Switch section</span><span><kbd>Enter</kbd> Select</span><span><kbd>P</kbd> Menu</span></div></div></div><ul id="mutations" hidden></ul><p id="notice" class="sr-only" role="status"></p></main>`;

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
      try { const bitmap = await (game.captureFrame?.() ?? createImageBitmap(canvas)); if (bitmap) { mirror.postMessage({ type: 'frame', bitmap }); bitmap.close(); } } catch { /* mirror is optional */ }
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
  function showPlayToast(message: string) {
    const toast = document.querySelector<HTMLElement>('#play-toast')!; toast.textContent = message;
    setTimeout(() => { if (toast.textContent === message) toast.textContent = ''; }, 5000);
  }
  async function shippedToast(runId?: string) {
    const [history, mutations, ideas] = await Promise.all([
      fetch('/api/runs').then(r => r.json()) as Promise<{ runs: { id: string; ideaId: string; status: string; demo?: boolean; mutationName?: string; finishedAt?: string }[] }>,
      fetch('/api/mutations').then(r => r.json()) as Promise<MutationFile[]>,
      fetch('/api/ideas').then(r => r.json()) as Promise<{ ideas: { id: string; authorName: string; contributors?: string[] }[] }>
    ]);
    const run = runId ? history.runs.find(item => item.id === runId) : history.runs.at(-1);
    if (!run || run.status !== 'shipped') return;
    const source = mutations.find(item => item.name === run.mutationName)?.source ?? '';
    const title = /title\s*:\s*['"`]([^'"`]{1,80})/.exec(source)?.[1] ?? 'New patch';
    const idea = ideas.ideas.find(item => item.id === run.ideaId);
    const credit = run.demo ? '@Live Patch Demo' : idea?.contributors?.map(name => `@${name}`).join(', ') ?? (idea ? `@${idea.authorName}` : '@viewer');
    sessionStorage.setItem('live-patch:last-toast', run.id);
    showPlayToast(`${run.demo ? '' : 'New patch: '}${title} — by ${credit}`);
  }
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
    import.meta.hot?.on('live-patch:runner', (event: { type: string; runId?: string }) => {
      if (['shipped', 'failed', 'rolled_back'].includes(event.type)) game.apply({ type: 'systemEvent', args: [event.type] }, 'system');
      if (event.type === 'shipped') void shippedToast(event.runId).catch(() => showPlayToast('New patch shipped'));
      else if (event.type === 'rolled_back') showPlayToast('Patch rolled back');
      else if (event.type === 'failed') showPlayToast('Patch failed safely');
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
  if (!comparison && !selected && !params.has('original')) {
    try {
      const recent = await fetch('/api/runs').then(r => r.json()) as { runs: { id: string; status: string; demo?: boolean; mutationName?: string; finishedAt?: string }[] };
      const latest = recent.runs.at(-1);
      if (latest?.status === 'shipped' && latest.finishedAt && Date.now() - Date.parse(latest.finishedAt) < 90_000 && sessionStorage.getItem('live-patch:last-toast') !== latest.id) {
        await shippedToast(latest.id);
      }
    } catch { /* the game remains playable if run history is unavailable */ }
  }
  document.querySelector('#status')!.textContent = info.name + ' · LIVE';
  (window as Window & { __livePatch?: { game: GameAdapter; host: MutationHost } }).__livePatch = { game, host };
}
start().catch(error => { document.querySelector('#status')!.textContent = `Startup failed: ${error}`; console.error(error); });
