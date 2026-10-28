import './stream.css';
import { appendText, dashboardData, roundClock } from './shared';

const root = document.querySelector<HTMLDivElement>('#overlay')!;
root.innerHTML = '<div class="stream-shell"><header><div class="brand">LIVE PATCH <span>CHAT BUILDS THE GAME</span></div><div id="patches" class="patches"></div></header><aside><div class="panel-label">CODEX AT WORK</div><div id="work"></div></aside><footer><div class="round-heading"><div><span class="panel-label">CHAT DECIDES</span><strong id="phase"></strong></div><strong id="clock"></strong></div><div id="candidates" class="candidates"></div></footer></div>';
const shell = root.querySelector<HTMLElement>('.stream-shell')!;
function scaleOverlay() { shell.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; }
scaleOverlay(); window.addEventListener('resize', scaleOverlay);

async function refresh() {
  try {
    const { round, runs, mutations, ideas, events, settings } = await dashboardData();
    root.className = `${settings.reduceFlashing ? 'reduced-effects ' : ''}${settings.overlayCompact ? 'compact-overlay' : ''}`;
    document.querySelector('#phase')!.textContent = `ROUND ${round.number} · ${round.phase.toUpperCase()}`;
    document.querySelector('#clock')!.textContent = roundClock(round.remainingMs);
    const patches = document.querySelector<HTMLElement>('#patches')!; patches.replaceChildren();
    for (const mutation of mutations.filter(item => !item.error).slice(-10)) {
      const pill = document.createElement('div'); pill.className = 'patch';
      const title = /title\s*:\s*['"`]([^'"`]{1,80})/.exec(mutation.source)?.[1] ?? mutation.name;
      const run = runs.find(item => item.status === 'shipped' && item.mutationName === mutation.name);
      const idea = ideas.find(item => item.id === run?.ideaId);
      const credit = run ? (idea?.contributors?.map(name => `@${name}`).join(', ') ?? (idea ? `@${idea.authorName}` : 'Viewer patch')) : 'Built-in';
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
      const steps = events.filter(event => event.runId === latest.id);
      const endStage = latest.status === 'failed' ? { id: 'failed', label: 'Build failed' } : latest.status === 'rolled_back' ? { id: 'rolled_back', label: 'Rolled back' } : { id: 'shipped', label: 'Patch shipped' };
      const stages = [
        { id: 'sandbox_verified', label: 'Sandbox checked' }, { id: 'file', label: 'Writing mutation' },
        { id: 'testing', label: 'Smoke test' }, endStage
      ];
      const seen = new Set(steps.map(step => step.type));
      if (['shipped', 'failed', 'rolled_back'].includes(latest.status)) seen.add(latest.status);
      for (const stage of stages) {
        const step = steps.find(item => item.type === stage.id);
        appendText(work, 'small', `${seen.has(stage.id) ? '✓' : '○'} ${stage.label}${stage.id === 'file' && step?.message ? ` · ${step.message}` : ''}`, `work-step ${seen.has(stage.id) ? 'complete' : ''}`);
      }
      if (latest.status === 'shipped') appendText(work, 'strong', '✦ PATCH SHIPPED ✦', 'shipped-moment');
      if (latest.status === 'failed') appendText(work, 'strong', 'BUILD FAILED', 'failed-moment');
      if (latest.status === 'rolled_back') appendText(work, 'strong', 'PATCH ROLLED BACK', 'rolled-moment');
      if (!steps.length && latest.mutationName) appendText(work, 'small', `File: ${latest.mutationName}`);
      if (latest.error) appendText(work, 'small', latest.error);
      else if (latest.durationMs) appendText(work, 'small', `${Math.round(latest.durationMs / 1000)}s`);
    } else appendText(work, 'p', 'Waiting for a chat idea');
    const candidates = document.querySelector<HTMLElement>('#candidates')!; candidates.replaceChildren();
    const maxVotes = Math.max(1, ...round.candidates.map(item => item.votes.length));
    const totalVotes = round.candidates.reduce((total, item) => total + item.votes.length, 0);
    for (const [index, candidate] of round.candidates.entries()) {
      const card = document.createElement('div'); card.className = `candidate${totalVotes && candidate.votes.length === maxVotes ? ' leader' : ''}`;
      appendText(card, 'span', ['✦', '◈', '✿'][index] ?? '✦', 'candidate-mark');
      appendText(card, 'strong', `${index + 1} · ${candidate.spec ?? candidate.text}`);
      const percent = totalVotes ? Math.round(candidate.votes.length / totalVotes * 100) : 0;
      appendText(card, 'small', `${candidate.votes.length} vote${candidate.votes.length === 1 ? '' : 's'} · ${percent}% · ${candidate.contributors?.map(name => `@${name}`).join(', ') ?? `@${candidate.authorName}`}`);
      const track = document.createElement('div'); track.className = 'vote-track';
      const bar = document.createElement('div'); bar.className = 'vote-bar'; bar.style.width = `${percent}%`;
      track.append(bar); card.append(track); appendText(card, 'b', `!vote ${index + 1}`, 'vote-hint'); candidates.append(card);
    }
    if (round.phase === 'pitch') {
      const pending = ideas.filter(item => ['submitted', 'shortlisted'].includes(item.status));
      appendText(candidates, 'p', `${pending.length} pitch${pending.length === 1 ? '' : 'es'} in the queue · !idea <mechanic>`);
      for (const idea of pending.slice(0, 3)) {
        const card = document.createElement('div'); card.className = 'candidate';
        appendText(card, 'strong', idea.spec ?? idea.text);
        appendText(card, 'small', `${idea.contributors?.map(name => `@${name}`).join(', ') ?? `@${idea.authorName}`}${idea.contributors && idea.contributors.length > 1 ? ' · merged pitch' : ''}`);
        candidates.append(card);
      }
    } else if (!round.candidates.length) appendText(candidates, 'p', 'Waiting for the next round');
  } catch (error) { document.querySelector('#work')!.textContent = `Overlay reconnecting: ${String(error)}`; }
}

void refresh();
setInterval(() => { void refresh(); }, 1_000);
import.meta.hot?.on('live-patch:round', () => { void refresh(); });
import.meta.hot?.on('live-patch:runner', () => { void refresh(); });
