import '../app.css';
import type { StudioSettings } from '../studio/settings';

const root = document.querySelector<HTMLElement>('#settings')!;
root.innerHTML = '<div class="section-head"><div><p class="app-kicker">MAKE THE STREAM YOURS</p><h2>Settings</h2></div></div><form id="studio-settings" class="settings-grid"><section class="studio-card"><h2>Round timing</h2><label>Pitch seconds <input name="pitchSeconds" type="number" min="15" max="600"></label><label>Vote seconds <input name="voteSeconds" type="number" min="10" max="300"></label></section><section class="studio-card"><h2>Sound</h2><label>Master volume <input name="masterVolume" type="range" min="0" max="1" step="0.01"></label><label>Music volume <input name="musicVolume" type="range" min="0" max="1" step="0.01"></label><label>Effects volume <input name="effectsVolume" type="range" min="0" max="1" step="0.01"></label><label><input name="muted" type="checkbox"> Mute all sound</label></section><section class="studio-card"><h2>Effects and overlay</h2><label>Effects intensity <input name="effectsIntensity" type="range" min="0" max="1" step="0.01"></label><label><input name="reduceFlashing" type="checkbox"> Reduce flashing and shake</label><label><input name="overlayCompact" type="checkbox"> Compact overlay</label></section><div><button>Save settings</button><p id="settings-notice" role="status"></p></div></form><p class="muted">Twitch reward ID and app credentials live on the Setup page.</p>';
const form = root.querySelector<HTMLFormElement>('#studio-settings')!;
const numeric: (keyof StudioSettings)[] = ['pitchSeconds', 'voteSeconds', 'masterVolume', 'musicVolume', 'effectsVolume', 'effectsIntensity'];
const checks: (keyof StudioSettings)[] = ['muted', 'reduceFlashing', 'overlayCompact'];
fetch('/api/settings').then(response => response.json()).then((settings: StudioSettings) => {
  for (const key of numeric) (form.elements.namedItem(key) as HTMLInputElement).value = String(settings[key]);
  for (const key of checks) (form.elements.namedItem(key) as HTMLInputElement).checked = Boolean(settings[key]);
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  const body: Record<string, number | boolean> = {};
  for (const key of numeric) body[key] = Number((form.elements.namedItem(key) as HTMLInputElement).value);
  for (const key of checks) body[key] = (form.elements.namedItem(key) as HTMLInputElement).checked;
  const response = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  root.querySelector('#settings-notice')!.textContent = response.ok ? 'Settings saved for your next round and current game.' : 'Settings could not be saved.';
});
