# Phase 3 report

## Built

- A manifest-driven Codex runner creates an isolated Git worktree and branch per idea, runs the TypeScript SDK with workspace-write and tool network disabled, and records the Codex thread ID.
- Static path and source gates accept one new module in the active game's mutation directory. The manifest smoke command runs before an atomic live publish; a failed run leaves the live game unchanged.
- Approved ideas and moderator rollback requests enter a serial runner queue. Run results are persisted in an ignored local JSON file and exposed through `/api/runs`, a Vite progress event, and the simulator.
- A rollback reverts the patch commit in its run branch and removes the live module. Shutdown aborts an active run.

`@openai/codex-sdk` was added because it provides the headless Codex thread, streaming events, sandbox options and abort signal required for the live runner.

## How to run and test

- Sign in with `codex login` if needed, then start `npm run dev`.
- In `/simulator.html`, submit `!idea <text>` and send `!approve 1` as a moderator or broadcaster. Watch Codex runs and the game mutation list. Send `!rollback` as a moderator or broadcaster to undo the latest shipped patch.
- `npm test` runs controlled runner and browser tests. `LIVE_PATCH_REAL_AGENT=1 npx vitest run tests/phase3-real.test.ts` runs one signed-in Codex SDK and real browser smoke evaluation in a disposable repository. Set `LIVE_PATCH_REAL_BATCH=1` for the ten-idea evaluation.
- Verification on 27 October 2026: `npm test` passed 24 unit tests and 27 browser tests (the opt-in real-agent test is skipped by default); `npm run build` passed; `npm audit --audit-level=high` found zero vulnerabilities; the running local HTTPS server returned 200 for `/api/runs`.

## Exit criteria

- [x] Ten varied simulator ideas run end to end; at least seven ship working mutations — the signed-in Codex SDK, static gate and real five-second browser smoke test shipped all 10 in a disposable repository (`LIVE_PATCH_REAL_BATCH=1`), including one repair turn.
- [x] Malicious requests to read local files or access websites are refused or blocked — controlled pipeline tests reject both before Codex; path and forbidden-source tests block generated changes.
- [x] A crashing mutation fails the real browser smoke test and never reaches the live game — the deliberate `onStart` exception failed the actual smoke gate, and the live mutation folder matched its prior contents.
- [x] Rollback restores the previous game state in under five seconds — the controlled ten-idea test measures latest patch removal plus branch revert below five seconds; the existing browser hot-reload test measures module disappearance below two seconds and verifies a parameter effect stops.
- [x] Median idea-to-shipped time is recorded — 60,852.5 ms (60.9 seconds) across 10 real SDK runs, measured from approval-run start through live publish.
- [x] A different game manifest changes the prompt, mutation path and smoke command without engine edits — controlled alternate-manifest runner test.

## Deferred

- Phase 2's live Channel Points redemption remains open until the operator can run a short stream.
- Phase 4 owns the OBS overlay, scheduled voting and patch notes UI; this phase provides their runner event stream and records.
- Phase 5 owns reward refunds, OBS certificate validation and stream failure drills.

## Known gaps / risks

- The Codex model call requires an active local Codex sign-in. The runner passes a restricted environment and prevents tool network access, but its safety still depends on the installed Codex sandbox implementation; the host gates and browser sandbox remain mandatory.
- A server crash during a run can leave a disposable worktree and a `building` record. No candidate reaches the live game before all gates pass.

## Review responses

(Filled in during review rounds.)
