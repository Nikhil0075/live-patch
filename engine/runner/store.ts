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
  error?: string;
}
export interface RunnerEvent { runId: string; ideaId: string; type: 'started' | 'sandbox_verified' | 'thread' | 'file' | 'testing' | 'passed' | 'failed' | 'shipped' | 'rolled_back'; at: string; message?: string; threadId?: string }

export function publicRun(record: RunRecord) {
  return { id: record.id, ideaId: record.ideaId, status: record.status, startedAt: record.startedAt, finishedAt: record.finishedAt, durationMs: record.durationMs, threadId: record.threadId, mutationName: record.mutationName, error: record.error ? 'Build failed; see local run record' : undefined };
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
