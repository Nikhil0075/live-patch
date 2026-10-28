import '../app.css';
import { appendText } from './shared';

interface Check { id: string; label: string; state: 'Ready' | 'Needs action' | 'Not available here'; reason: string; fix?: string }
interface SetupData { checks: Check[]; credentials: { clientId: string; redirectUri: string; rewardId: string; secretSet: boolean }; diagnostics: string }
const root = document.querySelector<HTMLElement>('#setup')!;
root.innerHTML = '<div class="section-head"><div><p class="app-kicker">SIX STEPS TO YOUR FIRST STREAM</p><h2>Guided setup</h2><p class="muted">Practice works without Twitch. Codex writes patches only in its own isolated worktree.</p></div></div><nav class="setup-steps" aria-label="Setup steps"></nav><div id="setup-checks" class="settings-grid"></div><section class="studio-card"><h2>Codex sandbox</h2><p>The elevated Windows sandbox checks that Codex can write inside its worktree and cannot write to this project. Administrator approval is required for setup, not for each stream build.</p><div class="library-card-actions"><button id="sandbox-test" class="secondary">Run sandbox self-test</button><button id="sandbox-setup">Run Codex sandbox setup</button><a class="button secondary" href="ms-settings:windowsdefender" id="windows-security">Open Windows Security</a><button id="copy-diagnostics" class="secondary">Copy diagnostics</button></div><p id="sandbox-notice" role="status"></p><p class="muted">If Controlled Folder Access blocks setup, check Protection history. Allow only the specific executable named in the block, or move this project out of the protected folder. Live Patch never changes Windows Security settings.</p></section><section class="studio-card"><h2>Twitch app · optional for practice</h2><form id="twitch-credentials" class="credential-grid"><label>Client ID<input name="clientId" autocomplete="off"></label><label>Client secret <small id="secret-state"></small><input name="clientSecret" type="password" autocomplete="new-password" placeholder="Leave blank to keep saved secret"><button type="button" id="replace-secret" class="secondary">Replace secret</button></label><label>Exact HTTPS redirect URI<input name="redirectUri" autocomplete="off"></label><label>Pitch reward ID<input name="rewardId" autocomplete="off"></label><div class="library-card-actions"><button>Save and reconnect</button><button type="button" class="danger" id="remove-twitch">Remove Twitch credentials</button></div></form><div class="library-card-actions"><a class="button secondary" href="/api/twitch/auth/broadcaster/start">Connect broadcaster</a><a class="button secondary" href="/api/twitch/auth/bot/start">Connect bot</a></div><p id="twitch-notice" role="status"></p></section><section class="studio-card"><h2>Choose a game and test OBS</h2><p>Pick an active game, then run a practice round. OBS uses the unchanged overlay URL and a separate capture of the game window.</p><div class="library-card-actions"><a class="button secondary" href="/?view=library">Choose game</a><a class="button secondary" href="/?view=practice">Practice round</a><button id="copy-overlay">Copy overlay URL</button><a class="button secondary" href="/overlay.html" target="_blank">Open overlay</a></div><p id="overlay-notice" role="status"></p></section>';
for (const step of ['Requirements', 'Codex sign-in', 'Sandbox', 'Twitch', 'Choose game', 'OBS and practice']) appendText(root.querySelector('.setup-steps')!, 'span', step);
let diagnostics = '';
const checkBox = root.querySelector<HTMLElement>('#setup-checks')!;
async function refresh() {
  const data = await fetch('/api/setup').then(response => response.json()) as SetupData;
  diagnostics = data.diagnostics;
  checkBox.replaceChildren();
  for (const item of data.checks) {
    const box = document.createElement('article'); box.className = 'studio-card setup-check';
    appendText(box, 'strong', item.label);
    appendText(box, 'span', item.state, item.state === 'Ready' ? 'state-ready' : item.state === 'Needs action' ? 'state-action' : 'state-unavailable');
    appendText(box, 'p', item.reason);
    if (item.fix) appendText(box, 'small', item.fix);
    checkBox.append(box);
  }
  const form = root.querySelector<HTMLFormElement>('#twitch-credentials')!;
  (form.elements.namedItem('clientId') as HTMLInputElement).value = data.credentials.clientId;
  (form.elements.namedItem('redirectUri') as HTMLInputElement).value = data.credentials.redirectUri;
  (form.elements.namedItem('rewardId') as HTMLInputElement).value = data.credentials.rewardId;
  const secret = form.elements.namedItem('clientSecret') as HTMLInputElement;
  secret.value = '';
  secret.disabled = data.credentials.secretSet;
  (root.querySelector<HTMLButtonElement>('#replace-secret')!).hidden = !data.credentials.secretSet;
  root.querySelector('#secret-state')!.textContent = data.credentials.secretSet ? 'set · enter a new value to replace' : 'not set';
}
async function setupAction(action: string) {
  const notice = root.querySelector('#sandbox-notice')!; notice.textContent = 'Checking…';
  const response = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
  const result = await response.json() as { check?: Check; error?: string; diagnostics?: string };
  notice.textContent = result.check ? `${result.check.state}: ${result.check.reason}` : result.error ?? 'Setup check failed';
  diagnostics = result.diagnostics ?? '';
  await refresh();
}
root.querySelector('#sandbox-test')!.addEventListener('click', () => { void setupAction('self-test'); });
root.querySelector('#replace-secret')!.addEventListener('click', () => {
  const secret = root.querySelector<HTMLInputElement>('input[name="clientSecret"]')!;
  secret.disabled = false; secret.focus();
  (root.querySelector<HTMLButtonElement>('#replace-secret')!).hidden = true;
});
root.querySelector('#sandbox-setup')!.addEventListener('click', () => { void setupAction('sandbox-setup'); });
root.querySelector('#copy-diagnostics')!.addEventListener('click', () => { void navigator.clipboard.writeText(diagnostics || 'No setup diagnostics recorded.'); });
root.querySelector('#copy-overlay')!.addEventListener('click', () => { void navigator.clipboard.writeText(`${location.origin}/overlay.html`); root.querySelector('#overlay-notice')!.textContent = 'Overlay URL copied. Add it as an OBS Browser Source.'; });
root.querySelector<HTMLFormElement>('#twitch-credentials')!.addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const data = new FormData(form);
  const body = { clientId: String(data.get('clientId')), redirectUri: String(data.get('redirectUri')), rewardId: String(data.get('rewardId')), ...(data.get('clientSecret') ? { clientSecret: String(data.get('clientSecret')) } : {}) };
  const response = await fetch('/api/twitch/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json() as { message?: string; error?: string };
  root.querySelector('#twitch-notice')!.textContent = result.message ?? result.error ?? 'Could not save settings'; await refresh();
});
root.querySelector('#remove-twitch')!.addEventListener('click', async () => {
  if (!confirm('Remove Twitch app credentials and disconnect both accounts?')) return;
  const response = await fetch('/api/twitch/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remove: true }) });
  const result = await response.json() as { message?: string; error?: string };
  root.querySelector('#twitch-notice')!.textContent = result.message ?? result.error ?? 'Could not remove credentials'; await refresh();
});
void refresh().catch(error => { root.querySelector('#sandbox-notice')!.textContent = `Setup checks unavailable: ${String(error)}`; });
