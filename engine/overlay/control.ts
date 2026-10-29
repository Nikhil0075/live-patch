import './control.css';
import './dashboard.css';
import { appendText, dashboardData, roundClock } from './shared';

const root = document.querySelector<HTMLDivElement>('#control')!;
root.innerHTML = `<main class="go-live-dashboard"><div class="live-status"><strong id="round">Loading round…</strong><span id="twitch-pill">Twitch checking…</span><span id="codex-pill">Codex checking…</span><span id="overlay-pill">Overlay ready</span><span id="sound-pill">Sound checking…</span></div><div class="layout-presets"><label>Layout <select id="layout-preset"><option value="default">Default</option><option value="chat-focus">Chat focus</option></select></label><span>Drag panels to reorder; use the controls in each panel.</span></div><div class="dashboard-panels" id="dashboard-panels">
<section class="live-card panel-preview" data-panel="preview"><div class="live-card-heading"><h3>Stream preview</h3></div><div class="game-preview"><p id="preview-placeholder">Open Play to mirror the real game here. No second game is running.</p><canvas id="play-mirror" width="480" height="320" hidden aria-label="Mirror of the Play window"></canvas><iframe id="overlay-mirror" src="/overlay.html" title="OBS overlay preview" tabindex="-1" aria-hidden="true"></iframe></div><p class="hint">This mirrors the real Play window with the OBS overlay. It runs no second game.</p></section>
<section class="live-card panel-round" data-panel="round"><div class="live-card-heading"><h3>Round and ballot</h3><span id="ballot-total"></span></div><p id="timing-hint" class="hint"></p><div id="candidates"></div><h4>Pitch queue <span id="pitch-count"></span></h4><p class="muted">Oldest pending pitches enter the ballot first.</p><div id="pitch-queue"></div><div id="triage-preview"></div><button data-action="triage" title="Shortcut T">Preview AI triage · T</button></section>
<section class="live-card panel-chat" data-panel="chat"><div class="live-card-heading"><h3>Recent chat</h3></div><div id="chat-strip"></div></section>
<section class="live-card panel-actions" data-panel="actions"><div class="live-card-heading"><h3>Quick actions</h3></div><div class="quick-tiles"><button data-action="pause" title="Shortcut P">Pause round · P</button><button data-action="resume" title="Shortcut R">Resume round · R</button><button data-action="advance" title="Shortcut N">Next stage · N</button><button data-action="rollback" class="danger">Roll back latest</button><button data-action="save">Save build</button><button data-action="bet-start">Open prediction</button><button data-action="force-next" class="danger">Cancel build</button></div><p id="rollback-vote" class="hint"></p></section>
<section class="live-card panel-activity" data-panel="activity"><div class="live-card-heading"><h3>Activity feed</h3></div><div id="activity-feed"></div><h4>Reward redemptions</h4><div id="refunds"></div><h4>Points prediction</h4><div id="prediction"></div></section>
<section class="live-card panel-codex" data-panel="codex"><div class="live-card-heading"><h3>Codex at work</h3></div><div id="runs"></div></section>
<section class="live-card panel-patches" data-panel="patches"><div class="live-card-heading"><h3>Active patches</h3><span id="patch-count"></span></div><div id="patches"></div><h4>Saved builds</h4><div id="builds"></div></section>
</div><p id="notice" role="status"></p></main>`;
const panels = root.querySelector<HTMLElement>('#dashboard-panels')!;
const popoutId = location.hash.slice(1);
if (popoutId && panels.querySelector(`[data-panel="${popoutId}"]`)) { document.body.classList.add('dashboard-popout'); panels.dataset.popout = popoutId; document.title = `${popoutId} · Live Patch`; }
const preset = root.querySelector<HTMLSelectElement>('#layout-preset')!;
const savedPreset = localStorage.getItem('live-patch:dashboard-preset');
if (savedPreset === 'chat-focus') preset.value = savedPreset;
panels.dataset.preset = preset.value;
preset.addEventListener('change', () => { panels.dataset.preset = preset.value; localStorage.setItem('live-patch:dashboard-preset', preset.value); });
for (const panel of Array.from(panels.querySelectorAll<HTMLElement>('[data-panel]'))) {
  const heading = panel.querySelector('.live-card-heading')!;
  const controls = document.createElement('div'); controls.className = 'panel-controls';
  for (const [action, symbol] of [['collapse','−'],['left','←'],['right','→'],['popout','↗']]) { const button = document.createElement('button'); button.className = 'secondary'; button.textContent = symbol; button.dataset.panelAction = action; button.setAttribute('aria-label', `${action === 'left' ? 'Move' : action === 'right' ? 'Move' : action === 'popout' ? 'Pop out' : 'Collapse'} ${panel.querySelector('h3')?.textContent ?? 'panel'}${action === 'left' ? ' left' : action === 'right' ? ' right' : ''}`); controls.append(button); }
  heading.append(controls);
  panel.draggable = true;
}
function orderPanels(order: string[]) { for (const id of order) { const panel = panels.querySelector(`[data-panel="${id}"]`); if (panel) panels.append(panel); } localStorage.setItem('live-patch:dashboard-order', JSON.stringify(Array.from(panels.children).map(item => (item as HTMLElement).dataset.panel))); }
try { const stored = JSON.parse(localStorage.getItem('live-patch:dashboard-order') ?? '[]') as string[]; if (stored.length) orderPanels(stored); } catch { /* use default */ }
panels.addEventListener('click', event => { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-panel-action]'); if (!button) return; const panel = button.closest<HTMLElement>('[data-panel]')!; const action = button.dataset.panelAction; if (action === 'collapse') { panel.classList.toggle('collapsed'); button.textContent = panel.classList.contains('collapsed') ? '+' : '−'; localStorage.setItem('live-patch:dashboard-collapsed', JSON.stringify(Array.from(panels.querySelectorAll<HTMLElement>('.collapsed')).map(item => item.dataset.panel))); } else if (action === 'left' && panel.previousElementSibling) panels.insertBefore(panel, panel.previousElementSibling); else if (action === 'right' && panel.nextElementSibling) panels.insertBefore(panel.nextElementSibling, panel); else if (action === 'popout') window.open(`/?view=go-live#${panel.dataset.panel}`, `live-patch-panel-${panel.dataset.panel}`, 'width=700,height=700'); orderPanels(Array.from(panels.children).map(item => (item as HTMLElement).dataset.panel!)); });
for (const id of JSON.parse(localStorage.getItem('live-patch:dashboard-collapsed') ?? '[]') as string[]) panels.querySelector(`[data-panel="${id}"]`)?.classList.add('collapsed');
let dragged: HTMLElement | null = null;
panels.addEventListener('dragstart', event => { dragged = (event.target as HTMLElement).closest<HTMLElement>('[data-panel]'); });
panels.addEventListener('dragover', event => { if ((event.target as HTMLElement).closest('[data-panel]')) event.preventDefault(); });
panels.addEventListener('drop', event => { const target = (event.target as HTMLElement).closest<HTMLElement>('[data-panel]'); if (dragged && target && dragged !== target) { panels.insertBefore(dragged, target); orderPanels(Array.from(panels.children).map(item => (item as HTMLElement).dataset.panel!)); } dragged = null; });
const mirror = root.querySelector<HTMLCanvasElement>('#play-mirror')!;
const previewPlaceholder = root.querySelector<HTMLElement>('#preview-placeholder')!;
const previewFrame = root.querySelector<HTMLIFrameElement>('#overlay-mirror')!;
new ResizeObserver(() => { previewFrame.style.transform = `scale(${previewFrame.parentElement!.clientWidth / 1920})`; }).observe(previewFrame.parentElement!);
const channel = new BroadcastChannel('live-patch-play-mirror');
channel.onmessage = event => { if (event.data?.type !== 'frame' || !(event.data.bitmap instanceof ImageBitmap)) return; mirror.hidden = false; previewPlaceholder.hidden = true; mirror.getContext('2d')!.drawImage(event.data.bitmap, 0, 0, mirror.width, mirror.height); event.data.bitmap.close(); };
window.addEventListener('beforeunload', () => channel.close());

let currentCandidateId: string | undefined;
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
    const response = await fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: name, ideaId: ideaId ?? (name === 'bet-start' ? currentCandidateId : undefined) }) });
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
      fetch('/api/builds').then(response => response.json()) as Promise<{ builds: { id: string; patches: unknown[]; createdAt?: string }[] }>,
      fetch('/api/twitch/refunds').then(response => response.json()) as Promise<{ refunds: { redemptionId: string; action?: 'refund' | 'fulfill'; status: string; message: string; updatedAt?: string }[] }>,
      fetch('/api/predictions').then(response => response.json()) as Promise<{ active?: { ideaId: string; status: string; error?: string } }>
    ]);
    const { round, runs, mutations, ideas, rollbackVote, events, settings } = data;
    currentCandidateId = round.candidates[0]?.id;
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
    appendText(runList, 'p', latest ? `${latest.demo ? 'DEMO · ' : ''}${latest.status.toUpperCase()} · ${latest.mutationName ?? latest.error ?? 'Codex working'}` : 'No Codex run yet. Approve an idea to begin.', latest ? 'run-summary' : 'empty-state');
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
    const activity: { at: string; text: string }[] = [];
    for (const idea of ideas) {
      if (idea.createdAt) activity.push({ at: idea.createdAt, text: `${idea.source === 'reward' ? 'Reward redemption' : 'Pitch'} · @${idea.authorName}: ${idea.text}` });
      if (idea.votes.length && idea.updatedAt) activity.push({ at: idea.updatedAt, text: `${idea.votes.length} vote${idea.votes.length === 1 ? '' : 's'} · ${idea.spec ?? idea.text}` });
    }
    for (const event of events) activity.push({ at: event.at, text: `${event.type.replaceAll('_',' ')} · ${event.message ?? 'Codex run'}` });
    for (const refund of refundData.refunds) if (refund.updatedAt) activity.push({ at: refund.updatedAt, text: `${refund.action === 'fulfill' ? 'Redemption' : 'Refund'} · ${refund.status}: ${refund.message}` });
    for (const build of saved.builds) if (build.createdAt) activity.push({ at: build.createdAt, text: `Saved build · ${build.id}` });
    if (betData.active) activity.push({ at: new Date().toISOString(), text: `Prediction · ${betData.active.status}` });
    const feed = root.querySelector<HTMLElement>('#activity-feed')!; feed.replaceChildren();
    for (const item of activity.sort((a,b) => b.at.localeCompare(a.at)).slice(0, 20)) appendText(feed, 'p', `${new Date(item.at).toLocaleTimeString()} · ${item.text}`);
    if (!activity.length) appendText(feed, 'p', 'Activity appears here after the first pitch.');
  } catch (error) { root.querySelector('#notice')!.textContent = `Control panel reconnecting: ${String(error)}`; }
}

void refresh();
setInterval(() => { void refresh(); }, 2_000);
import.meta.hot?.on('live-patch:round', () => { void refresh(); });
import.meta.hot?.on('live-patch:runner', () => { void refresh(); });
