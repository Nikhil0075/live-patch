import fs from 'node:fs';
import path from 'node:path';

interface Ballot { runId: string; openedAt: number; viewers: string[]; confirmed: boolean }
export interface RollbackVote { runId: string; votes: number; threshold: number; ready: boolean; expiresAt: number; confirmed: boolean }

export class RollbackVotes {
  private ballot?: Ballot;
  constructor(private file: string, private now: () => number = Date.now, private threshold = 3, private durationMs = 2 * 60_000) {
    if (fs.existsSync(file)) this.ballot = JSON.parse(fs.readFileSync(file, 'utf8')) as Ballot;
  }
  snapshot(runId?: string): RollbackVote | undefined {
    const ballot = this.ballot;
    if (!ballot || !runId || ballot.runId !== runId || this.now() >= ballot.openedAt + this.durationMs) return undefined;
    return { runId, votes: ballot.viewers.length, threshold: this.threshold, ready: ballot.viewers.length >= this.threshold, expiresAt: ballot.openedAt + this.durationMs, confirmed: ballot.confirmed };
  }
  vote(runId: string, viewerId: string): { accepted: boolean; state: RollbackVote } {
    if (!this.snapshot(runId)) this.ballot = { runId, openedAt: this.now(), viewers: [], confirmed: false };
    const ballot = this.ballot!;
    const accepted = !ballot.viewers.includes(viewerId) && !ballot.confirmed;
    if (accepted) { ballot.viewers.push(viewerId); this.save(); }
    return { accepted, state: this.snapshot(runId)! };
  }
  confirm(runId: string): boolean {
    if (!this.snapshot(runId)?.ready || this.ballot?.confirmed) return false;
    this.ballot!.confirmed = true; this.save(); return true;
  }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.ballot), { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }
}
