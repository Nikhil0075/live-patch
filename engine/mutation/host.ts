import type { GameAction, GameAdapter, GameEvent } from '../game-api';
import type { GameManifest } from '../manifest/schema';
import { frameDocument } from './frame';

export interface MutationFile { name: string; source: string; error: string | null }
interface Loaded {
  file: MutationFile;
  status: 'loading' | 'starting' | 'active' | 'failed' | 'rejected';
  title: string;
  reason?: string;
  frame?: HTMLIFrameElement;
  queue: GameEvent[];
  pending?: { id: number; timeout: number; eventType: string };
  loadTimeout?: number;
  budgetStart: number;
  budgetCount: number;
}

const LOAD_DEADLINE_MS = 1500;
const EVENT_DEADLINE_MS = 200;
const MAX_ACTIONS_PER_SECOND = 60;

function validAction(action: GameAction, manifest: GameManifest): boolean {
  if (!action || typeof action.type !== 'string' || !Array.isArray(action.args)) return false;
  if (!Object.hasOwn(manifest.actions, action.type)) return false;
  const schema = manifest.actions[action.type];
  if (!schema || action.args.length > schema.length) return false;
  return schema.every((rule, index) => {
    const value = action.args[index];
    if (value === undefined) return rule.optional === true;
    if (typeof value !== rule.type) return false;
    if (rule.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value) || (rule.min !== undefined && value < rule.min) || (rule.max !== undefined && value > rule.max))) return false;
    if (rule.type === 'string' && (typeof value !== 'string' || (rule.maxLength !== undefined && value.length > rule.maxLength) || (rule.values && !rule.values.includes(value)))) return false;
    return true;
  });
}

export class MutationHost {
  private loaded = new Map<string, Loaded>();
  private nextId = 1;

  constructor(private game: GameAdapter, private manifest: GameManifest, private list: HTMLElement, private notice: HTMLElement) {
    window.addEventListener('message', this.onMessage);
  }

  sync(files: MutationFile[]) {
    const names = new Set(files.map(file => file.name));
    for (const [name, entry] of this.loaded) if (!names.has(name)) {
      this.dispose(entry); this.game.removeMutation(name); this.loaded.delete(name);
    }
    for (const file of files) {
      const previous = this.loaded.get(file.name);
      if (previous?.file.source === file.source && previous.file.error === file.error) continue;
      if (previous) { this.dispose(previous); this.game.removeMutation(file.name); this.loaded.delete(file.name); }
      if (file.error) {
        this.loaded.set(file.name, { file, status: 'rejected', title: file.name, reason: file.error, queue: [], budgetStart: 0, budgetCount: 0 });
        this.notice.textContent = `${file.name} rejected: ${file.error}`;
      } else this.load(file);
    }
    this.render();
  }

  emit(event: GameEvent) {
    for (const entry of this.loaded.values()) {
      if (entry.status !== 'active' || event.origin === entry.file.name) continue;
      if (event.type === 'tick' && (entry.pending || entry.queue.some(item => item.type === 'tick'))) continue;
      if (entry.queue.length >= 64) { this.disable(entry, 'Event queue limit exceeded'); continue; }
      entry.queue.push(event);
      this.pump(entry);
    }
  }

  private load(file: MutationFile) {
    const frame = document.createElement('iframe');
    frame.sandbox.add('allow-scripts');
    frame.style.display = 'none';
    frame.srcdoc = frameDocument;
    const entry: Loaded = { file, frame, status: 'loading', title: file.name, queue: [], budgetStart: 0, budgetCount: 0 };
    this.loaded.set(file.name, entry);
    let loadCount = 0;
    frame.addEventListener('load', () => {
      loadCount++;
      if (loadCount > 1) { this.disable(entry, 'Mutation frame navigated'); return; }
      frame.contentWindow?.postMessage({ type: 'load', source: file.source }, '*');
    });
    entry.loadTimeout = window.setTimeout(() => this.disable(entry, 'Load deadline exceeded'), LOAD_DEADLINE_MS);
    document.body.append(frame);
  }

  private onMessage = (message: MessageEvent) => {
    const entry = [...this.loaded.values()].find(item => item.frame?.contentWindow === message.source);
    if (!entry) return;
    if (message.origin !== 'null') { this.disable(entry, 'Mutation frame left its sandbox origin'); return; }
    const data = message.data;
    if (!data || typeof data !== 'object' || typeof data.type !== 'string') { this.disable(entry, 'Malformed worker message'); return; }
    if (data.type === 'ready') {
      const meta = data.meta;
      if (entry.status !== 'loading' || !meta || !['id', 'title', 'author', 'description'].every(key => typeof meta[key] === 'string' && meta[key].length > 0 && meta[key].length < 120)) {
        this.disable(entry, 'Malformed ready message'); return;
      }
      window.clearTimeout(entry.loadTimeout);
      entry.status = 'starting'; entry.title = meta.title;
      entry.queue.push({ type: 'start' });
      this.pump(entry);
    } else if (data.type === 'reply') {
      if (!['starting', 'active'].includes(entry.status) || !entry.pending || data.id !== entry.pending.id || !Array.isArray(data.actions) || data.actions.length > 20) {
        this.disable(entry, 'Malformed event reply'); return;
      }
      const completedType = entry.pending.eventType;
      window.clearTimeout(entry.pending.timeout); entry.pending = undefined;
      const now = Date.now();
      if (now - entry.budgetStart >= 1000) { entry.budgetStart = now; entry.budgetCount = 0; }
      entry.budgetCount += data.actions.length;
      if (entry.budgetCount > MAX_ACTIONS_PER_SECOND) { this.disable(entry, 'Action rate limit exceeded'); return; }
      for (const action of data.actions as GameAction[]) {
        if (!validAction(action, this.manifest)) {
          this.disable(entry, 'Invalid game action'); return;
        }
        try { this.game.apply(action, entry.file.name); }
        catch (error) { this.disable(entry, `Game action failed: ${String(error)}`); return; }
      }
      if (completedType === 'start') entry.status = 'active';
      this.pump(entry);
    } else if (data.type === 'error') this.disable(entry, String(data.error).slice(0, 200));
    else this.disable(entry, 'Unknown worker message');
    this.render();
  };

  private pump(entry: Loaded) {
    if (!['starting', 'active'].includes(entry.status) || entry.pending || !entry.queue.length) return;
    const event = entry.queue.shift()!;
    const id = this.nextId++;
    entry.pending = { id, eventType: event.type, timeout: window.setTimeout(() => this.disable(entry, 'Event deadline exceeded'), EVENT_DEADLINE_MS) };
    entry.frame?.contentWindow?.postMessage({ type: 'event', id, event, state: this.game.snapshot(), actions: Object.keys(this.manifest.actions), hooks: this.manifest.hooks }, '*');
  }

  private disable(entry: Loaded, reason: string) {
    if (entry.status === 'failed' || entry.status === 'rejected') return;
    this.dispose(entry);
    this.game.removeMutation(entry.file.name);
    entry.status = 'failed'; entry.reason = reason;
    this.notice.textContent = `${entry.file.name} disabled: ${reason}`;
    this.render();
  }

  private dispose(entry: Loaded) {
    window.clearTimeout(entry.loadTimeout);
    if (entry.pending) window.clearTimeout(entry.pending.timeout);
    entry.frame?.contentWindow?.postMessage({ type: 'dispose' }, '*');
    entry.frame?.remove(); entry.frame = undefined; entry.pending = undefined; entry.queue.length = 0;
  }

  private render() {
    this.list.replaceChildren();
    for (const entry of this.loaded.values()) {
      const li = document.createElement('li');
      li.textContent = `${entry.title} · ${entry.status}${entry.reason ? ` · ${entry.reason}` : ''}`;
      this.list.append(li);
    }
    if (!this.loaded.size) { const li = document.createElement('li'); li.textContent = 'No mutations yet'; this.list.append(li); }
  }

  destroy() { window.removeEventListener('message', this.onMessage); for (const entry of this.loaded.values()) this.dispose(entry); this.loaded.clear(); }
}
