# Phase 4 — Review round 1

## Verdict
Fail

The plumbing is solid:
- the round clock survives restarts;
- vote slots are fixed when voting opens;
- control requests are restricted to the same origin;
- every viewer string on the overlay and control panel goes through `textContent`.

Three Majors are open. Vote bars carry votes from earlier rounds. Viewers vote on an AI-rewritten pitch while Codex builds the original text. And the vision promises stream features the code doesn't have, which the Codex-written spec dropped without saying so.

How I verified: I reviewed `phase-3-done..f0d2ebf` and ran the suite, build and audit in this repository. In a scratch clone at `f0d2ebf` (since deleted), I ran two unit probes with fake data: P4-A for votes across rounds, and P4-B for the runner on a reopened saved build. I did not run the opt-in signed-in triage test, and I did not check the overlay in OBS.

Process note: `docs/phases/phase-4.md` was written by Codex in the same commit as the code it specifies (`git log --diff-filter=A` shows `f0d2ebf`). The builder wrote its own exit criteria. The operator should confirm this spec against the plan before this phase is judged against it. P4-R1-03 lists what the vision describes that the spec leaves out.

## Exit criteria
- [x] A pitch round transitions to a 45-second vote with no more than three fixed candidates; one vote per viewer remains enforced — `automatically moves from a 60-second pitch to a 45-second vote…` and `keeps three fixed voting slots…` pass. The three slots are fixed when voting opens (`rounds.ts:100`), and `IdeaStore.vote` removes a viewer's earlier vote before adding a new one (`ideas.ts:56-63`). The vote totals themselves are wrong across rounds (P4-R1-01).
- [x] Moderator approval launches the runner, a rejected candidate never builds, and round state survives a restart — approval calls `rounds.approved` and `runner.enqueue` together (`server.ts`), the runner builds only `approved` ideas, and the restart test passes. A round that was `building` restarts as a fresh pitch.
- [x] The OBS display and control panel show the same round, vote totals, active patches and redacted runner progress, and viewer text is never parsed as HTML — both pages read the same four endpoints (`shared.ts:12-22`) and insert every value with `appendText`. The only `innerHTML` use is a fixed template. The browser test sends a pitch containing `<img>` and `<b>` markup and finds no such elements. "Runner progress" is only the latest run's status and duration (P4-R1-03).
- [x] An operator can pause, resume and advance a round locally, and cross-origin requests can't invoke controls — `/api/control` requires an `Origin` header whose host is `localhost` or `127.0.0.1` and matches `Host`, plus a JSON content type (`server.ts:39-47`). The browser test gets 403 for a denied request, and the unit test covers pause and resume.
- [x] A saved build contains only the selected game's content, shipped mutations and patch notes crediting contributors — `saves a playable game snapshot…` passes: it excludes `.env`, local data, tests and unshipped `patch-*` files. See P4-R1-02 (notes credit the AI rewrite), P4-R1-06 (markdown escaping) and P4-R1-07 (saved builds can't be built on).
- [x] Full unit and browser tests, TypeScript build and dependency audit pass — `npm test`: vitest 35 passed and 4 skipped (opt-in signed-in tests), Playwright 29/29. The build succeeded and `npm audit --audit-level=high` found 0 vulnerabilities. The tree stayed clean apart from the untracked review files.

## Previous findings
Carried from Phase 3: P3-R3-01 (flaky MCP test) — Resolved. `disabledMcpConfig` now accepts a list function, the default test uses a simulated configuration, and the real-CLI variant is opt-in (`LIVE_PATCH_REAL_MCP=1`).

## Findings

### Blockers
None.

### Majors
- **P4-R1-01** · `engine/pipeline/rounds.ts:100,112-115`, `engine/pipeline/ideas.ts:56-63` — Votes are never scoped to a round, so the bars on stream are wrong. Losing candidates keep their status (`voting`) and their votes. When fewer than three new pitches arrive, they are picked again and start the next vote ahead. Probe P4-A: in round 1, C got 2 votes and D won. In round 2, before anyone voted, the candidates read `E:0, C:2, B:0`. Selection is also "newest three", not a ranking. Idea A, pitched first, stayed `submitted` through both rounds and never reached a ballot. So in a busy round, late pitches crowd out earlier ones. Suggested fix:
  - Record votes per round, or clear candidates' votes when a vote opens, so every ballot starts at zero.
  - Decide what happens to losing candidates (retire them, or carry them with zeroed votes) and to pitches that didn't make the ballot.
  - Choose the three by a stated rule (earliest first, AI ranking or a queue), shown on the control panel.
  - Add a two-round test.
- **P4-R1-02** · `engine/runner/gates.ts:54`, `engine/overlay/stream.ts:25,32`, `engine/overlay/control.ts:28`, `engine/overlay/builds.ts:18` — After AI triage, the overlay, control panel and patch notes all show `idea.spec`, the model's rewrite, but the runner prompt still sends `idea.text`. Chat votes on one sentence, and Codex builds another. Patch notes then credit the rewrite, not what shipped. Because one model call rewrites up to 12 pitches together, one viewer's pitch text can also influence how others' pitches are displayed. Suggested fix: build from the text viewers voted on. Pass the approved spec as the task, with the original pitch as quoted context, and use that same text everywhere it's shown or credited. Add a test that the runner prompt contains the displayed spec.
- **P4-R1-03** · `docs/vision.md:12,20`, `engine/overlay/stream.ts:20-27`, `docs/phases/phase-4.md` — Demo honesty. The vision promises:
  - a "Codex at work panel [that] shows the idea, author, file changes and tests";
  - channel-point bets on shipped or failed;
  - the chaotic game shown "beside its original version";
  - a chat vote to roll back a bad idea.

  None of these exists. The overlay's panel shows the latest run's status, its idea text only while that idea is still a candidate, and a duration or generic error; no author, no file names, no test step. There are no bets, comparison view or chat rollback vote. The Codex-written spec omits all four without listing them as deferred or cut. Suggested fix: the operator decides the scope. For each item, either build it (the runner already emits `file` and `testing` events the panel could show), or mark it in `docs/vision.md` and the report as deferred or cut, so the submission makes no claim the code doesn't meet.

### Minors
- **P4-R1-04** · `engine/pipeline/rounds.ts:66-77` — AI triage decisions take effect immediately, with no preview and no undo. Any pending pitch can be merged into any other pending ID; the prompt's "earlier ID" rule isn't enforced. A single pitch written as instructions could therefore steer the model to reject or absorb the others when the operator clicks the button. Suggested fix: enforce merges toward the earlier idea, show proposed decisions on the control panel before applying them (or allow undo), and cap how many pitches one run can reject.
- **P4-R1-05** · `engine/pipeline/rounds.ts:98`, `engine/runner/runner.ts:213` — If the runner never sends a final event for the selected idea, the round stays `building` with no way out. For example, `build()` returns silently when the idea is no longer `approved`. **Next stage** refuses ("A patch is building"), and pause/resume returns to `building`, so only a restart recovers. Suggested fix: let the control panel force the next pitch round from `building`, or have every runner exit path emit a final event.
- **P4-R1-06** · `engine/overlay/builds.ts:8,37` — `safeText` escapes `<`, `>` and `&`, but not Markdown syntax. A pitch or name such as `[free sub](https://…)` or `![](https://…)` becomes a live link or remote image when `patch-notes.md` is viewed on GitHub or in an editor preview. Suggested fix: escape Markdown punctuation in viewer strings (`[ ] ( ) ! * _ #`, and `\`), or place them in a construct that renders literally.
- **P4-R1-07** · `engine/overlay/builds.ts`, `README.md` (saved builds), `.gitignore:12` — A reopened saved build can be played but not built on. Its folder is ignored by Git, so the runner's snapshot leaves it untracked, and the single-file gate then fails every idea. Probe P4-B: "Only one new mutation file is allowed; found: builds/saved-1/game/docs/mutation-api.md, builds/saved-1/game/live-patch.json, …". Continuing a stream from a saved build would therefore fail every patch. Suggested fix: either say in the README that saved builds are play-only, and have the runner refuse them with a clear message, or make the runner snapshot an ignored game folder correctly.
- **P4-R1-08** · `engine/overlay/stream.ts:15-16` — The overlay's patch chips take `title` and `author` by regex from the module source written by Codex. Merged contributors never appear, and the credit depends on what Codex put in `meta.author`. Suggested fix: build the chips from shipped run records and the idea's `contributors`, which the patch notes already use.

### Nits
None.

## Working well — do not change
- The round store is written with an atomic rename and recovers `building` as a fresh pitch. Deadlines are absolute, so a restart doesn't reset the clock.
- Fixed candidate IDs, so late pitches can't renumber the ballot; the vote window closes before approval.
- `/api/control` requires the same origin, the Host to match, and JSON. Mutation frames (origin `null`) and cross-site pages can't reach it.
- Plain-text rendering throughout both pages, with a browser test using markup in a pitch.
- Codex triage runs read-only, with no tools, a schema for its output, a 20-second deadline and a check on every returned ID. The immediate triage runs without the model.
- Saved builds leave out hidden files, tests, local data and unshipped patches, and clean up after a failure.
