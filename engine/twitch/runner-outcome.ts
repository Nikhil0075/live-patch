import type { RunRecord, RunnerEvent } from '../runner/store';

export const setupFailureNotice = 'Patch build stopped because the test browser or studio setup failed. The idea is still available; check Setup before approving again.';

export async function handleRunnerOutcome(
  event: RunnerEvent,
  failureKind: RunRecord['failureKind'],
  predictions: { cancel(): Promise<unknown>; settle(ideaId: string, shipped: boolean): Promise<unknown> },
  notifySetup: (message: string) => Promise<void>
): Promise<void> {
  if (event.type !== 'shipped' && event.type !== 'failed') return;
  if (event.type === 'failed' && failureKind !== 'patch') {
    const results = await Promise.allSettled([predictions.cancel(), notifySetup(setupFailureNotice)]);
    for (const result of results) if (result.status === 'rejected') throw result.reason;
  } else await predictions.settle(event.ideaId, event.type === 'shipped');
}
