import type { GameAction, GameAdapter, GameEvent } from '../game-api';
import type { GameManifest } from '../manifest/schema';
import { frameDocument } from './frame';
import { EffectLimits } from './effect-limits';
import { WindowCounter } from './window-counter';

export interface MutationFile { name: string; source: string; error: string | null }
interface Loaded {
  file: MutationFile;
  status: 'loading' | 'starting' | 'active' | 'failed' | 'rejected';
  title: string;
  author?: string;
  description?: string;
  startedAt?: number;
  reason?: string;
  frame?: HTMLIFrameElement;
  queue: GameEvent[];
  hooks: Set<string>;
  skippedTickDelta: number;
  droppedEvents: WindowCounter;
  droppedActions: WindowCounter;
  invalidActions: WindowCounter;
  pending?: { id: number; timeout: number; eventType: string };
  loadTimeout?: number;
  budgetStart: number;
  budgetCount: number;
}

const LOAD_DEADLINE_MS = 1500;
// The frame and Worker share a busy streaming PC with Codex and a second smoke browser.
// Keep a finite deadline, but allow scheduler stalls without disabling an innocent patch.
const EVENT_DEADLINE_MS = 1800;
const MAX_ACTIONS_PER_SECOND = 60;

function normalizeAction(action: GameAction, manifest: GameManifest): GameAction | null {
  if (!action || typeof action.type !== 'string' || !Array.isArray(action.args)) return null;
  if (!Object.hasOwn(manifest.actions, action.type)) return null;
  const schema = manifest.actions[action.type];
  if (!schema || action.args.length > schema.length) return null;
  const args: (string | number | undefined)[] = [];
  for (const [index, rule] of schema.entries()) {
    const value = action.args[index];
    if (value === undefined) { if (!rule.optional) return null; args.push(undefined); continue; }
    if (typeof value !== rule.type) return null;
    if (rule.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) return null;
      args.push(Math.min(rule.max ?? Infinity, Math.max(rule.min ?? -Infinity, value)));
    } else {
      if (typeof value !== 'string' || (rule.values && !rule.values.includes(value))) return null;
      args.push(value.slice(0, rule.maxLength ?? Infinity));
    }
  }
  return { type: action.type, args };
}

function freshCounters() { return { hooks: new Set<string>(), skippedTickDelta: 0, droppedEvents: new WindowCounter(10_000), droppedActions: new WindowCounter(10_000), invalidActions: new WindowCounter(60_000) }; }

export class MutationHost {
  private loaded = new Map<string, Loaded>();
  private nextId = 1;
  private effectLimits: EffectLimits;
  private paused = false;
  private deferredActions: { action: GameAction; origin: string }[] = [];
  private deliveredTicks = 0;

  constructor(private game: GameAdapter, private manifest: GameManifest, private list: HTMLElement, private notice: HTMLElement) {
    this.effectLimits = new EffectLimits(manifest);
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
        this.loaded.set(file.name, { file, status: 'rejected', title: file.name, reason: file.error, queue: [], budgetStart: 0, budgetCount: 0, ...freshCounters() });
        this.notice.textContent = `${file.name} rejected: ${file.error}`;
      } else this.load(file);
    }
    this.render();
  }

  emit(event: GameEvent) {
    if (this.paused) return;
    for (const entry of this.loaded.values()) {
      if (entry.status !== 'active' || event.origin === entry.file.name) continue;
      if (!entry.hooks.has(event.type)) continue;
      if (event.type === 'tick') {
        const delta = typeof event.delta === 'number' ? event.delta : 0;
        const queued = entry.queue.find(item => item.type === 'tick');
        if (queued) { queued.delta = (typeof queued.delta === 'number' ? queued.delta : 0) + delta; continue; }
        if (entry.pending) { entry.skippedTickDelta += delta; continue; }
        entry.queue.push({ ...event, delta: delta + entry.skippedTickDelta });
        entry.skippedTickDelta = 0;
      } else {
        if (entry.queue.length >= 64) {
          const removed = entry.queue.shift();
          if (removed?.type === 'tick' && typeof removed.delta === 'number') entry.skippedTickDelta += removed.delta;
          entry.droppedEvents.add();
        }
        entry.queue.push(event);
      }
      this.pump(entry);
    }
  }

  private load(file: MutationFile) {
    const frame = document.createElement('iframe');
    frame.sandbox.add('allow-scripts');
    frame.style.display = 'none';
    frame.srcdoc = frameDocument;
    const entry: Loaded = { file, frame, status: 'loading', title: file.name, queue: [], budgetStart: 0, budgetCount: 0, ...freshCounters() };
    this.loaded.set(file.name, entry);
    let loadCount = 0;
    frame.addEventListener('load', () => {
      loadCount++;
      if (loadCount > 1) { this.disable(entry, 'Mutation frame navigated'); return; }
      frame.contentWindow?.postMessage({ type: 'load', source: file.source, hooks: this.manifest.hooks }, '*');
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
      if (entry.status !== 'loading' || !meta || !['id', 'title', 'author', 'description'].every(key => typeof meta[key] === 'string' && meta[key].length > 0 && meta[key].length < 120) || !Array.isArray(data.hooks) || !data.hooks.every((hook: unknown) => typeof hook === 'string' && Object.hasOwn(this.manifest.hooks, hook))) {
        this.disable(entry, 'Malformed ready message'); return;
      }
      window.clearTimeout(entry.loadTimeout);
      entry.status = 'starting'; entry.title = meta.title; entry.author = meta.author; entry.description = meta.description; entry.hooks = new Set(data.hooks);
      entry.queue.push({ type: 'start' });
      this.pump(entry);
    } else if (data.type === 'reply') {
      if (!['starting', 'active'].includes(entry.status) || !entry.pending || data.id !== entry.pending.id || !Array.isArray(data.actions) || (data.skipped !== undefined && (!Number.isSafeInteger(data.skipped) || data.skipped < 0))) {
        this.disable(entry, 'Malformed event reply'); return;
      }
      const completedType = entry.pending.eventType;
      window.clearTimeout(entry.pending.timeout); entry.pending = undefined;
      const now = Date.now();
      if (now - entry.budgetStart >= 1000) { entry.budgetStart = now; entry.budgetCount = 0; }
      entry.droppedActions.add(Math.max(0, data.actions.length - 20) + (data.skipped ?? 0));
      for (const action of (data.actions as GameAction[]).slice(0, 20)) {
        if (entry.budgetCount >= MAX_ACTIONS_PER_SECOND) { entry.droppedActions.add(); continue; }
        const normalized = normalizeAction(action, this.manifest);
        if (!normalized) {
          if (entry.invalidActions.add() >= 10) { this.disable(entry, 'Repeated invalid game actions'); return; }
          continue;
        }
        if (!this.effectLimits.allow(normalized, entry.file.name)) { entry.droppedActions.add(); continue; }
        entry.budgetCount++;
        try { if (this.paused) this.deferredActions.push({ action: normalized, origin: entry.file.name }); else this.game.apply(normalized, entry.file.name); }
        catch (error) { this.disable(entry, `Game action failed: ${String(error)}`); return; }
      }
      if (completedType === 'start') { entry.status = 'active'; entry.startedAt = Date.now(); }
      this.pump(entry);
    } else if (data.type === 'error') this.disable(entry, String(data.error).slice(0, 200));
    else this.disable(entry, 'Unknown worker message');
    this.render();
  };

  private pump(entry: Loaded) {
    if (this.paused || !['starting', 'active'].includes(entry.status) || entry.pending || !entry.queue.length) return;
    const events = entry.status === 'starting' ? [entry.queue.shift()!] : entry.queue.splice(0, 16);
    this.deliveredTicks += events.filter(event => event.type === 'tick').length;
    const id = this.nextId++;
    const deadline = Math.min(2200, EVENT_DEADLINE_MS + (events.length - 1) * 25);
    entry.pending = { id, eventType: events[0].type, timeout: window.setTimeout(() => this.disable(entry, 'Event deadline exceeded'), deadline) };
    entry.frame?.contentWindow?.postMessage({ type: 'event', id, events, state: this.game.snapshot(), actions: Object.keys(this.manifest.actions), hooks: this.manifest.hooks }, '*');
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
    this.deferredActions = this.deferredActions.filter(item => item.origin !== entry.file.name);
    window.clearTimeout(entry.loadTimeout);
    if (entry.pending) window.clearTimeout(entry.pending.timeout);
    entry.frame?.contentWindow?.postMessage({ type: 'dispose' }, '*');
    entry.frame?.remove(); entry.frame = undefined; entry.pending = undefined; entry.queue.length = 0;
  }

  private render() {
    this.list.replaceChildren();
    for (const entry of this.loaded.values()) {
      const li = document.createElement('li');
      const droppedActions = entry.droppedActions.current(), droppedEvents = entry.droppedEvents.current();
      li.textContent = `${entry.title} · ${entry.status}${entry.reason ? ` · ${entry.reason}` : ''}${droppedActions ? ` · ${droppedActions} actions skipped in 10s` : ''}${droppedEvents ? ` · ${droppedEvents} events skipped in 10s` : ''}`;
      this.list.append(li);
    }
    if (!this.loaded.size) { const li = document.createElement('li'); li.textContent = 'No mutations yet'; this.list.append(li); }
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused) {
      for (const item of this.deferredActions.splice(0)) {
        const entry = this.loaded.get(item.origin);
        if (entry?.status === 'active') this.game.apply(item.action, item.origin);
      }
      for (const entry of this.loaded.values()) this.pump(entry);
    }
  }

  entries() { return [...this.loaded.values()].map(item => ({ title: item.title, author: item.author ?? 'Unknown viewer', description: item.description ?? '', status: item.status, reason: item.reason, startedAt: item.startedAt })); }
  tickDeliveries() { return this.deliveredTicks; }

  destroy() { window.removeEventListener('message', this.onMessage); for (const entry of this.loaded.values()) this.dispose(entry); this.loaded.clear(); }
}
