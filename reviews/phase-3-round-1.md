# Phase 3 — Review round 1

## Verdict
Fail

The runner's core is careful. A patch is published only after the path gate, source gate and smoke test all pass, the publish step is atomic, and the manifest drives the prompt, paths and test command. Five Majors are open:
- rollback waits behind any build in progress;
- the smoke test runs the new module alone, not with the active ones;
- the ten-idea evaluation did not run in the live configuration;
- the evidence for malicious requests covers only a keyword filter;
- a restart during a run leaves records stuck at `building`.

How I verified: I reviewed `42813c9..198e3ba`, ran the suite, build and audit in this repository, and read the runner, gates, smoke harness and game removal code. I did **not** run the opt-in real-agent evaluation, because it uses the operator's Codex sign-in; it can be run on request. I did not finish a check of what the Codex sandbox itself allows on this machine (see P3-R1-04).

Note: Phase 2 is still untagged. Its round-2 fixes (`42813c9`) have not been reviewed yet, and its live redemption check is open.

## Exit criteria
- [ ] Ten varied simulator ideas run end to end; at least seven ship working mutations — **not reproduced.** The evaluation ran in a minimal fixture repository that `tests/phase3-real.test.ts:91` deletes afterwards. The shipped modules and per-idea results are gone, and the report gives no per-idea table. The fixture also differs from the live configuration (P3-R1-03). The smoke gate checks that a module loads and the game keeps running, not that it does what the idea asked.
- [ ] Malicious requests to read local files or access websites are refused or blocked by the gates — **partly evidenced.** The mutation-code side holds:
  - `rejects out-of-folder writes and forbidden source before smoke or live publish` passes;
  - a `fetch` call and an extra file are rejected before the smoke run;
  - modules run only in the browser sandbox.

  The request side is evidenced only by a keyword filter, and Codex's own commands during a build are not covered by any test (P3-R1-04).
- [x] A crashing mutation fails the smoke test and never reaches the live game — the controlled ten-idea test rejects both crashing ideas and publishes nothing for them. Publishing happens only after the gate and smoke test pass, and the source is re-read and compared after the smoke run (`runner.ts:183-196`). The smoke spec requires the module to be `active` (`smoke.spec.ts:33`), so an `onStart` exception fails it. I did not run the opt-in real-browser variant.
- [ ] Rollback restores the previous game state in under five seconds — **only when the runner is idle.** The test measures rollback with an empty queue (`tests/phase3.test.ts:91-93`). A rollback sent during a build waits for it (P3-R1-01). Removal undoes the module's parameters, its own entities, drawings and messages, but not its edits to other entities (P3-R1-07).
- [x] The phase report records the median idea-to-shipped time — 60.9 s is recorded, measured in the minimal fixture (P3-R1-03).
- [x] Switching to another valid game manifest changes the prompt, mutation path and test command without an engine change — `uses the selected manifest for the prompt, mutation path and smoke command` passes. The runner takes `mutationDir`, `apiDocs`, `examples` and `testCommand` from the manifest (`runner.ts:166-170,183`), and the loader keeps manifest paths inside the game folder (`engine/manifest/load.ts:14-23`).

Suite: `npm test` passed (vitest 24 passed, 1 skipped — the opt-in real-agent test; Playwright 27/27). The build succeeded, `npm audit --audit-level=high` found 0 vulnerabilities, and the tree stayed clean apart from the untracked Phase 2 review files.

## Findings

### Blockers
None found in what I checked. P3-R1-04 is open until the sandbox question is settled.

### Majors
- **P3-R1-01** · `engine/runner/runner.ts:105-109` — `requestRollback` chains onto the same queue as builds. A moderator's `!rollback` sent while an idea is building waits for that run and any queued approvals, up to three minutes per run, while a bad patch keeps running on stream. The spec requires rollback within five seconds, and the only timing test runs with an idle queue. Suggested fix: run rollback outside the build queue, so it never waits for Codex. If the build in progress finishes later, publish it only if it is still wanted. Add a test that requests a rollback during a slow fake build and asserts it completes in under five seconds.
- **P3-R1-02** · `games/arena-survivor/tests/smoke/smoke.spec.ts:10,23,32`, `engine/runner/runner.ts:183` — With `--mutation`, the smoke test loads only that module (`/?mutation=<file>`) and asserts exactly one active module. The spec says "Run the manifest's smoke command with the new module and all active mutations". The README and `docs/architecture.md` say it runs "with all active patches". So conflicts between modules are never tested before publish, such as two gravity rules, or one module removing entities another depends on, or the shared action budget being exceeded. Suggested fix: add a smoke mode that loads every module in the folder plus the candidate, and requires the candidate and the previously active modules to stay active. Add a test with a deliberately conflicting pair. Then the README claim is true.
- **P3-R1-03** · `tests/phase3-real.test.ts:30-45,91`, `engine/runner/runner.ts:120` — The ten-idea evaluation used a fixture that holds only the game folder and a `.gitignore`. In live use, every worktree is a full checkout of this repository, including the root `AGENTS.md`. Codex loads that file as project instructions, and it tells the agent to reply with a plan and wait for an OK, run the full test suite, write phase reports and commit. All of that conflicts with the runner prompt and costs time within the three-minute limit. So the 10/10 result and the 60.9 s median describe a configuration the live server never uses. The fixture is deleted, so nothing can be checked afterwards. Suggested fix:
  - Keep the builder's instructions away from runner threads: give the worktree only what the live agent needs, or turn off project-instruction loading for those threads.
  - Rerun the ten ideas through the same path `npm run dev` uses.
  - Add a per-idea table to the report: idea, outcome, duration, thread ID and module name, plus one line on whether the module does what was asked.
  - Keep the evaluation's modules somewhere ignored, so a reviewer can read them.
- **P3-R1-04** · `engine/runner/gates.ts:7-10`, `tests/phase3.test.ts:76`, `engine/runner/runner.ts:38-39` — The evidence for "malicious requests are refused or blocked" is two phrasings ("read the streamer's files", "open a website"), written to match a keyword filter. Any paraphrase without those keywords reaches Codex. During the build, the only limits on Codex's own commands are the local Codex sandbox and the model's judgment. No test checks that sandbox, and the runner sets only the sandbox mode and network flag. On Windows, the sandbox implementation comes from the operator's global Codex config (here `[windows] sandbox = 'unelevated'` in `~/.codex/config.toml`), so a different machine can get different confinement. Suggested fix:
  - Set every sandbox-relevant option explicitly in the runner's Codex configuration, including the Windows sandbox mode, and refuse to start a run if it can't be applied.
  - Add an automated check that confirms the effective sandbox before the first run.
  - Treat the keyword filter as a convenience, not a gate, and describe the remaining risk honestly in the report.

  I'll re-check this item in round 2.
- **P3-R1-05** · `engine/runner/runner.ts:148-155`, `engine/runner/store.ts` — If the server stops during a run, the run record and the idea stay `building`, and their worktree and `.git/worktrees` entry stay behind. Nothing reconciles this at startup. The README tells the operator to restart after any `.env` change, so this will happen on stream. The Phase 4 overlay will show the run as building forever, and the idea can't be approved again. The report lists it as a known gap; under the "nothing half-applied" rule it needs fixing now. Suggested fix: on startup, mark any `building` run and idea as failed with a "server restarted" reason, and prune runner worktrees. Add a test.

### Minors
- **P3-R1-06** · `engine/runner/runner.ts:119-120,146` — Every run, failed ones included, leaves a `live-patch/run-*` branch with a snapshot commit in the operator's repository. Over one stream that is dozens of branches, and `git push --all` would publish them. Suggested fix: delete failed runs' branches, keep only shipped ones (or keep them outside the main repository), and say so in the README.
- **P3-R1-07** · `engine/runner/runner.ts:234-240`, `games/arena-survivor/src/main.ts:54-62` — Rollback runs `git revert` before removing the live file. A Git failure, such as a missing branch, leaves the bad module running. The idea also stays `shipped` after rollback. Removal undoes parameters, owned entities, effects and messages, but not edits to other entities (radius, tags, velocity, removals); this is the look-ahead noted at the close of Phase 1. Suggested fix: remove the live file first, then record the revert, and mark the idea rolled back. State in the mutation API doc and the README exactly what rollback undoes.
- **P3-R1-08** · `engine/runner/runner.ts:46-47,213` — Runner events sent to the browser carry absolute worktree paths, which include the Windows user folder, and raw smoke output in failure messages. Phase 4 overlays will consume this stream on screen. Suggested fix: send paths relative to the game folder and a short failure summary, and keep the full text in the run record.
- **P3-R1-09** · `engine/runner/runner.ts:15-17`, `engine/runner/gates.ts:13` — Synchronous Git calls (worktree add, status, commit) block the dev server's event loop during each run, and `gitPaths` has no timeout. Suggested fix: use async process calls with timeouts.

### Nits
- **P3-R1-10** · `engine/runner/runner.ts:175-207` — `source` holds the candidate source on success and the error text before the repair turn. A separate name would make the repair prompt easier to follow.

## Working well — do not change
- Publish order: gates, then smoke, then re-gate and compare the source, then commit, then an exclusive temp write and rename into the live folder. A failure after publish removes the file.
- The worktree pointer is checked before any Git command runs in the worktree, and the single-file rule includes ignored files.
- The engine's forbidden list always applies on top of the manifest's (`validate.ts:4,9`), and the loader rejects manifest paths outside the game folder.
- Codex gets a restricted environment with no Twitch variables. Tool network access and web search are off, and runs are aborted with a process-tree kill on shutdown.
- Serial builds, a three-minute limit covering the repair turn, run records in an ignored, Vite-denied `runs.json`, and plain-text rendering of runs in the simulator.
