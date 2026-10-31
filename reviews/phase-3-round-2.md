# Phase 3 — Review round 2

## Verdict
Pass with minors

All five round-1 Majors are fixed, and I checked each fix in the code, the tests or the retained evaluation. The deferrals are reasoned and hide no Blocker. Three new Minors remain:
- `!rollback` cancels work even when there is nothing to roll back;
- the wider keyword filter rejects ordinary game ideas;
- the README doesn't cover setting up the elevated Windows sandbox.

How I verified: I reviewed `198e3ba..b653f38`. I ran the suite, build and audit in this repository, and read the retained evaluation at `live-patch-evaluations/phase3-live-2026-10-27T19-34-18-525Z`. I compared its runner code with `b653f38` by Git blob, read its `results.json` and two of its modules, and ran the keyword filter on a few harmless ideas. I did not rerun the real-Codex evaluation, because it uses the operator's Codex sign-in, and I did not run my own sandbox probes this round.

Note: Phase 2 is still untagged. Its round-2 fixes (`42813c9`) have not been reviewed yet, and its live redemption check is open.

## Exit criteria
- [x] Ten varied simulator ideas run end to end; at least seven ship working mutations — the retained evaluation ran through an isolated `npm run dev` server and the simulator endpoint, in a full clone.
  - Its runner, sandbox, gate, store, smoke spec and test-harness files are identical to `b653f38` (same Git blobs).
  - `results.json` lists 10 shipped runs, and the 10 modules are in its mutation folder.
  - The report judges 8 of 10 as matching their pitch. I read two modules and agree. `patch-54690d1e05e3.js` sets `enemySpeed` to 120 when lives recover, against a baseline of 68 (`games/arena-survivor/src/main.ts:8`). `patch-c491ef2010d8.js` merges touching enemies as pitched.
  - Eight of ten clears the bar of seven.
- [x] Malicious requests to read local files or access websites are refused or blocked by the gates — the runner now pins the Codex configuration (`engine/runner/sandbox.ts:8-15`):
  - the shell tool, apps, plugins and web search are off;
  - every configured MCP server is disabled, and the effective list is checked;
  - any attempted command, MCP or web-search item aborts the run (`runner.ts:64-65`), and the SDK kills its child process when the event loop exits;
  - a probe before the first turn must show that writing inside the worktree works and writing in the main repository fails.

  So during a build Codex can only edit files, and its output still passes the path gate, source gate and browser sandbox. The eval's server log has no tool-rejection lines across 10 runs, which fits the shell tool being unavailable. The keyword filter is now described as a convenience, not a boundary.
- [x] A crashing mutation fails the smoke test and never reaches the live game — unchanged from round 1. The combined smoke test now also requires every previously active module to stay `active`.
- [x] Rollback restores the previous game state in under five seconds — `rolls back a shipped patch during a slow build without waiting for the build queue` passes. Rollback now aborts the build and removes the live file before any Git work (`runner.ts:128-131,282-306`). What rollback does not undo (edits to other modules' entities, score earned) is documented in `games/arena-survivor/docs/mutation-api.md:7` and the README, and the remaining work is deferred to Phase 5.
- [x] The phase report records the median idea-to-shipped time — 42,187 ms. I recomputed it from the ten durations in `results.json`: the mean of 42,084 and 42,290.
- [x] Switching to another valid game manifest changes the prompt, mutation path and test command without an engine change — unchanged, and the test passes.

Suite: `npm test` passed (vitest 29 passed, 2 skipped — the two opt-in real-Codex tests; Playwright 28/28). The build succeeded, `npm audit --audit-level=high` found 0 vulnerabilities, and the tree stayed clean apart from the untracked review files.

## Previous findings
- P3-R1-01 — Resolved. Rollback no longer waits in the build queue. It aborts the active build, and a stale build can't publish because the rollback epoch is checked before the publish step (`runner.ts:241`). A slow-build test covers it. Side effects are in P3-R2-01.
- P3-R1-02 — Resolved. With `LIVE_PATCH_SMOKE_COMBINED=1`, the smoke test loads the whole mutation folder plus the candidate and requires every module to stay `active` (`smoke.spec.ts:31-34,57`). `combined smoke detects a conflict that candidate-only smoke misses` shows the difference. The README now matches.
- P3-R1-03 — Resolved. Builder `AGENTS.md`, `AGENTS.override.md` and `.codex` folders are removed from each worktree (`runner.ts:32-39`), and the evaluation was rerun through the dev server in a full clone. It is retained with a per-idea table and an honest source review.
- P3-R1-04 — Resolved; see exit criterion 2. The report's remaining-risk wording is accurate.
- P3-R1-05 — Resolved. At startup, `recoverInterrupted` marks building runs and ideas failed, removes a half-published candidate, cleans up the worktree, prunes and deletes the branch. It also marks shipped records whose file is gone as rolled back. A restart test covers it.
- P3-R1-06 — Resolved. Failed run branches are deleted; shipped ones stay for rollback.
- P3-R1-07 — Accepted as partly deferred to Phase 5. The live file is now removed first, the idea is marked `rolled_back`, and the limits are documented.
- P3-R1-08 — Resolved. Browser events carry file names and a generic failure line, and `/api/runs` returns `publicRun` summaries; a test covers it.
- P3-R1-09 — Accepted as deferred to Phase 5. One correction: the report says the synchronous Git calls are bounded by 20-second timeouts, but `gitPaths` (`gates.ts:16`) still has none. Each run also now makes two synchronous `codex mcp list` calls with up to 15 s each (`sandbox.ts:36`). Include both in the Phase 5 fix.
- P3-R1-10 — Accepted as deferred to Phase 5.

## Findings

### Blockers
None.

### Majors
None.

### Minors
- **P3-R2-01** · `engine/runner/runner.ts:128-131,201-202,285` — `requestRollback` increments the rollback epoch and aborts the active build before `rollback()` checks for a shipped module. A `!rollback` with nothing to roll back therefore:
  - throws away the build in progress and every approved idea in the queue;
  - leaves those queued ideas `failed` with no run record or reason, and the viewers who pitched them get no message.

  Suggested fix: confirm there is a shipped module before aborting anything. Return cancelled queued ideas to `approved` (or record a "cancelled by rollback" reason) instead of a bare `failed`.
- **P3-R2-02** · `engine/runner/gates.ts:7-13` — The wider keyword filter now rejects ordinary game ideas. In my run it rejected:
  - "Enemies drop power-up tokens; check how many tokens the player has";
  - "When you grab a coin, send a web of lightning to nearby enemies";
  - "Coins open a portal to another site on the map";
  - "Show the twitch.tv chat name above the player".

  It is no longer a security boundary, so each rejection costs a viewer's approved idea for no safety gain. Suggested fix: narrow the filter to unmistakable requests, such as explicit paths, URLs or "your/streamer's files", or let flagged ideas through to the disabled-tool sandbox and gates. If the filter does reject an idea, show the reason to the moderator.
- **P3-R2-03** · `README.md:32` — Every run now needs Codex's elevated Windows sandbox. The README doesn't say what a new machine needs for it, or what the operator should do when the probe fails with "Codex sandbox cannot write in its worktree". Phase 5's fresh-clone check will hit this first. Suggested fix: add the setup step and the failure message to the README, and have the simulator show a sandbox failure clearly, separate from an ordinary build failure.

### Nits
None.

## Working well — do not change
- A pinned Codex configuration with no shell: the safest shape for a live agent, and it also made runs faster (42 s median).
- The probe before the first turn fails closed, and the effective MCP list is checked rather than assumed.
- Rollback ordering: abort the build, remove the live file, update records, then do Git history work on a best-effort basis.
- Startup recovery that reconciles both directions (stale `building` and missing `shipped` files).
- The retained evaluation, with blob-identical code, raw records and an honest per-idea source review that names the two weak patches.
- Combined smoke with a regression test showing why candidate-only smoke wasn't enough.
