# Twitch permissions

Live Patch connects broadcaster and bot accounts separately with OAuth authorization code flow. Setup shows the exact HTTPS redirect URL to register in the Twitch developer console.

| Account | Scope | Use |
|---|---|---|
| Broadcaster | `channel:manage:redemptions` | Subscribe to reward redemptions and, for an app-owned reward, mark accepted pitches fulfilled or cancel rejected ones for a refund. |
| Broadcaster | `channel:manage:predictions` | Start, resolve or cancel the optional Channel Points Prediction. |
| Bot | `user:read:chat` | Receive chat messages through EventSub. |
| Bot | `user:write:chat` | Acknowledge pitches, votes and control commands in chat. |

Scopes are requested in `engine/twitch/auth.ts`. If Twitch features or permissions change, reconnect the affected account in Setup. The app stores credentials and tokens in ignored local files; never paste them into the repository or demo recording.
