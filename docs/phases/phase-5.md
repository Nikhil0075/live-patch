# Phase 5 — Stream readiness and final experience

## Goal

Finish the deferred stream features and harden Live Patch for a fresh operator, a real browser renderer, and a full Twitch session. This phase follows the product vision and the items explicitly carried forward in the Phase 1–4.5 reviews.

## Build

- Add `npm run setup` for a fresh clone. It checks dependencies, browser, Codex sign-in, sandbox and optional Twitch configuration without printing secrets, then points the operator to the Setup wizard.
- Make Practice generate distinct pitches from distinct viewers and provide one-click votes from new viewers.
- Show the configured Twitch reward's actual enabled, paused and stock state in Setup and Go Live. Document that the broadcaster needs a second account to redeem it.
- Handle rejected reward redemptions with a refund when the app owns the reward and has `channel:manage:redemptions`; otherwise explain clearly why a refund cannot be sent. Never silently claim that points were returned.
- Add a limited channel-point outcome bet on whether a patch ships, with settlement or refund rules and explicit operator control. A failed or cancelled build must not leave points in an ambiguous state.
- Add an original-versus-evolved comparison view for a saved build or the active game, without sending duplicate mutation actions to the live game.
- Add chat rollback voting with one vote per viewer per ballot, a visible threshold and moderator approval before the existing rollback runs.
- Close Phase 1–4.5 review minors: source-gate shadowing, invalid-action aging, event skip counters, rollback side effects, blocking runner calls, repair-step clarity, review report accuracy and the remaining presentation and setup gaps.
- Verify the actual WebGL effect path under an opt-in browser test, and document a headed busy-scene check on the streaming PC.
- Verify OBS browser-source certificate trust, sandbox setup, Twitch reconnect and a timed first run on the operator machine. Keep any manual check unchecked until observed.

## Exit criteria

- [ ] A fresh clone runs `npm run setup`, passes the documented checks, and starts the studio without editing source files.
- [ ] Practice fills a three-idea ballot and casts votes without cooldown conflicts or manual viewer-field edits.
- [ ] Disabled, paused and out-of-stock rewards are shown as unavailable in Setup and Go Live; a live second-account redemption still enters the shared idea pipeline.
- [ ] Rejected redemptions refund points only when Twitch permits it; API failures and unsupported reward ownership are visible and tested.
- [ ] Outcome bets settle or refund correctly across ship, fail, cancel and restart paths, with no duplicate settlement.
- [ ] Comparison shows original and evolved games side by side without altering the live run.
- [ ] Chat rollback votes are limited per viewer and require moderator or broadcaster confirmation before rollback.
- [ ] Review minors carried into this phase have a recorded resolution, test or justified deferral.
- [ ] A busy scene keeps unrelated patches active on the normal WebGL path; the opt-in test and operator observation are recorded.
- [ ] OBS loads the HTTPS overlay and play view with audio once, and the operator completes a fresh setup and practice round in under ten minutes.
- [ ] `npm test`, `npm run build` and `npm audit --audit-level=high` pass; docs and the phase report match the code; no secrets are committed.
