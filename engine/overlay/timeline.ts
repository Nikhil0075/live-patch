export type TimelineState = 'Done' | 'In progress' | 'Failed' | 'Pending';

export function timelineState(stage: 'sandbox_verified' | 'file' | 'testing' | 'shipped', events: ReadonlySet<string>, runStatus: string): TimelineState {
  if (stage === 'testing' && events.has('passed')) return 'Done';
  if (stage !== 'testing' && events.has(stage)) return 'Done';
  if (runStatus === 'failed') {
    const failedAt = events.has('testing') ? 'testing' : events.has('file') ? 'file' : 'sandbox_verified';
    return stage === failedAt ? 'Failed' : 'Pending';
  }
  if (runStatus === 'building' && ((stage === 'testing' && events.has('testing')) || (stage === 'file' && events.has('sandbox_verified')))) return 'In progress';
  return 'Pending';
}
