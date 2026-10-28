# Phase 4 report

## Built

- A persistent round coordinator runs 60-second pitch and 45-second vote windows, fixes the three oldest pending candidate IDs with zero starting votes, retires losing candidates, and carries unselected pitches forward. The local control page can pause, resume, advance and escape a stuck build.
- Immediate triage rejects explicit unsafe requests, merges exact duplicates and keeps contributor credit. Optional operator-triggered Codex triage proposes refinements, rejections or merges with a 20-second deadline. The control page previews the validated proposals and requires an explicit apply; backward merges and more than two rejections are refused.
- A transparent 1920×1080 OBS overlay shows contributor-credited active patches, the round and vote bars, and the approved idea, author, mutation file and smoke-test progress. A separate local control page shows the same state, runs and saved builds. Viewer content is inserted with `textContent`.
- A saved-build action copies the selected game, excludes hidden/local data and unshipped generated patches, and writes Markdown-escaped patch notes crediting contributors. The snapshot can be reopened for play with `npm run dev -- --game builds/<id>/game`; the runner clearly refuses attempts to build into it.
- The Phase 3 MCP test was made deterministic for the default suite; its real CLI/configuration variant is opt-in with a timeout matching the production calls.

No new dependency was added.

## How to run and test

- Run `npm run dev`. Play at `/`, open `/control.html` for round controls, and add `/overlay.html` as an OBS Browser Source above a capture of the game window.
- Use the simulator or Twitch chat to send `!idea` and `!vote 1`–`!vote 3`; a moderator or broadcaster approves a candidate. The control page offers **Preview AI triage**, apply/discard, **Cancel build and next round**, and **Save build and patch notes**.
- `npm test` covers timing, restart recovery, vote slots, triage, saved builds, cross-origin control rejection and safe browser rendering. `LIVE_PATCH_REAL_TRIAGE=1 npx vitest run tests/phase4-real.test.ts` checks the signed-in Codex triage path separately.
- On 28 October 2026, the round-one fix suite passed 40 unit tests and 29 browser tests (four opt-in Codex tests skipped by default). `npm run build` passed and `npm audit --audit-level=high` found zero vulnerabilities. The original signed-in triage check passed; the changed preview/apply flow has unit coverage but has not been rerun against a signed-in model. A saved build was reopened on port 5190 in the original Phase 4 verification and loaded Arena Survivor with its three example mutations.

## Exit criteria

- [x] Pitch transitions to a 45-second vote with at most three fixed candidates; one vote per viewer remains enforced — fake-clock unit test, pipeline vote test and two-round zero-vote/FIFO regression.
- [x] Moderator approval launches the runner, rejection does not build, and round state survives restart — shared pipeline control callback, round persistence test and existing moderator-permission tests.
- [x] OBS and control pages show round, votes, active patches and redacted runs using plain text — browser test, source review and 1920×1080 visual inspection from the original build; the overlay center has alpha 0. The work panel now displays recent file and test events.
- [x] Local pause, resume and advance controls work, and cross-origin requests cannot invoke them — unit tests and browser POST rejection test.
- [x] Saved build contains selected game content, shipped mutations and credited patch notes — unit test excludes `.env` and unshipped patch, checks Markdown escaping and the play-only runner refusal; the original snapshot reopened successfully with `npm run dev -- --game`.
- [x] Full unit and browser tests, TypeScript build and dependency audit pass — commands above.

## Deferred

- Phase 2's live Channel Points redemption check still needs a short stream.
- Phase 5: channel-point outcome bets (after live redemption and refund validation), evolved/original comparison, and chat rollback voting with vote limits and moderator review. Also OBS certificate validation, reward refunds, game-state rollback of edits to other entities or earned score, synchronous Git/MCP-list call latency, and repair-variable cleanup. The Phase 3 MCP test's machine-dependent timeout (P3-R3-01) was fixed in this phase.

## Known gaps / risks

- The OBS browser source has not been tested inside OBS itself; the browser check verifies transparency and page rendering. The operator must verify the local HTTPS certificate in OBS before a real stream.
- AI triage is an optional operator action. Its model output may be imperfect, so the operator sees its suggestions before applying them and still approves the winning patch. If Codex is unavailable or triage times out, immediate safety and duplicate checks leave the round usable.
- Saved builds are playable from this repository's dev server, but cannot receive new patches. They are source snapshots, not standalone static exports.
- Recent runner events for the Codex panel are held in server memory. After a restart the run outcome remains in the run store, while past file/test steps are no longer shown.

## Review responses

- **P4-R1-01 — Fixed:** ballot order is oldest pending first; opening a ballot clears its votes, losers retire after the round, and a two-round test covers the old failure.
- **P4-R1-02 — Fixed:** the runner task now uses the approved specification shown in voting and notes, with the original pitch marked as context; a prompt regression test checks both.
- **P4-R1-03 — Fixed/Deferred:** the Codex panel now shows idea, contributors, file and smoke-test progress. Channel-point bets, evolved/original comparison and chat rollback vote are explicitly scheduled for Phase 5 in the vision and Phase 4 spec; the reward and refund checks must precede bets.
- **P4-R1-04 — Fixed:** AI triage now previews proposals for apply/discard, enforces earlier-only merges and caps rejections at two per call; tests cover the limits.
- **P4-R1-05 — Fixed:** the control panel can cancel a stuck build and start the next round; the round escape and runner cancellation have regression coverage.
- **P4-R1-06 — Fixed:** patch-note viewer strings escape Markdown links, images and formatting; the snapshot test includes hostile examples.
- **P4-R1-07 — Fixed:** saved builds are documented as play-only, and the runner fails fast with a clear message; the refusal has a regression test.
- **P4-R1-08 — Fixed:** overlay patch chips derive shipped credits from idea contributors and run records rather than Codex-authored metadata.
