import './simulator.css';

const root = document.querySelector<HTMLDivElement>('#simulator')!;
root.innerHTML = `<main><header><div><p class="eyebrow">PRACTICE MODE</p><h1>Try the whole loop</h1><p>Send chat or reward events through the same idea pipeline as Twitch.</p></div><a href="/">Open game ↗</a></header><section class="grid"><form id="send"><h2>Send an event</h2><button type="button" id="sample-pitch" class="secondary">Generate sample pitch</button><div class="links"><button type="button" class="secondary practice-vote" data-vote="1">Vote 1 as new viewer</button><button type="button" class="secondary practice-vote" data-vote="2">Vote 2 as new viewer</button><button type="button" class="secondary practice-vote" data-vote="3">Vote 3 as new viewer</button></div><label>Account ID<input name="id" value="viewer-1" required maxlength="40"></label><label>Login<input name="login" value="viewer1" required maxlength="40"></label><label>Display name<input name="name" value="Viewer 1" required maxlength="60"></label><label>Role<select name="role"><option value="viewer">Viewer</option><option value="moderator">Moderator</option><option value="broadcaster">Broadcaster</option></select></label><label>Event<select name="kind"><option value="chat">Chat message</option><option value="reward">Pitch reward</option></select></label><label>Text<textarea name="text" rows="4" maxlength="600" placeholder="!idea Enemies split when hit" required></textarea></label><button>Send</button><p id="result" role="status"></p><p class="hint">Generate three pitches, vote during the ballot, then switch to Moderator for <code>!approve 1</code>. Reward text needs no command.</p></form><div><section><h2>Twitch connection</h2><p id="connection">Loading…</p><p id="accounts"></p><div class="links"><a href="/api/twitch/auth/broadcaster/start">Connect broadcaster</a><a href="/api/twitch/auth/bot/start">Connect bot</a></div></section><section><h2>Ideas</h2><ul id="ideas"></ul></section><section><h2>Codex runs</h2><ul id="runs"></ul></section><section><h2>Bot replies</h2><ul id="replies"></ul></section></div></section></main>`;
root.querySelector('main')!.insertAdjacentHTML('afterbegin', '<div class="practice-banner">PRACTICE MODE · Nothing is sent to Twitch</div><div class="practice-quick"><section><h2>Practice chat</h2><div id="practice-chat" aria-live="polite"><p>Sample viewers are ready to pitch a mechanic.</p></div><button id="send-sample-pitch" type="button">Send sample pitch</button></section><section><h2>Your first round</h2><div id="practice-timeline"><span data-stage="pitch">1 Pitch</span><span data-stage="vote">2 Vote</span><span data-stage="approval">3 Approve</span><span data-stage="building">4 Build</span><span data-stage="ship">5 Ship</span></div><p id="practice-stage">Loading round…</p><div class="practice-actions"><button id="add-three-votes" type="button">Add 3 votes</button><button id="auto-round" type="button">Run a full round automatically</button><button id="demo-ship" type="button" hidden>Ship a demo patch</button></div><p id="quick-result" role="status"></p></section></div>');
root.querySelector('header a')!.setAttribute('href', '/play');

const form = document.querySelector<HTMLFormElement>('#send')!;
let practiceViewer = 0;
let practicePitch = 0;
const sampleIdeas = ['Enemies split into two tiny slimes when hit', 'Coins leave a sparkling trail', 'The player gets a brief shield after collecting five coins'];
async function postPractice(text: string, number: number) {
  const response = await fetch('/api/simulator/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: crypto.randomUUID(), kind: 'chat', text, viewer: { id: `quick-${number}-${crypto.randomUUID()}`, login: `quick${number}`, name: `Sample viewer ${number}`, moderator: false, broadcaster: false } }) });
  const data = await response.json() as { message?: string; error?: string };
  if (!response.ok) throw Error(data.message ?? data.error ?? `HTTP ${response.status}`);
  const line = document.createElement('p'); line.textContent = `Sample viewer ${number}: ${text}`; root.querySelector('#practice-chat')!.append(line);
}
async function advance() { const response = await fetch('/api/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'advance' }) }); if (!response.ok) throw Error((await response.json() as {error?:string}).error ?? 'Could not advance round'); }
async function quick(work: () => Promise<void>) { const result = root.querySelector('#quick-result')!; result.textContent = 'Working…'; try { await work(); result.textContent = 'Done. Follow the round timeline for the next step.'; await refresh(); } catch (error) { result.textContent = `${String(error)} Try again, or use the event form below.`; } }
root.querySelector('#send-sample-pitch')!.addEventListener('click', () => { void quick(async () => { await postPractice(`!idea ${sampleIdeas[practicePitch++ % sampleIdeas.length]}`, practicePitch); }); });
root.querySelector('#add-three-votes')!.addEventListener('click', () => { void quick(async () => { for (let i = 0; i < 3; i++) await postPractice('!vote 1', ++practiceViewer); }); });
root.querySelector('#auto-round')!.addEventListener('click', () => { void quick(async () => { const state = await fetch('/api/round').then(r => r.json()) as { phase: string }; if (state.phase !== 'pitch') throw Error('Start a new pitch round in Go Live first.'); for (let i = 0; i < 3; i++) await postPractice(`!idea ${sampleIdeas[(practicePitch++) % sampleIdeas.length]}`, ++practiceViewer); await advance(); for (let i = 0; i < 3; i++) await postPractice('!vote 1', ++practiceViewer); await advance(); }); });
root.querySelector('#demo-ship')!.addEventListener('click', () => { void quick(async () => { const state = await fetch('/api/round').then(r => r.json()) as { candidates: { id: string; practice?: boolean }[] }; const candidate = state.candidates.find(item => item.practice); if (!candidate) throw Error('No Practice pitch is ready for a demo patch.'); const response = await fetch('/api/practice/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ideaId: candidate.id }) }); const data = await response.json() as { message?: string; error?: string }; if (!response.ok) throw Error(data.error ?? 'Demo patch could not ship'); localStorage.setItem('live-patch:practice-complete','1'); const line = document.createElement('p'); line.textContent = data.message ?? 'Demo patch shipped'; root.querySelector('#practice-chat')!.append(line); }); });
function usePracticeViewer() {
  const number = ++practiceViewer;
  (form.elements.namedItem('id') as HTMLInputElement).value = `practice-${number}`;
  (form.elements.namedItem('login') as HTMLInputElement).value = `practice${number}`;
  (form.elements.namedItem('name') as HTMLInputElement).value = `Practice Viewer ${number}`;
  (form.elements.namedItem('role') as HTMLSelectElement).value = 'viewer';
  (form.elements.namedItem('kind') as HTMLSelectElement).value = 'chat';
}
document.querySelector('#sample-pitch')!.addEventListener('click', () => {
  const examples = sampleIdeas;
  usePracticeViewer();
  (root.querySelector<HTMLTextAreaElement>('textarea[name="text"]')!).value = `!idea ${examples[practicePitch++ % examples.length]}`;
});
for (const button of Array.from(root.querySelectorAll<HTMLButtonElement>('.practice-vote'))) button.addEventListener('click', () => {
  usePracticeViewer();
  (form.elements.namedItem('text') as HTMLTextAreaElement).value = `!vote ${button.dataset.vote}`;
  form.requestSubmit();
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const fields = new FormData(form);
  const role = String(fields.get('role'));
  const payload = { id: crypto.randomUUID(), kind: String(fields.get('kind')), text: String(fields.get('text')), viewer: { id: String(fields.get('id')), login: String(fields.get('login')), name: String(fields.get('name')), moderator: role === 'moderator', broadcaster: role === 'broadcaster' } };
  const result = document.querySelector('#result')!;
  try {
    const response = await fetch('/api/simulator/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json() as { message?: string; error?: string };
    result.textContent = data.message ?? data.error ?? `HTTP ${response.status}`;
    await refresh();
  } catch (error) { result.textContent = String(error); }
});

async function refresh() {
  const round = await fetch('/api/round').then(r => r.json()) as { phase: string; candidates: { practice?: boolean }[] };
  root.querySelector('#practice-stage')!.textContent = `Current stage: ${round.phase}. ${round.phase === 'approval' ? 'Choose a Practice demo patch or approve a real Codex build.' : round.phase === 'pitch' ? 'Send sample pitches to begin.' : round.phase === 'vote' ? 'Add votes, then advance the round in Go Live.' : 'The round continues.'}`;
  for (const step of Array.from(root.querySelectorAll<HTMLElement>('#practice-timeline span'))) step.classList.toggle('current', step.dataset.stage === round.phase);
  (root.querySelector<HTMLButtonElement>('#demo-ship')!).hidden = round.phase !== 'approval' || !round.candidates.some(item => item.practice);
  const [ideasResponse, statusResponse, runsResponse] = await Promise.all([fetch('/api/ideas'), fetch('/api/twitch/status'), fetch('/api/runs')]);
  const data = await ideasResponse.json() as { ideas: { id: string; authorName: string; text: string; source: string; status: string; votes: string[] }[]; candidateIds: (string | null)[]; replies: { text: string }[] };
  const status = await statusResponse.json() as { configured: boolean; rewardConfigured: boolean; authIssue: string; chatIssue: string; broadcaster: { login: string } | null; bot: { login: string } | null; eventsub: string };
  document.querySelector('#connection')!.textContent = status.configured ? `EventSub: ${status.eventsub}${status.rewardConfigured ? '' : ' · Set TWITCH_PITCH_REWARD_ID for reward events'}${status.authIssue ? ` · ${status.authIssue}` : ''}${status.chatIssue ? ` · ${status.chatIssue}` : ''}` : 'Twitch app is not configured; simulator is ready.';
  document.querySelector('#accounts')!.textContent = `Broadcaster: ${status.broadcaster?.login ?? 'not connected'} · Bot: ${status.bot?.login ?? 'not connected'}`;
  const ideas = document.querySelector('#ideas')!; ideas.replaceChildren();
  for (const idea of data.ideas.slice(-20).reverse()) {
    const li = document.createElement('li');
    const candidate = data.candidateIds.indexOf(idea.id);
    li.textContent = `${candidate < 0 ? '' : `Vote ${candidate + 1} · `}${idea.status.toUpperCase()} · ${idea.text} · @${idea.authorName} · ${idea.votes.length} vote(s) · ${idea.source}`;
    ideas.append(li);
  }
  const replies = document.querySelector('#replies')!; replies.replaceChildren();
  for (const item of data.replies.slice(-10).reverse()) { const li = document.createElement('li'); li.textContent = item.text; replies.append(li); }
  const runData = await runsResponse.json() as { runs: { status: string; mutationName?: string; threadId?: string; durationMs?: number; error?: string }[] };
  const runList = document.querySelector('#runs')!; runList.replaceChildren();
  for (const run of runData.runs.slice(-10).reverse()) {
    const li = document.createElement('li');
    li.textContent = `${run.status.toUpperCase()} · ${run.mutationName ?? run.error ?? 'Codex working'}${run.durationMs ? ` · ${Math.round(run.durationMs / 1000)}s` : ''}${run.threadId ? ` · thread ${run.threadId}` : ''}`;
    runList.append(li);
  }
}
void refresh();
setInterval(() => { void refresh(); }, 2000);
