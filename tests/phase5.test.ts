import { describe, expect, it, vi } from 'vitest';
import { createManagedPitchReward, describeReward, fetchPitchReward, refundRedemption, type TwitchReward } from '../engine/twitch/rewards';
import type { TwitchConfig } from '../engine/twitch/auth';
import { RefundStore } from '../engine/twitch/refunds';
import fs from 'node:fs';
import path from 'node:path';

const reward: TwitchReward = { id: 'pitch', title: 'Pitch a mechanic.', cost: 1, is_enabled: true, is_paused: false, is_in_stock: true, is_user_input_required: true };
const config: TwitchConfig = { clientId: 'client', clientSecret: 'secret', redirectUri: 'https://localhost:5173/api/twitch/auth/callback', rewardId: 'pitch' };

describe('Phase 5 reward availability', () => {
  it('explains disabled, paused, out-of-stock and missing viewer text states', () => {
    expect(describeReward(reward, true).state).toBe('enabled');
    expect(describeReward({ ...reward, is_enabled: false }, true)).toMatchObject({ state: 'disabled', reason: 'Reward is switched off on Twitch.' });
    expect(describeReward({ ...reward, is_paused: true }, true).state).toBe('paused');
    expect(describeReward({ ...reward, is_in_stock: false }, true).state).toBe('out_of_stock');
    expect(describeReward({ ...reward, is_user_input_required: false }, true).state).toBe('unavailable');
    expect(describeReward(undefined, true).state).toBe('missing');
  });
  it('queries the configured reward ID instead of assuming it is available', async () => {
    const helix = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ ...reward, is_enabled: false }] })));
    const result = await fetchPitchReward({ identity: () => ({ id: 'broadcaster', login: 'streamer' }), helix } as any, config);
    expect(helix.mock.calls[0][1]).toContain('id=pitch');
    expect(result.state).toBe('disabled');
  });
  it('refunds only an app-owned, unfulfilled redemption with Twitch confirmation', async () => {
    const auth = {
      identity: () => ({ id: 'owner', login: 'streamer' }),
      hasScope: () => true,
      helix: vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: [{ id: 'pitch' }] }))),
      helixRequest: vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'redemption', status: 'CANCELED' }] })))
    };
    expect((await refundRedemption(auth as any, 'pitch', 'redemption')).status).toBe('refunded');
    expect(auth.helixRequest.mock.calls[0][2]).toBe('PATCH');
    expect(auth.helixRequest.mock.calls[0][3]).toEqual({ status: 'CANCELED' });
    auth.helix.mockResolvedValueOnce(new Response('', { status: 404 }));
    expect((await refundRedemption(auth as any, 'manual', 'another')).status).toBe('not_manageable');
    expect(auth.helixRequest).toHaveBeenCalledTimes(1);
    auth.helixRequest.mockResolvedValueOnce(new Response('', { status: 404 }));
    expect((await refundRedemption(auth as any, 'pitch', 'fulfilled')).status).toBe('not_unfulfilled');
  });
  it('reuses a managed reward and creates a 1-point text reward only when needed', async () => {
    const auth = { identity: () => ({ id: 'owner', login: 'streamer' }), hasScope: () => true, helix: vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'existing', title: 'Live Patch Pitch' }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'created' }] }))) };
    expect(await createManagedPitchReward(auth as any)).toBe('existing');
    expect(await createManagedPitchReward(auth as any)).toBe('created');
    expect(auth.helix.mock.calls[2][2]).toMatchObject({ cost: 1, is_user_input_required: true, should_redemptions_skip_request_queue: false });
  });
  it('keeps failed refund attempts visible across a server restart', () => {
    const directory = fs.mkdtempSync(path.join(process.cwd(), '.test-refunds-'));
    try {
      const file = path.join(directory, 'refunds.json');
      new RefundStore(file).upsert({ redemptionId: 'redemption', rewardId: 'pitch', reason: 'Cooldown', status: 'failed', message: 'Twitch refund returned 503; refund not confirmed.' });
      expect(new RefundStore(file).find('redemption')).toMatchObject({ status: 'failed', reason: 'Cooldown' });
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });
});
