# Phase 2: Twitch integration

## Goal

Real Twitch chat and custom channel-point redemptions enter the server as typed events. A local simulator drives the same path without a live channel.

## Build

- Document Twitch app registration and OAuth for broadcaster and bot accounts, including refresh.
- Subscribe over EventSub WebSocket to `channel.chat.message` and `channel.channel_points_custom_reward_redemption.add`.
- Parse `!idea <text>`, `!vote <n>`, and moderator or broadcaster only `!approve`, `!reject`, `!rollback`.
- Acknowledge ideas and announce voting through Send Chat Message.
- Persist ideas with submitted, shortlisted, voting, approved, building, shipped, failed and rejected statuses.
- Provide a simulator page using the same typed event path.
- Limit idea length and submissions per viewer.

## Exit criteria

- [ ] On a real test channel, `!idea` from a second account appears in the idea store within two seconds.
- [ ] Redeeming the configured custom reward creates an idea the same way.
- [ ] Moderator commands work only for moderators and the broadcaster.
- [ ] Simulator and Twitch events use the identical pipeline.
- [ ] EventSub reconnects automatically after a dropped connection.
- [ ] No tokens or secrets are committed.

Reviewer focus: token handling and scopes, reconnect logic, moderator authorization, and plain-text rendering of viewer content.
