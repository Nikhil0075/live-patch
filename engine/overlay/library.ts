import '../app.css';
import { appendText } from './shared';

interface GameCard { directory: string; name: string; description: string; tags: string[]; version?: string; author?: string; valid: boolean; error?: string; examples: number; smoke?: { status: string; at: string; detail?: string }; shipped: number; cover?: string }
const root = document.querySelector<HTMLElement>('#library')!;
root.innerHTML = '<div class="section-head"><div><p class="app-kicker">PICK YOUR STARTING WORLD</p><h2>Game library</h2><p class="muted">Each game brings its own mutation rules and smoke test.</p></div></div><div id="game-cards" class="library-grid"></div><div class="studio-card"><h2>Add a game</h2><div class="library-actions"><form id="import-game"><label>Import a local folder<input name="directory" placeholder="D:\\my-game" required></label><button>Validate and import</button></form><form id="new-game"><label>Start from a template<input name="name" placeholder="My new game" required maxlength="80"></label><button>Create and smoke test</button></form></div><p id="library-notice" role="status"></p></div><dialog id="docs-dialog"><form method="dialog"><button class="secondary">Close</button></form><h2>Mutation API</h2><pre id="docs-text"></pre></dialog>';
const cards = root.querySelector<HTMLElement>('#game-cards')!;
const notice = root.querySelector<HTMLElement>('#library-notice')!;

async function request(action: string, fields: Record<string, string>) {
  notice.textContent = `${action === 'active' ? 'Switching game' : 'Checking game'}…`;
  const response = await fetch('/api/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...fields }) });
  const result = await response.json() as { error?: string; message?: string };
  notice.textContent = result.message ?? result.error ?? `HTTP ${response.status}`;
  if (response.ok && action === 'active') setTimeout(() => { location.href = '/'; }, 1200);
  else if (response.ok) await refresh();
}

root.querySelector<HTMLFormElement>('#import-game')!.addEventListener('submit', event => {
  event.preventDefault(); const directory = String(new FormData(event.currentTarget as HTMLFormElement).get('directory'));
  void request('import', { directory }).catch(error => { notice.textContent = String(error); });
});
root.querySelector<HTMLFormElement>('#new-game')!.addEventListener('submit', event => {
  event.preventDefault(); const name = String(new FormData(event.currentTarget as HTMLFormElement).get('name'));
  void request('template', { name }).catch(error => { notice.textContent = String(error); });
});

async function refresh() {
  const data = await fetch('/api/library').then(response => response.json()) as { active: string; games: GameCard[] };
  cards.replaceChildren();
  for (const game of data.games) {
    const card = document.createElement('article'); card.className = 'library-card';
    const cover = document.createElement('div'); cover.className = 'library-cover';
    if (game.cover) { const image = document.createElement('img'); image.src = `/api/library/cover?directory=${encodeURIComponent(game.directory)}`; image.alt = ''; cover.append(image); }
    else { const icon = document.createElement('span'); icon.textContent = '✳'; cover.append(icon); }
    card.append(cover);
    const content = document.createElement('div'); content.className = 'library-card-content';
    appendText(content, 'small', game.directory === data.active ? 'ACTIVE GAME' : game.valid ? 'READY TO PLAY' : 'NEEDS ATTENTION', 'app-kicker');
    appendText(content, 'h3', game.name);
    appendText(content, 'p', game.description || game.error || 'Add a description to the game manifest.');
    appendText(content, 'small', `Manifest ${game.valid ? 'valid' : 'invalid'} · Smoke ${game.smoke?.status ?? 'not run'}${game.smoke?.at ? ` (${new Date(game.smoke.at).toLocaleString()})` : ''} · ${game.examples} example${game.examples === 1 ? '' : 's'} · ${game.shipped} shipped`);
    if (game.tags.length) appendText(content, 'small', game.tags.join(' · '));
    const actions = document.createElement('div'); actions.className = 'library-card-actions';
    const play = document.createElement('button'); play.textContent = 'Play'; play.className = 'primary'; play.disabled = !game.valid;
    play.addEventListener('click', () => { if (game.directory === data.active) location.href = '/'; else void request('active', { directory: game.directory }); });
    const active = document.createElement('button'); active.textContent = game.directory === data.active ? 'Active' : 'Make active'; active.className = 'secondary'; active.disabled = !game.valid || game.directory === data.active;
    active.addEventListener('click', () => { void request('active', { directory: game.directory }); });
    const docs = document.createElement('button'); docs.textContent = 'Mutation API'; docs.className = 'secondary'; docs.disabled = !game.valid;
    docs.addEventListener('click', async () => {
      const response = await fetch(`/api/library/docs?directory=${encodeURIComponent(game.directory)}`);
      root.querySelector('#docs-text')!.textContent = await response.text();
      root.querySelector<HTMLDialogElement>('#docs-dialog')!.showModal();
    });
    actions.append(play, active, docs); content.append(actions); card.append(content); cards.append(card);
  }
  for (const title of ['Sky Orchard', 'Neon Drift']) {
    const card = document.createElement('article'); card.className = 'library-card concept-card';
    const cover = document.createElement('div'); cover.className = 'library-cover'; const icon = document.createElement('span'); icon.textContent = title === 'Sky Orchard' ? '✿' : '◈'; cover.append(icon); card.append(cover);
    const content = document.createElement('div'); content.className = 'library-card-content'; appendText(content, 'small', 'CONCEPT — NOT PLAYABLE', 'app-kicker'); appendText(content, 'h3', title); appendText(content, 'p', 'A future starting world. A second playable game comes after the planned phases.'); card.append(content); cards.append(card);
  }
  if (!data.games.length) appendText(cards, 'p', 'No valid games yet. Create one from the template or import a folder above.');
}
void refresh().catch(error => { notice.textContent = `Library unavailable: ${String(error)}`; });
