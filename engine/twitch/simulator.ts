import './simulator.css';

const root = document.querySelector<HTMLDivElement>('#simulator')!;
root.innerHTML = `<main><header><div><p class="eyebrow">PRACTICE MODE</p><h1>Try the whole loop</h1><p>Send chat or reward events through the same idea pipeline as Twitch.</p></div><a href="/">Open game ↗</a></header><section class="grid"><form id="send"><h2>Send an event</h2><button type="button" id="sample-pitch" class="secondary">Generate sample pitch</button><label>Account ID<input name="id" value="viewer-1" required maxlength="40"></label><label>Login<input name="login" value="viewer1" required maxlength="40"></label><label>Display name<input name="name" value="Viewer 1" required maxlength="60"></label><label>Role<select name="role"><option value="viewer">Viewer</option><option value="moderator">Moderator</option><option value="broadcaster">Broadcaster</option></select></label><label>Event<select name="kind"><option value="chat">Chat message</option><option value="reward">Pitch reward</option></select></label><label>Text<textarea name="text" rows="4" maxlength="600" placeholder="!idea Enemies split when hit" required></textarea></label><button>Send</button><p id="result" role="status"></p><p class="hint">Try <code>!idea …</code>, <code>!vote 1</code>, then switch to Moderator for <code>!approve 1</code>. Reward text needs no command.</p></form><div><section><h2>Twitch connection</h2><p id="connection">Loading…</p><p id="accounts"></p><div class="links"><a href="/api/twitch/auth/broadcaster/start">Connect broadcaster</a><a href="/api/twitch/auth/bot/start">Connect bot</a></div></section><section><h2>Ideas</h2><ul id="ideas"></ul></section><section><h2>Codex runs</h2><ul id="runs"></ul></section><section><h2>Bot replies</h2><ul id="replies"></ul></section></div></section></main>`;

document.querySelector('#sample-pitch')!.addEventListener('click', () => {
  const examples = ['Enemies split into two tiny slimes when hit', 'Coins leave a sparkling trail', 'The player gets a brief shield after collecting five coins'];
  (root.querySelector<HTMLTextAreaElement>('textarea[name="text"]')!).value = `!idea ${examples[Math.floor(Math.random() * examples.length)]}`;
});

const form = document.querySelector<HTMLFormElement>('#send')!;
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
