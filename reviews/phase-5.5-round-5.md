# Phase 5.5 — Review round 5

An extra round, asked for by the operator: a re-check of Codex's fixes for round 4 (`plans/phase-5.5/codex-round-4-fixes-prompt.md`). The three-round cap applied to the original Phase 5.5 work.

## Verdict
Pass with minors

Both round-4 Majors are fixed, and I checked each one myself:
- chat now gets a true line for cancels, timeouts, setup failures and Codex outages (P55-R4-01);
- `npm test` stays green after Practice ships a demo patch (P55-R4-14).

The operator's three UI requests and the Go Live preflight notice work in the browser. Six Minors and two Nits remain:
- the operator's saved overlay layout still has two widgets overlapping (now the ballot and the ticker);
- the themed scrollbars stop at Go Live's panels;
- the Active patches list has shrunk to one visible row;
- the `.env` timeout setting is ignored;
- `npm test` needs Git, and saves an empty build into the real `builds/` folder on every run.

How I verified, at `0a5a429` (`8163287..0a5a429`, one commit, local only):
- `0a5a429` differs from the `6127f4e` that Codex's report names only by two report lines (`git diff --stat 6127f4e 0a5a429`), so Codex's evidence applies to this code.
- I cloned the local repository into a scratch folder (no `.env`, no tokens) and ran `npm ci`, `npm test`, `npm run build` and `npm audit --audit-level=high` there.
- I ran a headless Chromium walkthrough against the clone's real `npm run dev` (HTTPS, port 5199):
  - three window sizes (1920×1080, 1536×864, 1366×768);
  - the operator's saved overlay layout from the first stream;
  - Practice only, with no Codex build.
- In a second run, the studio's `PLAYWRIGHT_BROWSERS_PATH` pointed at an empty folder, so the browser preflight failed for real.
- I added one probe test to the clone only (not the repository): it drives real `LiveRunner` failures through `handleRunnerOutcome`.
- My screenshots are in `D:\twitchconXcodex\plans\phase-5.5\review-r1\r5\`.

## Exit criteria
- [x] **Clean clone: tests, build and audit.**
  - `npm test`: vitest **88 passed, 4 skipped**; Playwright **62 passed, 1 skipped** (opt-in WebGL); "HTTPS regression passed…"; exit 0.
  - `npm run build`: exit 0. `npm audit --audit-level=high`: **0 vulnerabilities**.
- [x] **The same tests after Practice ships a demo patch.**
  - Codex reports a full second run with the demo file present.
  - I shipped a demo through the clone's Practice UI (`demo-e8b67caf.js` in `mutations/`), then reran the two exact-count tests that failed for the operator: "Go Live can remove Practice demo patches…" and "one crowded Space attack keeps unrelated patches active". **2 passed.** On 31 October, before this fix, the second one failed "Expected: 3, Received: 4".
- [x] **The report has "Round 4 responses" for P55-R4-01 to P55-R4-14** (`docs/phases/phase-5.5-report.md:122-139`). R4-10 is deferred, with a reason.
- [x] **No Blockers or Majors open.** See below.

## Previous findings
- **P55-R4-01** — **Resolved.** Runs now record a `stopReason`, and `handleRunnerOutcome` picks the notice from it. My probe through the real runner:
  - Cancel build → "Patch build was cancelled. No patch shipped." (idea `failed`).
  - Missing test browser → the setup notice, and the idea is back at `shortlisted`.
  - "Codex quota exhausted" and "Not logged in" → "Codex is unavailable. The idea is still available…" (`shortlisted`).
  - Codex's tests also run cancel and timeout through the runner and the outcome handler (`tests/phase3.test.ts:233-257`).
  - Wording edge cases: P55-R5-07.
- **P55-R4-02** — **Not resolved** for the operator's real layout. The patch card is now clear, but the ballot moved onto the ticker. See P55-R5-01.
- **P55-R4-03** — **Resolved.** The popup test asserts `locationbar.visible === false` (`smoke.spec.ts:252`), and the README's OBS paragraph mentions the popup strip and F or a crop.
- **P55-R4-04** — **Resolved.** The test now rejects at approval, after keeping "More actions" open through a 2.2 s refresh (`smoke.spec.ts:342-351`).
- **P55-R4-05** — **Resolved.** With the browser path broken, `/api/setup` reported `browser: Needs action`, and Go Live showed "Test browser needs attention: Couldn't start the test browser on this PC. Open Setup to repair it before approving a patch." (`r5-go-live-browser-notice.png`). It reads the existing 30-second setup cache, which the app shell already polls, so it adds no extra browser launches.
- **P55-R4-06** — **Resolved.** `docs/architecture.md:9` now says 1.8–2.2 seconds.
- **P55-R4-07** — **Resolved.**
  - The timer starts after the probe (`runner.ts:268`).
  - The default budget is 4 minutes.
  - The report records the timed-out verification run (`phase-5.5-report.md:120`).
  - The new override works only from the shell, not from `.env`: P55-R5-04.
- **P55-R4-08** — **Resolved.** The duplicate rule is gone.
- **P55-R4-09** — **Partly resolved.** The duplicate menu Reject is gone, but the notice now shows the idea's internal ID: P55-R5-08.
- **P55-R4-10** — **Accepted as deferred** (timeline edge cases; no exit criterion depends on them).
- **P55-R4-11** — **Resolved.**
  - Every tile has a 30 px icon column and a left-aligned label on one line, in two columns.
  - No tile overflows at 1920×1080, 1536×864 or 1366×768, and Quick actions doesn't scroll (`r5-quick-actions-*.png`).
  - A geometry test covers it.
- **P55-R4-12** — **Partly resolved.**
  - Inside Go Live, the panels have thin dark-violet scrollbars (computed `scrollbar-color: rgb(107, 60, 161) rgb(36, 33, 45)`).
  - Quick actions doesn't scroll, and Remove demo patches sits inside its panel.
  - Two gaps: the other pages still use default scrollbars (P55-R5-02), and the Active patches list paid for the button (P55-R5-03).
- **P55-R4-13** — **Resolved.**
  - Setup's Twitch card shows the 2FA, Confidential and New Secret how-to.
  - Both links open in a new tab with `rel="noopener noreferrer"`.
  - "Copy redirect URI" has a manual fallback message.
  - The README carries the same links (`r5-setup-twitch-card.png`).
- **P55-R4-14** — **Resolved.**
  - `scripts/copy-test-game.mjs` copies only Git-tracked built-in patches for a game inside the repository.
  - `tests/copy-test-game.test.mjs` leaves a shipped demo in the source and checks the copy doesn't have it.
  - My demo-present rerun passed.
  - The new copy step needs Git: P55-R5-05.

**Operator-requested change (Recent chat), checked as well:**
- Viewer commands now appear in Go Live's Recent chat with a command chip. `<b>…</b>` stays plain text.
- A 300-character line wraps without widening the panel.
- `!rollbackvote` is now kept out of game chat as well (`events.ts:9`).
- The bot's own messages are dropped before the list (`server.ts:154-160`).
- The live Twitch path isn't tested, because no stream was running. See the operator notes.

## Findings

### Blockers
None.

### Majors
None.

### Minors
- **P55-R5-01** · `engine/studio/overlay-placement.ts:29-42`, `tests/phase55.test.ts:107-119` — The operator's saved layout still loads with two widgets overlapping.
  - Their four widgets (patch card, Codex card, ballot, ticker) normalise to: the ballot at x 391, y 380, 501×700, and the ticker at x 560, y 998, 1336×58. The ballot's lower edge sits under the ticker (`r5-overlay-operator-layout.png`). In the vote stage, the third ballot row ends at about y 1013, inside the ticker.
  - `placeWidget` returns the widget unchanged when no free slot exists (line 42). A 1336 px ticker can't fit beside a 700 px-tall ballot, so it stays on top of it.
  - The new unit test places only the patch card and the ballot.
  - Fix:
    - when no free slot exists, change the later widget (shrink the ticker to the free width, or move the ballot back up), or flag the overlap in the overlay editor;
    - test with the operator's full four-widget layout.
- **P55-R5-02** · `engine/overlay/dashboard.css:63-66` — The themed scrollbars apply only to `#control .dashboard-panels *`.
  - At 1536×864, the page itself scrolls on Home, Practice, Setup and Library, and the root and the welcome dialog report `scrollbar-color: auto` (the browser default).
  - The operator asked for every scrollbar to match.
  - Fix: set the same thin dark-violet colours at the app-shell level (the root, the content area and dialogs), so every view gets them.
- **P55-R5-03** · `engine/overlay/dashboard.css:68-71` — The Active patches list is now a 66 px window at 1920×1080.
  - With four patches active it shows one card (`scrollHeight 300`, `clientHeight 66`), and Saved builds is cut at 42 of 72 px (`r5-active-patches-1920x1080.png`).
  - The panel now has to hold the list, Saved builds and the Remove button in 275 px.
  - Fix:
    - give Active patches more height (it can use the space Quick actions no longer needs), or show Saved builds as one line that links to Library;
    - extend the geometry test so at least three patch cards are visible.
- **P55-R5-04** · `engine/runner/runner.ts:15-17`, `engine/twitch/server.ts:65`, `.env.example:9-10` — `LIVE_PATCH_RUN_TIMEOUT_MS` in `.env` has no effect.
  - `RUN_TIMEOUT_MS` is computed when `runner.ts` is first imported. `server.ts` imports it at line 15, but loads `.env` later, at line 65 inside `configureTwitchServer`.
  - My probe set the variable after import, as `loadLocalEnv` does, and got `env=600000 runner.runTimeoutMs=240000`.
  - Only a shell variable works, yet `.env.example` now offers the setting there.
  - Fix:
    - read the variable when the `LiveRunner` is constructed, or in `configureTwitchServer` after `loadLocalEnv`, and pass it in;
    - add a test that loads a `.env` with the setting and checks the runner's budget.
- **P55-R5-05** · `scripts/copy-test-game.mjs:13` — `npm test` now needs a Git checkout.
  - In a folder without `.git`, such as a GitHub "Download ZIP", `git ls-files` throws "not a git repository", and the test script stops before any test runs. I checked this in a scratch folder.
  - The README says `git clone`, so this is off the main path.
  - Fix:
    - when Git can't list files, fall back to leaving out the studio's own output names (`demo-*.js` and `patch-*.js`, which `.gitignore` already treats as generated);
    - test that path.
- **P55-R5-06** · `games/arena-survivor/tests/smoke/smoke.spec.ts:993`, `engine/twitch/server.ts:419` — Every `npm test` saves an empty build into the real repository's `builds/` folder. This dates from Phase 4 (`f0d2ebf`), not this round.
  - The test server isolates the game and the data folder, but `saveBuild(root, …)` writes to `root/builds`. After my clean run, the clone had a new `builds/2026-10-31T15-04-34-125Z-b73be233` (0 patches).
  - The operator's checkout holds 35 saved builds. The sample I opened has `"patches": []`, and the newest three are from Codex's verification runs today.
  - They appear in Library and in Go Live's Saved builds, so a judge who runs `npm test` gets a mystery build.
  - Fix:
    - point the test server's builds folder into the test's temporary folder, as is done for the data folder;
    - check that `builds/` is unchanged after `npm test`.

### Nits
- **P55-R5-07** · `engine/twitch/runner-outcome.ts:17`, `engine/runner/runner.ts:338` — Two wording edge cases in the generic notice:
  - It ends "check the local run record", which goes to Twitch chat, where viewers can't act on it.
  - Codex's own usage-limit message ("You've hit your usage limit…") and a dropped stream fall into it, although the idea goes back to the pool.
  - Suggestion: add "usage limit" and "rate limit" to the Codex pattern, and word the generic line for viewers.
- **P55-R5-08** · `engine/overlay/control.ts:76` — After a Go Live reject, the notice reads "rejected idea" plus a 36-character internal ID. Name the idea by its author and opening words instead.

## Working well — do not change
- **Stop reasons:** they're recorded apart from `failureKind`, so the notice, the prediction and the idea's status stay consistent. Runner-plus-outcome tests cover cancel and timeout.
- **Test isolation:** the test copy uses the game's tracked built-ins. Smoke runs and games outside the repository keep their active files. A unit test proves a shipped demo is left out.
- **Quick actions:** the grid has one icon column and one-line labels, and fits at three window sizes.
- **Recent chat:** it shows text only (no HTML), keeps the command chip, drops the bot, keeps the scroll position, and filters `!rollbackvote` from the game.
- **Go Live preflight notice:** it reuses the cached setup check instead of launching another browser.
- **Twitch app card:** new-tab links with `noopener noreferrer`, and a copy button with a manual fallback.
- **Run budget:** the timer starts after the browser probe, and the default is four minutes.

## Notes for the operator
- **Tag:** with no Blockers or Majors open, `phase-5.5-done` can go on `0a5a429` whenever you decide. Fixing the Minors first is optional. P55-R5-02 and P55-R5-03 change how Go Live looks, so if you want them in the demo video, have them fixed before you record.
- **Before your next stream:** use **Go Live → OBS overlay layout → Reset layout**, so the ballot doesn't overlap the ticker (P55-R5-01).
- **On your next stream:** check that a viewer's `!idea` shows in Go Live's Recent chat and the bot's replies don't. Codex could only test this with the simulator.
- **Leftover folders**, all disposable. Delete them when convenient:
  - `C:\Users\ROG\AppData\Local\Temp\live-patch-r4-6127f4e` (Codex's round-4 clone; its deletion was blocked);
  - `C:\Users\ROG\AppData\Local\Temp\live-patch-ls-fb63555c` and `D:\twitchconXcodex\app_submission\.live-patch-test-live-builds-d65cd80a` (from round 4);
  - `D:\lp-timed-run` (your Phase 5 timed-run copy).
- **`builds/`:** most of your 35 saved builds are probably empty test builds (P55-R5-06). Check before deleting any; a build you saved on purpose lists its patches in `build.json`.
- **Cleanup:** I stopped my scratch studio and delete my scratch clone after this review. Nothing is pushed or tagged by me.
