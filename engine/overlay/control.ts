import './control.css';
import { appendText, dashboardData, roundClock } from './shared';

const root = document.querySelector<HTMLDivElement>('#control')!;
root.innerHTML = '<main><header><div><p class="eyebrow">LIVE PATCH / OPERATOR</p><h1>Stream control</h1></div><nav><a href="/">Game</a><a href="/overlay.html">Overlay</a><a href="/simulator.html">Simulator</a></nav></header><div class="grid"><section><h2>Round</h2><p id="round"></p><div class="actions"><button data-action="pause">Pause</button><button data-action="resume">Resume</button><button data-action="advance">Next stage</button><button data-action="triage">AI triage pitches</button></div><p class="hint">Pitch: 60 seconds · Vote: 45 seconds · Approval waits for a moderator. AI triage is optional; basic safety and duplicate checks run immediately.</p><div id="candidates"></div></section><section><h2>Codex runs</h2><div id="runs"></div><h2>Active patches</h2><div id="patches"></div><div class="actions"><button data-action="rollback" class="danger">Roll back latest</button><button data-action="save">Save build and patch notes</button></div><h2>Saved builds</h2><div id="builds"></div></section></div><p id="notice" role="status"></p></main>';

async function action(name: string, ideaId?: string) {
  const notice = document.querySelector('#notice')!;
  try {
    const response = await fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name, ideaId }) });
    const data = await response.json() as { error?: string; message?: string; id?: string; applied?: number };
    notice.textContent = response.ok ? (data.message ?? (data.id ? `Saved build ${data.id}` : data.applied !== undefined ? `AI triage updated ${data.applied} pitch(es)` : `${name} complete`)) : (data.error ?? data.message ?? `HTTP ${response.status}`);
    await refresh();
  } catch (error) { notice.textContent = String(error); }
}
root.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (target) void action(target.dataset.action ?? '', target.dataset.ideaId);
});

async function refresh() {
  try {
    const { round, runs, mutations } = await dashboardData();
    document.querySelector('#round')!.textContent = `Round ${round.number} · ${round.phase.toUpperCase()} · ${roundClock(round.remainingMs)}`;
    const candidates = document.querySelector<HTMLElement>('#candidates')!; candidates.replaceChildren();
    for (const [index, idea] of round.candidates.entries()) {
      const card = document.createElement('article');
      appendText(card, 'strong', `${index + 1}. ${idea.spec ?? idea.text}`);
      appendText(card, 'small', `${idea.votes.length} vote(s) · ${idea.contributors?.map(name => `@${name}`).join(', ') ?? `@${idea.authorName}`}`);
      const buttons = document.createElement('div'); buttons.className = 'actions';
      for (const name of ['approve', 'reject']) {
        const button = document.createElement('button'); button.textContent = name === 'approve' ? 'Approve and build' : 'Reject'; button.dataset.action = name; button.dataset.ideaId = idea.id; buttons.append(button);
      }
      card.append(buttons); candidates.append(card);
    }
    if (!round.candidates.length) appendText(candidates, 'p', 'No voting candidates yet.');
    const runList = document.querySelector<HTMLElement>('#runs')!; runList.replaceChildren();
    for (const run of runs.slice(-10).reverse()) appendText(runList, 'p', `${run.status.toUpperCase()} · ${run.mutationName ?? run.error ?? 'Codex working'}${run.durationMs ? ` · ${Math.round(run.durationMs / 1000)}s` : ''}`);
    const patches = document.querySelector<HTMLElement>('#patches')!; patches.replaceChildren();
    for (const item of mutations.filter(mutation => !mutation.error)) appendText(patches, 'p', item.name);
    const buildsResponse = await fetch('/api/builds');
    const builds = (await buildsResponse.json() as { builds: { id: string; patches: unknown[] }[] }).builds;
    const buildList = document.querySelector<HTMLElement>('#builds')!; buildList.replaceChildren();
    for (const build of builds.slice(0, 5)) appendText(buildList, 'p', `${build.id} · ${build.patches.length} patch(es)`);
  } catch (error) { document.querySelector('#notice')!.textContent = `Control panel reconnecting: ${String(error)}`; }
}

void refresh();
setInterval(() => { void refresh(); }, 2_000);
import.meta.hot?.on('live-patch:round', () => { void refresh(); });
import.meta.hot?.on('live-patch:runner', () => { void refresh(); });
