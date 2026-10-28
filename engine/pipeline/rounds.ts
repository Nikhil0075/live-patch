import fs from 'node:fs';
import path from 'node:path';
import { unsafeIdea } from '../runner/gates';
import type { Idea } from './ideas';
import { IdeaStore } from './ideas';
import type { TriageDecision, TriageModel } from './triage';

export type RoundPhase = 'pitch' | 'vote' | 'approval' | 'building' | 'paused';
interface RoundState {
  version: 1;
  number: number;
  phase: RoundPhase;
  deadlineAt: number | null;
  candidateIds: string[];
  selectedId?: string;
  pausedFrom?: Exclude<RoundPhase, 'paused'>;
  remainingMs?: number;
  triagePreview?: TriageDecision[];
}
export interface RoundSnapshot extends Omit<RoundState, 'remainingMs'> {
  candidates: Idea[];
  remainingMs: number | null;
}

const PITCH_MS = 60_000;
const VOTE_MS = 45_000;
const norm = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

export class RoundCoordinator {
  private state: RoundState;
  private timer: ReturnType<typeof setInterval>;
  constructor(private file: string, private ideas: IdeaStore, private onChange: (state: RoundSnapshot) => void = () => {}, private now: () => number = Date.now) {
    const existing = fs.existsSync(file);
    this.state = existing ? JSON.parse(fs.readFileSync(file, 'utf8')) as RoundState : { version: 1, number: 1, phase: 'pitch', deadlineAt: now() + PITCH_MS, candidateIds: [] };
    if (this.state.version !== 1 || !Array.isArray(this.state.candidateIds)) throw Error('Invalid round store');
    if (this.state.phase === 'building') this.startPitch(false);
    else if (!existing) this.publish();
    this.tick();
    this.timer = setInterval(() => this.tick(), 500);
    this.timer.unref?.();
  }
  stop() { clearInterval(this.timer); }
  snapshot(): RoundSnapshot {
    return { ...this.state, candidateIds: [...this.state.candidateIds], candidates: this.state.candidateIds.flatMap(id => this.ideas.list().filter(idea => idea.id === id)), remainingMs: this.state.phase === 'paused' ? this.state.remainingMs ?? null : this.state.deadlineAt === null ? null : Math.max(0, this.state.deadlineAt - this.now()) };
  }
  candidate(number: number): Idea | undefined {
    if (this.state.phase === 'pitch') return this.ideas.candidate(number);
    const id = this.state.candidateIds[number - 1];
    return id ? this.ideas.list().find(idea => idea.id === id) : undefined;
  }
  canVote() { return this.state.phase === 'vote'; }
  triage(idea: Idea): void {
    delete this.state.triagePreview;
    if (unsafeIdea(idea.text)) { this.ideas.setStatus(idea.id, 'rejected'); this.publish(); return; }
    const duplicate = this.ideas.list().find(other => other.id !== idea.id && ['submitted', 'shortlisted', 'voting'].includes(other.status) && norm(other.text) === norm(idea.text));
    if (duplicate) { this.ideas.merge(idea.id, duplicate.id); this.publish(); return; }
    this.ideas.setSpec(idea.id, idea.text.replace(/\s+/g, ' ').trim().slice(0, 160));
    this.ideas.setStatus(idea.id, 'shortlisted');
    this.publish();
  }
  async aiTriage(model: TriageModel): Promise<TriageDecision[]> {
    if (this.state.phase !== 'pitch') throw Error('AI triage is available during the pitch window');
    const pending = this.ideas.list().filter(idea => ['submitted', 'shortlisted'].includes(idea.status)).slice(-12);
    if (!pending.length) return [];
    const decisions = await model.review(pending);
    if (this.state.phase !== 'pitch') throw Error('Round changed while AI triage was running');
    const proposals: TriageDecision[] = [];
    let rejected = 0;
    for (const item of decisions) {
      const index = pending.findIndex(idea => idea.id === item.id);
      if (index < 0 || proposals.some(proposal => proposal.id === item.id)) continue;
      if (item.decision === 'merge' && item.duplicateId && pending.findIndex(idea => idea.id === item.duplicateId) < index && pending.some(idea => idea.id === item.duplicateId))
        proposals.push({ id: item.id, decision: 'merge', duplicateId: item.duplicateId });
      else if (item.decision === 'reject' && rejected < 2) { proposals.push({ id: item.id, decision: 'reject' }); rejected++; }
      else if (item.decision === 'accept' && typeof item.spec === 'string' && item.spec.trim())
        proposals.push({ id: item.id, decision: 'accept', spec: item.spec.replace(/[\r\n\x00-\x1f]+/g, ' ').trim().slice(0, 160) });
    }
    this.state.triagePreview = proposals;
    this.publish();
    return proposals;
  }
  applyTriagePreview(): number {
    if (this.state.phase !== 'pitch' || !this.state.triagePreview) throw Error('No triage preview to apply');
    const proposals = this.state.triagePreview;
    const rejectedIds = new Set(proposals.filter(item => item.decision === 'reject').map(item => item.id));
    let applied = 0;
    for (const item of proposals) {
      const current = this.ideas.list().find(idea => idea.id === item.id);
      if (!current || !['submitted', 'shortlisted'].includes(current.status)) continue;
      if (item.decision === 'merge' && item.duplicateId && !rejectedIds.has(item.duplicateId) && this.ideas.list().some(idea => idea.id === item.duplicateId && ['submitted', 'shortlisted'].includes(idea.status))) { this.ideas.merge(item.id, item.duplicateId); applied++; }
      else if (item.decision === 'reject') { this.ideas.setStatus(item.id, 'rejected'); applied++; }
      else if (item.decision === 'accept' && item.spec) { this.ideas.setSpec(item.id, item.spec); applied++; }
    }
    delete this.state.triagePreview;
    this.publish();
    return applied;
  }
  discardTriagePreview() {
    if (!this.state.triagePreview) return;
    delete this.state.triagePreview; this.publish();
  }
  approved(idea: Idea) {
    this.state.phase = 'building'; this.state.deadlineAt = null; this.state.selectedId = idea.id; this.publish();
  }
  runFinished(ideaId: string) { if (this.state.phase === 'building' && this.state.selectedId === ideaId) this.startPitch(true); }
  forceNext() {
    if (this.state.phase !== 'building' && !(this.state.phase === 'paused' && this.state.pausedFrom === 'building')) throw Error('No build to cancel');
    const selected = this.state.selectedId && this.ideas.list().find(idea => idea.id === this.state.selectedId);
    if (selected && ['approved', 'building'].includes(selected.status)) this.ideas.setStatus(selected.id, 'failed');
    this.startPitch(true);
  }
  pause() {
    if (this.state.phase === 'paused') return;
    this.state.remainingMs = this.state.deadlineAt === null ? undefined : Math.max(0, this.state.deadlineAt - this.now());
    this.state.pausedFrom = this.state.phase; this.state.phase = 'paused'; this.state.deadlineAt = null; this.publish();
  }
  resume() {
    if (this.state.phase !== 'paused') return;
    this.state.phase = this.state.pausedFrom ?? 'pitch';
    this.state.deadlineAt = this.state.remainingMs === undefined ? null : this.now() + this.state.remainingMs;
    delete this.state.pausedFrom; delete this.state.remainingMs; this.publish();
  }
  advance() {
    if (this.state.phase === 'paused') throw Error('Resume the round before advancing');
    if (this.state.phase === 'building') throw Error('A patch is building');
    if (this.state.phase === 'pitch') {
      delete this.state.triagePreview;
      const candidates = this.ideas.list().filter(idea => ['submitted', 'shortlisted'].includes(idea.status)).slice(0, 3);
      if (!candidates.length) { this.state.deadlineAt = this.now() + PITCH_MS; this.publish(); return; }
      this.state.candidateIds = candidates.map(idea => idea.id);
      this.ideas.clearVotes(this.state.candidateIds);
      for (const idea of candidates) this.ideas.setStatus(idea.id, 'voting');
      this.state.phase = 'vote'; this.state.deadlineAt = this.now() + VOTE_MS; this.publish(); return;
    }
    if (this.state.phase === 'vote') { this.state.phase = 'approval'; this.state.deadlineAt = null; this.publish(); return; }
    this.startPitch(true);
  }
  private tick() {
    if (this.state.deadlineAt !== null && this.now() >= this.state.deadlineAt) this.advance();
  }
  private startPitch(increment: boolean) {
    for (const id of this.state.candidateIds) {
      if (this.ideas.list().find(idea => idea.id === id)?.status === 'voting') this.ideas.setStatus(id, 'lost_vote');
    }
    if (increment) this.state.number++;
    this.state.phase = 'pitch'; this.state.deadlineAt = this.now() + PITCH_MS; this.state.candidateIds = []; delete this.state.selectedId; delete this.state.triagePreview;
    this.publish();
  }
  private publish() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    fs.renameSync(temp, this.file);
    this.onChange(this.snapshot());
  }
}
