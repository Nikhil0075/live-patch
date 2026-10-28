import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PatchPredictions } from '../engine/twitch/predictions';
import type { TwitchAuth } from '../engine/twitch/auth';

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-patch-bets-')); dirs.push(dir);
  const file = path.join(dir, 'predictions.json');
  const helix = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'bet-1', outcomes: [{ id: 'ship' }, { id: 'fail' }] }] }), { status: 200 }));
  const helixRequest = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ status: 'RESOLVED' }] }), { status: 200 }));
  const auth = { identity: () => ({ id: 'channel' }), hasScope: () => true, helix, helixRequest } as unknown as TwitchAuth;
  return { file, auth, helix, helixRequest };
}
describe('Twitch patch predictions', () => {
  it('settles a shipped patch once, including across restart', async () => {
    const { file, auth, helixRequest } = fixture();
    let bets = new PatchPredictions(file, auth);
    await bets.start('idea-a', 'Jumping slimes');
    await expect(bets.start('idea-b', 'Other')).rejects.toThrow('current prediction');
    await bets.settle('idea-a', true);
    bets = new PatchPredictions(file, auth);
    expect(bets.active()).toBeUndefined();
    expect(await bets.settle('idea-a', false)).toBeUndefined();
    expect(helixRequest).toHaveBeenCalledTimes(1);
    expect(helixRequest.mock.calls[0][3]).toMatchObject({ status: 'RESOLVED', winning_outcome_id: 'ship' });
  });
  it('cancels on operator request and marks API errors for retry', async () => {
    const { file, auth, helixRequest } = fixture();
    const bets = new PatchPredictions(file, auth);
    await bets.start('idea-a', 'Jumping slimes');
    helixRequest.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(bets.cancel()).rejects.toThrow('503');
    expect(bets.active()?.status).toBe('error');
    await bets.cancel();
    expect(bets.active()).toBeUndefined();
    expect(helixRequest.mock.calls[1][3]).toMatchObject({ status: 'CANCELED' });
  });
  it('reconciles a resolved prediction after restart', async () => {
    const { file, auth, helix } = fixture();
    await new PatchPredictions(file, auth).start('idea-a', 'Jumping slimes');
    helix.mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ status: 'RESOLVED' }] }), { status: 200 }));
    const restarted = new PatchPredictions(file, auth);
    await restarted.reconcile();
    expect(restarted.list()[0].status).toBe('resolved');
  });
});
