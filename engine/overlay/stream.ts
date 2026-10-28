import './stream.css';
import { appendText, dashboardData, roundClock } from './shared';

const root = document.querySelector<HTMLDivElement>('#overlay')!;
root.innerHTML = '<div class="stream-shell"><header><div class="brand">LIVE PATCH <span>CHAT BUILDS THE GAME</span></div><div id="patches" class="patches"></div></header><aside><div class="panel-label">CODEX AT WORK</div><div id="work"></div></aside><footer><div class="round-heading"><div><span class="panel-label">CHAT DECIDES</span><strong id="phase"></strong></div><strong id="clock"></strong></div><div id="candidates" class="candidates"></div></footer></div>';

async function refresh() {
  try {
    const { round, runs, mutations, ideas, events } = await dashboardData();
    document.querySelector('#phase')!.textContent = `ROUND ${round.number} · ${round.phase.toUpperCase()}`;
    document.querySelector('#clock')!.textContent = roundClock(round.remainingMs);
    const patches = document.querySelector<HTMLElement>('#patches')!; patches.replaceChildren();
    for (const mutation of mutations.filter(item => !item.error).slice(-10)) {
      const pill = document.createElement('div'); pill.className = 'patch';
      const title = /title\s*:\s*['"`]([^'"`]{1,80})/.exec(mutation.source)?.[1] ?? mutation.name;
      const run = runs.find(item => item.status === 'shipped' && item.mutationName === mutation.name);
      const idea = ideas.find(item => item.id === run?.ideaId);
      const fallbackAuthor = /author\s*:\s*['"`]([^'"`]{1,80})/.exec(mutation.source)?.[1] ?? '';
      const credit = idea?.contributors?.map(name => `@${name}`).join(', ') ?? (idea ? `@${idea.authorName}` : fallbackAuthor ? `@${fallbackAuthor}` : '');
      appendText(pill, 'strong', title); if (credit) appendText(pill, 'small', credit);
      patches.append(pill);
    }
    const latest = runs.at(-1);
    const work = document.querySelector<HTMLElement>('#work')!; work.replaceChildren();
    if (latest) {
      appendText(work, 'strong', latest.status.toUpperCase(), `run-status ${latest.status}`);
      const idea = ideas.find(item => item.id === latest.ideaId);
      appendText(work, 'p', idea?.spec ?? idea?.text ?? latest.mutationName ?? 'Patch run');
      if (idea) appendText(work, 'small', idea.contributors?.map(name => `@${name}`).join(', ') ?? `@${idea.authorName}`);
      const steps = events.filter(event => event.runId === latest.id).slice(-5);
      for (const step of steps) {
        const label = step.type === 'file' ? `File: ${step.message ?? 'mutation'}` : step.type === 'testing' ? 'Smoke test running' : step.type === 'passed' ? 'Smoke test passed' : step.type === 'sandbox_verified' ? 'Sandbox verified' : step.type === 'failed' ? 'Build failed' : step.type === 'shipped' ? 'Patch shipped' : '';
        if (label) appendText(work, 'small', label, 'work-step');
      }
      if (!steps.length && latest.mutationName) appendText(work, 'small', `File: ${latest.mutationName}`);
      if (latest.error) appendText(work, 'small', latest.error);
      else if (latest.durationMs) appendText(work, 'small', `${Math.round(latest.durationMs / 1000)}s`);
    } else appendText(work, 'p', 'Waiting for a chat idea');
    const candidates = document.querySelector<HTMLElement>('#candidates')!; candidates.replaceChildren();
    const maxVotes = Math.max(1, ...round.candidates.map(item => item.votes.length));
    for (const [index, candidate] of round.candidates.entries()) {
      const card = document.createElement('div'); card.className = 'candidate';
      appendText(card, 'strong', `${index + 1} · ${candidate.spec ?? candidate.text}`);
      appendText(card, 'small', `${candidate.votes.length} vote${candidate.votes.length === 1 ? '' : 's'} · ${candidate.contributors?.map(name => `@${name}`).join(', ') ?? `@${candidate.authorName}`}`);
      const track = document.createElement('div'); track.className = 'vote-track';
      const bar = document.createElement('div'); bar.className = 'vote-bar'; bar.style.width = `${Math.round(candidate.votes.length / maxVotes * 100)}%`;
      track.append(bar); card.append(track); candidates.append(card);
    }
    if (!round.candidates.length) appendText(candidates, 'p', round.phase === 'pitch' ? 'Pitch ideas with !idea <mechanic>' : 'Waiting for the next round');
  } catch (error) { document.querySelector('#work')!.textContent = `Overlay reconnecting: ${String(error)}`; }
}

void refresh();
setInterval(() => { void refresh(); }, 1_000);
import.meta.hot?.on('live-patch:round', () => { void refresh(); });
import.meta.hot?.on('live-patch:runner', () => { void refresh(); });
