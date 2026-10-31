# Phase 5.5 — Review round 6

An extra round, asked for by the operator: a re-check of Codex's fixes for round 5 (`plans/phase-5.5/codex-round-5-fixes-prompt.md`).

## Verdict
Fail

All eight round-5 findings are fixed, and I checked each one myself. The phase fails on one Major, which a single sentence fixes:
- Codex raised the mutation load deadline from 1.5 to 3 seconds.
- Arena Survivor's mutation API doc still says 1.5 seconds. That doc is the contract live Codex reads in every build (P55-R6-01).

One Minor and two Nits remain.

How I verified, at `36e906d` (`0a5a429..36e906d`, two commits, local only):
- `36e906d` changes only two report lines after `9dc6301`, so Codex's evidence applies to this code.
- I cloned the local repository into a scratch folder (no `.env`, no tokens) and ran `npm ci`, `npm test`, `npm run build` and `npm audit --audit-level=high` there.
- I added a `.env` probe test to the clone only (not the repository). It drives the real `loadLocalEnv` and `LiveRunner`.
- I made a no-Git copy of the clone with `git archive`, the same content as a GitHub "Download ZIP", and put a shipped demo file in its `mutations/`.
- I ran a headless Chromium walkthrough against the clone's real `npm run dev` (HTTPS, port 5199):
  - the operator's saved overlay layout from the first stream;
  - all seven studio views and the welcome dialog at 1366×600;
  - Active patches at 1920×1080 and 1366×768, with 3 to 6 active patches;
  - a Go Live reject.

  Practice only, with no Codex build.
- My screenshots are in `D:\twitchconXcodex\plans\phase-5.5\review-r1\r6\`.

## Exit criteria
- [x] **Clean clone: tests, build and audit.**
  - `npm test`: vitest **91 passed, 4 skipped**; Playwright **63 passed, 1 skipped** (opt-in WebGL); "HTTPS regression passed…"; exit 0.
  - `npm run build`: exit 0. `npm audit --audit-level=high`: **0 vulnerabilities**.
- [x] **`builds/` unchanged after `npm test`.**
  - In the clone, no `builds/` folder existed before or after the run.
  - `scripts/test.mjs:27,68-69` now fails the run if the repository's `builds/` names change.
  - The operator's checkout still has the same 35 builds after Codex's runs.
- [x] **The report has "Round 5 responses" for P55-R5-01 to P55-R5-08** (`docs/phases/phase-5.5-report.md:145-162`).
- [ ] **No Blockers or Majors open.** P55-R6-01 is a Major.

## Previous findings
- **P55-R5-01** — **Resolved.**
  - With the operator's real saved layout from the first stream, the studio now places:
    - the patch card at x 0, y 165 (moved below the HUD zone);
    - the ballot at x 391, y 380, 501×700;
    - the ticker shrunk to 1028 px at x 892.
  - No two widgets overlap, and none covers a keep-clear zone. In the vote stage, the ballot's third row ends above the ticker's left edge (`r6-overlay-operator-layout.png`).
  - With four stacked full-screen widgets that can't be resolved, the layout editor says "Layout overlap: … Move or resize a widget before streaming."
- **P55-R5-02** — **Resolved.**
  - The page root, the content area and every inner scroller report `scrollbar-color: rgb(107, 60, 161) rgb(36, 33, 45)` on Home, Practice, Go Live, Library, Builds, Setup and Settings at 1366×600.
  - The welcome dialog is thin and violet too (`r6-welcome-1366x600.png`, `r6-library-1366x600.png`).
  - Codex's test also scrolls Library with PageDown.
- **P55-R5-03** — **Resolved.**
  - At 1920×1080, three patch cards are fully visible with four, five or six active patches, and the list scrolls for the rest.
  - "Saved builds (N) →" is one unclipped line that opens Builds.
  - Remove demo patches sits inside the panel and works ("Removed 1 Practice demo patch").
  - At 1366×768, all cards show and the page scrolls.
  - Quick actions doesn't scroll (`r6-patches-demo-4-1920.png`, `r6-patches-demo-6-1920.png`, `r6-patches-6-1366.png`).
- **P55-R5-04** — **Resolved.**
  - The budget is now read when the `LiveRunner` is constructed (`runner.ts:15-19,139`). The server constructs it after `loadLocalEnv` (`server.ts:58,116`).
  - My probe wrote `LIVE_PATCH_RUN_TIMEOUT_MS` to a `.env`, loaded it, then built a runner:
    - `600000` → 600000;
    - `5000` → 240000 (below the minimum);
    - `99999999` → 1800000 (capped);
    - empty → 240000.
- **P55-R5-05** — **Resolved.**
  - In the no-Git copy, the test script printed "Test game copy: no Git index; excluding generated demo and patch modules".
  - With `demo-abcdef12.js` present in the source, the two exact-count tests passed: "Library patch count…" and "one crowded Space attack…".
  - Before this fix, the script stopped before running any test.
- **P55-R5-06** — **Resolved.** Test servers use `LIVE_PATCH_BUILDS_DIR` inside their temporary folder (`test.mjs:45`, `test-https.mjs:42`). The comparison test checks the saved path. See also the exit criterion above, and P55-R6-04.
- **P55-R5-07** — **Resolved.**
  - "usage limit", "rate limit" and dropped-stream errors now count as Codex unavailable (`runner.ts:341`).
  - The generic line reads "Patch build stopped before shipping. The streamer can try again."
  - A runner-plus-outcome test covers the usage-limit message (`tests/phase3.test.ts:210-220`).
- **P55-R5-08** — **Resolved.** After a Go Live reject, the notice reads: "rejected @R6Viewer: \<b\>Bold\</b\> coins bounce off the arena walls every…". It's plain text, and `#notice` contains no `<b>` element.

**Unrequested change, checked:**
- **The mutation load deadline is now 3 seconds** (`engine/mutation/host.ts:29`). Codex's reason: a false positive late in the browser suite, with three game views open.
  - I accept the change: a module that stalls at load time still runs in its own Worker, so the game keeps drawing.
  - "a top-level loop is stopped at load time" still passes. It now has 2 seconds of margin under its 5-second wait.
  - The game's API doc wasn't updated: see P55-R6-01.
- **The Go Live preflight notice** now refreshes on its own 30-second timer, so the dashboard no longer waits for `/api/setup`. Fine.

## Findings

### Blockers
None.

### Majors
- **P55-R6-01** · `games/arena-survivor/docs/mutation-api.md:17`, `engine/mutation/host.ts:29` — The mutation API doc still says "Each load has a 1.5 second deadline", while the host now allows 3 seconds.
  - `docs/architecture.md:9` was updated; the game's API doc wasn't.
  - The reviewer rules rate a mutation API doc out of sync with the code as Major, because live Codex reads this file in every build prompt (`engine/runner/gates.ts:70-71`).
  - The practical risk is low, since the doc is stricter than the code. But it's the contract, and Phase 6's new game doc will be modelled on it.
  - Fix: change that sentence to 3 seconds, matching `architecture.md`.

### Minors
- **P55-R6-02** · `engine/overlay/dashboard.css:121` (the bottom-row height) — At 1920×1080, the last Codex timeline step, "Shipped", is cut off.
  - Its row ends at y 1043, but the Codex at work panel ends at y 1022. The panel scrolls, so the row can be reached.
  - This was already true in round 5 (`r5-go-live-1920x1080.png`); I missed it then.
  - It's the step the streamer waits for during a build, and it shows in the demo video (`r6-patches-demo-4-1920.png`).
  - Fix:
    - make the timeline rows a little more compact, or give the bottom panel row a few more pixels;
    - extend the 1920×1080 geometry test so all four Codex steps are fully visible.

### Nits
- **P55-R6-03** · `engine/twitch/server.ts:437-439`, `server.ts:150-152` — Go Live's Approve, Reject and Roll back buttons show up in Recent chat as chat lines.
  - They work by ingesting a simulated "Operator" chat command, and since round 4 commands appear in Recent chat. After my reject, Recent chat showed "Operator: !reject 88747633-6daf-48fd-ac85-53790c5be418": the operator's own click, presented as chat, with the internal ID P55-R5-08 removed from the notice.
  - It stays local; nothing is sent to Twitch.
  - Suggestion: leave local-operator control commands out of Recent chat, or show them as "Operator rejected @author: …".
- **P55-R6-04** · `.env.example:11-12` — `LIVE_PATCH_BUILDS_DIR` is documented in the user-facing `.env` template as a test-only setting that `npm test` sets automatically. A streamer reading the template may set it, and its play-only path then depends on a test-only route (`server.ts:216-222`). The test scripts already set it themselves. Suggestion: remove it from `.env.example`.

## Working well — do not change
- **Overlay placement:** a widget is moved first and resized second, never below its minimum, and the editor names every remaining overlap. The unit test uses all four widgets.
- **Scrollbar theme:** set once at the app-shell level, so every view and dialog inherits it.
- **Active patches:** compact cards, a one-line Saved builds link, and Remove demo patches inside the panel, with a geometry test at two window sizes.
- **Run budget:** read when the runner is built, after `.env` loads. It is bounded, and tested through a real `.env`.
- **Test isolation:** the copy works with or without Git and prints its mode. Builds stay in the test folder, and a guard fails the run if `builds/` changes.
- **Notices:** plain-text author and opening words instead of IDs, and viewer-facing chat wording.

## Notes for the operator
- **Tag:** `phase-5.5-done` waits on P55-R6-01, a one-sentence doc change. After Codex commits it, I can confirm it in a few minutes without a full re-run. Fixing P55-R6-02 at the same time helps the demo video. The Nits are optional.
- **Your overlay:** your saved layout now loads without overlaps (patch card below the HUD, ballot in the middle, a shorter ticker on the right). Reset layout is no longer needed, but you can still use it if you prefer the default arrangement.
- **Leftover folders:**
  - You already deleted the four from round 5.
  - Still to delete: Codex's round-5 clone at `C:\Users\ROG\AppData\Local\Temp\live-patch-r5-9dc6301` (Codex couldn't delete it).
  - Five old `.live-patch-test-*` folders in `D:\twitchconXcodex\app_submission` (dated 27–31 October) are leftovers from interrupted test runs, possibly including my own earlier reviews. They're Git-ignored and disposable.
  - So is the empty `games\phase45-switch-probe`.
- **Cleanup:** I stopped my scratch studio and delete my scratch clone and no-Git copy after this review. Nothing is pushed or tagged by me.
