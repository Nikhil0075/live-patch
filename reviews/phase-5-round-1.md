# Phase 5 — Review round 1

## Verdict
Fail

The code work is broad and mostly solid:
- the Phase 1–4.5 carry-overs are closed with tests;
- refunds and predictions are honest about what Twitch allows;
- no secret appears anywhere in the git history;
- `npm test` passed twice in a row (64 unit, 36 browser).

But the judge's fresh-clone run found a **Blocker**: in the real `npm run dev` server (HTTPS), **every button that sends a request is refused (403)**. That covers Practice, Go Live controls, Settings, Setup actions and Library actions. The automated suite runs on plain HTTP and never sees it. There are also two Majors:
- moderators can no longer roll back a bad patch from chat without three viewer votes;
- the README is not ready for judges, and contradicts itself and the code.

How I verified:
- I reviewed `e4764e8..9cca41a`.
- I ran `npm test` twice (both passed), plus the build and audit.
- I scanned the full git history for the real Twitch client ID, secret and reward ID and all four stored tokens, printing counts only, plus common secret patterns.
- **Judge run:** I cloned the repository into a fresh temporary folder, followed only the README (`npm run setup`, `npm run dev`, open the studio, try Practice), drove it with headless Chromium, and confirmed the failure at the protocol level with HTTP/1.1 and HTTP/2 requests. Screenshots are in `D:\twitchconXcodex\plans\phase-5-judge\`; the clone has been deleted.
- I did not do the live Twitch prediction or refund, OBS, or the visible busy-scene check. Those are operator checks.

Process notes:
1. `docs/phases/phase-5.md` was written by Codex in the same commit as the code. Its scope matches what earlier reviews deferred to Phase 5, but the operator should accept it as the contract.
2. The repository has **no Git remote**, so a judge can't clone it yet, and the README has no clone URL.
3. Tags `phase-2-done` and `phase-4.5-done` are not set (only phase-1, 3 and 4 are).
4. Codex's temporary clone is still at `C:\Users\ROG\AppData\Local\Temp\live-patch-phase5-clone-657d281c`, along with `…-clone-data-657d281c`. The operator can delete both.

## Exit criteria
- [x] A fresh clone runs `npm run setup`, passes the documented checks and starts the studio without editing source files.
  - Judge run: setup took 13 s and printed Ready for Node 22.17.1, Git, dependencies, Chromium and Codex sign-in. "Elevated sandbox" correctly says Needs action, and Twitch is listed as optional.
  - `npm run dev` served Home, `/api/game`, `/overlay.html` and `/?view=setup`, all with HTTP 200, and the first visit landed on the Setup wizard.
  - The studio's interactive controls don't work in this mode: see P5-R1-01.
- [ ] Practice fills a three-idea ballot and casts votes without cooldown conflicts or manual edits — **fails in the real dev server.** The judge run clicked **Generate sample pitch** and **Send** three times: each reply was "Local JSON request required", and the idea list stayed empty (`plans/phase-5-judge/judge-practice.png`). The browser test passes only on the HTTP test server. The new buttons themselves ("Vote 1/2/3 as new viewer", rotating practice viewers) are present.
- [x] Disabled, paused and out-of-stock rewards show as unavailable; a live redemption enters the pipeline — `describeReward`/`fetchPitchReward` cover all states, with unit tests. Phase 2 round 3 observed a live redemption on 28 October. A redemption of the new app-owned reward is still an operator check.
- [x] Rejected redemptions refund only when Twitch permits; failures are visible and tested — `refundRedemption` checks `only_manageable_rewards`, then cancels with `PATCH status=CANCELED`, and reports `refunded` only when Twitch confirms. Unsupported ownership, unfulfilled and API failures each have their own message; tested. The live refund is an operator check.
- [x] Predictions settle or refund correctly across ship, fail, cancel and restart, with no duplicate settlement — `PatchPredictions` serialises operations, persists state and reconciles at startup; `predictions.test.ts` passes. The live settlement is an operator check. See P5-R1-07.
- [x] The comparison shows original and evolved side by side without altering the live run — `compare.html` uses two isolated `preview.html` frames from a saved bundle, served by read-only GET endpoints, so P5-R1-01 doesn't affect it. The browser test passes.
- [x] Chat rollback votes are limited per viewer and need moderator or broadcaster confirmation — `RollbackVotes`: one vote per viewer per two-minute ballot on the latest shipped run, threshold 3, persisted. But see P5-R1-02.
- [x] Carried review Minors have a recorded resolution — see "Previous findings". Two small gaps are noted there.
- [ ] A busy scene keeps unrelated patches active on the normal WebGL path, and the operator observation is recorded — the report says the opt-in test passed 3/3 headless; I couldn't open a visible browser from here. The operator observation is pending.
- [ ] OBS loads the HTTPS overlay and play view with audio once, and a fresh setup plus practice round takes under ten minutes — operator checks pending, and the timed practice can't succeed until P5-R1-01 is fixed.
- [ ] Tests, build and audit pass; docs match the code; no secrets are committed — tests, build, audit and secrets ✔:
  - `npm test` twice: vitest 64 passed and 4 skipped, Playwright 36/36 each time;
  - `npm audit --audit-level=high` found 0 vulnerabilities;
  - **0** occurrences of the real client ID, client secret, reward ID or any of the 4 stored access and refresh tokens in `git log --all -p`, and 0 hits for `oauth:…`, `Bearer …` and `client_secret=…` patterns. The only tracked env file is `.env.example`.

  **The docs don't match the code** (P5-R1-02, P5-R1-03).

## Previous findings (carried into Phase 5)
- P1-R3-01 — Resolved. Scope-aware identifier lookup in `validate.ts` closes the declared-name bypass, with a test.
- P1-R3-02 — Resolved. Invalid actions are counted in a rolling 60 s window (`WindowCounter`).
- P1-R3-03 — Resolved. Ordered batches of up to 16 events, and skip counters over a rolling 10 s window. See P5-R1-04.
- Phase 1 note about stale rename evidence — **not resolved.** `docs/phases/phase-1-report.md:29` still cites `.tmp-renamed-game`. Minor, folded into P5-R1-03.
- P2-R1-05 (refunds and ownership) — Resolved in code: an app-owned "Live Patch Pitch" reward and explicit refund states. The live check is pending.
- P2-R1-09 (OBS certificate) — Still pending the operator.
- P2-R3-01 — Resolved. Setup and Go Live show the reward's real state, and the README says a second account must redeem.
- P3-R1-07 — Resolved. Rollback reverses entity edits, removals and score in the current run. See P5-R1-05.
- P3-R1-09 — Resolved. Live-build Git and MCP calls are asynchronous with timeouts.
- P3-R1-10 — Resolved (`repairReason`).
- P4 deferral "rerun signed-in triage on the preview/apply flow" — not recorded in the report. It's an operator or opt-in check, so add it to the manual list.
- P45-R3-03 — Resolved in code: rotating practice viewers and "Vote N as new viewer". It is broken in the real dev server by P5-R1-01.
- P45-R3-04 — Partly verified: the opt-in WebGL crowd test exists, the player's GPU post-processing was removed, and the visible check is pending.

## Findings

### Blockers
- **P5-R1-01** · `engine/twitch/server.ts:50-58` (`localOrigin`), used by 9 POST routes — **Every browser POST is refused in the real HTTPS dev server.**
  - With HTTPS, Vite serves browsers over **HTTP/2**. HTTP/2 requests carry `:authority`, not a `Host` header, so `req.headers.host` is `undefined`, and `url.host === host` fails for every same-origin request.
  - Evidence from the fresh clone at `9cca41a`:
    - a same-origin POST over HTTP/1.1 returned **200** for both the simulator and control routes;
    - the same requests over **HTTP/2** returned **403** "Local JSON request required" and "Same-origin JSON request required";
    - in headless Chromium, every Practice **Send** got 403, and no idea was stored.
  - Affected: Practice; Go Live (pause, resume, advance, approve, reject, rollback, save, triage, prediction, cancel build); Settings; Setup (save credentials, run setup, self-test, refresh); Library (import, template, make active); refund retry; creating the managed reward.
  - All 36 browser tests run on the HTTP/1.1 test server, which is why the suite passes.
  - In practice, the README's first-run path and the timed check can't succeed in the real `npm run dev`.

  **Smallest fix:**
  - In `localOrigin`, compare the Origin's host with `req.headers.host ?? req.headers[':authority']`, still rejecting cross-origin and non-local hosts.
  - Add one browser test that runs against the HTTPS/HTTP2 server and drives a Practice pitch and a Go Live action.
  - Re-run the judge path.

### Majors
- **P5-R1-02** · `engine/pipeline/commands.ts:61-63`, `engine/twitch/server.ts` (`canConfirmRollback`), `README.md:40,46,54,68`, `docs/architecture.md:15` — **Moderators and the broadcaster lost the emergency rollback from chat.**
  - A Twitch-origin `!rollback` now runs only if three viewers have voted with `!rollbackvote` in the last two minutes; otherwise it replies "The viewer rollback vote has not reached its threshold". This applies even to the broadcaster.
  - Only the local **Roll back latest** button stays immediate, and it is itself broken in the real dev server by P5-R1-01.
  - The spec asked for viewer votes **plus** moderator approval, not for removing the direct moderator rollback that Phases 2 and 3 built and tested.
  - The README contradicts itself. Line 40 describes the vote-gated flow, but lines 46, 54 and 68 and `architecture.md:15` still describe `!rollback` as an immediate moderator command.

  Suggested fix: keep `!rollback` immediate for moderators and the broadcaster, as before. Let a met viewer threshold surface a "confirm rollback" prompt in Go Live and chat, which a moderator confirms with `!rollback`. Update every rollback passage in the README and architecture doc to match, and add a test that a moderator can roll back with zero viewer votes.
- **P5-R1-03** · `README.md` — **The README isn't ready for a hackathon judge.** Following only the README, a judge meets:
  - **No way to get the code:** no clone URL, and the repository has no remote yet.
  - **A development log, not a guide:** "Phase 2 adds…", "Phase 5 stream controls", "Phase 3 builds approved ideas", "Research used for Phase 1".
  - **Stale and conflicting paths:**
    - "Open …/simulator.html" (now Practice);
    - "open the simulator page. Click **Connect broadcaster**" (the connection now lives in Setup);
    - "The **Home** page plays the active game";
    - the rollback contradictions in P5-R1-02.
  - **No statement of what a judge can do without accounts:** Practice and the game work offline, but building patches needs a Codex/ChatGPT sign-in and the **Windows** elevated sandbox, and the platform requirement is never stated.
  - **No demo video link**, and no short "what you'll see in 2 minutes" section.
  - `docs/phases/phase-1-report.md:29` still cites `.tmp-renamed-game`.

  Suggested fix: rewrite the README for a first-time reader:
  - a one-paragraph pitch and a demo link;
  - **Requirements:** Windows 10/11 for the Codex sandbox; Node 20+; Git; optionally Codex sign-in and a Twitch app;
  - **Quick start:** clone URL, `npm run setup`, `npm run dev`, first-visit Setup, then Practice;
  - "What works without Twitch or Codex";
  - one consistent command reference (`!idea`, `!vote`, `!approve`, `!reject`, `!rollback`, `!rollbackvote`);
  - move the phase history to `docs/`.

  Push the repository and put the clone URL in the README.

### Minors
- **P5-R1-04** · `engine/mutation/host.ts` (event batches), `engine/mutation/frame.ts` — Up to 16 queued events now go to a module in one message under a single 200 ms deadline, and the hooks run one after another. A module whose hook costs about 15 ms is fine one event at a time, but is disabled at 16 × 15 ms = 240 ms in a busy moment. That works against the fault-isolation goal the batches were meant to serve. Suggested fix: scale the deadline with the batch size (with a cap), or shrink the batch when the previous one ran close to the limit.
- **P5-R1-05** · `games/arena-survivor/src/main.ts` (`removeMutation` restore) — Rolling back a patch that removed enemies brings back up to 96 of them at their old positions, all at once. That can drop a crowd onto the player the moment a moderator rolls back, which is the opposite of what a rollback should feel like on stream. Suggested fix: don't restore hostile entities, or restore them gradually away from the player, and document the rule.
- **P5-R1-06** · `engine/twitch/server.ts`, `engine/twitch/rewards.ts` — Accepted reward redemptions are never marked `FULFILLED`; the codebase never uses that value. They stay `UNFULFILLED` in the broadcaster's reward request queue for good. Suggested fix: mark a redemption `FULFILLED` once its idea is stored (only for the app-owned reward), and keep `CANCELED` for refunds.
- **P5-R1-07** · `engine/twitch/server.ts` (prediction settlement on `failed`) — Every failed build resolves the prediction as **Fails**, including failures that aren't the patch's fault:
  - the sandbox isn't set up;
  - Codex usage is exhausted;
  - the three-minute timeout runs out.

  Viewers who bet "Fails" then win because of a setup problem. Suggested fix: cancel the prediction (refunding everyone) when the failure is infrastructure (sandbox, quota, timeout, server stop), and resolve as Fails only when the patch itself failed the gates or the smoke test.

### Nits
None.

## Working well — do not change
- `npm run setup` on a fresh clone: fast, prints no secrets, and is honest that the sandbox and Twitch need explicit steps.
- Refund handling never claims points came back unless Twitch confirms the cancellation, and says plainly when a dashboard-made reward can't be refunded.
- Predictions: serialised, persisted, reconciled at startup, and cancelled on rejection, force-next and server restart.
- One-viewer-one-vote rollback ballots tied to the specific shipped run.
- The comparison view reuses the isolated preview with read-only endpoints.
- Closing the Phase 1 sandbox Minors (scope-aware gate, rolling counters) with tests.
- A clean secret history across all commits.

## Judge run log (fresh clone, README only)
| Step | Result |
|---|---|
| `git clone` | Works locally; **no remote/clone URL** for a real judge |
| `npm run setup` | ✔ 13 s; Node, Git, deps, Chromium and Codex Ready; sandbox Needs action; Twitch optional |
| `npm run dev`, open https://localhost:5173 | ✔ serves; first visit opens the Setup wizard (`judge-first-visit.png`) |
| Practice: Generate sample pitch → Send (×3) | ✘ "Local JSON request required"; no ideas stored (`judge-practice.png`) — P5-R1-01 |
| Go Live / Settings / Setup / Library actions | ✘ same 403 over HTTP/2 (protocol probe) — P5-R1-01 |
| README guidance | ✘ unclear or contradictory in several places — P5-R1-03 |
