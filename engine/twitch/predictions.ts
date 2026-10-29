import fs from 'node:fs';
import path from 'node:path';
import type { TwitchAuth } from './auth';

export interface PatchPrediction { id: string; ideaId: string; shipId: string; failId: string; status: 'open' | 'settling' | 'resolved' | 'canceled' | 'error'; error?: string; createdAt?: string }
export class PatchPredictions {
  private records: PatchPrediction[];
  private operation: Promise<unknown> = Promise.resolve();
  constructor(private file: string, private auth: TwitchAuth) {
    this.records = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as PatchPrediction[] : [];
  }
  setAuth(auth: TwitchAuth) { this.auth = auth; }
  list() { return this.records.map(record => ({ ...record })); }
  active() { return this.records.find(record => ['open', 'settling', 'error'].includes(record.status)); }
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = this.operation.then(work);
    this.operation = result.catch(() => {});
    return result;
  }
  start(ideaId: string, title: string): Promise<PatchPrediction> { return this.serialize(() => this.startNow(ideaId, title)); }
  private async startNow(ideaId: string, title: string): Promise<PatchPrediction> {
    if (this.active()) throw Error('Settle or cancel the current prediction first');
    const broadcaster = this.auth.identity('broadcaster');
    if (!broadcaster || !this.auth.hasScope('broadcaster', 'channel:manage:predictions')) throw Error('Reconnect the broadcaster with prediction permission');
    const response = await this.auth.helix('broadcaster', 'predictions', { broadcaster_id: broadcaster.id, title: `Will this patch ship? ${title}`.slice(0, 45), outcomes: [{ title: 'Ships' }, { title: 'Fails' }], prediction_window: 120 });
    if (!response.ok) throw Error(`Twitch prediction start returned ${response.status}`);
    const data = await response.json() as { data?: { id: string; outcomes: { id: string }[] }[] };
    const result = data.data?.[0];
    if (!result?.id || result.outcomes?.length !== 2) throw Error('Twitch prediction response was incomplete');
    const record: PatchPrediction = { id: result.id, ideaId, shipId: result.outcomes[0].id, failId: result.outcomes[1].id, status: 'open', createdAt: new Date().toISOString() };
    this.records.push(record); this.save(); return record;
  }
  settle(ideaId: string, shipped: boolean): Promise<PatchPrediction | undefined> { return this.serialize(() => this.settleNow(ideaId, shipped)); }
  private async settleNow(ideaId: string, shipped: boolean): Promise<PatchPrediction | undefined> {
    const record = this.active();
    if (!record || record.ideaId !== ideaId) return undefined;
    return this.end(record, 'RESOLVED', shipped ? record.shipId : record.failId);
  }
  cancel(): Promise<PatchPrediction | undefined> { return this.serialize(() => this.cancelNow()); }
  private async cancelNow(): Promise<PatchPrediction | undefined> {
    const record = this.active();
    if (!record) return undefined;
    return this.end(record, 'CANCELED');
  }
  reconcile(): Promise<void> { return this.serialize(() => this.reconcileNow()); }
  private async reconcileNow(): Promise<void> {
    const record = this.active();
    if (!record) return;
    const broadcaster = this.auth.identity('broadcaster');
    if (!broadcaster) { record.status = 'error'; record.error = 'Reconnect broadcaster to check the prediction'; this.save(); return; }
    try {
      const response = await this.auth.helix('broadcaster', `predictions?broadcaster_id=${encodeURIComponent(broadcaster.id)}&id=${encodeURIComponent(record.id)}`);
      if (!response.ok) throw Error(`Twitch prediction lookup returned ${response.status}`);
      const data = await response.json() as { data?: { status: string }[] };
      const status = data.data?.[0]?.status;
      if (status === 'RESOLVED') record.status = 'resolved';
      else if (status === 'CANCELED') record.status = 'canceled';
      else { record.status = 'error'; record.error = 'Prediction is still live after restart; cancel it or settle the build outcome'; }
      this.save();
    } catch (error) { record.status = 'error'; record.error = String(error); this.save(); }
  }
  private async end(record: PatchPrediction, status: 'RESOLVED' | 'CANCELED', winningId?: string): Promise<PatchPrediction> {
    const broadcaster = this.auth.identity('broadcaster');
    if (!broadcaster) throw Error('Reconnect broadcaster to settle prediction');
    record.status = 'settling'; record.error = undefined; this.save();
    try {
      const body = { broadcaster_id: broadcaster.id, id: record.id, status, ...(winningId ? { winning_outcome_id: winningId } : {}) };
      const response = await this.auth.helixRequest('broadcaster', 'predictions', 'PATCH', body);
      if (!response.ok) throw Error(`Twitch prediction ${status.toLowerCase()} returned ${response.status}`);
      record.status = status === 'RESOLVED' ? 'resolved' : 'canceled'; this.save(); return { ...record };
    } catch (error) { record.status = 'error'; record.error = String(error); this.save(); throw error; }
  }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.records), { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }
}
