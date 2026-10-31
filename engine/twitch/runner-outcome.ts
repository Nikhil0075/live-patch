import type { RunRecord, RunnerEvent } from '../runner/store';

export const setupFailureNotice = 'Patch build stopped because the test browser or studio setup failed. The idea is still available; check Setup before approving again.';

export async function handleRunnerOutcome(
  event: RunnerEvent,
  record: Pick<RunRecord, 'failureKind' | 'stopReason'> | undefined,
  predictions: { cancel(): Promise<unknown>; settle(ideaId: string, shipped: boolean): Promise<unknown> },
  notifySetup: (message: string) => Promise<void>
): Promise<void> {
  if (event.type !== 'shipped' && event.type !== 'failed') return;
  if (event.type === 'failed' && record?.failureKind !== 'patch') {
    const notice = record?.stopReason === 'setup' ? setupFailureNotice
      : record?.stopReason === 'codex_unavailable' ? 'Patch build stopped because Codex is unavailable. The idea is still available; check Codex sign-in or quota before retrying.'
      : record?.stopReason === 'timeout' ? 'Patch build timed out. No patch shipped.'
      : record?.stopReason === 'cancelled' ? 'Patch build was cancelled. No patch shipped.'
      : 'Patch build stopped. No patch shipped; check the local run record.';
    const results = await Promise.allSettled([predictions.cancel(), notifySetup(notice)]);
    for (const result of results) if (result.status === 'rejected') throw result.reason;
  } else await predictions.settle(event.ideaId, event.type === 'shipped');
}
