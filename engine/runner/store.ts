import fs from 'node:fs';
import path from 'node:path';

export type RunStatus = 'building' | 'shipped' | 'failed' | 'rolled_back';
export interface RunRecord {
  id: string;
  ideaId: string;
  gameDirectory: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  threadId?: string;
  branch?: string;
  commit?: string;
  mutationName?: string;
  mutationTitle?: string;
  demo?: boolean;
  error?: string;
  failureKind?: 'patch' | 'infrastructure';
}
export interface RunnerEvent { runId: string; ideaId: string; type: 'started' | 'sandbox_verified' | 'thread' | 'file' | 'testing' | 'passed' | 'failed' | 'shipped' | 'rolled_back'; at: string; message?: string; threadId?: string }

export function publicFailure(error?: string): string | undefined {
  if (!error) return undefined;
  if (error === 'Cancelled by moderator rollback' || error === 'Cancelled by operator') return error;
  if (error.startsWith('Error: Saved builds are play-only')) return 'Saved builds are play-only; return to the original game to build new patches';
  if (/Codex sandbox cannot write in its worktree|Codex sandbox can write outside its worktree|Sandbox probe path already exists/.test(error))
    return 'Sandbox setup failed; see README and local run record';
  return 'Build failed; see local run record';
}

export function publicRun(record: RunRecord) {
  return { id: record.id, ideaId: record.ideaId, status: record.status, startedAt: record.startedAt, finishedAt: record.finishedAt, durationMs: record.durationMs, threadId: record.threadId, mutationName: record.mutationName, mutationTitle: record.mutationTitle, demo: record.demo, error: publicFailure(record.error) };
}

export class RunStore {
  private records: RunRecord[];
  constructor(private file: string) {
    this.records = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as RunRecord[] : [];
    if (!Array.isArray(this.records)) throw Error('Invalid runner store');
  }
  list() { return this.records.map(record => ({ ...record })); }
  get(id: string) { return this.records.find(record => record.id === id); }
  lastShipped(gameDirectory: string) { return [...this.records].reverse().find(record => record.gameDirectory === gameDirectory && record.status === 'shipped'); }
  upsert(record: RunRecord) {
    const index = this.records.findIndex(item => item.id === record.id);
    if (index === -1) this.records.push({ ...record });
    else this.records[index] = { ...record };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.records, null, 2), { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }
}
