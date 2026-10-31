# Phase 2 — Review round 2

## Verdict
Pass with minors

All three round-1 Majors are fixed, and I reproduced each fix. Chat now survives a network outage and a rejected reward subscription, and the token file is blocked. Only Minors remain. **The phase gate still waits on two real-channel checks that only the operator can run** (exit criteria 1 and 2). Your live server confirms the reward is *configured*. It does not yet show a *redemption* turning into an idea. The steps are at the end.

How I verified: I reviewed `5901e5a..56c9d92`, which includes the two commits after `76d3c79`. I ran the suite in this repository. I read the live server's status and idea endpoints, with the token-file response discarded unread. I ran probes in a throwaway clone with fake credentials, plus mocked unit probes. I never used the real tokens, and I sent no chat messages and made no redemptions.

## Exit criteria
- [ ] On a real test channel, `!idea` from a second account appears within 2 s — **operator check pending.** The live `/api/ideas` holds one idea: the broadcaster's own chat idea, now `rejected`. No second-account idea has arrived yet.
- [ ] Redeeming the configured custom reward creates an idea — **configuration confirmed; redemption still untested.** Live `/api/twitch/status` reports `rewardConfigured: true` and `eventsub: "connected"`. With a reward ID set, the status says plain "connected" only when both the chat and reward subscriptions are up, so this matches your report. The idea store has no idea with source `reward`, so no redemption has gone through the pipeline yet.
- [x] Moderator commands work only for moderators and the broadcaster — unchanged since round 1, where I verified it through the simulator. Denied commands now get no reply (P2-R1-04).
- [x] Simulator and Twitch events use the identical pipeline — unchanged. Both still go through `ChatPipeline.ingest`.
- [x] EventSub reconnects automatically after a dropped connection — the socket-drop tests pass. The token-check recovery gap is fixed (P2-R1-01 below).
- [x] No tokens or secrets are committed — I re-ran the full-history search for the real client ID, client secret and reward ID, printing counts only: 0 matches each. `.env` and `.live-patch/` stay ignored.

Suite: `npm test` passed (vitest 18/18, Playwright 27/27), `tsc --noEmit` is clean, the build succeeded, `npm audit` found 0 vulnerabilities, and the tree stayed clean apart from the untracked review file.

## Previous findings
- P2-R1-01 — Resolved. In probe P-B2 (mocked fetch, fake timers):
  - after a failed hourly check during an outage, chat stayed `connected`, with `authIssue: TypeError: fetch failed` shown;
  - six minutes after the network returned, it was `connected` with no issue;
  - when the server started offline, it reported `offline | authIssue …`, then reached `connected` once the network returned.

  A rejected credential still stops EventSub, with a visible reason.
- P2-R1-02 — Resolved: chat no longer depends on the reward subscription. In P-A2, with the reward subscription returning 403, a chat notification was still delivered, and the status read `connected · reward events unavailable: … returned 403: forbidden`. Separate sessions per user also match Twitch's WebSocket rule. The report says this happens "without a reconnect loop", but the reward stream still retries (P2-R2-01).
- P2-R1-03 — Resolved. On the clone's HTTPS server with a fake token file, 14 request variants returned `403`, including `?raw`, `?import&raw??`, `?url`, doubled slashes, `/./`, `%2e`, case changes and `/@fs/` absolute paths. With a fake `.env`, every `.env` variant also returned 403. The live server returns 403 for the token path too, and a regression test covers it.
- P2-R1-04 — Resolved. Denied moderator commands get no reply, and other error replies are limited to one per viewer every 30 s, with a unit test.
- P2-R1-05 — Accepted as deferred to Phase 5. The README warns against paid rewards until refunds exist. The reward is now enabled, so take care during the redemption test (see the operator steps).
- P2-R1-06 — Resolved. `force_verify=true` is sent, and expired states are pruned.
- P2-R1-07 — Resolved. Bot messages and command messages no longer reach the game's `onChat`, with a unit test.
- P2-R1-08 — Resolved. `/api/ideas` returns `candidateIds`, and the simulator labels only those ideas as `Vote 1–3`; a browser test covers it.
- P2-R1-09 — Accepted as deferred to Phase 5. HTTPS stays because the operator's Twitch registration needed it, and the OBS certificate check joins the Phase 5 list.

## Findings

### Blockers
None.

### Majors
None.

### Minors
- **P2-R2-01** · `engine/twitch/eventsub.ts:67`, `engine/twitch/eventsub.ts:99` — If the reward subscription is rejected (4xx), the reward stream closes its socket and retries forever, with backoff capped at 30 s. In P-A2 it made 14 reward subscription attempts and opened 15 sockets in 5 minutes. Chat is unaffected, but the report says this happens without a reconnect loop, and the round-1 advice was not to retry configuration errors. Suggested fix: after a 4xx reply to a subscription request, stop that stream and keep its error visible until the reward ID or tokens change. Keep backoff retries for network and 5xx failures.

### Nits
- **P2-R2-02** · `engine/twitch/connection.ts:6-9` — Whether a credential was rejected is decided by matching the error text against a regex. If any error message in `auth.ts` is reworded, rejected credentials would be treated as transient and retried forever. Consider a typed error, or a status field, set at the throw sites.

## Working well — do not change
- `TwitchConnection`: it separates rejected credentials from transient failures, backs off from 5 s to 5 min, restarts EventSub after recovery, and never runs two checks at once.
- One EventSub session per account, with each stream's state and error reported separately. A reward problem can never silence chat.
- The explicit Vite deny list keeps Vite's own defaults and adds the data folder and token file names. It held against every bypass variant I tried.
- The bot-spam controls (silent denial for mod commands, a 30 s error-reply limit) and the game chat filter.
- Everything from round 1's list: the careful OAuth flow, one normalized event type, `is_sent` checks, plain-text rendering and isolated test data.

## Operator steps to close the gate
Use one second Twitch account that you control, in one sitting:
1. **Lower the reward cost first** (for example to 1 point). Refunds don't exist yet (P2-R1-05), so a rejected redemption keeps the points. The second account will need at least that many points; following the channel can grant a small bonus if that's enabled.
2. **Redeem "Pitch a mechanic"** from the second account with a short text, under 200 characters. Within a few seconds `/api/ideas` should show a new idea with `source: "reward"`. That clears criterion 2.
3. **Wait at least three minutes.** The per-viewer cooldown covers chat and rewards together, so an `!idea` sent sooner is rejected.
4. **Type `!idea <text>`** in chat from the same second account. It should appear in `/api/ideas` (source `chat`) within 2 s. That clears criterion 1. If you'd rather not wait, use a third account for this step.
5. During the test, watch the simulator's connection line for a bot delivery warning (`msg_rejected` earlier). If replies still fail, make the bot a moderator (`/mod <botname>`) and check that its email or phone is verified.
6. Afterwards, put the reward cost back, or pause the reward, until Phase 5 adds refunds.

Once steps 2 and 4 show up in `/api/ideas`, nothing blocks tagging `phase-2-done`.
