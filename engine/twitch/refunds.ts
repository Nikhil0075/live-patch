import fs from 'node:fs';
import path from 'node:path';
import type { RefundResult } from './rewards';

export interface RefundRecord {
  redemptionId: string;
  rewardId: string;
  reason: string;
  status: RefundResult['status'] | 'pending';
  message: string;
  updatedAt: string;
}

export class RefundStore {
  private records: RefundRecord[];
  constructor(private file: string) {
    this.records = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as RefundRecord[] : [];
    if (!Array.isArray(this.records)) throw Error('Invalid refund store');
  }
  list() { return this.records.map(record => ({ ...record })); }
  find(redemptionId: string) { const record = this.records.find(item => item.redemptionId === redemptionId); return record && { ...record }; }
  upsert(record: Omit<RefundRecord, 'updatedAt'>) {
    const current = this.records.findIndex(item => item.redemptionId === record.redemptionId);
    const next = { ...record, updatedAt: new Date().toISOString() };
    if (current < 0) this.records.push(next); else this.records[current] = next;
    this.save(); return next;
  }
  private save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.records, null, 2), { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }
}
