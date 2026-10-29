import './stream.css';
import './overlay-polish.css';
import { appendText, dashboardData, roundClock } from './shared';

const root = document.querySelector<HTMLDivElement>('#overlay')!;
root.innerHTML = '<div class="stream-shell"><header><div id="patches" class="patches"></div></header><aside><div class="panel-label">CODEX AT WORK</div><div id="work"></div></aside><footer><div class="round-heading"><div><span class="panel-label">CHAT DECIDES</span><strong id="phase"></strong></div><strong id="clock"></strong></div><div id="candidates" class="candidates"></div></footer><div id="pitch-ticker" class="pitch-ticker"></div></div>';
const shell = root.querySelector<HTMLElement>('.stream-shell')!;
const widgets: Record<string, HTMLElement> = {
  patches: shell.querySelector('header')!, codex: shell.querySelector('aside')!,
  ballot: shell.querySelector('footer')!, ticker: shell.querySelector('#pitch-ticker')!
};
function scaleOverlay() { shell.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; }
scaleOverlay(); window.addEventListener('resize', scaleOverlay);

async function refresh() {
  try {
    const { round, runs, mutations, ideas, events, settings } = await dashboardData();
    root.className = `${settings.reduceFlashing ? 'reduced-effects ' : ''}${settings.overlayCompact ? 'compact-overlay' : ''}`;
    for (const [type, element] of Object.entries(widgets)) {
      const widget = settings.overlayWidgets.find(item => item.type === type);
      element.hidden = !widget;
      if (widget) Object.assign(element.style, { left: `${widget.x}px`, top: `${widget.y}px`, width: `${widget.width}px`, height: `${widget.height}px`, right: 'auto', bottom: 'auto', minHeight: '0', boxSizing: 'border-box', overflow: 'hidden' });
    }
    document.querySelector('#phase')!.textContent = `Round ${round.number} · ${round.phase === 'vote' ? 'Vote' : round.phase.toUpperCase()}`;
    document.querySelector('#clock')!.textContent = roundClock(round.remainingMs);
    const patches = document.querySelector<HTMLElement>('#patches')!; patches.replaceChildren();
    appendText(patches, 'h2', 'LIVE PATCHES', 'patch-list-title');
    for (const mutation of mutations.filter(item => !item.error).slice(-10)) {
      const pill = document.createElement('div'); pill.className = 'patch';
      const title = /title\s*:\s*['"`]([^'"`]{1,80})/.exec(mutation.source)?.[1] ?? mutation.name;
      const run = runs.find(item => item.status === 'shipped' && item.mutationName === mutation.name);
      const idea = ideas.find(item => item.id === run?.ideaId);
      const credit = run?.demo ? 'by @Live Patch Demo' : run ? (idea?.contributors?.map(name => `@${name}`).join(', ') ?? (idea ? `@${idea.authorName}` : 'Viewer patch')) : 'Built-in';
      appendText(pill, 'span', '✦', 'patch-icon');
      appendText(pill, 'strong', run?.demo && !title.toLowerCase().startsWith('demo') ? `DEMO · ${title}` : title); if (credit) appendText(pill, 'small', credit);
      patches.append(pill);
    }
    const latest = runs.at(-1);
    const work = document.querySelector<HTMLElement>('#work')!; work.replaceChildren();
    document.querySelector('.stream-shell aside .panel-label')!.textContent = latest?.demo ? 'DEMO PATCH' : 'CODEX AT WORK';
    if (latest) {
      appendText(work, 'strong', latest.status.toUpperCase(), `run-status ${latest.status}`);
      const idea = ideas.find(item => item.id === latest.ideaId);
      appendText(work, 'p', latest.demo ? `Demo patch: Coin Shower (stands in for “${idea?.text ?? 'a Practice idea'}”)` : idea?.spec ?? idea?.text ?? latest.mutationName ?? 'Patch run');
      if (latest.demo) appendText(work, 'small', 'by @Live Patch Demo');
      else if (idea) appendText(work, 'small', idea.contributors?.map(name => `@${name}`).join(', ') ?? `@${idea.authorName}`);
      const steps = events.filter(event => event.runId === latest.id);
      const endStage = latest.status === 'failed' ? { id: 'failed', label: 'Build failed' } : latest.status === 'rolled_back' ? { id: 'rolled_back', label: 'Rolled back' } : { id: 'shipped', label: 'Patch shipped' };
      const stages = latest.demo ? [
        { id: 'sandbox_verified', label: 'Prepared example' }, { id: 'file', label: 'Practice check' },
        { id: 'testing', label: 'Practice pitch' }, { id: 'shipped', label: 'Demo shipped' }
      ] : [
        { id: 'sandbox_verified', label: 'Sandbox checked' }, { id: 'file', label: 'Writing mutation' },
        { id: 'testing', label: 'Smoke test' }, endStage
      ];
      const seen = new Set(steps.map(step => step.type));
      if (['shipped', 'failed', 'rolled_back'].includes(latest.status)) seen.add(latest.status);
      for (const stage of stages) {
        const step = steps.find(item => item.type === stage.id);
        appendText(work, 'small', `${seen.has(stage.id) ? '✓' : '○'} ${stage.label}${stage.id === 'file' && step?.message ? ` · ${step.message}` : ''}`, `work-step ${seen.has(stage.id) ? 'complete' : ''}`);
      }
      if (latest.status === 'shipped') appendText(work, 'strong', latest.demo ? '✦ DEMO PATCH ✦' : '✦ PATCH SHIPPED ✦', 'shipped-moment');
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
    const ticker = document.querySelector<HTMLElement>('#pitch-ticker')!; ticker.replaceChildren();
    const latestPitch = ideas.filter(item => ['submitted','shortlisted','voting'].includes(item.status)).at(-1);
    appendText(ticker, 'strong', latestPitch ? `New pitch from @${latestPitch.authorName}: ${latestPitch.spec ?? latestPitch.text}` : 'Your idea could change the game.');
    appendText(ticker, 'span', `type !idea to pitch · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  } catch (error) { document.querySelector('#work')!.textContent = `Overlay reconnecting: ${String(error)}`; }
}

void refresh();
setInterval(() => { void refresh(); }, 1_000);
import.meta.hot?.on('live-patch:round', () => { void refresh(); });
import.meta.hot?.on('live-patch:runner', () => { void refresh(); });
