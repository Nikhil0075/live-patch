# Phase 2 report

## Built

- Twitch OAuth code flow for separate broadcaster and bot accounts, with state checks, scope and identity validation, token refresh, and ignored local token storage.
- EventSub WebSocket chat and configured custom-reward subscriptions, dropped-connection retry, reconnect handoff, keepalive timeout, and notification deduplication.
- A shared typed-event pipeline for Twitch and simulator input, chat commands, moderator checks, bot replies, and a JSON idea store with status and votes.
- A local simulator page, HTTP status and idea endpoints, and a chat bridge into mutation `onChat` hooks.
- Phase 2 spec, Twitch setup instructions, `.env.example`, architecture updates, unit tests, and a browser simulator regression.
- Switched the development server and OAuth callback to HTTPS because the operator's Twitch registration form requires an `https://` redirect. The test harness remains on isolated HTTP ports.

`ws` was added for a supported WebSocket client and lifecycle on Node 20 or newer; `@types/ws` supplies strict TypeScript definitions. `@vitejs/plugin-basic-ssl` generates a local development certificate so Twitch can redirect to an HTTPS callback.

## How to run and test

- `npm install`, `npx playwright install chromium`, then `npm run dev`. Open `https://localhost:5173/simulator.html` for offline chat and reward input. The local development certificate is self-signed and may prompt a browser warning.
- `npm test` runs the unit and browser suites against a temporary game and idea store. `npm run build` checks TypeScript and bundles the browser client.
- Follow the README's Twitch setup steps to register a confidential app, authorize separate accounts, configure a text-entry reward, and run the real-channel checks.

Local verification: `npm test` passed 11 unit and 26 browser tests; `npm run build` passed; `npm audit --audit-level=moderate` found zero vulnerabilities. `npm run dev` served the simulator over HTTPS, and a Chromium check loaded the simulator at `https://localhost:5173/simulator.html` with local certificate errors ignored. The OAuth start route returned the matching HTTPS callback.

## Exit criteria

- [ ] A second account's `!idea` appears in the store within two seconds on a real test channel — waiting for Twitch app registration and accounts; the simulator path and unit tests pass.
- [ ] Redeeming the configured custom reward creates an idea on the real channel — waiting for an eligible channel, reward ID and authorization; normalization and simulator reward tests pass.
- [x] Moderator commands work only for moderators and the broadcaster — command authorization is tested with viewer, moderator and broadcaster inputs; the broadcaster is identified by Twitch user ID.
- [x] The simulator drives the identical code path — Twitch and simulator payloads normalize to `InboundEvent` and call the same `ChatPipeline.ingest`; the browser test checks idea persistence and `onChat` delivery.
- [x] WebSocket reconnects after a dropped connection — fake-socket unit tests verify new connection and subscription calls, and Twitch reconnect handoff without duplicate subscriptions. Keepalive timeouts also trigger reconnect.
- [x] No tokens or secrets are in Git — `.env` and `.live-patch/` are ignored; `.env.example` has field names only. The committed code contains no credentials.

## Deferred

- Phase 3: execute approved ideas and rollback requests through the Codex runner. Phase 2 records their intent and status.
- Phase 4: AI triage, scheduled voting rounds, OBS overlay, stream control panel and patch notes.
- Phase 5: the three accepted Phase 1 Minor findings, OBS browser-source check and full stream hardening.

## Known gaps / risks

- Real Twitch authentication, chat latency and custom-reward delivery require the operator's app, eligible channel and two accounts. They remain unverified in this development environment.
- The simulator trusts role selection because it is a local development tool. Its event endpoint binds to the local development server, checks browser Origin, and can be disabled with `LIVE_PATCH_SIMULATOR_ENABLED=0`.
- JSON persistence is suitable for one local server process. Concurrent writers or a hosted deployment would need a transactional store.
- The most recent three pending ideas serve as provisional voting slots until Phase 4 adds timed rounds and triage.

## Review responses

Pending Phase 2 review.
