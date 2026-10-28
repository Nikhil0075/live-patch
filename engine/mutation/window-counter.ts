export class WindowCounter {
  private start = 0;
  private count = 0;
  constructor(private durationMs: number) {}
  add(amount = 1, now = Date.now()): number {
    if (!this.start || now - this.start >= this.durationMs) { this.start = now; this.count = 0; }
    this.count += amount;
    return this.count;
  }
  current(now = Date.now()): number { return now - this.start < this.durationMs ? this.count : 0; }
}
