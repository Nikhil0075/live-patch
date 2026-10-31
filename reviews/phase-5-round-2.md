# Phase 5 — Review round 2

## Verdict
Pass with minors

All seven round-1 findings are fixed and verified. That includes the HTTP/2 Blocker, which I checked in a fresh clone of the **public** repository, driving the real `npm run dev` server over `h2`. Tests, build, audit and the secret scan are clean. Two Minors and one Nit are left.

**Codex's work for Phase 5 is done. The phase itself cannot close yet:** the live Twitch, OBS, visible busy-scene and timed first-run checks are operator-only and still open (see "Operator checks before closing" below).

How I verified, at `40b7e5b` (`9cca41a..40b7e5b` reviewed):
- `npm test`, `npm run build`, `npm audit --audit-level=high`, `git diff --check`.
- A secret scan of the full public history, printing counts only.
- **Judge run:** I cloned `https://github.com/Nikhil0075/live-patch.git` into a new temporary folder and followed only the README. I drove the real HTTPS server with headless Chromium, never approving an idea, so no Codex build started. Screenshots are in `D:\twitchconXcodex\plans\phase-5-judge\r2-*.png`. I have since deleted the clone.

## Exit criteria
- [x] **A fresh clone runs `npm run setup`, passes the documented checks and starts the studio without editing source files.**
  - Public clone in 5 s.
  - `npm run setup` finished in 14 s, exit 0. Node, Git, dependencies (via `npm ci`), Chromium and Codex sign-in were all Ready; Elevated sandbox said "Needs action"; Twitch was "Optional".
  - `npm run dev` printed `https://localhost:5173/`, and the first visit landed on `/?view=setup`.
- [x] **Practice fills a three-idea ballot and casts votes without cooldown conflicts or manual viewer-field edits** — verified in the **real HTTPS dev server**:
  - Generate sample pitch → Send, three times: "Idea received" each time.
  - The POSTs ran over `nextHopProtocol = h2`.
  - Go Live **Next stage** → "ROUND 1 · VOTE · 45s".
  - Three **Vote N as new viewer** clicks → "Vote recorded" each time.
  - `/api/ideas`: 3 ideas, 1 vote each, 3 distinct authors.
  - The overlay showed the ballot at 33 % each.
- [x] **Disabled, paused and out-of-stock rewards show as unavailable; a live redemption enters the pipeline** — code and unit tests as in round 1. A live redemption of the **app-owned** reward is an operator check.
- [x] **Rejected redemptions refund only when Twitch permits; failures are visible and tested** — unchanged and tested. New: accepted redemptions are marked `FULFILLED`, with retry. The live check is an operator check.
- [x] **Predictions settle or refund correctly across ship, fail, cancel and restart, with no duplicate settlement.**
  - `failureKind` now separates patch failures (resolve **Fails**) from infrastructure failures (cancel), both live and at restart reconciliation.
  - Covered by the test "classifies a Codex outage as infrastructure and a smoke rejection as a patch failure".
  - The live check is an operator check.
- [x] **Comparison shows original and evolved side by side without altering the live run** — browser test passed.
- [x] **Rollback votes are limited per viewer and need moderator or broadcaster confirmation** — viewer votes alone never roll back. A moderator's `!rollback` is immediate: the judge run sent it with zero votes and got "Rollback confirmed."
- [x] **Carried review Minors have a recorded resolution** — see "Previous findings".
- [ ] **A busy scene keeps unrelated patches active on WebGL, and the operator observation is recorded** — the opt-in headless test passed 3/3 per the report (skipped by default in my run). **Operator observation pending.**
- [ ] **OBS loads the HTTPS overlay and play view with audio once, and a fresh setup plus practice round takes under ten minutes** — **operator checks pending.** For reference, my scripted judge run went from clone to a completed vote stage in about 40 s, so the ten-minute target looks easy for a person.
- [x] **Tests, build and audit pass; docs match the code; no secrets are committed:**
  - `npm test`: vitest **68 passed, 4 skipped**; Playwright **38 passed, 1 skipped** (the opt-in WebGL test); then "HTTPS regression passed: HTTP/2 same-origin, cross-origin denial, Practice and Go Live"; exit 0.
  - `npm run build`: exit 0. `npm audit --audit-level=high`: **0 vulnerabilities**.
  - **Secrets:** **0** occurrences of the real client ID, client secret, reward ID or any of the 4 stored access and refresh tokens, in either the public history (`git log --all -p`) or the tracked files. 0 hits for `oauth:…`, `Bearer …`, `client_secret=…`, `sk-…` and `ghp_…` patterns. `.env` and `.live-patch/` are ignored (`.gitignore:5,8`). The remote has only `refs/heads/master` at `40b7e5b`.
  - **Docs:** two small mismatches remain (P5-R2-01, P5-R2-02).

## Previous findings
- **P5-R1-01** — **Resolved.**
  - The fix: `engine/twitch/server.ts:55` falls back to `:authority`, and still requires a local hostname and an exact host match.
  - `scripts/test-https.mjs` checks an HTTP/2 same-origin POST (200), a cross-origin request (403), and Practice plus Go Live in Chromium. `npm test` now runs it after the browser suite.
  - The judge run confirmed Practice, voting, Go Live pause and resume, and chat commands over `h2`.
- **P5-R1-02** — **Resolved.**
  - `engine/pipeline/commands.ts:62-66`: moderator and broadcaster `!rollback` is immediate again, and `canConfirmRollback` is removed.
  - There's a unit test for zero-vote moderator rollback, and the judge run confirmed it. README lines 47–50 and the Go Live hint agree.
- **P5-R1-03** — **Resolved.**
  - The README now has the public clone URL, the requirements (Windows 10/11, Node 20+, Git), what works without accounts, a two-minute walkthrough, and one command table that matches the code.
  - The remote exists, and `phase-1-report.md` no longer cites `.tmp-renamed-game`.
  - The demo video is honestly marked pending, with an outline in `docs/demo-script.md`; that's the operator's job.
- **P5-R1-04** — **Resolved.** `engine/mutation/host.ts:167` scales the deadline from 200 ms up to 575 ms for 16 events. Test: "a slow but bounded event batch stays active during a busy moment". `architecture.md:9` is updated.
- **P5-R1-05** — **Resolved.** `games/arena-survivor/src/main.ts:74` archives only coins for restore. Test: "rollback does not resurrect hostile enemies on the player". The rule is documented at `README.md:50`.
- **P5-R1-06** — **Resolved.**
  - `fulfillRedemption` in `engine/twitch/rewards.ts` checks reward ownership and reports `fulfilled` only when Twitch confirms.
  - It's called after the idea is stored (`commands.ts`, `onAcceptedReward`), and failures can be retried from Go Live.
  - Unit tests cover the order, ownership and failure.
- **P5-R1-07** — **Resolved.** `RunRecord.failureKind` is set in `engine/runner/runner.ts`. Only gate or smoke failures count as `patch`, and anything else cancels the prediction, both live and at restart (`server.ts`).
- **P2-R1-09** (OBS certificate) — still pending the operator.
- **P45-R3-04** — still partly verified; the visible check is pending the operator.
- **Phase 4 deferral "re-run signed-in triage against the preview/apply flow"** — **still not recorded** in the report's manual list. Add it to the operator checks below; no code change needed.

## Findings

### Blockers
None.

### Majors
None.

### Minors
- **P5-R2-01** · `games/arena-survivor/docs/mutation-api.md` (the `apiDocs` that live Codex reads) — The doc never tells a mutation author how much time a hook gets.
  - The host disables a module whose events take longer than 200 ms, or up to 575 ms for a batch (`engine/mutation/host.ts:167`). That's the most likely way a Codex-written patch fails on stream after passing the smoke test.
  - Suggested fix: add one sentence near the batching paragraph (line 44): hooks must return quickly; the budget is about 200 ms per event message, scaled for batches; long loops disable the module.
  - Also, the root `docs/mutation-api.md` is only a "Mutation sound and effects" addendum. Point it to the game's full API doc in its first line, so nobody takes it for the whole contract.
- **P5-R2-02** · `docs/architecture.md:9` — It says the host applies "at most 20 actions per hook". Since batching, the cap is 20 per event **batch**: `engine/mutation/frame.ts:25` caps the reply, and `host.ts:143-144` slices it. Up to 16 hooks share those 20. The game API doc (line 44) already says "per batch". Suggested fix: change the architecture sentence to match.

### Nits
- **P5-R2-03** · `engine/pipeline/commands.ts:62-66` — `!rollback` replies "Rollback confirmed." even when nothing has shipped. In the judge run, `/api/runs` was empty and chat still got "@judgemod Rollback confirmed." On stream, that can make a moderator think a patch was removed. Consider replying "Nothing to roll back" when no patch has shipped.

## Working well — do not change
- The HTTPS/HTTP2 regression lives inside `npm test`, so the protocol gap that hid the round-1 Blocker can't come back unseen.
- A fresh public clone works from the README alone in under a minute of machine time, with setup output that is honest about the sandbox and Twitch.
- The predictions model separates patch failures from infrastructure failures, both live and at restart.
- Fulfilment and refunds report success only when Twitch confirms it, and say why when they can't.
- Moderator emergency rollback stays immediate, with viewer votes as an advisory signal.
- The public history is clean of secrets.

## Operator checks before closing Phase 5
These can't be done by Codex or by me. Each needs your channel, OBS or a person:
1. In Setup, **reconnect the broadcaster** to grant `channel:manage:redemptions` and `channel:manage:predictions`.
2. Select the **app-owned "Live Patch Pitch" reward**. The current "Pitch a mechanic." reward was made in the dashboard, so the app can't fulfil it or refund points for it.
3. **Live, from a second account:**
   - redeem the reward, check that the idea arrives and the redemption shows as fulfilled;
   - redeem one that gets rejected, and check the points come back.
4. **Live prediction:** open one before approving, then check it resolves on ship or fail, or cancels if the build fails for setup reasons.
5. **OBS:** add the overlay and play view as HTTPS browser sources, trust the certificate, and confirm the game audio is heard once.
6. **Visible busy scene:** run the WebGL crowd check from the README on the streaming PC.
7. **Timed first run:** do setup plus a practice round in under 10 minutes and note the time.
8. **Signed-in triage:** re-run AI triage on the preview and apply flow (Phase 4 carry-over).
9. **Paperwork:**
   - accept `docs/phases/phase-5.md` as the contract;
   - record and link the demo video;
   - set the tags.

Housekeeping, not findings:
- **Reviews in the public repo:** only `reviews/phase-1-round-*.md` are committed; the later rounds are untracked. Commit all of them or none, so the repository tells one consistent story.
- **Commit author:** all 25 public commits are authored as "Mousmi". Confirm that's the identity you want on the submission.
- **Tags:** `phase-2-done` and `phase-4.5-done` aren't set, and no tags are pushed (the remote has only `master`).
- **Leftover temporary folders:** Codex's test checkouts are still in `%TEMP%`: `live-patch-judge-check-95b8914`, `live-patch-phase5-clone-657d281c` and `live-patch-phase5-clone-data-657d281c`.
