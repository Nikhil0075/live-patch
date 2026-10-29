import '../app.css';
import { appendText } from './shared';

const root = document.querySelector<HTMLElement>('#build-library')!;
root.innerHTML = '<div class="section-head"><div><p class="app-kicker">EVERY STREAM LEAVES A STORY</p><h2>Saved builds</h2></div></div><div id="saved-builds" class="library-grid"></div><p id="build-notice" role="status"></p><dialog id="notes-dialog"><form method="dialog"><button class="secondary">Close</button></form><h2>Patch notes</h2><pre id="notes-content"></pre></dialog>';
const list = root.querySelector<HTMLElement>('#saved-builds')!;
fetch('/api/builds').then(response => response.json()).then((data: { builds: { id: string; game: string; createdAt: string; patches: unknown[] }[] }) => {
  if (!data.builds.length) { appendText(list, 'p', 'No saved builds yet. Ship a patch, then use Save build and patch notes from Go Live.'); return; }
  for (const build of data.builds) {
    const card = document.createElement('article'); card.className = 'studio-card';
    appendText(card, 'small', build.game, 'app-kicker'); appendText(card, 'h2', build.id);
    appendText(card, 'p', `${new Date(build.createdAt).toLocaleString()} · ${build.patches.length} patches`);
    const actions = document.createElement('div'); actions.className = 'library-card-actions';
    const notes = document.createElement('button'); notes.className = 'secondary'; notes.textContent = 'View patch notes';
    notes.addEventListener('click', async () => { root.querySelector('#notes-content')!.textContent = await fetch(`/api/builds/notes?id=${encodeURIComponent(build.id)}`).then(response => response.text()); root.querySelector<HTMLDialogElement>('#notes-dialog')!.showModal(); });
    const play = document.createElement('button'); play.textContent = 'Play (play-only)';
    play.addEventListener('click', async () => {
      const playWindow = window.open('about:blank', 'live-patch-play');
      const response = await fetch('/api/builds/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: build.id }) });
      const result = await response.json() as { message?: string; error?: string };
      root.querySelector('#build-notice')!.textContent = result.message ?? result.error ?? 'Could not open build';
      if (response.ok) { if (playWindow) playWindow.location.href = '/play'; else root.querySelector('#build-notice')!.textContent = 'Build ready. Use Play in the top bar to open it.'; }
      else playWindow?.close();
    });
    const compare = document.createElement('a'); compare.className = 'button secondary'; compare.textContent = 'Compare with original'; compare.href = `/compare.html?id=${encodeURIComponent(build.id)}`; compare.target = '_blank'; compare.rel = 'noopener';
    actions.append(notes, play, compare); card.append(actions); list.append(card);
  }
}).catch(error => { root.querySelector('#build-notice')!.textContent = String(error); });
