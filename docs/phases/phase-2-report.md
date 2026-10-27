# Phase 2 report

## Built

- Twitch OAuth code flow for separate broadcaster and bot accounts, with state checks, scope and identity validation, token refresh, and ignored local token storage.
- EventSub WebSocket chat and configured custom-reward subscriptions, dropped-connection retry, reconnect handoff, keepalive timeout, and notification deduplication.
- A shared typed-event pipeline for Twitch and simulator input, chat commands, moderator checks, bot replies, and a JSON idea store with status and votes.
- A local simulator page, HTTP status and idea endpoints, and a chat bridge into mutation `onChat` hooks.
- Phase 2 spec, Twitch setup instructions, `.env.example`, architecture updates, unit tests, and a browser simulator regression.
- Switched the development server and OAuth callback to HTTPS because the operator's Twitch registration form requires an `https://` redirect. The test harness remains on isolated HTTP ports.
- OAuth callback errors now explain redirect mismatches and show the exact configured URL to register. An earlier callback on `127.0.0.1` exposed a host mismatch with the current `localhost` setting.
- Bot reply delivery checks Twitch's `is_sent` field and displays a dropped-message warning in the simulator, even when the Send Chat Message API returns HTTP 200.
- Round-one fixes keep EventSub alive through transient token-validation failures, isolate optional reward subscription errors from chat, and deny HTTP access to private token and idea files. OAuth verification now forces Twitch's consent screen; denied commands no longer trigger unlimited bot replies; the game chat hook skips bot replies and control commands; simulator vote labels match pending candidates.

`ws` was added for a supported WebSocket client and lifecycle on Node 20 or newer; `@types/ws` supplies strict TypeScript definitions. `@vitejs/plugin-basic-ssl` generates a local development certificate so Twitch can redirect to an HTTPS callback.

## How to run and test

- `npm install`, `npx playwright install chromium`, then `npm run dev`. Open `https://localhost:5173/simulator.html` for offline chat and reward input. The local development certificate is self-signed and may prompt a browser warning.
- `npm test` runs the unit and browser suites against a temporary game and idea store. `npm run build` checks TypeScript and bundles the browser client.
- Follow the README's Twitch setup steps to register a confidential app, authorize separate accounts, configure a text-entry reward, and run the real-channel checks.

Local verification: after round one, `npm test` passed 17 unit and 27 browser tests; `npm run build` passed; `npm audit --audit-level=moderate` found zero vulnerabilities. The browser test confirmed a harmless file in the isolated data directory was serveable while `tokens.json` was denied. The live HTTPS server returned 403 for `/.live-patch/tokens.json` and reported EventSub connected with no authorization issue. Earlier checks loaded the simulator in Chromium with local certificate errors ignored and confirmed the matching HTTPS OAuth callback.

Real-channel check on 2026-10-27: the broadcaster and bot completed OAuth and EventSub reported connected. A broadcaster chat `!idea` appeared in `/api/ideas` with source `chat`; `!reject 1` changed that test idea to `rejected`. Twitch's Get Custom Reward API returned 403 with `The broadcaster must have partner or affiliate status`, so no reward exists to configure or redeem. Twitch's Send Chat Message API returned `is_sent: false`, `msg_rejected` for the connected bot account, and no second-account idea arrived. A subsequent broadcaster `!vote 1` showed the bot delivery warning in `/api/twitch/status`.

Later on 2026-10-27, the creator dashboard showed completed tools onboarding and activated Spendable Balance, and its navigation included Power-ups & Channel Points. The Channel Points panel was blank after a reload, and Get Custom Reward still returned 403; `TWITCH_PITCH_REWARD_ID` remained unset. Twitch's Channel Points FAQ says the feature can take up to 24 hours to appear after onboarding.

## Exit criteria

- [ ] A second account's `!idea` appears in the store within two seconds on a real test channel — broadcaster chat ingestion works, but Twitch rejected bot-account test messages with `msg_rejected`; a second-account message has not arrived.
- [ ] Redeeming the configured custom reward creates an idea on the real channel — Twitch returned 403 because the broadcaster lacks Affiliate or Partner status; no reward ID is available. Normalization and simulator reward tests pass.
- [x] Moderator commands work only for moderators and the broadcaster — command authorization is tested with viewer, moderator and broadcaster inputs; the broadcaster is identified by Twitch user ID.
- [x] The simulator drives the identical code path — Twitch and simulator payloads normalize to `InboundEvent` and call the same `ChatPipeline.ingest`; the browser test checks idea persistence and `onChat` delivery.
- [x] WebSocket reconnects after a dropped connection — fake-socket unit tests verify new connection and subscription calls, and Twitch reconnect handoff without duplicate subscriptions. Keepalive timeouts also trigger reconnect.
- [x] No tokens or secrets are in Git — `.env` and `.live-patch/` are ignored; `.env.example` has field names only. The committed code contains no credentials.

## Deferred

- Phase 3: execute approved ideas and rollback requests through the Codex runner. Phase 2 records their intent and status.
- Phase 4: AI triage, scheduled voting rounds, OBS overlay, stream control panel and patch notes.
- Phase 5: the three accepted Phase 1 Minor findings, OBS browser-source check and full stream hardening.

## Known gaps / risks

- Real Twitch OAuth and broadcaster chat ingestion are verified. Bot chat sending failed because Twitch rejected test messages; the channel's chat settings did not show follower, subscriber, emote or slow restrictions. Creator tools onboarding is complete, but Twitch's custom-reward API still returns 403 and the Channel Points panel has not populated. Custom reward creation, subscription and redemption remain untested until Twitch enables the feature for this channel.
- The simulator trusts role selection because it is a local development tool. Its event endpoint binds to the local development server, checks browser Origin, and can be disabled with `LIVE_PATCH_SIMULATOR_ENABLED=0`.
- JSON persistence is suitable for one local server process. Concurrent writers or a hosted deployment would need a transactional store.
- The most recent three pending ideas serve as provisional voting slots until Phase 4 adds timed rounds and triage.

## Review responses

- **P2-R1-01 Fixed:** `TwitchConnection` retries transient validation and starts EventSub after recovery; fake-timer tests cover startup and hourly blips. Credential rejection still stops the socket with a visible error.
- **P2-R1-02 Fixed:** chat subscribes first and remains active when the optional reward subscription fails; the reward error stays visible without a reconnect loop. A fake-socket test delivers chat after a reward 403.
- **P2-R1-03 Fixed:** Vite denies `.live-patch`, `tokens.json` and `ideas.json` while retaining its default secret-file denies; a browser request tests the token path.
- **P2-R1-04 Fixed:** denied moderator commands produce no bot reply; other error replies are limited to one per viewer every 30 seconds. Unit tests cover a spam burst.
- **P2-R1-05 Deferred to Phase 5:** reward ownership and cancellation require a new `channel:manage:redemptions` authorization and a managed reward creation flow. The README warns against enabling a paid reward until refunds exist; the operator has set reward-ID setup aside.
- **P2-R1-06 Fixed:** authorization requests use `force_verify=true` and prune expired pending states when starting a new flow; the OAuth unit test checks the parameter.
- **P2-R1-07 Fixed:** bot messages and recognized commands no longer reach the game's `onChat`; a unit test checks both filters.
- **P2-R1-08 Fixed:** `/api/ideas` returns authoritative pending candidate IDs and the simulator labels only those with `Vote 1–3`; a browser test rejects one idea and checks the labels.
- **P2-R1-09 Deferred to Phase 5:** the operator's Twitch registration form required HTTPS, so switching the live callback to HTTP would break their working OAuth flow. OBS certificate trust remains part of the Phase 5 browser-source check.
