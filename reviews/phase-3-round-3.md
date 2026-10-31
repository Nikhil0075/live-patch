# Phase 3 — Review round 3

## Verdict
Pass with minors

All three round-2 Minors are fixed. The one new issue is a flaky unit test: it failed in one of my two full runs. It is a Minor and doesn't block closing the phase. This is the last review round for Phase 3; tagging is the operator's call.

How I verified: I reviewed `b653f38..23c60f0`. I ran `npm test` twice, plus the build and audit. I ran the keyword filter on the four harmless ideas from round 2 and three plainly malicious ones, and checked that the bundled Codex CLI contains the sandbox setup command the README names. As in round 2, I did not rerun the real-Codex evaluation or my own sandbox probes.

Note: Phase 2 is still untagged. Its round-2 fixes (`42813c9`) have not been reviewed yet, and its live redemption check is open.

## Exit criteria
All six remain met, as recorded in round 2. This round's changes don't affect them: rollback still aborts a build and removes the live file in under five seconds, and the sandbox, gates and smoke test are unchanged.

Suite:
- First `npm test` run: one failure, `disables every configured Codex MCP server for a runner thread` ("Test timed out in 5000ms", 13,174 ms; see P3-R3-01). The other 29 unit tests passed.
- Second run: vitest 30 passed and 2 skipped (the opt-in real-Codex tests), Playwright 28/28.
- The build succeeded, `npm audit --audit-level=high` found 0 vulnerabilities, and the tree stayed clean apart from the untracked review files.

## Previous findings
- P3-R2-01 — Resolved. `requestRollback` now checks for a shipped module before it aborts anything, and rejects without side effects when there is none (`runner.ts:130-131`). Queued ideas cancelled by a real rollback get a run record with "Cancelled by moderator rollback", which `/api/runs` passes through (`runner.ts:204-210`, `store.ts:21-27`).
- P3-R2-02 — Resolved. The filter now needs an access verb aimed at a private target, or a network verb with a destination (`gates.ts:7-13`). In my run all four harmless ideas were accepted, and "read the streamer's files", "open a website" and "Send the API keys to my server" were rejected. The report keeps it described as a convenience, not a boundary.
- P3-R2-03 — Resolved. The README now covers provisioning the elevated Windows sandbox, both probe failure messages, and the rule that the runner won't fall back to a weaker sandbox. The simulator labels sandbox failures separately ("Sandbox setup failed; see README…"). The bundled Codex 0.164 binary contains the `codex sandbox setup --elevated` command, though `codex sandbox --help` doesn't list it. I did not run the setup.
- P3-R1-09 — Report corrected. It now says `gitPaths` has no timeout and names the two MCP-list calls. Still deferred to Phase 5.
- P3-R1-07, P3-R1-10 — Still deferred to Phase 5, unchanged.

## Findings

### Blockers
None.

### Majors
None.

### Minors
- **P3-R3-01** · `tests/phase3.test.ts:292-295` — `disables every configured Codex MCP server for a runner thread` runs the real `codex mcp list` twice against the operator's own Codex configuration, under Vitest's default 5-second limit. The function it tests allows up to 15 s per call (`engine/runner/sandbox.ts:36`). On this machine one call takes 0.3–2.1 s when idle. During the full suite, the pair took 13.2 s and the test failed; on rerun it passed. So `npm test` can fail on a slow or busy machine, and the result depends on whichever MCP servers that machine has configured. That will matter for the Phase 5 fresh-clone check. Suggested fix:
  - Test the override and verification logic against a fake server list, so `npm test` never depends on local configuration.
  - Move the real-binary check to an opt-in test like the real-Codex ones, or give it a timeout that matches the function's own limit.

  The same timing also shows the cost of P3-R1-09: on a busy machine, the start of each build can block the dev server for over 10 s.

### Nits
None.

## Working well — do not change
- Rollback now has no side effects when there is nothing to roll back, and cancellations leave an explained record instead of a bare `failed`.
- The filter now aims at clear requests and leaves enforcement to the disabled tools, gates and browser sandbox.
- The sandbox troubleshooting text is specific: it names each probe failure and refuses a silent fallback.
- Everything listed under "Working well" in round 2.

## Phase 3 closing note — carried to Phase 5
- P3-R1-07: rollback doesn't undo edits to other modules' entities, or score already earned.
- P3-R1-09: synchronous Git and MCP-list calls block the dev server, and `gitPaths` has no timeout.
- P3-R1-10: the variable naming used for the repair prompt.
- P3-R3-01: the flaky MCP test.
