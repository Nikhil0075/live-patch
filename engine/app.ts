import './app.css';

type View = 'home' | 'library' | 'go-live' | 'builds' | 'setup' | 'settings' | 'practice';
const labels: Record<View, string> = { home: 'Home', library: 'Library', 'go-live': 'Go Live', builds: 'Builds', setup: 'Setup', settings: 'Settings', practice: 'Practice' };
const icons: Record<View, string> = { home: '⌂', library: '▦', 'go-live': '◉', builds: '▤', setup: '◇', settings: '⚙', practice: '▷' };
const desired = new URLSearchParams(location.search).get('view');
const view: View = desired && Object.hasOwn(labels, desired) ? desired as View : 'home';
const shell = document.querySelector<HTMLDivElement>('#shell')!;
shell.innerHTML = '<aside class="app-rail"><div class="app-mark"><span class="mark-icon">✳</span><span>LIVE<br>PATCH</span></div><nav id="app-nav" aria-label="Main navigation"></nav><div class="rail-foot"><span class="live-dot"></span><span>LOCAL STUDIO</span></div></aside><div class="app-content"><header class="app-top"><div><p class="app-kicker">THE STREAMER STUDIO</p><h1 id="app-heading"></h1></div><div class="top-actions"><span id="app-connection">Checking connections…</span><a class="button secondary" href="/overlay.html" target="_blank" rel="noopener">Open OBS overlay ↗</a></div></header><div id="app-page"></div><div id="toast-layer" role="status" aria-live="polite"></div></div>';
const nav = document.querySelector<HTMLElement>('#app-nav')!;
for (const item of Object.keys(labels) as View[]) {
  const link = document.createElement('a'); link.href = item === 'home' ? '/' : `/?view=${item}`;
  link.className = item === view ? 'selected' : '';
  link.setAttribute('aria-current', item === view ? 'page' : 'false');
  const icon = document.createElement('span'); icon.className = 'nav-icon'; icon.textContent = icons[item];
  const name = document.createElement('span'); name.textContent = labels[item]; link.append(icon, name); nav.append(link);
}
document.querySelector('#app-heading')!.textContent = labels[view];
const page = document.querySelector<HTMLElement>('#app-page')!;

export function toast(message: string) {
  const item = document.createElement('div'); item.className = 'toast'; item.textContent = message;
  document.querySelector('#toast-layer')!.append(item);
  setTimeout(() => item.remove(), 5000);
}

async function summary() {
  try {
    const [game, twitch, runs, builds] = await Promise.all([
      fetch('/api/game').then(r => r.json()) as Promise<{ name: string }>,
      fetch('/api/twitch/status').then(r => r.json()) as Promise<{ configured: boolean; broadcaster: { login: string } | null; bot: { login: string } | null; eventsub: string }>,
      fetch('/api/runs').then(r => r.json()) as Promise<{ runs: { status: string }[] }>,
      fetch('/api/builds').then(r => r.json()) as Promise<{ builds: { id: string }[] }>
    ]);
    document.querySelector('#app-connection')!.textContent = twitch.broadcaster && twitch.bot ? `● Twitch ${twitch.eventsub}` : '○ Practice ready';
    const set = (id: string, value: string) => { const element = document.querySelector(id); if (element) element.textContent = value; };
    set('#home-game', game.name);
    set('#home-twitch', twitch.broadcaster && twitch.bot ? `${twitch.broadcaster.login} + ${twitch.bot.login}` : twitch.configured ? 'Connect both accounts' : 'Set up Twitch when ready');
    set('#home-codex', runs.runs.at(-1)?.status ?? 'Check setup');
    set('#home-build', builds.builds.at(0)?.id ?? 'No saved build yet');
    set('#home-setup', twitch.broadcaster && twitch.bot ? 'Connected' : 'Practice mode available');
    if (view === 'home') {
      set('#home-overlay', 'Overlay ready');
      window.setTimeout(() => {
        void fetch('/api/setup').then(r => r.json()).then((setup: { checks: { id: string; state: string }[] }) => {
          const codex = setup.checks.find(item => item.id === 'codex');
          set('#home-codex', codex?.state === 'Ready' ? 'Signed in' : 'Sign in to Codex');
          const ready = twitch.broadcaster && twitch.bot && codex?.state === 'Ready' && setup.checks.find(item => item.id === 'sandbox')?.state === 'Ready';
          const primary = document.querySelector<HTMLAnchorElement>('#home-primary');
          if (primary && ready) { primary.href = '/?view=go-live'; primary.textContent = 'Go live →'; }
        }).catch(() => set('#home-codex', 'Check setup'));
      }, 8000);
    }
  } catch { document.querySelector('#app-connection')!.textContent = '○ Local studio'; }
}

switch (view) {
  case 'home':
    page.innerHTML = '<section class="hero"><div><p class="app-kicker">CHAT DESIGNS. CODEX BUILDS. YOU PLAY.</p><h2>Your next stream starts here.</h2><p>Practice the full loop, then take your evolving game live. Keep the game running as ideas turn into playable patches.</p><div class="hero-actions"><a id="home-primary" class="button primary" href="/?view=practice">Start a practice round →</a><a class="button secondary" href="/?view=go-live">Go to stream controls</a></div></div><div class="hero-graphic"><span>✳</span><small>THE GAME CHANGES WHILE YOU PLAY</small></div></section><section class="status-grid"><article><small>ACTIVE GAME</small><strong id="home-game">Loading…</strong><a href="/?view=library">Browse games →</a></article><article><small>TWITCH</small><strong id="home-twitch">Loading…</strong><a href="/?view=setup">Connection guide →</a></article><article><small>CODEX</small><strong id="home-codex">Loading…</strong><a href="/?view=setup">Check setup →</a></article><article><small>OVERLAY</small><strong id="home-overlay">Checking…</strong><a href="/overlay.html" target="_blank" rel="noopener">Open overlay →</a></article><article><small>LAST BUILD</small><strong id="home-build">Loading…</strong><a href="/?view=builds">Open library →</a></article></section><div class="section-head"><div><p class="app-kicker">PLAY VIEW</p><h2>Live arena</h2></div><span id="home-setup" class="status-pill"></span></div><div id="app"></div>';
    void import('./client'); void summary(); break;
  case 'go-live': page.innerHTML = '<div id="control"></div>'; void import('./overlay/control'); void summary(); break;
  case 'practice': page.innerHTML = '<div id="simulator"></div>'; void import('./twitch/simulator'); void summary(); break;
  case 'library': page.innerHTML = '<div id="library"></div>'; void import('./overlay/library'); void summary(); break;
  case 'builds': page.innerHTML = '<div id="build-library"></div>'; void import('./overlay/build-library'); void summary(); break;
  case 'setup': page.innerHTML = '<div id="setup"></div>'; void import('./overlay/setup'); void summary(); break;
  case 'settings': page.innerHTML = '<div id="settings"></div>'; void import('./overlay/settings'); void summary(); break;
}
