import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const ideaStatuses = ['submitted', 'shortlisted', 'voting', 'approved', 'building', 'shipped', 'rolled_back', 'failed', 'rejected', 'merged', 'lost_vote'] as const;
export type IdeaStatus = typeof ideaStatuses[number];
export interface Idea {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  spec?: string;
  contributors?: string[];
  mergedInto?: string;
  source: 'chat' | 'reward';
  status: IdeaStatus;
  votes: string[];
  createdAt: string;
  updatedAt: string;
}
interface Saved { version: 1; ideas: Idea[]; rollbackRequests: { by: string; at: string }[] }

export class IdeaStore {
  private data: Saved;
  constructor(private file: string) {
    this.data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as Saved : { version: 1, ideas: [], rollbackRequests: [] };
    if (this.data.version !== 1 || !Array.isArray(this.data.ideas) || !Array.isArray(this.data.rollbackRequests)) throw Error('Invalid idea store');
  }
  list() { return this.data.ideas.map(idea => ({ ...idea, votes: [...idea.votes] })); }
  rollbackRequests() { return [...this.data.rollbackRequests]; }
  add(authorId: string, authorName: string, text: string, source: Idea['source'], now = Date.now()): Idea {
    const idea: Idea = { id: randomUUID(), authorId, authorName, text, source, status: 'submitted', votes: [], createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() };
    this.data.ideas.push(idea); this.save(); return { ...idea, votes: [] };
  }
  recentBy(authorId: string, since: number) { return this.data.ideas.some(idea => idea.authorId === authorId && Date.parse(idea.createdAt) >= since); }
  candidate(number: number) { return this.data.ideas.filter(idea => ['submitted', 'shortlisted', 'voting'].includes(idea.status)).slice(-3).reverse()[number - 1]; }
  find(idOrNumber: string) { return /^\d+$/.test(idOrNumber) ? this.candidate(Number(idOrNumber)) : this.data.ideas.find(idea => idea.id === idOrNumber); }
  setStatus(id: string, status: IdeaStatus): Idea | undefined {
    const idea = this.data.ideas.find(item => item.id === id);
    if (!idea) return;
    idea.status = status; idea.updatedAt = new Date().toISOString(); this.save(); return { ...idea, votes: [...idea.votes] };
  }
  setSpec(id: string, spec: string): Idea | undefined {
    const idea = this.data.ideas.find(item => item.id === id);
    if (!idea) return;
    idea.spec = spec.slice(0, 200); idea.updatedAt = new Date().toISOString(); this.save(); return { ...idea, votes: [...idea.votes] };
  }
  merge(id: string, targetId: string): void {
    const idea = this.data.ideas.find(item => item.id === id);
    const target = this.data.ideas.find(item => item.id === targetId);
    if (!idea || !target || id === targetId) throw Error('Invalid idea merge');
    idea.status = 'merged'; idea.mergedInto = target.id; idea.updatedAt = new Date().toISOString();
    target.contributors = [...new Set([...(target.contributors ?? [target.authorName]), idea.authorName])];
    target.updatedAt = new Date().toISOString(); this.save();
  }
  clearVotes(ids: string[]): void {
    const selected = new Set(ids);
    for (const idea of this.data.ideas) if (selected.has(idea.id)) idea.votes = [];
    this.save();
  }
  vote(id: string, viewerId: string): Idea | undefined {
    const idea = this.data.ideas.find(item => item.id === id);
    if (!idea) return;
    for (const item of this.data.ideas) item.votes = item.votes.filter(voter => voter !== viewerId);
    idea.votes.push(viewerId);
    if (idea.status === 'submitted' || idea.status === 'shortlisted') idea.status = 'voting';
    idea.updatedAt = new Date().toISOString(); this.save(); return { ...idea, votes: [...idea.votes] };
  }
  requestRollback(by: string) { this.data.rollbackRequests.push({ by, at: new Date().toISOString() }); this.save(); }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }
}
