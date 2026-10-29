import './control.css';
import { appendText, dashboardData, roundClock } from './shared';

const root = document.querySelector<HTMLDivElement>('#control')!;
root.innerHTML = `<main class="go-live-dashboard">
  <div class="live-status"><strong id="round">Loading round…</strong><span id="twitch-pill">Twitch checking…</span><span id="codex-pill">Codex checking…</span><span id="overlay-pill">Overlay ready</span><span id="sound-pill">Sound checking…</span></div>
  <div class="live-columns">
    <section class="live-card pitch-column"><div class="live-card-heading"><h3>Pitch queue</h3><span id="pitch-count"></span></div><p class="muted">Oldest pending pitches enter the ballot first.</p><div id="pitch-queue"></div><div id="triage-preview"></div><div class="actions"><button data-action="triage" title="Shortcut T">Preview AI triage · T</button></div></section>
    <section class="live-card centre-column"><div class="live-card-heading"><h3>Game preview · separate run</h3><button id="preview-toggle" class="secondary">Start preview</button></div><div class="game-preview"><p id="preview-placeholder">Preview is off. Start it to inspect the current patches in a separate game run.</p><iframe title="Separate game preview" tabindex="-1" hidden></iframe></div><div class="live-card-heading"><h3>Current ballot</h3><span id="ballot-total"></span></div><div id="candidates"></div><div class="actions"><button data-action="pause" title="Shortcut P">Pause · P</button><button data-action="resume" title="Shortcut R">Resume · R</button><button data-action="advance" title="Shortcut N">Next stage · N</button><button data-action="force-next" class="danger">Cancel build and next round</button></div><p id="timing-hint" class="hint"></p></section>
    <section class="live-card run-column"><div class="live-card-heading"><h3>Codex at work</h3></div><div id="runs"></div><div class="live-card-heading"><h3>Active patches</h3><span id="patch-count"></span></div><div id="patches"></div><p id="rollback-vote" class="hint">Chat can vote with !rollbackvote after a patch ships. A moderator can use !rollback immediately.</p><div class="actions"><button data-action="rollback" class="danger">Roll back latest</button><button data-action="save">Save build and patch notes</button></div><div class="live-card-heading"><h3>Points prediction</h3></div><div id="prediction"></div><div class="live-card-heading"><h3>Reward redemptions</h3></div><div id="refunds"></div><div class="live-card-heading"><h3>Saved builds</h3></div><div id="builds"></div></section>
  </div><section class="live-card recent-chat"><h3>Recent chat</h3><div id="chat-strip"></div></section><p id="notice" role="status"></p>
</main>`;
const preview = root.querySelector<HTMLIFrameElement>('.game-preview iframe')!;
const previewPlaceholder = root.querySelector<HTMLElement>('#preview-placeholder')!;
const previewToggle = root.querySelector<HTMLButtonElement>('#preview-toggle')!;
function stopPreview() {
  preview.src = 'about:blank'; preview.hidden = true; previewPlaceholder.hidden = false;
  previewToggle.textContent = 'Start preview';
}
previewToggle.addEventListener('click', () => {
  if (!preview.hidden) { stopPreview(); return; }
  preview.src = '/preview.html'; preview.hidden = false; previewPlaceholder.hidden = true;
  previewToggle.textContent = 'Stop preview';
});
document.addEventListener('visibilitychange', () => { if (document.hidden && !preview.hidden) stopPreview(); });

async function action(name: string, ideaId?: string) {
  const confirmations: Record<string, string> = { rollback: 'Roll back the latest shipped patch?', 'force-next': 'Cancel the current build and start a new round?', 'triage-discard': 'Discard these AI triage suggestions?', 'bet-cancel': 'Cancel the points prediction and return all points?' };
  if (confirmations[name] && !confirm(confirmations[name])) return;
  const notify = (message: string) => {
    root.querySelector('#notice')!.textContent = message;
    const layer = document.querySelector('#toast-layer');
    if (!layer) return;
    const item = document.createElement('div'); item.className = 'toast'; item.textContent = message; layer.append(item);
    setTimeout(() => item.remove(), 5000);
  };
  try {
    const response = await fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name, ideaId }) });
    const data = await response.json() as { error?: string; message?: string; id?: string; applied?: number; preview?: unknown[] };
    notify(response.ok ? (data.message ?? (data.id ? `Saved build ${data.id}` : data.preview ? `Review ${data.preview.length} AI suggestion(s) below` : data.applied !== undefined ? `AI triage updated ${data.applied} pitch(es)` : `${name} complete`)) : (data.error ?? data.message ?? `HTTP ${response.status}`));
    await refresh();
  } catch (error) { notify(String(error)); }
}
root.addEventListener('click', event => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
  if (target) void action(target.dataset.action ?? '', target.dataset.ideaId);
  const retry = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-refund]');
  if (retry?.dataset.refund) void fetch('/api/twitch/refunds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redemptionId: retry.dataset.refund }) }).then(() => refresh());
});
window.addEventListener('keydown', event => {
  if (event.ctrlKey || event.altKey || event.metaKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) return;
  const shortcuts: Record<string, string> = { p: 'pause', r: 'resume', n: 'advance', t: 'triage' };
  const selected = shortcuts[event.key.toLowerCase()];
  if (selected) { event.preventDefault(); void action(selected); }
});

async function refresh() {
  try {
    const [data, twitch, chat, saved, refundData, betData] = await Promise.all([
      dashboardData(),
      fetch('/api/twitch/status').then(response => response.json()) as Promise<{ broadcaster: { login: string } | null; bot: { login: string } | null; eventsub: string; reward?: { state: string; reason: string }; refundIssue?: string }>,
      fetch('/api/chat/recent').then(response => response.json()) as Promise<{ messages: { at: string; author: string; text: string }[] }>,
      fetch('/api/builds').then(response => response.json()) as Promise<{ builds: { id: string; patches: unknown[] }[] }>,
      fetch('/api/twitch/refunds').then(response => response.json()) as Promise<{ refunds: { redemptionId: string; action?: 'refund' | 'fulfill'; status: string; message: string }[] }>,
      fetch('/api/predictions').then(response => response.json()) as Promise<{ active?: { ideaId: string; status: string; error?: string } }>
    ]);
    const { round, runs, mutations, ideas, rollbackVote, events, settings } = data;
    root.querySelector('#rollback-vote')!.textContent = rollbackVote
      ? `Chat rollback vote ${rollbackVote.votes}/${rollbackVote.threshold}${rollbackVote.ready ? ' · threshold met; moderator can confirm with !rollback' : ''} · moderator !rollback is always immediate · expires ${new Date(rollbackVote.expiresAt).toLocaleTimeString()}`
      : 'Chat can vote with !rollbackvote after a patch ships. A moderator can use !rollback immediately.';
    root.querySelector('#round')!.textContent = `ROUND ${round.number} · ${round.phase.toUpperCase()} · ${roundClock(round.remainingMs)}`;
    root.querySelector('#twitch-pill')!.textContent = twitch.broadcaster && twitch.bot ? `● Twitch ${twitch.eventsub}${twitch.reward && !['enabled', 'unconfigured'].includes(twitch.reward.state) ? ` · ${twitch.reward.reason}` : ''}${twitch.refundIssue ? ` · ${twitch.refundIssue}` : ''}` : '○ Practice mode';
    root.querySelector('#codex-pill')!.textContent = runs.at(-1)?.status === 'building' ? '◉ Codex building' : '○ Codex standing by';
    root.querySelector('#sound-pill')!.textContent = settings.muted ? '○ Sound muted' : '● Sound on in play view';
    root.querySelector('#timing-hint')!.textContent = `Pitch ${settings.pitchSeconds}s · Vote ${settings.voteSeconds}s · Approval waits for a moderator.`;

    const pending = ideas.filter(idea => ['submitted', 'shortlisted'].includes(idea.status));
    root.querySelector('#pitch-count')!.textContent = String(pending.length);
    const queue = root.querySelector<HTMLElement>('#pitch-queue')!; queue.replaceChildren();
    if (!pending.length) appendText(queue, 'p', 'No pitches yet. Ask chat to send !idea <mechanic>.', 'empty-state');
    for (const [index, idea] of pending.slice(0, 12).entries()) {
      const item = document.createElement('article'); item.className = 'queue-item';
      appendText(item, 'strong', `${index + 1}. ${idea.spec ?? idea.text}`);
      appendText(item, 'small', `${idea.contributors?.map(name => `@${name}`).join(', ') ?? `@${idea.authorName}`} · ${idea.status}`);
      queue.append(item);
    }
    const preview = root.querySelector<HTMLElement>('#triage-preview')!; preview.replaceChildren();
    if (round.triagePreview?.length) {
      appendText(preview, 'h3', 'AI triage preview');
      for (const proposal of round.triagePreview) {
        const original = ideas.find(idea => idea.id === proposal.id);
        const target = ideas.find(idea => idea.id === proposal.duplicateId);
        appendText(preview, 'p', `${original?.text ?? proposal.id} → ${proposal.decision === 'accept' ? proposal.spec : proposal.decision === 'merge' ? `merge into ${target?.text ?? proposal.duplicateId}` : 'reject'}`);
      }
      const buttons = document.createElement('div'); buttons.className = 'actions';
      for (const [name, label] of [['triage-apply', 'Apply suggestions'], ['triage-discard', 'Discard suggestions']]) { const button = document.createElement('button'); button.dataset.action = name; button.textContent = label; buttons.append(button); }
      preview.append(buttons);
    }

    const candidates = root.querySelector<HTMLElement>('#candidates')!; candidates.replaceChildren();
    const total = round.candidates.reduce((sum, idea) => sum + idea.votes.length, 0);
    root.querySelector('#ballot-total')!.textContent = `${total} vote${total === 1 ? '' : 's'}`;
    for (const [index, idea] of round.candidates.entries()) {
      const card = document.createElement('article'); card.className = 'ballot-item';
      const percent = total ? Math.round(idea.votes.length / total * 100) : 0;
      appendText(card, 'strong', `${index + 1}. ${idea.spec ?? idea.text}`);
      appendText(card, 'small', `${percent}% · ${idea.votes.length} vote${idea.votes.length === 1 ? '' : 's'} · ${idea.contributors?.map(name => `@${name}`).join(', ') ?? `@${idea.authorName}`}`);
      const track = document.createElement('div'); track.className = 'dashboard-vote-track'; const bar = document.createElement('div'); bar.className = 'dashboard-vote-bar'; bar.style.width = `${percent}%`; track.append(bar); card.append(track);
      appendText(card, 'small', `!vote ${index + 1}`);
      const buttons = document.createElement('div'); buttons.className = 'actions';
      if (round.phase === 'approval' && !betData.active) { const bet = document.createElement('button'); bet.textContent = 'Open points prediction'; bet.dataset.action = 'bet-start'; bet.dataset.ideaId = idea.id; buttons.append(bet); }
      for (const name of ['approve', 'reject']) { const button = document.createElement('button'); button.textContent = name === 'approve' ? 'Approve and build' : 'Reject'; button.dataset.action = name; button.dataset.ideaId = idea.id; buttons.append(button); }
      card.append(buttons); candidates.append(card);
    }
    if (!round.candidates.length) appendText(candidates, 'p', round.phase === 'pitch' ? 'Ballot opens after the pitch window. The oldest three pending ideas will appear here.' : 'No voting candidates yet. Start the next round.', 'empty-state');

    const runList = root.querySelector<HTMLElement>('#runs')!; runList.replaceChildren();
    const latest = runs.at(-1);
    appendText(runList, 'p', latest ? `${latest.status.toUpperCase()} · ${latest.mutationName ?? latest.error ?? 'Codex working'}` : 'No Codex run yet. Approve an idea to begin.', latest ? 'run-summary' : 'empty-state');
    const seen = new Set(events.filter(event => event.runId === latest?.id).map(event => event.type));
    if (latest && ['shipped', 'failed', 'rolled_back'].includes(latest.status)) seen.add(latest.status);
    for (const [id, label] of [['sandbox_verified', 'Sandbox verified'], ['file', 'Writing patch'], ['testing', 'Smoke test'], [latest?.status === 'failed' ? 'failed' : latest?.status === 'rolled_back' ? 'rolled_back' : 'shipped', latest?.status === 'failed' ? 'Failed' : latest?.status === 'rolled_back' ? 'Rolled back' : 'Shipped']]) {
      appendText(runList, 'p', `${seen.has(id) ? '✓' : '○'} ${label}`, `timeline-step ${seen.has(id) ? 'complete' : ''}`);
    }
    const patches = root.querySelector<HTMLElement>('#patches')!; patches.replaceChildren();
    const active = mutations.filter(item => !item.error); root.querySelector('#patch-count')!.textContent = String(active.length);
    if (!active.length) appendText(patches, 'p', 'No active patches. Ship a viewer idea to evolve the game.', 'empty-state');
    for (const item of active) {
      const title = /title\s*:\s*['"`]([^'"`]{1,80})/.exec(item.source)?.[1] ?? item.name;
      const run = runs.find(entry => entry.status === 'shipped' && entry.mutationName === item.name);
      const idea = ideas.find(entry => entry.id === run?.ideaId);
      const card = document.createElement('article'); card.className = 'patch-item';
      appendText(card, 'strong', title); appendText(card, 'small', idea ? (idea.contributors?.map(name => `@${name}`).join(', ') ?? `@${idea.authorName}`) : 'Built-in'); patches.append(card);
    }
    const predictionBox = root.querySelector<HTMLElement>('#prediction')!; predictionBox.replaceChildren();
    if (betData.active) {
      appendText(predictionBox, 'p', `${betData.active.status} · ${ideas.find(idea => idea.id === betData.active?.ideaId)?.spec ?? 'Patch'}${betData.active.error ? ` · ${betData.active.error}` : ''}`);
      const cancel = document.createElement('button'); cancel.className = 'secondary'; cancel.dataset.action = 'bet-cancel'; cancel.textContent = 'Cancel and refund points'; predictionBox.append(cancel);
    } else appendText(predictionBox, 'p', 'Optional: open a two-minute Twitch prediction before approving a patch.', 'empty-state');
    const refundBox = root.querySelector<HTMLElement>('#refunds')!; refundBox.replaceChildren();
    if (!refundData.refunds.length) appendText(refundBox, 'p', 'No reward redemptions yet.', 'empty-state');
    for (const refund of refundData.refunds.slice(-3).reverse()) {
      const item = document.createElement('p'); item.textContent = `${refund.status}: ${refund.message}`;
      if (['failed', 'pending', 'not_unfulfilled'].includes(refund.status)) { const retry = document.createElement('button'); retry.className = 'secondary'; retry.textContent = refund.action === 'fulfill' ? 'Retry fulfillment' : 'Retry refund check'; retry.dataset.refund = refund.redemptionId; item.append(retry); }
      refundBox.append(item);
    }
    const builds = root.querySelector<HTMLElement>('#builds')!; builds.replaceChildren();
    if (!saved.builds.length) appendText(builds, 'p', 'No saved builds. Use Save build and patch notes after a patch ships.', 'empty-state');
    for (const build of saved.builds.slice(0, 3)) appendText(builds, 'p', `${build.id} · ${build.patches.length} patch(es)`);
    const strip = root.querySelector<HTMLElement>('#chat-strip')!; strip.replaceChildren();
    if (!chat.messages.length) appendText(strip, 'p', 'Recent viewer chat appears here once a message arrives.', 'empty-state');
    for (const message of chat.messages) { const line = document.createElement('p'); appendText(line, 'strong', `${message.author}: `); appendText(line, 'span', message.text); strip.append(line); }
  } catch (error) { root.querySelector('#notice')!.textContent = `Control panel reconnecting: ${String(error)}`; }
}

void refresh();
setInterval(() => { void refresh(); }, 2_000);
import.meta.hot?.on('live-patch:round', () => { void refresh(); });
import.meta.hot?.on('live-patch:runner', () => { void refresh(); });
