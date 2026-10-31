# Phase 2 — Review round 3

## Verdict
Pass with minors

Both round-2 findings are fixed, and on 28 October 2026 the two remaining real-channel checks passed on a **live stream** on `nikhil0075`:
- a second account's `!idea` reached the idea store and got a bot reply in chat;
- a **Channel Points redemption** created an idea with source `reward`.

All six exit criteria are met. Refunds and the OBS certificate check stay deferred to Phase 5, and one new Minor is listed.

How I verified:
- I reviewed `56c9d92..42813c9`, the round-2 fixes.
- I ran `tests/phase2.test.ts` (15/15 passed). I did not run the full suite during the live stream, to keep CPU free for streaming. The full suite, which includes these tests, passed twice earlier the same day at `e4764e8`.
- With the operator's OK, I started the studio (`npm run dev`), which reported EventSub connected, reward configured, broadcaster `nikhil0075` and bot `plasticpizza0075`. I watched `/api/ideas`, printing only metadata.
- I read the channel's chat and the reward's state in the operator's signed-in browser.
- The operator made the redemption from the second account. With the operator's OK, I re-enabled the reward (below).

## Exit criteria
- [x] On a real test channel, `!idea` from a second account appears within 2 s — live:
  - `plasticpizza0075: !idea make ththe area bit` was stored at `2026-10-28T18:56:03.839Z` as a `chat` idea, status `shortlisted`.
  - The bot replied in the live chat, "@plasticpizza0075 idea received: make ththe area bit", in the same minute (12:26 local), with no delivery warning (`chatIssue` empty).
  - Twitch's chat shows only minute-level times, so I can't measure the 2 s figure directly. The idea and the reply arrived together.
  - As agreed in round 2, the second account is the bot account; the pipeline treats it like any viewer.
- [x] Redeeming the configured custom reward creates an idea — live: the operator redeemed **"Pitch a mechanic."** as `plasticpizza0075` with "after killing a enemy increase the cooling period".
  - `/api/ideas` received it at `2026-10-28T19:10:42.550Z` with **source `reward`**, status `shortlisted`.
  - Chat shows the redemption and the bot's "idea received" reply at 12:40 local.
  - Why earlier attempts failed:
    1. Twitch never offers a channel's custom reward to its own broadcaster. It was missing from `nikhil0075`'s own menu both offline and live; only the five default rewards appear.
    2. The reward had been **switched off** in the Creator Dashboard after 27 October. Its Enabled toggle was off, so viewers couldn't see it either. With the operator's approval I switched it back on, and Twitch confirmed "…enabled on your channel".
- [x] Moderator commands work only for moderators and the broadcaster — unchanged since round 1, and covered by tests.
- [x] Simulator and Twitch events use the identical pipeline — unchanged. Both the live chat idea and the live reward idea went through `ChatPipeline.ingest`.
- [x] EventSub reconnects automatically after a dropped connection — unchanged, and covered by tests. See P2-R2-01 for the new no-retry rule on configuration errors.
- [x] No tokens or secrets are committed — unchanged from round 2. Nothing in this round printed a secret: I read status and idea metadata only.

## Previous findings
- P2-R2-01 — Resolved. A rejected subscription now throws `SubscriptionError`. Its `isConfigurationFailure` (4xx except 429) sets `permanentFailure`, which stops both reconnecting and retrying. `resetAfterAuthChange()` clears it when credentials change. Network, 429 and 5xx failures still retry. Tests cover both paths. The report's earlier "no reconnect loop" wording is now true.
- P2-R2-02 — Resolved. Rejected credentials are now a typed `TwitchCredentialError`: an identity or scope mismatch, or a 4xx (except 429) from validation or refresh. `connection.ts` classifies with `instanceof` instead of matching message text.
- P2-R1-05 (reward refunds and ownership) — still deferred to Phase 5. Until then, keep the reward's cost low (it is 1 point) or switch it off between streams.
- P2-R1-09 (OBS trusting the self-signed HTTPS certificate) — still deferred to Phase 5.

## Findings

### Blockers
None.

### Majors
None.

### Minors
- **P2-R3-01** · `engine/studio/setup.ts` (the "Pitch reward" check), `engine/twitch/server.ts` (`/api/twitch/rewards` returns only `id`, `title`, `requiresInput`) — Setup reports the pitch reward as **Ready** whenever a reward ID is set. Today the reward was switched off on Twitch, so viewers couldn't redeem it, while Setup and the status endpoint still said "rewardConfigured: true". That cost a stream's worth of debugging. Suggested fix (Phase 5): read the reward's `is_enabled`, `is_paused` and `is_in_stock` from Get Custom Reward, which the broadcaster token already allows. Show "Reward is switched off on Twitch" or "paused" in Setup and Go Live. Also note in the README that the broadcaster can't redeem their own reward, so the test needs a second account.

### Nits
None.

## Working well — do not change
- A live chat idea and a live reward idea both reached the store, and the bot's replies were delivered on stream; the earlier `msg_rejected` problem is gone.
- Separate EventSub sessions per account, now with a permanent stop for configuration errors and retries only for temporary failures.
- Typed credential errors instead of matching error text.

## Phase 2 closing note
Phase 2 can be tagged `phase-2-done`; that is the operator's decision. Its fixes are in `42813c9`, which every later phase builds on.

Carried to Phase 5:
- reward refunds and ownership (P2-R1-05);
- the OBS certificate check (P2-R1-09);
- P2-R3-01: reward state in Setup, and the README note about testing from a second account.
