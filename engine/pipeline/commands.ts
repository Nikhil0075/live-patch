import type { Idea } from './ideas';
import { IdeaStore } from './ideas';

export interface Viewer { id: string; login: string; name: string; moderator: boolean; broadcaster: boolean }
export type InboundEvent =
  | { kind: 'chat'; origin: 'twitch' | 'simulator'; id: string; viewer: Viewer; text: string }
  | { kind: 'reward'; origin: 'twitch' | 'simulator'; id: string; viewer: Viewer; rewardId: string; text: string };
export interface Outcome { accepted: boolean; command: string; message: string; idea?: Idea }
export interface PipelineOptions {
  rewardId: string;
  reply: (text: string, event: InboundEvent) => Promise<void>;
  onChat?: (event: Extract<InboundEvent, { kind: 'chat' }>) => void;
  onControl?: (action: 'approve' | 'reject' | 'rollback', idea?: Idea) => void;
  now?: () => number;
}
const IDEA_MAX_LENGTH = 200;
const IDEA_COOLDOWN_MS = 3 * 60_000;

export class ChatPipeline {
  private seen = new Map<string, number>();
  private lastErrorReply = new Map<string, number>();
  constructor(private store: IdeaStore, private options: PipelineOptions) {}
  async ingest(event: InboundEvent): Promise<Outcome> {
    const now = this.options.now?.() ?? Date.now();
    if (this.seen.has(event.id)) return { accepted: false, command: 'duplicate', message: 'Already handled' };
    this.seen.set(event.id, now);
    for (const [id, at] of this.seen) if (at < now - 10 * 60_000) this.seen.delete(id);
    if (event.kind === 'chat') this.options.onChat?.(event);
    if (event.kind === 'reward') {
      if (!this.options.rewardId || event.rewardId !== this.options.rewardId) return { accepted: false, command: 'reward', message: 'Unconfigured reward' };
      return this.submit(event, event.text, 'reward', now);
    }
    const match = /^!(idea|vote|approve|reject|rollback)(?:\s+(.*))?$/is.exec(event.text.trim());
    if (!match) return { accepted: false, command: 'chat', message: 'No command' };
    const command = match[1].toLowerCase();
    const argument = (match[2] ?? '').trim();
    if (command === 'idea') return this.submit(event, argument, 'chat', now);
    if (command === 'vote') {
      const number = Number(argument);
      if (!/^[1-3]$/.test(argument)) return this.respond(event, command, 'Vote for 1, 2, or 3.');
      const candidate = this.store.candidate(number);
      if (!candidate) return this.respond(event, command, 'There is no idea at that number yet.');
      const idea = this.store.vote(candidate.id, event.viewer.id)!;
      await this.options.reply(`@${event.viewer.login} voted for ${number}. Voting is open for the latest three ideas.`, event);
      return { accepted: true, command, message: 'Vote recorded', idea };
    }
    if (!event.viewer.moderator && !event.viewer.broadcaster) return { accepted: false, command, message: 'Only a moderator or broadcaster can use that command.' };
    if (command === 'rollback') {
      this.store.requestRollback(event.viewer.id);
      this.options.onControl?.('rollback');
      return this.respond(event, command, 'Rollback requested. The runner will handle it in Phase 3.', true);
    }
    const idea = this.store.find(argument);
    if (!idea) return this.respond(event, command, 'Idea not found. Use its ID or current number.');
    if (!['submitted', 'shortlisted', 'voting'].includes(idea.status)) return this.respond(event, command, 'That idea is no longer pending.');
    const updated = this.store.setStatus(idea.id, command === 'approve' ? 'approved' : 'rejected')!;
    this.options.onControl?.(command as 'approve' | 'reject', updated);
    await this.options.reply(`${command === 'approve' ? 'Approved' : 'Rejected'} idea by @${idea.authorName}: ${idea.text}`, event);
    return { accepted: true, command, message: updated.status, idea: updated };
  }
  private async submit(event: InboundEvent, text: string, source: Idea['source'], now: number): Promise<Outcome> {
    if (!text || text.length > IDEA_MAX_LENGTH) return this.respond(event, 'idea', `Ideas must be 1–${IDEA_MAX_LENGTH} characters.`);
    if (this.store.recentBy(event.viewer.id, now - IDEA_COOLDOWN_MS)) return this.respond(event, 'idea', 'Please wait three minutes before another idea.');
    const idea = this.store.add(event.viewer.id, event.viewer.name, text, source, now);
    await this.options.reply(`@${event.viewer.login} idea received: ${text}`, event);
    return { accepted: true, command: 'idea', message: 'Idea received', idea };
  }
  private async respond(event: InboundEvent, command: string, message: string, accepted = false): Promise<Outcome> {
    const now = this.options.now?.() ?? Date.now();
    const last = this.lastErrorReply.get(event.viewer.id);
    if (accepted || last === undefined || now - last >= 30_000) {
      if (!accepted) this.lastErrorReply.set(event.viewer.id, now);
      await this.options.reply(`@${event.viewer.login} ${message}`, event);
    }
    return { accepted, command, message };
  }
}
