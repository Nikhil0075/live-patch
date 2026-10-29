import '../app.css';
import './library-polish.css';
import { appendText } from './shared';

interface GameCard { directory: string; name: string; description: string; tags: string[]; version?: string; author?: string; valid: boolean; error?: string; examples: number; smoke?: { status: string; at: string; detail?: string }; shipped: number; cover?: string; hooks?: string[]; actions?: string[]; controls?: { action: string; keys: string[] }[]; audio?: string[]; effects?: string[]; source?: 'built-in' | 'imported' }
const root = document.querySelector<HTMLElement>('#library')!;
root.innerHTML = '<div class="section-head"><div><p class="app-kicker">PICK YOUR STARTING WORLD</p><h2>Game library</h2><p class="muted">Each game brings its own mutation rules and smoke test.</p></div><label class="library-search">Search games<input id="game-search" type="search" placeholder="Search games and tags"></label></div><div class="library-layout"><div id="game-cards" class="library-grid"></div><aside id="game-detail" class="studio-card library-detail"></aside></div><dialog id="add-game-dialog"><form method="dialog"><button class="secondary">Close</button></form><h2>Add your game</h2><div class="library-actions"><form id="import-game"><label>Import a local folder<input name="directory" placeholder="D:\\my-game" required></label><button>Inspect folder</button></form><form id="new-game"><label>Start from a template<input name="name" placeholder="My new game" required maxlength="80"></label><button>Create and smoke test</button></form></div><div id="import-preview" hidden><h3>Before import</h3><p id="import-details"></p><p>This folder can run local code through its smoke-test command. Import only a folder you trust.</p><button id="confirm-import">Run smoke test and import</button></div><p id="library-notice" role="status"></p></dialog><dialog id="docs-dialog"><form method="dialog"><button class="secondary">Close</button></form><h2>Mutation API</h2><pre id="docs-text"></pre></dialog>';
root.querySelector('.section-head')!.insertAdjacentHTML('afterend','<div class="library-toolbar"><div id="library-filters" aria-label="Filter games"><button data-filter="all" aria-pressed="true">All</button><button data-filter="ready">Ready to stream</button><button data-filter="templates">Templates</button><button data-filter="imported">Imported</button></div><label>Sort <select id="library-sort"><option value="name">Name</option><option value="shipped">Most patches</option></select></label></div>');
const cards = root.querySelector<HTMLElement>('#game-cards')!;
const detail = root.querySelector<HTMLElement>('#game-detail')!;
const notice = root.querySelector<HTMLElement>('#library-notice')!;
let importDirectory = '';
let selected = '';
let filter = 'all';
let library: { active: string; games: GameCard[] } = { active: '', games: [] };

async function request(action: string, fields: Record<string, string>) {
  notice.textContent = `${action === 'active' ? 'Switching game' : 'Checking game'}…`;
  const response = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...fields }) });
  const result = await response.json() as { error?: string; message?: string; directory?: string; name?: string; example?: string; testCommand?: string };
  notice.textContent = result.message ?? result.error ?? `HTTP ${response.status}`;
  if (response.ok && action === 'active') setTimeout(() => { location.href = '/'; }, 1200);
  else if (response.ok && action === 'inspect') {
    importDirectory = result.directory ?? '';
    root.querySelector('#import-details')!.textContent = `${result.name} · Example: ${result.example} · Smoke command: ${result.testCommand}`;
    root.querySelector<HTMLElement>('#import-preview')!.hidden = false;
    notice.textContent = 'Review the command, then confirm import.';
  } else if (response.ok) { if (action === 'import') root.querySelector<HTMLDialogElement>('#add-game-dialog')!.close(); await refresh(); }
}

root.querySelector<HTMLFormElement>('#import-game')!.addEventListener('submit', event => {
  event.preventDefault(); const directory = String(new FormData(event.currentTarget as HTMLFormElement).get('directory'));
  root.querySelector<HTMLElement>('#import-preview')!.hidden = true;
  void request('inspect', { directory }).catch(error => { notice.textContent = String(error); });
});
root.querySelector('#confirm-import')!.addEventListener('click', () => { if (importDirectory) void request('import', { directory: importDirectory }).catch(error => { notice.textContent = String(error); }); });
root.querySelector<HTMLInputElement>('#game-search')!.addEventListener('input', render);
root.querySelector('#library-filters')!.addEventListener('click', event => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-filter]'); if (!button) return; filter = button.dataset.filter!; for (const item of Array.from(root.querySelectorAll<HTMLButtonElement>('#library-filters button'))) item.setAttribute('aria-pressed', String(item === button)); render(); });
root.querySelector('#library-sort')!.addEventListener('change', render);
root.querySelector<HTMLFormElement>('#new-game')!.addEventListener('submit', event => {
  event.preventDefault(); const name = String(new FormData(event.currentTarget as HTMLFormElement).get('name'));
  void request('template', { name }).catch(error => { notice.textContent = String(error); });
});

function showDetails(game?: GameCard) {
  detail.replaceChildren();
  if (!game) { appendText(detail, 'h2', 'Choose a game'); return; }
  appendText(detail, 'p', game.valid ? 'GAME DETAILS' : 'NEEDS ATTENTION', 'app-kicker');
  appendText(detail, 'h2', game.name);
  appendText(detail, 'p', game.description || game.error || 'No description supplied.');
  for (const [label, value] of [
    ['Version', game.version ?? 'Unspecified'], ['Creator', game.author ?? 'Unspecified'],
    ['Controls', game.controls?.map(item => `${item.action}: ${item.keys.join(', ')}`).join(' · ') || 'Not declared'],
    ['Hooks', game.hooks?.join(' · ') || 'Unspecified'], ['Actions', game.actions?.join(' · ') || 'Unspecified'],
    ['Audio', game.audio?.join(' · ') || 'None'], ['Effects', game.effects?.join(' · ') || 'None']
  ]) {
    const row = document.createElement('p'); row.className = 'library-detail-row';
    appendText(row, 'strong', label); appendText(row, 'span', value); detail.append(row);
  }
  const badges = document.createElement('div'); badges.className = 'library-badges';
  for (const label of [`Manifest ${game.valid ? 'valid' : 'invalid'}`, `Smoke ${game.smoke?.status ?? 'not run'}`, `${game.examples} examples`, `${game.shipped} shipped`]) appendText(badges, 'span', label);
  detail.append(badges);
  const actions = document.createElement('div'); actions.className = 'library-card-actions';
  const play = document.createElement('button'); play.textContent = 'Play in new window'; play.disabled = !game.valid;
  play.addEventListener('click', () => { if (game.directory === library.active) window.open('/play', 'live-patch-play'); else void request('active', { directory: game.directory }); });
  const active = document.createElement('button'); active.textContent = game.directory === library.active ? 'Active game' : 'Make active for streams'; active.className = 'secondary'; active.disabled = !game.valid || game.directory === library.active;
  active.addEventListener('click', () => { void request('active', { directory: game.directory }); });
  const docs = document.createElement('button'); docs.textContent = 'Mutation API'; docs.className = 'secondary'; docs.disabled = !game.valid;
  docs.addEventListener('click', async () => {
    const response = await fetch(`/api/library/docs?directory=${encodeURIComponent(game.directory)}`);
    root.querySelector('#docs-text')!.textContent = await response.text();
    root.querySelector<HTMLDialogElement>('#docs-dialog')!.showModal();
  });
  actions.append(play, active, docs); detail.append(actions);
}

function render() {
  const data = library;
  const search = root.querySelector<HTMLInputElement>('#game-search')!.value.trim().toLowerCase();
  cards.replaceChildren();
  const visible = data.games.filter(item => `${item.name} ${item.description} ${item.tags.join(' ')}`.toLowerCase().includes(search)).filter(item => filter === 'all' || filter === 'ready' && item.valid && item.smoke?.status === 'passed' || filter === 'templates' && item.tags.some(tag => tag.toLowerCase() === 'template') || filter === 'imported' && item.source === 'imported').sort((a,b) => (root.querySelector<HTMLSelectElement>('#library-sort')!.value === 'shipped' ? b.shipped - a.shipped : 0) || a.name.localeCompare(b.name));
  for (const game of visible) {
    const card = document.createElement('button'); card.className = `library-card library-select${game.directory === selected ? ' selected' : ''}`;
    card.setAttribute('aria-pressed', String(game.directory === selected));
    const cover = document.createElement('div'); cover.className = 'library-cover';
    if (game.cover) { const image = document.createElement('img'); image.src = game.cover; image.alt = ''; cover.append(image); }
    else { const icon = document.createElement('span'); icon.textContent = '✳'; cover.append(icon); }
    card.append(cover);
    const content = document.createElement('div'); content.className = 'library-card-content';
    appendText(content, 'small', game.directory === data.active ? 'ACTIVE GAME' : game.valid ? 'READY TO PLAY' : 'NEEDS ATTENTION', 'app-kicker');
    appendText(content, 'h3', game.name);
    appendText(content, 'p', game.description || game.error || 'Add a description to the game manifest.');
    appendText(content, 'small', `Manifest ${game.valid ? 'valid' : 'invalid'} · Smoke ${game.smoke?.status ?? 'not run'}${game.smoke?.at ? ` (${new Date(game.smoke.at).toLocaleString()})` : ''} · ${game.examples} example${game.examples === 1 ? '' : 's'} · ${game.shipped} shipped`);
    if (game.tags.length) appendText(content, 'small', game.tags.join(' · '));
    card.append(content); card.addEventListener('click', () => { selected = game.directory; render(); }); cards.append(card);
  }
  if (!search && filter === 'all') {
    const add = document.createElement('button'); add.className = 'library-card library-add'; add.setAttribute('aria-label', 'Add your game');
    appendText(add, 'span', '+', 'library-add-icon'); appendText(add, 'h3', 'Add your game'); appendText(add, 'p', 'Import a local browser game or start from a template.');
    add.addEventListener('click', () => root.querySelector<HTMLDialogElement>('#add-game-dialog')!.showModal()); cards.append(add);
  }
  if (!cards.children.length) appendText(cards, 'p', search ? 'No games match your search.' : 'No games match this filter. Choose All or add a game.');
  showDetails(data.games.find(game => game.directory === selected));
}

async function refresh() {
  library = await fetch('/api/library').then(response => response.json()) as { active: string; games: GameCard[] };
  selected = library.games.find(game => game.directory === selected)?.directory ?? library.games.find(game => game.directory === library.active)?.directory ?? library.games[0]?.directory ?? '';
  render();
}
void refresh().catch(error => { notice.textContent = `Library unavailable: ${String(error)}`; });
