# Phase 4 — Review round 2

## Verdict
Pass with minors

All three Majors and all five Minors from round 1 are fixed or explicitly deferred, and I re-ran both probes against the fixes. The vision now matches what the code does: features that aren't built are labelled Phase 5. No new Blockers or Majors.

How I verified: I reviewed `f0d2ebf..5e0885d` and ran the suite, build and audit in this repository. I re-ran probes P4-A (votes across rounds) and P4-B (runner on a saved build) in a scratch clone at `5e0885d` (since deleted). As in round 1, I did not run the signed-in triage test or check the overlay in OBS. The report notes that the new preview/apply flow has not been rerun against a signed-in model.

Process note: Codex edited `docs/phases/phase-4.md` again in this round, to match the fixes (oldest-first ballots, play-only builds) and to add a list of vision items scheduled for Phase 5. Those changes follow the round-1 findings, but the operator should still accept this spec as the Phase 4 contract.

## Exit criteria
- [x] A pitch round transitions to a 45-second vote with no more than three fixed candidates; one vote per viewer remains enforced — the tests pass, including the new `retires losing ideas and starts the next ballot with old queued pitches at zero votes`. Probe P4-A, round 1: `A:0, B:0, C:0`. After A won, round 2 opened with `D:0, E:0`, and B and C were `lost_vote`.
- [x] Moderator approval launches the runner, a rejected candidate never builds, and round state survives a restart — unchanged and passing. The runner now builds the specification shown on the ballot (`gates.ts:54-55`).
- [x] The OBS display and control panel show the same round, vote totals, active patches and redacted runner progress, and viewer text is never parsed as HTML — the Codex panel now shows the idea, contributors, the file name and smoke-test steps from `/api/runner-events`. Every new element is built with `appendText`, including the triage preview. The only `innerHTML` uses are fixed templates (`control.ts:5`, `stream.ts:5`, `simulator.ts:4`, `client.ts:8`).
- [x] An operator can pause, resume and advance a round locally, and cross-origin requests can't invoke controls — unchanged. The new actions (`triage-apply`, `triage-discard`, `force-next`) go through the same same-origin JSON check.
- [x] A saved build contains only the selected game's content, shipped mutations and patch notes crediting contributors — the snapshot test now includes hostile Markdown, and the runner refuses saved builds. Probe P4-B: "Saved builds are play-only; return to the original game to build new patches", with no worktree or branch created.
- [x] Full unit and browser tests, TypeScript build and dependency audit pass — `npm test`: vitest 40 passed and 4 skipped (opt-in signed-in tests), Playwright 29/29, in one full run that included the stuck-build test. The build succeeded, `npm audit --audit-level=high` found 0 vulnerabilities, and the tree stayed clean apart from the untracked review files.

## Previous findings
- P4-R1-01 — Resolved. Ballots take the oldest `submitted`/`shortlisted` pitches (`rounds.ts:128`), votes are cleared when a ballot opens, and `startPitch` retires remaining candidates as `lost_vote`. Confirmed by P4-A and the new test.
- P4-R1-02 — Resolved. The runner prompt marks `idea.spec` as the approved mechanic and the original pitch as context only. Approval replies, the overlay, the control panel and patch notes show the same spec, and a prompt regression test covers it.
- P4-R1-03 — Resolved. The Codex panel now shows contributors, the file and smoke-test progress. Bets, the original-versus-evolved comparison and chat rollback voting are marked Phase 5 in `docs/vision.md`, the spec and the report. The report also notes that panel steps are kept in memory and vanish after a restart.
- P4-R1-04 — Resolved. AI triage now produces a preview (`aiTriage`), which applies only on `triage-apply`. Merges must point to an earlier pending pitch, rejections are capped at two per call, and both are re-checked when applied. The preview is cleared when the ballot opens or a new pitch arrives.
- P4-R1-05 — Resolved. **Cancel build and next round** calls `forceNext` and `runner.cancelBuild`, which also works from a paused build; a test covers it.
- P4-R1-06 — Resolved. `safeText` escapes Markdown punctuation as well as `<`, `>` and `&` (`builds.ts:8-10`), and the test includes hostile names and pitches.
- P4-R1-07 — Resolved. The runner fails fast for games under `builds/`, the saved-build README says the snapshot is play-only, and the error reaches the browser as a clear message (`store.ts`).
- P4-R1-08 — Resolved. Patch chips use the shipped run and the idea's `contributors`, falling back to `meta.author` only for example modules.

## Findings

### Blockers
None.

### Majors
None.

### Minors
- **P4-R2-01** · `engine/pipeline/rounds.ts:47`, `engine/pipeline/ideas.ts:36` — During the pitch window, `!approve 1` still resolves through the old Phase 2 numbering: the newest pending pitch, not the oldest. The ballot and control panel now use oldest-first. A moderator who types `!approve 1` during a pitch window therefore approves the latest pitch, which may not match what they expect. Suggested fix: during the pitch window, accept approvals by ID only (as the control panel already does), or use the same oldest-first order the ballot uses.

### Nits
None.

## Working well — do not change
- Votes are scoped to the ballot by clearing them when it opens, and losing ideas get an explicit `lost_vote` state.
- AI triage is advisory, with preview, apply and discard, and its limits are enforced twice: when the preview is made and when it is applied.
- One specification is used everywhere: ballot, approval reply, runner prompt, overlay and patch notes.
- Operator escape from a stuck build with the cancellation reason recorded, and a fail-fast refusal for saved builds.
- Vision and spec now list what is deferred instead of claiming it.

## Carried to Phase 5
- OBS certificate and browser-source check.
- Channel-point bets (after the live redemption and refund checks), the original-versus-evolved comparison, and chat rollback voting.
- Re-running the signed-in triage check against the preview/apply flow.
- P4-R2-01.
