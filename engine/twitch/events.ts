import type { InboundEvent, Viewer } from '../pipeline/commands';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue | null => value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : null;
const string = (value: unknown): string | null => typeof value === 'string' && value.length > 0 ? value : null;

export function forwardToGame(event: Extract<InboundEvent, { kind: 'chat' }>, botId: string | undefined): boolean {
  if (event.origin === 'twitch' && event.viewer.id === botId) return false;
  return !/^!(?:idea|vote|approve|reject|rollback)(?:\s|$)/i.test(event.text.trim());
}

export function normalizeEventSub(type: string, messageId: string, raw: unknown, broadcasterId: string): InboundEvent | null {
  const event = object(raw);
  if (!event || !string(messageId)) return null;
  if (type === 'channel.chat.message') {
    if (event.broadcaster_user_id !== broadcasterId) return null;
    const id = string(event.message_id);
    const userId = string(event.chatter_user_id);
    const login = string(event.chatter_user_login);
    const name = string(event.chatter_user_name);
    const text = string(object(event.message)?.text);
    if (!id || !userId || !login || !name || !text) return null;
    const badges = Array.isArray(event.badges) ? event.badges : [];
    const viewer: Viewer = { id: userId, login, name, broadcaster: userId === broadcasterId, moderator: badges.some(badge => object(badge)?.set_id === 'moderator') };
    return { kind: 'chat', origin: 'twitch', id: messageId, viewer, text };
  }
  if (type === 'channel.channel_points_custom_reward_redemption.add') {
    if (event.broadcaster_user_id !== broadcasterId) return null;
    const id = string(event.id);
    const userId = string(event.user_id);
    const login = string(event.user_login);
    const name = string(event.user_name);
    const rewardId = string(object(event.reward)?.id);
    if (!id || !userId || !login || !name || !rewardId || typeof event.user_input !== 'string') return null;
    return { kind: 'reward', origin: 'twitch', id: messageId, redemptionId: id, viewer: { id: userId, login, name, broadcaster: userId === broadcasterId, moderator: false }, rewardId, text: event.user_input };
  }
  return null;
}

export function normalizeSimulator(raw: unknown, rewardId: string): InboundEvent | null {
  const data = object(raw);
  const user = object(data?.viewer);
  const id = string(data?.id);
  const userId = string(user?.id);
  const login = string(user?.login);
  const name = string(user?.name);
  if (!data || !id || !userId || !login || !name || typeof data.text !== 'string' || data.text.length > 600) return null;
  const viewer: Viewer = { id: userId, login, name, moderator: user?.moderator === true, broadcaster: user?.broadcaster === true };
  if (data.kind === 'chat') return { kind: 'chat', origin: 'simulator', id, viewer, text: data.text };
  if (data.kind === 'reward') return { kind: 'reward', origin: 'simulator', id, viewer, text: data.text, rewardId };
  return null;
}
