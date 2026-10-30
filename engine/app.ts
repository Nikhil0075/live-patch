import './app.css';
import './studio.css';
import { terms } from './terms';
declare const __LIVE_PATCH_TEST_SERVER__: boolean;

type View = 'home' | 'practice' | 'go-live' | 'library' | 'builds' | 'setup' | 'settings';
const labels: Record<View, string> = { home: 'Home', practice: 'Practice', 'go-live': 'Go Live', library: 'Library', builds: 'Builds', setup: 'Setup', settings: 'Settings' };
const lineIcons: Record<View, string> = { home: 'M3 10.5 12 3l9 7.5V21h-6v-7H9v7H3z', practice: 'M7 4v16l13-8z', 'go-live': 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5v8m-4-4h8', library: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z', builds: 'M4 3h12l4 4v14H4zM16 3v5h4M8 12h8M8 16h8', setup: 'M12 2l9 9-9 11-9-11z' } as Record<View, string>;
const desired = new URLSearchParams(location.search).get('view');
const view: View = desired && Object.hasOwn(labels, desired) ? desired as View : 'home';
export function openPlay() { window.open('/play', 'live-patch-play', 'popup=yes,width=1280,height=720,resizable=yes,scrollbars=yes'); }
function toast(message: string) {
  const layer = document.querySelector('#toast-layer'); if (!layer) return;
  const item = document.createElement('div'); item.className = 'toast'; item.textContent = message;
  layer.append(item); setTimeout(() => item.remove(), 5000);
}
if (location.pathname === '/play') {
  document.title = 'Live Patch · Game';
  document.querySelector<HTMLDivElement>('#shell')!.innerHTML = '<div id="app"></div>';
  void import('./client');
} else {
const shell = document.querySelector<HTMLDivElement>('#shell')!;
shell.innerHTML = '<aside class="app-rail"><a class="app-mark" href="/" aria-label="Live Patch Home"><span class="mark-icon">✳</span><span>Live Patch</span></a><button id="rail-toggle" class="secondary" aria-label="Collapse sidebar">☰</button><nav id="app-nav" aria-label="Main navigation"></nav><div class="rail-setup"><p>SETUP</p><a href="/?view=setup#codex"><span id="dot-codex" class="setup-dot"></span>Codex</a><a href="/?view=setup#twitch"><span id="dot-twitch" class="setup-dot"></span>Twitch</a><a href="/?view=setup#obs"><span id="dot-obs" class="setup-dot"></span>OBS</a></div><a class="rail-settings" href="/?view=settings">⚙ Settings</a><div class="rail-foot"><span class="live-dot"></span><span>LOCAL STUDIO</span></div></aside><div class="app-content"><header class="app-top"><label class="top-search"><span>⌕</span><input id="studio-search" type="search" placeholder="Search patches, ideas, builds, settings" aria-label="Search studio"><kbd>Ctrl K</kbd></label><div class="top-actions"><span id="app-connection">Checking connections…</span><span id="codex-connection">Codex checking…</span><a class="button secondary" href="/overlay.html" target="_blank" rel="noopener">OBS ↗</a><nav id="mode-switch" aria-label="Practice or Live view"><a href="/?view=practice" data-mode="practice">Practice</a><a href="/?view=go-live" data-mode="live">Live</a></nav><button id="top-play" class="secondary">Play ↗</button><a class="button primary" href="/?view=go-live">Go Live</a></div></header><div class="page-heading"><p class="app-kicker">LIVE PATCH STUDIO</p><h1 id="app-heading"></h1><p id="app-description"></p><button id="glossary-open" class="secondary" aria-label="Help with Live Patch terms" title="Help with Live Patch terms">?</button></div><div id="app-page"></div><div id="toast-layer" role="status" aria-live="polite"></div></div>';
const glossary = document.createElement('dialog'); glossary.className = 'glossary-dialog'; glossary.innerHTML = '<form method="dialog"><button class="secondary">Close</button></form><h2>Words used in Live Patch</h2>';
for (const [term, definition] of Object.entries(terms)) { const row = document.createElement('p'); const label = document.createElement('strong'); label.textContent = `${term}: `; row.append(label, document.createTextNode(definition)); glossary.append(row); }
document.body.append(glossary);
document.querySelector('#glossary-open')!.addEventListener('click', () => glossary.showModal());
document.querySelector('#top-play')!.addEventListener('click', openPlay);
const rail = document.querySelector<HTMLElement>('.app-rail')!;
rail.classList.toggle('collapsed', localStorage.getItem('live-patch:rail-collapsed') === '1');
document.querySelector('#rail-toggle')!.addEventListener('click', () => { rail.classList.toggle('collapsed'); localStorage.setItem('live-patch:rail-collapsed', rail.classList.contains('collapsed') ? '1' : '0'); });
document.querySelector<HTMLInputElement>('#studio-search')!.addEventListener('keydown', event => { if (event.key !== 'Enter') return; const term = (event.currentTarget as HTMLInputElement).value.toLowerCase(); const target = term.includes('patch') || term.includes('idea') ? 'practice' : term.includes('build') ? 'builds' : term.includes('setting') ? 'settings' : term.includes('game') ? 'library' : ''; if (target) location.href = `/?view=${target}`; else toast('Search patches, ideas, builds, settings or games.'); });
window.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector<HTMLInputElement>('#studio-search')?.focus(); } });
const nav = document.querySelector<HTMLElement>('#app-nav')!;
const studioLabel = document.createElement('p'); studioLabel.className = 'nav-group-label'; studioLabel.textContent = 'STUDIO'; nav.before(studioLabel);
for (const item of ['home', 'practice', 'go-live', 'library', 'builds'] as View[]) {
  const link = document.createElement('a'); link.href = item === 'home' ? '/' : `/?view=${item}`;
  link.className = item === view ? 'selected' : '';
  link.setAttribute('aria-current', item === view ? 'page' : 'false');
  const icon = document.createElement('span'); icon.className = 'nav-icon';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '22'); svg.setAttribute('height', '22'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
  const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path'); shape.setAttribute('d', lineIcons[item]); svg.append(shape); icon.append(svg);
  const name = document.createElement('span'); name.textContent = labels[item]; link.append(icon, name); nav.append(link);
}
document.querySelector('#app-heading')!.textContent = labels[view];
document.querySelector('#app-description')!.textContent = ({home:'Your game, connections and next step at a glance.',practice:'Try a round with sample viewers. Nothing is sent to Twitch.', 'go-live':'Run your stream, follow chat and ship patches.',library:'Choose the game that chat will change.',builds:'Return to a game saved from an earlier stream.',setup:'Connect the tools you want to use.',settings:'Tune your game and studio.'} as Record<View,string>)[view];
document.querySelector<HTMLAnchorElement>(`#mode-switch [data-mode="${view === 'go-live' ? 'live' : 'practice'}"]`)?.setAttribute('aria-current', 'page');
const page = document.querySelector<HTMLElement>('#app-page')!;

async function summary() {
  try {
    const [game, twitch, runs, builds, library] = await Promise.all([
      fetch('/api/game').then(r => r.json()) as Promise<{ name: string }>,
      fetch('/api/twitch/status').then(r => r.json()) as Promise<{ configured: boolean; broadcaster: { login: string } | null; bot: { login: string } | null; eventsub: string; reconnect?: { role: 'broadcaster' | 'bot'; reason: string }; authIssue?: string }>,
      fetch('/api/runs').then(r => r.json()) as Promise<{ runs: { status: string; mutationName?: string; demo?: boolean }[] }>,
      fetch('/api/builds').then(r => r.json()) as Promise<{ builds: { id: string }[] }>,
      fetch('/api/library').then(r => r.json()) as Promise<{ playOnly: boolean; returnGame?: string; active: string; games: { directory: string; cover?: string; name: string }[] }>
    ]);
    if (library.playOnly && library.returnGame && !document.querySelector('#play-only-banner')) {
      const banner = document.createElement('div'); banner.id = 'play-only-banner'; banner.className = 'first-run-callout';
      const label = document.createElement('span'); label.textContent = 'Playing a saved build · This snapshot is play-only. Return to the original game to keep building.';
      const button = document.createElement('button'); button.textContent = 'Return to original game';
      button.addEventListener('click', async () => {
        button.disabled = true;
        await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'active', directory: library.returnGame }) });
        location.href = '/';
      });
      banner.append(label, button); page.prepend(banner);
    }
    document.querySelector('#app-connection')!.textContent = twitch.reconnect?.reason ?? (twitch.broadcaster && twitch.bot ? `● Twitch chat ${twitch.eventsub.startsWith('connected') ? 'connected' : 'disconnected'}` : '○ Practice ready');
    const liveButton = document.querySelector<HTMLAnchorElement>('.top-actions > a.button.primary')!;
    liveButton.textContent = twitch.reconnect ? 'Reconnect Twitch' : 'Go Live';
    liveButton.href = twitch.reconnect ? `/api/twitch/auth/${twitch.reconnect.role}/start` : '/?view=go-live';
    document.querySelector('#dot-twitch')?.classList.toggle('ready', Boolean(twitch.broadcaster && twitch.bot));
    const set = (id: string, value: string) => { const element = document.querySelector(id); if (element) element.textContent = value; };
    set('#home-game', game.name);
    const art = document.querySelector<HTMLElement>('.game-art');
    const activeCover = (library.games.find(item => item.directory === library.active) ?? library.games.find(item => item.name === game.name))?.cover;
    if (art && activeCover) { const image = document.createElement('img'); image.src = activeCover; image.alt = ''; art.replaceChildren(image); }
    set('#home-twitch', twitch.broadcaster && twitch.bot ? `${twitch.broadcaster.login} + ${twitch.bot.login}` : twitch.configured ? 'Connect both accounts' : 'Set up Twitch when ready');
    set('#home-codex', runs.runs.at(-1)?.status ?? 'Check setup');
    set('#home-build', builds.builds.at(0)?.id ?? 'No saved build yet');
    const shelf = document.querySelector('#recent-patches');
    if (shelf) { shelf.replaceChildren(); const shipped = runs.runs.filter(item => item.status === 'shipped').slice(-3).reverse(); if (!shipped.length) { const empty = document.createElement('p'); empty.textContent = 'No patches shipped yet. Try a Practice round to see one here.'; shelf.append(empty); } for (const item of shipped) { const card = document.createElement('article'); card.className = 'studio-card'; card.textContent = `${item.demo ? 'Demo · ' : ''}${item.mutationName ?? 'Shipped patch'}`; shelf.append(card); } }
    set('#home-setup', twitch.broadcaster && twitch.bot ? 'Connected' : 'Practice mode available');
      set('#home-overlay', 'Overlay ready');
      window.setTimeout(() => {
        void fetch('/api/setup').then(r => r.json()).then((setup: { checks: { id: string; state: string }[] }) => {
          const codex = setup.checks.find(item => item.id === 'codex');
          for (const [id, state] of [['codex', codex?.state], ['obs', setup.checks.find(item => item.id === 'overlay')?.state]] as const) {
            const dot = document.querySelector(`#dot-${id}`);
            dot?.classList.toggle('ready', state === 'Ready');
            dot?.classList.toggle('needs-action', state === 'Needs action');
          }
          set('#codex-connection', codex?.state === 'Ready' ? '● Codex ready' : codex?.state === 'Needs action' ? '◐ Codex setup' : '○ Codex unavailable');
          const ready = [Boolean(localStorage.getItem('live-patch:practice-complete')), Boolean(twitch.broadcaster && twitch.bot), codex?.state === 'Ready', setup.checks.find(item => item.id === 'overlay')?.state === 'Ready'];
          const ring = document.querySelector<HTMLElement>('#checklist-ring');
          if (ring) { ring.textContent = `${ready.filter(Boolean).length}/4`; ring.style.background = `conic-gradient(#9146ff ${ready.filter(Boolean).length * 25}%,#45454b 0)`; }
          if (ready.every(Boolean)) document.querySelector('#start-checklist')?.classList.add('complete');
          set('#home-codex', codex?.state === 'Ready' ? 'Signed in' : 'Sign in to Codex');
          const liveReady = twitch.broadcaster && twitch.bot && codex?.state === 'Ready' && setup.checks.find(item => item.id === 'sandbox')?.state === 'Ready';
          const primary = document.querySelector<HTMLAnchorElement>('#home-primary');
          if (primary && liveReady) { primary.href = '/?view=go-live'; primary.textContent = 'Go Live →'; }
        }).catch(() => set('#home-codex', 'Check setup'));
      }, 100);
  } catch { document.querySelector('#app-connection')!.textContent = '○ Local studio'; }
}

switch (view) {
  case 'home':
    page.innerHTML = '<div class="home-grid"><section id="start-checklist" class="studio-card"><div class="section-head"><div><p class="app-kicker">START HERE</p><h2>Your first stream starts here</h2></div><div id="checklist-ring" class="progress-ring">0/4</div></div><p>Try the loop in Practice, then connect the tools you want for a live stream.</p><ol class="journey-list"><li><a href="/?view=practice">Run a practice round</a><small>About 2 minutes</small></li><li><a href="/?view=setup#twitch">Connect Twitch</a><small>For live chat</small></li><li><a href="/?view=setup#codex">Enable Codex building</a><small>For new patches</small></li><li><a href="/?view=setup#obs">Add the OBS overlay</a><small>For viewers</small></li></ol><a id="home-primary" class="button primary" href="/?view=practice">Try Practice →</a></section><section class="studio-card active-game-card"><div><p class="app-kicker">ACTIVE GAME</p><h2 id="home-game">Loading…</h2><p>The game evolves as chat ideas become playable patches.</p><button id="home-play">Play in new window ↗</button><a href="/?view=library">Browse games →</a></div><div class="game-art" aria-hidden="true">✳</div></section></div><section class="home-shelf"><div class="section-head"><h2>Recently shipped patches</h2><a href="/?view=go-live">View activity →</a></div><div class="status-grid"><article><small>TWITCH</small><strong id="home-twitch">Checking…</strong></article><article><small>CODEX</small><strong id="home-codex">Checking…</strong></article><article><small>LAST SAVED BUILD</small><strong id="home-build">Checking…</strong><a href="/?view=builds">Open builds →</a></article></div></section>';
    document.querySelector('#home-play')!.addEventListener('click', openPlay);
    const recent = document.createElement('div'); recent.id = 'recent-patches'; recent.className = 'recent-patches'; document.querySelector('.home-shelf .section-head')!.after(recent);
    const homeStatus = document.querySelector<HTMLElement>('.status-grid')!; homeStatus.classList.add('home-status'); document.querySelector('.home-shelf')!.after(homeStatus);
    if (!localStorage.getItem('live-patch:welcome-seen') && (!__LIVE_PATCH_TEST_SERVER__ || new URLSearchParams(location.search).has('first-run'))) {
      const welcome = document.createElement('dialog'); welcome.className = 'welcome-dialog'; welcome.setAttribute('aria-label', 'Welcome to Live Patch');
      welcome.innerHTML = '<h2>Welcome to <em>Live Patch</em></h2><p class="welcome-tagline">Your chat designs the game. Codex builds it. You keep playing.</p><div class="welcome-steps"><div><span class="welcome-illustration chat-illustration" aria-hidden="true">•••</span><strong><b>1</b> Chat pitches an idea</strong></div><span class="welcome-arrow">➜</span><div><span class="welcome-illustration poll-illustration" aria-hidden="true"><i></i><i></i><i></i></span><strong><b>2</b> Chat votes</strong></div><span class="welcome-arrow">➜</span><div><span class="welcome-illustration puzzle-illustration" aria-hidden="true">✚</span><strong><b>3</b> Codex ships a patch live</strong></div></div><div class="welcome-return" aria-hidden="true">⤺ ──────────── the game keeps evolving ────────────</div><div class="welcome-choices"><article><span aria-hidden="true">⚡</span><h3>Try it now</h3><p>No accounts needed · about 2 minutes</p><a class="button primary" href="/?view=practice">Start practice →</a></article><article><span aria-hidden="true">♟</span><h3>Connect Twitch</h3><p>Bring your real chat</p><a class="button secondary" href="/?view=setup#twitch">Connect →</a></article><article><span aria-hidden="true">⌘</span><h3>Enable AI building</h3><p>Sign in to Codex and set up the safe sandbox</p><a class="button secondary" href="/?view=setup#codex">Set up Codex →</a></article></div><div class="welcome-footer"><a href="/?view=setup">What does Live Patch change on my PC?</a><button id="welcome-close" class="secondary">Skip for now</button></div>';
      document.body.append(welcome); welcome.showModal(); localStorage.setItem('live-patch:welcome-seen', '1');
      welcome.querySelector('#welcome-close')!.addEventListener('click', () => welcome.close());
    }
    void summary(); break;
  case 'go-live': page.innerHTML = '<div id="control"></div>'; void import('./overlay/control'); void summary(); break;
  case 'practice': page.innerHTML = '<div id="simulator"></div>'; void import('./twitch/simulator'); void summary(); break;
  case 'library': page.innerHTML = '<div id="library"></div>'; void import('./overlay/library'); void summary(); break;
  case 'builds': page.innerHTML = '<div id="build-library"></div>'; void import('./overlay/build-library'); void summary(); break;
  case 'setup': page.innerHTML = '<div id="setup"></div>'; void import('./overlay/setup'); void summary(); break;
  case 'settings': page.innerHTML = '<div id="settings"></div>'; void import('./overlay/settings'); void summary(); break;
}
}
