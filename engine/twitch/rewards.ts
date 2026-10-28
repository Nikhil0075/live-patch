import type { TwitchAuth, TwitchConfig } from './auth';

export interface RewardState {
  state: 'unconfigured' | 'disconnected' | 'enabled' | 'disabled' | 'paused' | 'out_of_stock' | 'missing' | 'unavailable';
  reason: string;
  title?: string;
  requiresInput?: boolean;
  cost?: number;
}
export interface TwitchReward {
  id: string;
  title: string;
  cost: number;
  is_enabled: boolean;
  is_paused: boolean;
  is_in_stock: boolean;
  is_user_input_required: boolean;
}

export function describeReward(reward: TwitchReward | undefined, configured: boolean): RewardState {
  if (!configured) return { state: 'unconfigured', reason: 'Optional: add the custom reward ID.' };
  if (!reward) return { state: 'missing', reason: 'Configured reward was not found on Twitch. Check its ID.' };
  const common = { title: reward.title, requiresInput: reward.is_user_input_required, cost: reward.cost };
  if (!reward.is_enabled) return { ...common, state: 'disabled', reason: 'Reward is switched off on Twitch.' };
  if (reward.is_paused) return { ...common, state: 'paused', reason: 'Reward is paused on Twitch.' };
  if (!reward.is_in_stock) return { ...common, state: 'out_of_stock', reason: 'Reward is out of stock on Twitch.' };
  if (!reward.is_user_input_required) return { ...common, state: 'unavailable', reason: 'Reward needs viewer text input enabled.' };
  return { ...common, state: 'enabled', reason: `${reward.title} is available to viewers.` };
}

export async function fetchPitchReward(auth: Pick<TwitchAuth, 'identity' | 'helix'>, config: TwitchConfig): Promise<RewardState> {
  if (!config.rewardId) return describeReward(undefined, false);
  const broadcaster = auth.identity('broadcaster');
  if (!broadcaster) return { state: 'disconnected', reason: 'Connect the broadcaster to check the reward on Twitch.' };
  try {
    const route = `channel_points/custom_rewards?broadcaster_id=${encodeURIComponent(broadcaster.id)}&id=${encodeURIComponent(config.rewardId)}`;
    const response = await auth.helix('broadcaster', route);
    if (response.status === 404) return describeReward(undefined, true);
    if (!response.ok) return { state: 'unavailable', reason: `Twitch reward check returned ${response.status}.` };
    const result = await response.json() as { data?: TwitchReward[] };
    return describeReward(result.data?.find(item => item.id === config.rewardId), true);
  } catch { return { state: 'unavailable', reason: 'Twitch reward check is temporarily unavailable.' }; }
}

export interface RefundResult { status: 'refunded' | 'not_manageable' | 'not_unfulfilled' | 'failed'; message: string }

export async function refundRedemption(auth: Pick<TwitchAuth, 'identity' | 'hasScope' | 'helix' | 'helixRequest'>, rewardId: string, redemptionId: string): Promise<RefundResult> {
  const broadcaster = auth.identity('broadcaster');
  if (!broadcaster || !auth.hasScope('broadcaster', 'channel:manage:redemptions')) return { status: 'failed', message: 'Reconnect the broadcaster with redemption management permission to check a refund.' };
  if (!rewardId || !redemptionId) return { status: 'failed', message: 'Refund needs a reward and redemption ID.' };
  const base = `channel_points/custom_rewards?broadcaster_id=${encodeURIComponent(broadcaster.id)}&id=${encodeURIComponent(rewardId)}`;
  try {
    const owned = await auth.helix('broadcaster', `${base}&only_manageable_rewards=true`);
    if (owned.status === 404) return { status: 'not_manageable', message: 'This reward was created outside Live Patch; Twitch will not let this app refund it.' };
    if (!owned.ok) return { status: 'failed', message: `Twitch ownership check returned ${owned.status}; refund not confirmed.` };
    const data = await owned.json() as { data?: { id: string }[] };
    if (!data.data?.some(item => item.id === rewardId)) return { status: 'not_manageable', message: 'This reward was created outside Live Patch; Twitch will not let this app refund it.' };
    const route = `channel_points/custom_rewards/redemptions?broadcaster_id=${encodeURIComponent(broadcaster.id)}&reward_id=${encodeURIComponent(rewardId)}&id=${encodeURIComponent(redemptionId)}`;
    const response = await auth.helixRequest('broadcaster', route, 'PATCH', { status: 'CANCELED' });
    if (response.status === 404) return { status: 'not_unfulfilled', message: 'Twitch could not cancel this redemption; it may already be fulfilled. Refund not confirmed.' };
    if (!response.ok) return { status: 'failed', message: `Twitch refund returned ${response.status}; refund not confirmed.` };
    const result = await response.json() as { data?: { id: string; status: string }[] };
    return result.data?.some(item => item.id === redemptionId && item.status.toUpperCase() === 'CANCELED')
      ? { status: 'refunded', message: 'Twitch confirmed the redemption was canceled and points were returned.' }
      : { status: 'failed', message: 'Twitch did not confirm cancellation; refund not confirmed.' };
  } catch { return { status: 'failed', message: 'Twitch refund request failed; refund not confirmed.' }; }
}

export async function createManagedPitchReward(auth: Pick<TwitchAuth, 'identity' | 'hasScope' | 'helix'>): Promise<string> {
  const broadcaster = auth.identity('broadcaster');
  if (!broadcaster || !auth.hasScope('broadcaster', 'channel:manage:redemptions')) throw Error('Reconnect the broadcaster with redemption management permission first');
  const route = `channel_points/custom_rewards?broadcaster_id=${encodeURIComponent(broadcaster.id)}`;
  const existing = await auth.helix('broadcaster', `${route}&only_manageable_rewards=true`);
  if (!existing.ok) throw Error(`Twitch managed reward lookup returned ${existing.status}`);
  const list = await existing.json() as { data?: { id: string; title: string }[] };
  const reuse = list.data?.find(item => item.title === 'Live Patch Pitch');
  if (reuse) return reuse.id;
  const response = await auth.helix('broadcaster', route, { title: 'Live Patch Pitch', cost: 1, prompt: 'Pitch a game mechanic in 200 characters or fewer.', is_user_input_required: true, is_enabled: true, should_redemptions_skip_request_queue: false });
  if (!response.ok) throw Error(`Twitch reward creation returned ${response.status}`);
  const result = await response.json() as { data?: { id: string }[] };
  const id = result.data?.[0]?.id;
  if (!id) throw Error('Twitch did not return a managed reward ID');
  return id;
}
