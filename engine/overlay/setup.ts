import '../app.css';
import { appendText } from './shared';

interface Check { id: string; label: string; state: 'Ready' | 'Needs action' | 'Not available here'; reason: string; fix?: string }
interface SetupData { checks: Check[]; credentials: { clientId: string; redirectUri: string; rewardId: string; secretSet: boolean }; diagnostics: string }
const steps = ['Requirements', 'Codex sign-in', 'Sandbox', 'Twitch', 'Choose game', 'OBS and practice'];
const stepChecks: string[][] = [
  ['node', 'git', 'dependencies', 'browser', 'project'], ['codex'], ['sandbox', 'defender'],
  ['twitch-app', 'accounts', 'reward'], [], ['overlay']
];
const root = document.querySelector<HTMLElement>('#setup')!;
root.innerHTML = `<div class="section-head"><div><p class="app-kicker">SIX STEPS TO YOUR FIRST STREAM</p><h2>Guided setup</h2><p class="muted">Practice works without Twitch. Complete each step, or skip ahead to practice.</p></div></div>
<nav class="setup-steps" aria-label="Setup steps"></nav>
<div class="setup-layout"><div class="setup-main"><div id="setup-checks"></div>
<section id="step-twitch" class="studio-card" hidden><h2>Twitch app · optional for practice</h2><form id="twitch-credentials" class="credential-grid"><label>Client ID<input name="clientId" autocomplete="off"></label><label>Client secret <small id="secret-state"></small><input name="clientSecret" type="password" autocomplete="new-password" placeholder="Leave blank to keep saved secret"><button type="button" id="replace-secret" class="secondary">Replace secret</button></label><label>Exact HTTPS redirect URI<input name="redirectUri" autocomplete="off"></label><label>Pitch reward ID<input name="rewardId" autocomplete="off"></label><div class="library-card-actions"><button>Save and reconnect</button><button type="button" class="danger" id="remove-twitch">Remove Twitch credentials</button></div></form><div class="library-card-actions"><a class="button secondary" href="/api/twitch/auth/broadcaster/start">Connect broadcaster</a><a class="button secondary" href="/api/twitch/auth/bot/start">Connect bot</a><button type="button" id="managed-pitch" class="secondary">Create refundable pitch reward</button></div><p class="hint">The managed reward costs 1 point and requires text. Twitch permits automatic refunds only for a reward created by this app. Your existing dashboard reward is kept separately.</p><p id="twitch-notice" role="status"></p></section>
<section id="step-game" class="studio-card" hidden><h2>Choose your starting world</h2><p>Make a game active from Library. Its manifest supplies the game, mutation API and smoke test.</p><a class="button primary" href="/?view=library">Open game library</a></section>
<section id="step-obs" class="studio-card" hidden><h2>Test OBS and run a practice round</h2><p>Keep the overlay URL as a silent OBS Browser Source above your game capture. Practice sends sample pitches through the same pipeline without Twitch.</p><div class="library-card-actions"><button id="copy-overlay">Copy overlay URL</button><a class="button secondary" href="/overlay.html" target="_blank" rel="noopener">Open overlay</a><a class="button primary" href="/?view=practice">Practice round</a></div><p id="overlay-notice" role="status"></p></section>
<div class="wizard-actions"><button id="setup-back" class="secondary">← Back</button><button id="setup-skip" class="secondary">Skip — practice with the simulator</button><button id="setup-continue">Continue →</button></div><p id="sandbox-notice" role="status"></p></div>
<aside class="studio-card setup-explainer"><h2>What this changes</h2><p>✓ Checks Node, Git, Chromium and Codex on this PC.</p><p>✓ Codex setup asks Windows for administrator approval and creates its isolated sandbox.</p><p>✓ The self-test confirms Codex can write inside its worktree while the project stays protected.</p><p>✓ Twitch is optional for practice; saved credentials stay local and the secret is never shown again.</p><p><strong>Windows Security stays on.</strong> Live Patch never disables Defender or adds exclusions.</p><button id="copy-diagnostics" class="secondary">Copy diagnostics</button></aside></div>`;

let current = Number(sessionStorage.getItem('live-patch:setup-step') ?? 0);
if (!Number.isInteger(current) || current < 0 || current >= steps.length) current = 0;
const skipped = new Set<number>(JSON.parse(sessionStorage.getItem('live-patch:setup-skipped') ?? '[]') as number[]);
let diagnostics = '';
let latest: SetupData | undefined;
const checksBox = root.querySelector<HTMLElement>('#setup-checks')!;
const stepNav = root.querySelector<HTMLElement>('.setup-steps')!;
for (const [index, label] of steps.entries()) {
  const button = document.createElement('button'); button.className = 'setup-step'; button.type = 'button'; button.dataset.step = String(index); button.textContent = `${index + 1} ${label}`;
  button.addEventListener('click', () => { current = index; render(); }); stepNav.append(button);
}
const checkActions: Record<string, { label: string; action: () => void }> = {
  sandbox: { label: 'Run setup', action: () => { void setupAction('sandbox-setup'); } },
  defender: { label: 'Open Windows Security', action: () => { location.href = 'ms-settings:windowsdefender'; } },
  accounts: { label: 'Connect accounts', action: () => { current = 3; render(); root.querySelector('#step-twitch')?.scrollIntoView({ behavior: 'smooth' }); } },
  'twitch-app': { label: 'Add credentials', action: () => { current = 3; render(); root.querySelector('#step-twitch')?.scrollIntoView({ behavior: 'smooth' }); } },
  reward: { label: 'Set reward ID', action: () => { current = 3; render(); (root.querySelector('input[name="rewardId"]') as HTMLInputElement).focus(); } },
  overlay: { label: 'Copy overlay URL', action: () => { void navigator.clipboard.writeText(`${location.origin}/overlay.html`); root.querySelector('#overlay-notice')!.textContent = 'Overlay URL copied.'; } }
};
const loadingLabels: Record<string, string> = { node: 'Node.js 20+', git: 'Git', dependencies: 'Dependencies', browser: 'Playwright browser', project: 'Project location', codex: 'Codex CLI and sign-in', sandbox: 'Codex elevated sandbox', defender: 'Controlled Folder Access', 'twitch-app': 'Twitch app', accounts: 'Broadcaster and bot', reward: 'Pitch reward', overlay: 'OBS overlay' };
checksBox.setAttribute('aria-busy', 'true');
for (const [step, ids] of stepChecks.entries()) {
  const group = document.createElement('section'); group.className = 'setup-check-group';
  appendText(group, 'h2', steps[step]);
  for (const id of ids) {
    const row = document.createElement('article'); row.className = 'setup-check-row'; row.dataset.check = id;
    const description = document.createElement('div'); appendText(description, 'strong', loadingLabels[id]); appendText(description, 'p', 'Checking this PC…');
    row.append(description); appendText(row, 'span', 'Checking…', 'state-unavailable'); group.append(row);
  }
  checksBox.append(group);
}

function render() {
  sessionStorage.setItem('live-patch:setup-step', String(current));
  for (const [index, button] of Array.from(stepNav.querySelectorAll<HTMLButtonElement>('button')).entries()) {
    button.className = `setup-step ${index === current ? 'current' : index < current ? 'done' : 'upcoming'}`;
    button.textContent = `${index < current ? '✓ ' : ''}${index + 1} ${steps[index]}`;
    button.setAttribute('aria-current', index === current ? 'step' : 'false');
  }
  for (const [index, panel] of Array.from(checksBox.querySelectorAll<HTMLElement>('.setup-check-group')).entries()) panel.hidden = index !== current;
  for (const [index, id] of [[3, 'step-twitch'], [4, 'step-game'], [5, 'step-obs']] as const) (root.querySelector<HTMLElement>(`#${id}`)!).hidden = index !== current;
  const items = latest?.checks.filter(item => stepChecks[current].includes(item.id)) ?? [];
  const required = current === 2 ? items.filter(item => item.id === 'sandbox') : items;
  const ready = current >= 3 || skipped.has(current) || (required.length > 0 && required.every(item => item.state === 'Ready'));
  (root.querySelector<HTMLButtonElement>('#setup-continue')!).disabled = !ready;
  (root.querySelector<HTMLButtonElement>('#setup-back')!).disabled = current === 0;
  root.querySelector('#setup-continue')!.textContent = current === 5 ? 'Finish setup →' : 'Continue →';
}

async function refresh(force = false) {
  const data = await fetch('/api/setup', force ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) } : undefined).then(response => response.json()) as SetupData;
  if (!Array.isArray(data.checks)) throw Error('Setup checks unavailable');
  latest = data; diagnostics = data.diagnostics;
  checksBox.setAttribute('aria-busy', 'false');
  checksBox.replaceChildren();
  for (const [step, ids] of stepChecks.entries()) {
    const group = document.createElement('section'); group.className = 'setup-check-group';
    appendText(group, 'h2', steps[step]);
    for (const id of ids) {
      const item = data.checks.find(check => check.id === id); if (!item) continue;
      const row = document.createElement('article'); row.className = 'setup-check-row'; row.dataset.check = item.id;
      const description = document.createElement('div'); appendText(description, 'strong', item.label); appendText(description, 'p', item.reason); if (item.fix) appendText(description, 'small', item.fix);
      const status = appendText(row, 'span', item.state, item.state === 'Ready' ? 'state-ready' : item.state === 'Needs action' ? 'state-action' : 'state-unavailable');
      row.prepend(description);
      const button = document.createElement('button'); button.className = 'secondary'; button.textContent = checkActions[id]?.label ?? 'Check again';
      button.addEventListener('click', () => { const action = checkActions[id]; if (action) action.action(); else void refresh(true); }); row.append(button);
      if (status.textContent === 'Ready') row.classList.add('ready');
      group.append(row);
    }
    if (step === 2) {
      const selfTest = document.createElement('button'); selfTest.id = 'sandbox-test'; selfTest.className = 'secondary'; selfTest.textContent = 'Run sandbox self-test';
      selfTest.addEventListener('click', () => { void setupAction('self-test'); }); group.append(selfTest);
    }
    checksBox.append(group);
  }
  const form = root.querySelector<HTMLFormElement>('#twitch-credentials')!;
  (form.elements.namedItem('clientId') as HTMLInputElement).value = data.credentials.clientId;
  (form.elements.namedItem('redirectUri') as HTMLInputElement).value = data.credentials.redirectUri;
  (form.elements.namedItem('rewardId') as HTMLInputElement).value = data.credentials.rewardId;
  const secret = form.elements.namedItem('clientSecret') as HTMLInputElement;
  secret.value = ''; secret.disabled = data.credentials.secretSet;
  (root.querySelector<HTMLButtonElement>('#replace-secret')!).hidden = !data.credentials.secretSet;
  root.querySelector('#secret-state')!.textContent = data.credentials.secretSet ? 'set · enter a new value to replace' : 'not set';
  render();
}

async function setupAction(action: string) {
  const notice = root.querySelector('#sandbox-notice')!; notice.textContent = 'Checking…';
  const response = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
  const result = await response.json() as { check?: Check; error?: string; diagnostics?: string };
  notice.textContent = result.check ? `${result.check.state}: ${result.check.reason}` : result.error ?? 'Setup check failed';
  diagnostics = result.diagnostics ?? ''; await refresh(true);
}
root.querySelector('#setup-back')!.addEventListener('click', () => { current = Math.max(0, current - 1); render(); });
root.querySelector('#setup-continue')!.addEventListener('click', () => {
  if (current < steps.length - 1) { current++; render(); }
  else { localStorage.setItem('live-patch:setup-complete', '1'); location.href = '/?view=practice'; }
});
root.querySelector('#setup-skip')!.addEventListener('click', () => { skipped.add(current); sessionStorage.setItem('live-patch:setup-skipped', JSON.stringify([...skipped])); localStorage.setItem('live-patch:setup-skipped', '1'); location.href = '/?view=practice'; });
root.querySelector('#replace-secret')!.addEventListener('click', () => { const secret = root.querySelector<HTMLInputElement>('input[name="clientSecret"]')!; secret.disabled = false; secret.focus(); (root.querySelector<HTMLButtonElement>('#replace-secret')!).hidden = true; });
root.querySelector('#managed-pitch')!.addEventListener('click', async () => {
  if (!confirm('Create or reuse the 1-point Live Patch Pitch reward and use it for new pitches? Your current dashboard reward remains on Twitch.')) return;
  const notice = root.querySelector('#twitch-notice')!; notice.textContent = 'Checking managed reward…';
  try {
    const response = await fetch('/api/twitch/rewards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create-managed-pitch' }) });
    const result = await response.json() as { message?: string; error?: string };
    notice.textContent = result.message ?? result.error ?? `HTTP ${response.status}`;
    if (response.ok) await refresh(true);
  } catch (error) { notice.textContent = String(error); }
});
root.querySelector('#copy-diagnostics')!.addEventListener('click', () => { void navigator.clipboard.writeText(diagnostics || 'No setup diagnostics recorded.'); });
root.querySelector('#copy-overlay')!.addEventListener('click', () => { void navigator.clipboard.writeText(`${location.origin}/overlay.html`); root.querySelector('#overlay-notice')!.textContent = 'Overlay URL copied. Add it as an OBS Browser Source.'; });
root.querySelector<HTMLFormElement>('#twitch-credentials')!.addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const data = new FormData(form);
  const body = { clientId: String(data.get('clientId')), redirectUri: String(data.get('redirectUri')), rewardId: String(data.get('rewardId')), ...(data.get('clientSecret') ? { clientSecret: String(data.get('clientSecret')) } : {}) };
  const response = await fetch('/api/twitch/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json() as { message?: string; error?: string };
  root.querySelector('#twitch-notice')!.textContent = result.message ?? result.error ?? 'Could not save settings'; await refresh(true);
});
root.querySelector('#remove-twitch')!.addEventListener('click', async () => {
  if (!confirm('Remove Twitch app credentials and disconnect both accounts?')) return;
  const response = await fetch('/api/twitch/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remove: true }) });
  const result = await response.json() as { message?: string; error?: string };
  root.querySelector('#twitch-notice')!.textContent = result.message ?? result.error ?? 'Could not remove credentials'; await refresh(true);
});
render();
void refresh().catch(error => { root.querySelector('#sandbox-notice')!.textContent = `Setup checks unavailable: ${String(error)}`; });
