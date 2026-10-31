# Phase 2 — Review round 1

## Verdict
Fail

The code works: the OAuth flow is careful, the simulator and Twitch share one pipeline, and moderator checks hold. But three Majors would hurt a real stream:
- one failed hourly token check stops chat ingestion for good;
- a failing reward subscription also drops the chat subscription, and that bites the moment the pending reward ID is set;
- the dev server hands out the OAuth tokens file to any request.

As the operator asked, the reward-ID setup is left for later and is not counted against this round. The second-account chat check is listed as an operator step below.

How I verified: I reviewed `phase-1-done..5901e5a`. I ran the suite in this repository. For probes, I used a throwaway clone with fake credentials on port 5373, plus mocked unit probes (P-A, P-B). I never used the real tokens or Twitch account, and I sent no chat messages.

## Exit criteria
- [ ] On a real test channel, `!idea` from a second account appears within 2 s — **pending an operator check.** The report shows the broadcaster's own `!idea` reached `/api/ideas` and `!reject 1` worked, so the real EventSub-to-store path runs. No second account has chatted yet: the bot's test message was dropped by Twitch with `msg_rejected`. This check needs no reward ID; see "Operator steps" below.
- [ ] Redeeming the configured custom reward creates an idea — **deferred by the operator.** The channel is not yet Affiliate, so Twitch returns 403 and no reward ID exists. Reward normalization and simulator reward ideas pass their tests. Read P2-R1-02 before setting the ID.
- [x] Moderator commands work only for moderators and the broadcaster — I checked this through the simulator endpoint:
  - a viewer's `!approve 1` returned "Only a moderator or broadcaster can use that command";
  - a moderator's `!approve 1` changed the idea to `approved`;
  - replaying the same event ID returned `duplicate`.

  Roles come from Twitch badges, and the broadcaster is matched by user ID (`events.ts:19`).
- [x] Simulator and Twitch events use the identical pipeline — both normalize to `InboundEvent` and call the same `ChatPipeline.ingest` (`events.ts`, `server.ts:68`, `server.ts:122-124`). Only the reply transport differs: replies stay local for the simulator and go to Helix for Twitch.
- [x] EventSub reconnects automatically after a dropped connection — the unit tests for a socket drop and the reconnect handoff pass, and probe P-A saw backoff retries. There is no recovery after a failed token validation, though (P2-R1-01).
- [x] No tokens or secrets are committed — I searched the full `git log --all -p` for the real client ID, the client secret and both stored access tokens, printing counts only: 0 matches each. `.env`, `.env.*` and `.live-patch/` are ignored, and `.env.example` holds only names.

Suite: `npm test` passed (vitest 13/13, Playwright 26/26). `tsc --noEmit` is clean, the build succeeded, `npm audit` found 0 vulnerabilities, and `git status` stayed clean.

## Findings

### Blockers
None in code. The two unchecked exit criteria above are operator checks, not code defects.

### Majors
- **P2-R1-01** · `engine/twitch/server.ts:79-82`, `engine/twitch/server.ts:70-77` — One failed token validation, even a network blip, stops EventSub permanently. The hourly timer calls `eventsub.stop()` on any error. Nothing ever starts it again: a later successful validation only clears `authIssue`. Startup has the same problem: if `connect(true)` fails because the network is down, it is never retried. In probe P-B (mocked fetch, fake timers), EventSub was `connected` at startup. After one hourly check during a network outage it was `offline | authIssue: TypeError: fetch failed`. One hour after the network came back it was still `offline`, the issue text was gone, and no new socket had opened. On stream, chat would silently stop being read for the rest of the run. Suggested fix:
  - Separate "this token is invalid" (Twitch answered with a rejection) from transient failures.
  - On a transient failure, keep EventSub running and retry validation with backoff.
  - Whenever validation succeeds while EventSub is stopped, start it again; retry the startup connection the same way.
  - Add a fake-timer test for a blip followed by recovery.
- **P2-R1-02** · `engine/twitch/eventsub.ts:56-57`, `engine/twitch/eventsub.ts:84-87` — Chat and reward subscriptions succeed or fail together. If the reward subscription fails, the whole session is closed, which drops the chat subscription that already succeeded, and the client then retries forever. In probe P-A (helix returns 202 for chat, 403 for the reward), the first socket closed straight after its welcome. After four retries there were 5 sockets, the status was `reconnecting`, and 0 chat events had been delivered. The status overwrites the real reason with `reconnecting`. This is exactly what happens if `TWITCH_PITCH_REWARD_ID` is set before the channel is Affiliate, or set to a wrong ID: chat ingestion dies, and the simulator just says "reconnecting". Suggested fix:
  - Create the subscriptions independently, and keep the session when the chat subscription succeeds.
  - Report a reward-subscription failure as its own visible status, such as "reward events unavailable: 403".
  - Don't retry-loop on a 4xx configuration error.
  - Add a test where chat succeeds and the reward fails.
- **P2-R1-03** · `vite.config.ts:55`, `engine/twitch/server.ts:44-45` — The OAuth token file sits inside the Vite root, and Vite serves it. On the clone's HTTPS dev server, with a fake `.live-patch/tokens.json`:
  - `GET /.live-patch/tokens.json` returned `200` with the fake token values;
  - `/.env` and `/.env.txt` returned `403`, thanks to Vite's default deny list.

  Any local process or same-origin page (game, simulator, and the Phase 4 overlays) can read the broadcaster and bot access and refresh tokens. If the server is ever bound beyond localhost, so can anything on the network; that is common with a second PC running OBS. Suggested fix: add the data folder to `server.fs.deny` alongside Vite's defaults, or move the token store out of the project root into a per-user data folder. Add a test that requests the token path and expects 403 or 404.

### Minors
- **P2-R1-04** · `engine/pipeline/commands.ts:46`, `engine/pipeline/commands.ts:61-62`, `engine/pipeline/commands.ts:67-69` — Every denied or invalid command gets a bot reply: a non-mod's `!approve`, a cooldown hit, or `!vote 9`. One viewer spamming makes the bot post once per message. That uses up Twitch's chat rate limit for the bot, so real acknowledgements get dropped (in my simulator run, every denied command added a reply). Suggested fix: ignore moderator commands from non-moderators without replying, and allow at most one error reply per viewer every 30 s or so.
- **P2-R1-05** · `engine/pipeline/commands.ts:29-30`, `engine/pipeline/commands.ts:61-62`, `README.md` step 4 — If a redemption's text is too long or empty, or the viewer is in cooldown, no idea is stored but the viewer's channel points are still spent. README step 4 creates the reward in the Twitch dashboard, and Twitch only lets the app that created a reward refund or fulfil its redemptions, so the app can never refund. Decide this before the reward-ID setup. Suggested fix: create the reward through the Create Custom Rewards API, with the `channel:manage:redemptions` scope, so the app owns it. Then mark redemptions fulfilled or cancelled (refunded), and use the reward's own input-length and per-viewer cooldown settings.
- **P2-R1-06** · `engine/twitch/auth.ts:37`, `engine/twitch/auth.ts:19` — The authorize URL leaves out `force_verify=true`. When the operator's browser is signed in as the broadcaster and they click "Connect bot", Twitch can silently reuse that session. The separate-account check then fails with a confusing error instead of showing an account picker. Expired pending states are also never pruned. Suggested fix: add `force_verify=true`, and drop expired states whenever a new one is created.
- **P2-R1-07** · `engine/twitch/server.ts:66`, `engine/pipeline/commands.ts:27` — Every chat event reaches the game's `onChat`, including the bot's own replies (which repeat viewer idea text) and `!approve` or `!reject` commands. Speech-bubble patches will show the bot talking to itself. Suggested fix: skip the bot user's messages and command messages before forwarding chat to the game.
- **P2-R1-08** · `engine/twitch/simulator.ts:28-30`, `engine/pipeline/ideas.ts:33` — The simulator numbers the latest 20 ideas 1–20 regardless of status. `!vote 1` and `!approve 1` target the newest *pending* idea. Once any idea is approved or rejected, the labels no longer match, so a moderator reading the simulator list approves a different idea than the one marked "1.". Suggested fix: show the vote number (1–3) only next to the current pending candidates, and list everything else without numbers.
- **P2-R1-09** · `vite.config.ts:55`, `README.md` "Run" — The game page is now served over self-signed HTTPS, and the OBS browser source may refuse it; that check is already on the Phase 5 list. Twitch's docs make an exception that allows `http://localhost` redirect URLs. Suggested fix: before the OBS check, retry registering exactly `http://localhost:5173/api/twitch/auth/callback`. If Twitch accepts it, keep HTTP. If not, document how to make OBS trust the local certificate.

### Nits
None.

## Working well — do not change
- The OAuth code flow: single-use state with an expiry, a scope and identity check on every token, refusal of the same account for both roles, hourly validation, refresh on 401, and atomic token writes.
- One `InboundEvent` type for Twitch and the simulator. Message IDs are de-duplicated, the broadcaster is matched by user ID, and moderator status comes from Twitch badges rather than display names.
- The simulator endpoint: on by default for local use, with an Origin check and a JSON-only rule. A foreign origin and a `text/plain` POST both got `403` in my run.
- The reply check reads Twitch's `is_sent` and `drop_reason`, so a dropped bot message shows up instead of being hidden behind HTTP 200.
- Plain text throughout: `textContent` in the simulator, and the `<img onerror>` regression test.
- The test harness isolates the idea and token store, and the README lists every scope.

## Operator steps (not code findings)
1. **Second-account check (clears exit criterion 1; no reward ID needed).** Using any second Twitch account you control, typed by hand in the browser rather than sent by the bot through the API, send `!idea test from second account` in your channel while `npm run dev` runs. `/api/ideas` should show it within 2 s.
2. **Bot replies dropped with `msg_rejected`.** Make the bot a moderator in your channel (`/mod <botname>`) and confirm the bot account has a verified email or phone, then retest `!vote 1` and check the simulator's delivery warning. Moderator bots also get a higher chat rate limit.
3. **Reward ID.** Once the channel has Affiliate status, set `TWITCH_PITCH_REWARD_ID` only after P2-R1-02 is fixed; until then, a reward subscription failure takes chat down too. Read P2-R1-05 first, because creating the reward from the dashboard rules out refunds.
4. **Housekeeping.** `.env.txt` in the submission folder is a second plaintext copy of the credentials, and it differs from `.env`. Git ignores it and the dev server blocks it, but delete it once `.env` works, so it never ends up in a zip or a screen share.
