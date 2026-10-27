# Phase 3 report

## Built

- A manifest-driven Codex runner creates an isolated Git worktree and branch per idea, runs the TypeScript SDK with workspace-write, elevated Windows sandbox, shell and tool network disabled, and records the Codex thread ID. A sandbox probe must pass before Codex's first turn.
- Static path and source gates accept one new module in the active game's mutation directory. The manifest smoke command runs before an atomic live publish; a failed run leaves the live game unchanged.
- Approved ideas enter a serial runner queue. Moderator rollback interrupts an active build, cancels queued approvals and removes the last shipped module without waiting for Codex. Run results are persisted in an ignored local JSON file; redacted summaries reach `/api/runs`, a Vite progress event, and the simulator.
- Startup marks interrupted runs failed, removes any half-published module and stale worktree, and reconciles shipped ideas. Failed run branches are deleted; shipped branches remain for rollback.

`@openai/codex-sdk` was added because it provides the headless Codex thread, streaming events, sandbox options and abort signal required for the live runner.

## How to run and test

- Sign in with `codex login` if needed, then start `npm run dev`.
- In `/simulator.html`, submit `!idea <text>` and send `!approve 1` as a moderator or broadcaster. Watch Codex runs and the game mutation list. Send `!rollback` as a moderator or broadcaster to undo the latest shipped patch.
- `npm test` runs controlled runner and browser tests. `LIVE_PATCH_REAL_AGENT=1 npx vitest run tests/phase3-real.test.ts` runs one signed-in Codex SDK and real browser smoke evaluation in a retained, ignored full repository clone. Set `LIVE_PATCH_REAL_BATCH=1` for the ten-idea evaluation. The test prints the evaluation directory and writes `results.json`; generated modules stay under its `repo/games/.../mutations/` folder.
- `LIVE_PATCH_LIVE_EVAL=1 npx vitest run tests/phase3-live.test.ts` starts an isolated `npm run dev` server from a full repository clone, sends ten ideas through `/api/simulator/events`, and retains the clone and `results.json` under the sibling `live-patch-evaluations/` directory. Its one-idea preflight (`LIVE_PATCH_LIVE_EVAL_COUNT=1`) shipped through that HTTP path in 43.3 seconds.
- Round-one verification on 28 October 2026: `npm test` passed 29 unit tests and 28 browser tests (two opt-in live tests skipped by default); `npm run build` passed; `npm audit --audit-level=high` found zero vulnerabilities. The focused signed-in run shipped with shell and MCP servers disabled and rejected a deliberate crash.

## Exit criteria

- [x] Ten varied simulator ideas run end to end; at least seven ship working mutations — all 10 shipped through an isolated `npm run dev` server and simulator HTTP endpoint in a retained full-repository clone. Source review found eight implementations matching their pitches in this setup and two with semantic gaps (details below).
- [x] Malicious requests to read local files or access websites are refused or blocked — reworded requests are rejected by the convenience filter; Codex receives no shell, apps, plugins, MCP servers, web search or tool network, and a direct sandbox probe must confirm writes outside the worktree are denied before the first model turn. The generated-source and path gates still apply.
- [x] A crashing mutation fails the real browser smoke test and never reaches the live game — the deliberate `onStart` exception failed the actual smoke gate, and the live mutation folder matched its prior contents.
- [x] Rollback restores the previous game state in under five seconds — a focused test requests rollback during a deliberately slow build and measures removal below five seconds; the browser hot-reload test measures module disappearance below two seconds and verifies a parameter effect stops.
- [x] Median idea-to-shipped time is recorded — 42,187 ms (42.2 seconds) across ten shipped ideas through the isolated dev server.
- [x] A different game manifest changes the prompt, mutation path and smoke command without engine edits — controlled alternate-manifest runner test.

## Retained live-path evaluation

The isolated dev-server repository, raw run records, generated modules and `results.json` are at `D:/twitchconXcodex/live-patch-evaluations/phase3-live-2026-10-27T19-34-18-525Z`. This clone contains the full tracked repository at commit `1d720aa`; its server received each `!idea` and moderator `!approve` through `/api/simulator/events`. The runner removed builder instructions from each Codex worktree and disabled configured MCP servers. Each outcome below passed the static gate and combined five-second browser smoke test. The source review separately checks whether the module implements the pitch.

| Idea | Outcome | Time | Codex thread ID | Module | Source review |
| --- | --- | ---: | --- | --- | --- |
| Flip gravity left and right every 20 seconds | Shipped | 41.7 s | `01a17edb-6249-78f1-b3a0-1930b3d2e4f7` | `patch-b4e52c01056b.js` | Complete: alternates `gravityX` every 20 seconds. |
| Split a hit enemy into two small enemies | Shipped | 39.8 s | `01a17edc-04ba-7f23-a9fd-3043e426477c` | `patch-af75ab90124c.js` | Complete: `onHit` spawns two radius-8 enemies. |
| Move coins away from the player twice per second | Shipped | 43.1 s | `01a17edc-a027-73c0-8b93-1f3c58ae953a` | `patch-08d67ec36896.js` | Partial: updates at most 20 coins per half-second, rotating if more are present. |
| Leave a short fire trail while moving | Shipped | 45.7 s | `01a17edd-4f71-7c21-9259-6f935ec321f5` | `patch-b97aea3256f8.js` | Complete: spawns fire behind movement at a bounded cadence. |
| Show the latest chat message above an enemy | Shipped | 42.8 s | `01a17edd-fd40-7282-8f58-f93ab29b94c8` | `patch-8a8954860692.js` | Complete: draws bounded chat text above an enemy. |
| Merge touching enemies into a larger enemy | Shipped | 42.1 s | `01a17ede-a391-75c2-827d-9eb0a6dad13d` | `patch-c491ef2010d8.js` | Complete: combines radii, moves one enemy to the midpoint and removes the other. |
| Move faster for the first 15 seconds of each run | Shipped | 42.3 s | `01a17edf-48da-71b3-bb61-8690f5a38702` | `patch-60b5c12ad31a.js` | Complete in this setup: 400 for 15 seconds, then 300, the active Quick Feet patch's speed. Coupled to that patch's value. |
| Make collected coins worth three points | Shipped | 37.3 s | `01a17edf-ef8a-7f33-9aa2-e186d2530462` | `patch-991aa7e5ec37.js` | Complete: sets `coinValue` to 3. |
| Slow enemies when the player has one life left | Shipped | 54.2 s | `01a17ee0-8207-7760-9318-482fb7d43a7c` | `patch-54690d1e05e3.js` | Incorrect: sets speed to 60 at one life, then 120 otherwise; the game's baseline is 68, so enemies speed up when lives recover. |
| Draw a pulsing ring around the player once per second | Shipped | 38.4 s | `01a17ee1-5300-77a1-b462-cd3962ffc593` | `patch-a4dddc825e82.js` | Complete: draws a fading ring once per second. |

The browser smoke gate checks stability and coexistence, not semantic completeness. The two semantic gaps demonstrate why a future quality gate should check the requested mechanic before a live approval is considered fully satisfied.

## Deferred

- Phase 2's live Channel Points redemption remains open until the operator can run a short stream.
- Phase 4 owns the OBS overlay, scheduled voting and patch notes UI; this phase provides their runner event stream and records.
- Phase 5 owns reward refunds, OBS certificate validation and stream failure drills.

## Known gaps / risks

- The Codex model call requires an active local Codex sign-in. The runner pins the sandbox settings, disables configured MCP servers and probes the filesystem boundary, but the safety of the native sandbox and SDK still depends on the installed Codex binary. The keyword filter is only a convenience; the disabled tools, host gates and browser sandbox are the enforcement layers. The probe does not independently prove every possible network path.
- During the first isolated-server evaluation, Codex hit the account's temporary usage limit after one shipped idea; nine subsequent runs failed with that explicit provider error. The limit reset, and the full ten-idea rerun shipped 10/10. The failed evaluation is retained separately as evidence; the runner currently marks quota-rejected ideas failed and does not automatically retry them.
- Rollback does not undo a module's prior edits to other entities or score already earned. Those game-model changes remain a Phase 5 concern.

## Review responses

- **P3-R1-01 — Fixed:** rollback interrupts a build and runs outside its queue; a slow-build test measures under five seconds.
- **P3-R1-02 — Fixed:** runner smoke loads candidate plus all active modules; a browser test shows a pairwise conflict missed by candidate-only smoke.
- **P3-R1-03 — Fixed:** the replacement used an isolated `npm run dev` server in a retained full-repository clone and ten simulator HTTP approvals. It shipped 10/10; eight match their ideas in this setup by source inspection, with a 42.2-second median. Builder instructions are stripped from Codex worktrees.
- **P3-R1-04 — Fixed:** explicit elevated Windows sandbox, no-shell/app/plugin/web configuration, all configured MCP servers overridden off with an effective-list check, fail-closed worktree boundary probe, attempted-tool rejection, and reworded-request tests; the filter is not claimed as a security boundary.
- **P3-R1-05 — Fixed:** startup reconciles building runs and ideas, removes half-published candidates and stale worktrees; a restart test covers it.
- **P3-R1-06 — Fixed:** failed run branches are deleted; shipped branches remain for rollback.
- **P3-R1-07 — Fixed in part:** rollback removes the live file before Git history work and marks the idea rolled back; game docs now state that edits to other entities and earned score persist. Reversing those game-model effects is deferred to Phase 5.
- **P3-R1-08 — Fixed:** events and `/api/runs` use short redacted messages; full diagnostics remain only in the ignored local run store.
- **P3-R1-09 — Deferred to Phase 5:** synchronous Git calls remain; they are bounded by 20-second timeouts but can briefly block the dev server.
- **P3-R1-10 — Deferred to Phase 5:** separate repair-error and candidate-source variables are a readability cleanup.
