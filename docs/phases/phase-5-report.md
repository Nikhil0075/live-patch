# Phase 5 report

## Built

- Fresh-clone `npm run setup` with dependency, browser, Git and Codex checks; a faster Practice pitch and vote path.
- Twitch reward availability checks, an app-owned refundable pitch reward, persisted refund results, and operator retry visibility.
- Optional Twitch Channel Points Predictions for Ships or Fails, with persisted settlement and cancellation after rejection, operator cancellation or interrupted builds.
- Saved-build original/evolved comparison, one-viewer-one-vote chat rollback ballot and moderator confirmation, and rollback undo for entity edits and patch-earned score in the current game run.
- Phase 1 source-scope checks, rolling invalid-action and skip counters, ordered event batches; asynchronous Git and MCP checks during live builds; clearer repair reason; an opt-in WebGL crowd check. Removed costly player GPU postprocessing after that check exposed patch timeouts; the shaded code-made textures remain.
- Browser-safe settings defaults and a self-contained saved-game bundle. Added `esbuild` because a saved game must bundle its shared engine imports into a playable snapshot.

## How to run and test

- `npm run setup`, then `npm run dev`. Open Setup, Practice, Go Live and Builds from the studio.
- `npm test`, `npm run build`, `npm audit --audit-level=high`.
- PowerShell headed renderer check: `$env:LIVE_PATCH_WEBGL=1; node scripts/test.mjs --browser-only --browser-grep "WebGL crowd"`.
- Manual operator checks: elevated sandbox setup/self-test, reconnect broadcaster and bot, redeem from a second account, run a live Prediction and refund test, trust the HTTPS source in OBS, and time a first run plus practice round.

## Exit criteria

- [x] A temporary clone ran `npm run setup`, installed missing packages with `npm ci`, detected Chromium and Codex sign-in, then started `npm run dev`; Home and `/api/game` both returned HTTP 200. The wizard's elevated sandbox check still requires the operator.
- [x] Practice produces three pitches and casts three votes without editing viewer fields — browser test `Practice generates three distinct pitches and one-click votes`.
- [x] Reward disabled, paused and out-of-stock states are classified and shown in Setup and Go Live — reward-state unit tests. A second-account live redemption remains an operator check after reconnect.
- [x] Rejected app-owned, unfulfilled redemptions can be canceled; unsupported ownership and API failures are visible — refund unit tests. Live refund remains an operator check.
- [x] Predictions persist and are settled or canceled idempotently, including restart reconciliation — `predictions.test.ts`. Live Channel Points settlement remains an operator check.
- [x] Saved comparison loads original and evolved views without changing the live game — browser comparison test.
- [x] Rollback ballot counts each viewer once, persists over restart and needs moderator confirmation — `rollback-votes.test.ts`; local control remains immediate.
- [x] Phase 1, 3 and 4 review carryovers addressed in code and tests; see Review responses.
- [x] WebGL crowd keeps unrelated patches active in headless Chromium with its WebGL renderer — opt-in test passed three consecutive runs. A visible streaming-PC observation remains pending.
- [ ] OBS trusts the HTTPS source, plays audio once, and a first setup plus practice round finishes within ten minutes — operator checks pending.
- [x] `npm test` passed 64 unit tests (4 opt-in skipped) and 36 browser tests (1 opt-in skipped); `npm run build` passed; `npm audit --audit-level=high` found 0 vulnerabilities; `git diff --check` passed.

## Deferred

- None of the remaining manual checks is claimed complete until the operator performs it on the streaming PC and live channel.

## Known gaps / risks

- Broadcaster OAuth needs reconnection to grant `channel:manage:redemptions` and `channel:manage:predictions`; the saved token with older scopes cannot be reused.
- Twitch only allows the app to refund its own unfulfilled reward redemptions. Dashboard-created reward redemptions cannot be refunded through this app. Prediction availability depends on Twitch channel eligibility.
- Rollback cannot undo natural game progression unrelated to a mutation, or effects already consumed outside the current game run.
- Browser-source certificate trust, live points settlement and a timed first-run remain unobserved while the studio and stream are closed.
- This shell could not launch a visible Chromium window (`spawn UNKNOWN`); the opt-in WebGL stress case passed 3/3 with headless Chromium's WebGL renderer. A visible check remains for the operator.
- Automatic command review rejected recursive cleanup of the temporary fresh-clone checkout. The test copy remains at `C:\Users\ROG\AppData\Local\Temp\live-patch-phase5-clone-657d281c` with its isolated data at `C:\Users\ROG\AppData\Local\Temp\live-patch-phase5-clone-data-657d281c`.

## Review responses

- P1-R3-01 — **Fixed:** lexical source scopes prevent an unused nested declaration from permitting a forbidden global elsewhere; test covers the bypass.
- P1-R3-02 — **Fixed:** invalid actions now count in a rolling 60-second window; unit test and mutation API doc state the rule.
- P1-R3-03 — **Fixed:** matching events are sent in ordered batches of up to 16; skip counts show only the recent 10 seconds; browser test covers ordered delivery.
- P2-R1-05 — **Fixed in code:** app-owned reward and explicit refund status; live refund requires operator verification.
- P2-R1-09 — **Pending manual:** OBS certificate trust must be checked on the streaming PC.
- P2-R3-01 — **Fixed:** Setup and Go Live read the reward's actual availability; README says to redeem from a second account.
- P3-R1-07 — **Fixed:** rollback reverses entity edits and patch-earned score in the current run; browser regression test.
- P3-R1-09 — **Fixed:** live-build Git and Codex MCP calls are asynchronous with 20-second Git and 15-second MCP timeouts; startup recovery remains synchronous.
- P3-R1-10 — **Fixed:** the repair prompt uses `repairReason` instead of overloading the accepted-source variable.
- P3-R3-01 — **Already fixed in Phase 4.5:** default MCP test uses a simulated configuration; real CLI check is opt-in.
- P4-R2-01 — **Already fixed:** chat's numeric approval resolves through `RoundCoordinator.candidate`, which uses oldest-first pitch order.
- P45-R3-03 — **Fixed:** sample pitches and vote shortcuts use distinct viewers; browser test.
- P45-R3-04 — **Partly verified:** opt-in WebGL crowd test passed 3/3 with player postprocessing removed; visible streaming-PC observation pending.
