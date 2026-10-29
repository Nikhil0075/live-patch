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
- Manual operator checks: elevated sandbox setup/self-test, reconnect broadcaster and bot, redeem from a second account, run a live Prediction and refund test, trust the HTTPS source in OBS, time a first run plus practice round, and re-run signed-in AI triage on the preview/apply flow.

## Exit criteria

- [x] A temporary clone ran `npm run setup`, installed missing packages with `npm ci`, detected Chromium and Codex sign-in, then started `npm run dev`; the studio and `/api/game` loaded. Round 1 found that HTTPS/HTTP2 POST controls were broken; the new `npm run test:https` checks a real TLS server, a Practice submission and a Go Live control. The wizard's elevated sandbox check still requires the operator.
- [x] Practice produces three pitches and casts three votes without editing viewer fields — browser test `Practice generates three distinct pitches and one-click votes`.
- [x] Reward disabled, paused and out-of-stock states are classified and shown in Setup and Go Live — reward-state unit tests. A second-account live redemption remains an operator check after reconnect.
- [x] Rejected app-owned, unfulfilled redemptions can be canceled; unsupported ownership and API failures are visible — refund unit tests. Live refund remains an operator check.
- [x] Predictions persist and are settled or canceled idempotently, including restart reconciliation — `predictions.test.ts`. Live Channel Points settlement remains an operator check.
- [x] Saved comparison loads original and evolved views without changing the live game — browser comparison test.
- [x] Rollback ballot counts each viewer once and persists over restart — `rollback-votes.test.ts`; a moderator or broadcaster can immediately use `!rollback` with zero votes, and the local button is immediate.
- [x] Phase 1, 3 and 4 review carryovers addressed in code and tests; see Review responses.
- [x] WebGL crowd keeps unrelated patches active in headless Chromium with its WebGL renderer — opt-in test passed three consecutive runs. A visible streaming-PC observation remains pending.
- [ ] OBS trusts the HTTPS source, plays audio once, and a first setup plus practice round finishes within ten minutes — operator checks pending.
- [x] Round 1 fix run: `npm test` passed 68 unit tests (4 opt-in skipped), 38 browser tests (1 opt-in skipped) and the separate real-HTTPS/HTTP2 regression; `npm run build` passed; `npm audit --audit-level=high` found 0 vulnerabilities; `git diff --check` passed.
- [x] Public judge path after round 1: [the GitHub repository](https://github.com/Nikhil0075/live-patch) was cloned into a fresh temporary folder; `npm run setup` passed in 13 seconds and `npm run test:https` passed in 6 seconds against a real TLS server, including Practice and Go Live controls.

## Deferred

- None of the remaining manual checks is claimed complete until the operator performs it on the streaming PC and live channel.

## Known gaps / risks

- The operator has not yet accepted the Phase 5 spec as the final contract or uploaded the public submission video. The README links to a concrete recording outline, and the video link remains visibly pending.
- The real-channel prediction, app-owned reward fulfillment/refund, OBS certificate and audio, visible busy-scene renderer, and timed first run remain operator checks while the stream is closed.
- Broadcaster OAuth needs reconnection to grant `channel:manage:redemptions` and `channel:manage:predictions`; the saved token with older scopes cannot be reused.
- Twitch only allows the app to update its own unfulfilled reward redemptions. Dashboard-created reward redemptions cannot be refunded or fulfilled through this app. Prediction availability depends on Twitch channel eligibility.
- Rollback cannot undo natural game progression unrelated to a mutation, or effects already consumed outside the current game run.
- Browser-source certificate trust, live points settlement and a timed first-run remain unobserved while the studio and stream are closed.
- This shell could not launch a visible Chromium window (`spawn UNKNOWN`); the opt-in WebGL stress case passed 3/3 with headless Chromium's WebGL renderer. A visible check remains for the operator.
- Automatic command review rejected recursive cleanup of the temporary fresh-clone checkout. The test copy remains at `C:\Users\ROG\AppData\Local\Temp\live-patch-phase5-clone-657d281c` with its isolated data at `C:\Users\ROG\AppData\Local\Temp\live-patch-phase5-clone-data-657d281c`.
- Automatic command review also rejected deletion of the round-1 public-clone check at `C:\Users\ROG\AppData\Local\Temp\live-patch-judge-check-95b8914`, even after a separate path check confirmed it was within the Temp folder. The operator can delete that test checkout later.

## Review responses

- P5-R2-01 — **Fixed:** Arena Survivor's mutation API now states the 200–575 ms event-message budget and explains that long loops disable the patch; the root addendum links to the full contract.
- P5-R2-02 — **Fixed:** architecture now says the 20-action limit applies per event batch.
- P5-R2-03 — **Fixed:** `!rollback` replies "Nothing to roll back" when no patch has shipped, with a regression test; emergency rollback remains immediate when a patch exists.
- Round-2 verification — the shared browser server could advance rounds while the late Practice test began, and a synthetic 70 ms tick hook could exceed the new 16-event batch budget. The Practice test now starts in a pitch phase, and the skipped-time test uses a bounded 25 ms hook. Both focused tests pass.

- P5-R1-01 — **Fixed:** same-origin control requests accept HTTP/2 `:authority`; a real HTTPS server regression sends an HTTP/2 request and drives Practice and Go Live in Chromium, while a cross-origin request remains forbidden.
- P5-R1-02 — **Fixed:** moderator and broadcaster `!rollback` is immediate with zero viewer votes; viewer ballot remains an advisory prompt, with a unit regression and updated UI/docs.
- P5-R1-03 — **Fixed in code and docs:** README is a fresh-judge guide with clone URL, optional-account path, command reference and two-minute walkthrough; stale Phase 1 temporary-folder wording is corrected. The public demo video still needs operator recording/upload.
- P5-R1-04 — **Fixed:** the Worker event deadline scales with batch size, capped at 575 ms for 16 hooks; a busy-batch browser regression checks a bounded module stays active.
- P5-R1-05 — **Fixed:** Arena Survivor no longer archives hostile entities for rollback, preventing mass enemy resurrection; a browser regression covers it.
- P5-R1-06 — **Fixed:** accepted app-owned reward pitches are marked `FULFILLED` after storing the idea, with confirmed status persisted and failed attempts offered for retry; unit tests cover ownership and API failure.
- P5-R1-07 — **Fixed:** run records classify patch versus infrastructure failures; only gate/smoke failures resolve **Fails**, while sandbox, Codex, timeout and restart failures cancel the prediction. Unit tests cover the classification.

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
