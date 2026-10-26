import type { Action, GameAdapter, GameEvent } from '../game-api';
import { frameDocument } from './frame';

export interface MutationFile { name: string; source: string; error: string | null }
interface Loaded { file: MutationFile; frame: HTMLIFrameElement; status: 'loading' | 'active' | 'failed'; title: string }

export class MutationHost {
  private loaded = new Map<string, Loaded>();
  private game: GameAdapter;
  private list: HTMLElement;
  private notice: HTMLElement;
  private failed = new Map<string, string>();

  constructor(game: GameAdapter, list: HTMLElement, notice: HTMLElement) {
    this.game = game; this.list = list; this.notice = notice;
    window.addEventListener('message', this.onMessage);
  }
  private onMessage = (event: MessageEvent) => {
    const entry = [...this.loaded.values()].find(item => item.frame.contentWindow === event.source);
    if (!entry || event.origin !== 'null' || !event.data || typeof event.data.type !== 'string') return;
    if (event.data.type === 'ready') {
      entry.status = 'active'; entry.title = event.data.meta.title;
      entry.frame.contentWindow?.postMessage({ type: 'event', event: { type: 'start' }, state: this.game.snapshot() }, '*');
    } else if (event.data.type === 'error') this.disable(entry.file.name, String(event.data.error));
    else if (event.data.type === 'actions' && entry.status === 'active' && Array.isArray(event.data.actions)) {
      for (const action of event.data.actions.slice(0, 20)) this.game.apply(action as Action);
    }
    this.render();
  };
  sync(files: MutationFile[]) {
    const changed = files.length !== this.loaded.size || files.some(file => {
      const prior = this.loaded.get(file.name);
      return prior?.file.source !== file.source || prior?.file.error !== file.error;
    });
    if (!changed) return;
    for (const name of this.loaded.keys()) this.unload(name);
    this.game.resetMutations();
    for (const file of files) {
      if (file.error) { this.notice.textContent = `${file.name} rejected: ${file.error}`; continue; }
      if (this.failed.get(file.name) === file.source) continue;
      this.failed.delete(file.name);
      this.load(file);
    }
    this.render();
  }
  emit(event: GameEvent) {
    const state = this.game.snapshot();
    for (const item of this.loaded.values()) if (item.status === 'active') item.frame.contentWindow?.postMessage({ type: 'event', event, state }, '*');
  }
  private disable(name: string, reason: string) {
    const item = this.loaded.get(name);
    if (!item) return;
    this.failed.set(name, item.file.source);
    item.status = 'failed'; item.frame.remove();
    this.notice.textContent = `${name} disabled: ${reason}`;
    const remaining = [...this.loaded.values()].filter(value => value.status !== 'failed' && value.file.name !== name).map(value => value.file);
    for (const other of [...this.loaded.keys()]) if (other !== name) this.unload(other);
    this.game.resetMutations();
    for (const file of remaining) this.load(file);
  }
  private unload(name: string) { this.loaded.get(name)?.frame.remove(); this.loaded.delete(name); }
  private load(file: MutationFile) {
    const frame = document.createElement('iframe');
    frame.sandbox.add('allow-scripts');
    frame.style.display = 'none';
    frame.srcdoc = frameDocument;
    document.body.append(frame);
    const loaded: Loaded = { file, frame, status: 'loading', title: file.name };
    this.loaded.set(file.name, loaded);
    frame.addEventListener('load', () => frame.contentWindow?.postMessage({ type: 'load', source: file.source }, '*'), { once: true });
  }
  private render() {
    this.list.replaceChildren();
    for (const item of this.loaded.values()) {
      const li = document.createElement('li'); li.textContent = `${item.title} · ${item.status}`; this.list.append(li);
    }
    if (!this.loaded.size) { const li = document.createElement('li'); li.textContent = 'No mutations yet'; this.list.append(li); }
  }
  destroy() { window.removeEventListener('message', this.onMessage); for (const name of this.loaded.keys()) this.unload(name); }
}
