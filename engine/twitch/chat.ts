export async function chatDeliveryIssue(response: Response): Promise<string> {
  if (!response.ok) return `Twitch chat reply failed (HTTP ${response.status})`;
  try {
    const result = await response.json() as { data?: { is_sent?: boolean; drop_reason?: { code?: string; message?: string } | null }[] };
    const delivery = result.data?.[0];
    if (delivery?.is_sent === true) return '';
    const reason = delivery?.drop_reason;
    return `Twitch chat reply was not sent${reason?.code ? ` (${reason.code})` : ''}${reason?.message ? `: ${reason.message}` : ''}`;
  } catch { return 'Twitch chat reply returned an invalid response'; }
}
