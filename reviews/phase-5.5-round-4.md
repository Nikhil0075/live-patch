# Phase 5.5 — Review round 4

This is an extra round, requested by the operator after round 3 passed. It reviews Codex's fixes for the operator's first live stream (LS-01 to LS-07, `plans/phase-5.5/codex-live-stream-fixes-prompt.md`). The three-round cap applied to the original Phase 5.5 work.

## Verdict
Fail

All seven items are built, and the tests, build and audit pass in a clean clone. Two Majors are open, and both fixes are small:
- after a build is **cancelled or times out**, chat is told the test browser failed and that the idea is still available, and neither is true (P55-R4-01);
- `npm test` fails once the studio has shipped any patch, including the README's own Practice demo (P55-R4-14, found in the operator's Phase 5 WebGL check on 31 October).

How I verified, at `9c10478` (`f78a0f6..9c10478`, one commit, local only):
- I cloned the local repository into a scratch folder (no `.env`, no tokens) and ran `npm ci`, `npm test`, `npm run build` and `npm audit --audit-level=high` there.
- I ran a headless Chromium walkthrough against the clone's real `npm run dev` (HTTPS) at 1920×1080. It used Practice only and never started a Codex build.
- I added one runner probe test to the clone only (not the repository).
- I read the run records in Codex's verification clone, `.live-patch-test-live-builds-d65cd80a/.live-patch/runs.json`. That clone has no tokens or `.env`.
- My screenshots are in `D:\twitchconXcodex\plans\phase-5.5\review-r1\ls\`.

## Exit criteria
- [x] **LS-01a: the timeline ticks only on `passed`, and a failed step is marked.** `engine/overlay/timeline.ts` is shared by Go Live and the overlay; there are unit and browser tests ("failed browser launch is shown as a failed smoke step in studio and OBS").
- [x] **LS-01b: plain failure words.** `publicFailure` now gives "Couldn't start the test browser (setup problem on the streaming PC)" or "Patch failed its smoke test". Full detail stays in the local `diagnostic` field.
- [x] **LS-01c: a setup failure is classified as infrastructure, cancels the prediction, and returns the idea to the pool.** The runner test sees two attempts, `failureKind: 'infrastructure'` and the idea back at `shortlisted`. Chat wording is right for a setup failure, but wrong for cancels and timeouts (P55-R4-01).
- [x] **LS-01d: the browser preflight.**
  - `scripts/probe-browser.mjs` launches Chromium at server start, on every approve (`canApprove`) and at build start.
  - It retries once, and logs the resolved path and the `stat` result.
  - An approval refused this way explains the problem (pipeline test).
  - Gap: there's no standing Go Live notice (P55-R4-05).
  - **The preflight works on the operator's PC.** After this commit, an approval there was refused with "Couldn't start the test browser on this PC. Open Setup, run npx playwright install chromium, then try again." The operator ran that command, and builds now ship. So the browser in the operator's Playwright install really was missing or broken. That is a strong clue to the original error; record it in the report's diagnosis.
- [x] **LS-01e: three real end-to-end builds.**
  - Codex's verification `runs.json` shows `patch-0e9dcac65c90.js` 91 s, `patch-5a68fcf1efe1.js` 93 s and `patch-aaafd6f7c787.js` 166 s, all shipped in a row.
  - The same file shows two earlier runs: a smoke rejection that led to the deadline change, and a **three-minute timeout** that the report leaves out (P55-R4-07).
  - The root cause of the original error is honestly reported as unproven.
- [x] **LS-02: Reject at every stage, and menus survive the refresh.**
  - My run, at approval: each candidate had a visible Reject; "More actions" was still open after 4.5 s; Reject asked "Reject this idea?" and the ballot went from 3 to 2 candidates.
  - Codex's test covers the pitch and vote stages (P55-R4-04).
- [x] **LS-03: one-click reconnect.**
  - `TwitchAuth.reconnectNeeded()` names the account (unit test). The top-right button becomes "Reconnect Twitch" and links to `/api/twitch/auth/<role>/start`, so it only starts on a click (browser test).
  - The chip reads "Twitch chat connected/disconnected". The existing callback calls `eventsub.resetAfterAuthChange()`.
- [x] **LS-04: Play opens as a popup and is reused.**
  - My run: inside Play, `locationbar`, `toolbar` and `menubar` were all `false`; a plain `window.open` gave `true` for all three.
  - A Library click reused the window (no new page).
  - Test and README gaps: P55-R4-03.
- [x] **LS-05: one active demo.** Browser test: two ships leave one demo file and one shipped demo run.
- [x] **LS-06: a narrow ballot stacks.** My run used the operator's saved layout (ballot 501 px wide):
  - three rows with 28 px titles and `!vote N`;
  - footer `scrollWidth 497 ≤ 501`, content ends at 633 of 700 px (`ls06-overlay-operator-layout.png`);
  - the patch card moved from y 2 to y 165, clear of the HUD.
  - New overlap between widgets: P55-R4-02.
- [x] **LS-07: icons and fit.** One line-icon set with a "STUDIO" label. Go Live `scrollHeight 1080` at a 1080 viewport, with the quick-action note visible (`ls02-menu-open-after-refresh.png`). Ballot, activity, Codex and patches panels scroll inside a fixed height. The operator's own window shows two side effects: misaligned Quick actions tiles (P55-R4-11) and unstyled panel scrollbars (P55-R4-12).
- [x] **Tests, build and audit** (in a clean clone; once the studio has shipped a patch, `npm test` fails, see P55-R4-14).
  - `npm test`: vitest **85 passed, 4 skipped**; Playwright **60 passed, 1 skipped** (opt-in WebGL); "HTTPS regression passed…"; exit 0.
  - `npm run build`: exit 0. `npm audit --audit-level=high`: **0 vulnerabilities**.

## Previous findings
- **P55-R2-08** — **Resolved** by LS-07 (icons, Studio label, Go Live fits 1080).
- **P55-R3-01** — **Resolved** by LS-05 (a new demo replaces the earlier one).

## Findings

### Blockers
None.

### Majors
- **P55-R4-01** · `engine/twitch/runner-outcome.ts:12-13`, `engine/runner/runner.ts:328-331` — Chat gets the setup notice after every non-patch failure, including operator cancel (**Cancel build**), a moderator rollback during a build, and the three-minute timeout.
  - The notice reads: "Patch build stopped because the test browser or studio setup failed. The idea is still available; check Setup before approving again."
  - In those cases the runner marks the idea `failed`, so both halves of the message are false.
  - Evidence: my probe test in the scratch clone (start a build, call `cancelBuild()`, pass the failed event to `handleRunnerOutcome`) printed `failureKind=infrastructure ideaStatus=failed notice=Patch build stopped because the test browser or studio setup failed. The idea is still available…`.
  - This is a common path: Codex's own verification had one timeout in five real runs.
  - Codex quota or sign-in failures also get the "test browser" wording, though there the idea really is returned.
  - Fix:
    - record why a run stopped, as a reason separate from `failureKind` (for example: setup, Codex unavailable, timed out, cancelled);
    - send the setup notice only for a setup failure where the idea really went back to the pool;
    - give the other reasons their own short, true line, or none;
    - add runner-plus-outcome tests for cancel and timeout.
- **P55-R4-14** · `scripts/test.mjs:47`, `games/arena-survivor/tests/smoke/smoke.spec.ts:727,736,744`, `README.md:25,65` — `npm test` fails after the studio ships any patch, the README's Practice demo included.
  - `test.mjs` copies the whole game folder, `mutations/` included, into the test's game. That brings in every patch the studio has shipped: Git-ignored `demo-*.js` files and live builds. Three tests then expect exactly 3 patches in Play.
  - Evidence:
    - The operator's WebGL check (31 October, in a fresh clone after Practice → Ship a demo patch) failed with "Expected: 3, Received: 4". The clone still had `demo-82405834.js`, and its run was still `shipped`.
    - I then ran a default test, "one crowded Space attack keeps unrelated patches active", in that clone. It failed the same way at line 727.
  - Why it matters:
    - README line 25 has a judge ship a demo patch as their first step, and line 65 says the tests "copy the selected game and use isolated data". A judge who then runs `npm test` gets a red run.
    - The operator's checkout also fails after every stream until the live patches are rolled back.
    - Codex's runs and mine used clean clones, so none of us saw it.
  - Fix:
    - make the test's game copy independent of studio state: copy only the patches that ship with the game (the tracked built-ins), not patches the studio shipped;
    - or have those tests check that the three built-in patches are listed and active, instead of an exact count. The copy should still be clean either way.
    - Add a test that leaves a shipped demo file in the working game and checks that the copied game doesn't contain it.
    - Keep README line 65 true.

### Minors
- **P55-R4-02** · `engine/studio/overlay-placement.ts:16-26`, `engine/studio/settings.ts:44-47` — Normalising the operator's real saved layout creates a new overlap between widgets.
  - The patch card is pushed down to y 165–517, and the narrow ballot grows to 501×700 at y 380. The ballot now covers the bottom 137 px of the patch card, hiding its third row (`ls06-overlay-operator-layout.png`).
  - `clearPlacement` only avoids the HUD and toast zones, and the editor doesn't warn about overlapping widgets.
  - Fix: keep widgets out of each other's rectangles too, or at least warn. When a narrow ballot needs more height, grow it away from other widgets.
- **P55-R4-03** · `games/arena-survivor/tests/smoke/smoke.spec.ts:244`, `README.md:39` — Two gaps in the Play popup work:
  - The test would pass if the window features were removed again: a plain tab also fires `popup`, has an opener and is wider than 1000 px.
  - The README doesn't say that Chrome still draws a title bar and a read-only address strip on popup windows, so a clean Window Capture still needs full screen (F) or an OBS crop.
  - Fix: assert that Play reports `window.locationbar.visible === false` (my run showed it tells the two cases apart), and say this in the README's OBS paragraph.
- **P55-R4-04** · `games/arena-survivor/tests/smoke/smoke.spec.ts:309` — The LS-02 test rejects in the pitch and vote stages only.
  - It never rejects at approval, and never opens "More actions" across a refresh.
  - The report says it "rejects at each stage".
  - The code works (my run), but add those two cases so a regression is caught.
- **P55-R4-05** · `engine/overlay/control.ts` — LS-01(d) asked for a Go Live notice when the browser preflight fails.
  - There is none: the streamer learns of the problem only from Setup, or when an approval is refused.
  - Fix: show the cached browser check as a notice in Go Live while it is "Needs action".
- **P55-R4-06** · `docs/architecture.md:9` — It still says the event deadline is "scaled from 200 ms … to at most 575 ms".
  - The new paragraph at line 58 and `engine/mutation/host.ts:32,177` say 1.8–2.2 s.
  - Fix: update line 9.
- **P55-R4-07** · `engine/runner/runner.ts:255` — The three-minute run budget is tight on this PC.
  - Codex's verification clone has a run that failed with "Run timed out after three minutes" (started 21:24). A shipped run used 166 s, and the build-start browser probe now runs inside the timer.
  - The report doesn't mention the timeout.
  - Fix:
    - list the timeout in the report;
    - start the timer after the probe;
    - consider a configurable or longer budget for live streams.

The operator found the next three on their own studio after this review. I confirmed each in the code. The operator wants them fixed in this round.
- **P55-R4-11** · `engine/overlay/dashboard.css:85` — The Quick actions tiles aren't aligned.
  - `9c10478` changed the tiles from `display:grid;place-items:center` to `display:flex;place-items:center;text-align:center`. In a flex row, the `:before` icon becomes a left-hand item and the label is squeezed beside it.
  - In the three-column grid, labels wrap to two or three lines ("Resume round · R", "Roll back latest"), and "Open prediction" runs into the tile's edge (operator screenshot).
  - Fix:
    - give every tile the same arrangement (for example, icon above a centred label, or a fixed icon column with a left-aligned label);
    - let labels wrap only between words and never overflow;
    - use two columns when the panel is narrow;
    - add a geometry test that every label stays inside its tile.
- **P55-R4-12** · no `scrollbar` rule anywhere in `engine/**/*.css` — The panel scrollbars are the browser's default light ones on the dark studio.
  - The fixed panel heights from LS-07 make several panels scroll: in my run, Round and ballot (689 > 474 px), Activity, Codex at work and Active patches; in the operator's window, Quick actions too.
  - Fix:
    - style scrollbars across the studio to match the theme: thin, dark track, violet thumb, with `scrollbar-width`/`scrollbar-color` plus the WebKit pseudo-elements;
    - size panels whose content nearly fits so they don't scroll at all (Quick actions should never scroll);
    - keep panels scrollable by keyboard.
- **P55-R4-13** · `engine/overlay/setup.ts:15`, `README.md:33` — The "Twitch app · optional for practice" card asks for a client ID, a secret and an exact redirect URI, but never says where they come from.
  - Fix: add links that open in a new tab (`rel="noopener noreferrer"`):
    - the Twitch Developer Console, `https://dev.twitch.tv/console/apps`;
    - the guide "Register your app", `https://dev.twitch.tv/docs/authentication/register-app/`.
  - Add a short how-to:
    - register an app (Twitch requires two-factor authentication on the account);
    - paste the redirect URI shown in Setup exactly as the OAuth Redirect URL;
    - choose the Confidential client type;
    - copy the Client ID and create a New Secret.
  - Add a copy button next to the redirect URI, and put the same links in the README's Twitch paragraph.
  - Both links returned HTTP 200 on 31 October.

### Nits
- **P55-R4-08** · `engine/overlay/dashboard.css:97,99` — The same panel-height rule is written twice.
- **P55-R4-09** · `engine/overlay/control.ts:157-163` — At approval, an open "More actions" menu shows a second Reject next to the new one. The notice after a Go Live reject reads only "rejected". Drop the menu copy and say which idea was rejected.
- **P55-R4-10** · `engine/overlay/timeline.ts:6-9` — Two cases get the wrong step:
  - a failure after `passed` (commit or publish) marks no step as Failed;
  - after a repair, a gate failure is shown as "Smoke test · Failed" because the first attempt's `testing` event is still in the set.

## Working well — do not change
- **The timeline:** one shared helper for both views, and "Smoke test" is ticked only on `passed`.
- **Real setup failures:** retried once, classified as infrastructure, the prediction cancelled, the idea back in the pool. The diagnostics stay local and the public wording is safe.
- **Approval guard:** an approval the PC can't build explains why instead of starting a build that can't be tested.
- **Reject:** it goes through the existing `/api/control` → pipeline path with a confirmation. Menus and focus survive the 2 s refresh. The honest "points cannot be returned" wording appears for reward ideas.
- **Overlay placement:** it is applied in `SettingsStore`, so OBS gets the corrected positions, not just the editor. A container query stacks the ballot.
- **Event deadline:** raised to 1.8–2.2 s, with good reasons. The queue stays bounded (64 events, ticks merged), and the endless-loop and three-second-stall tests still disable bad modules.
- **Evidence:** three real HTTPS builds with times, and an unproven root cause reported as unproven.

## Notes for the operator
- **Your saved overlay layout** will now load as a 501×700 ballot overlapping the patch card (P55-R4-02). Use **Go Live → OBS overlay layout → Reset layout** before the next stream.
- **OBS:** Play now opens as a popup. Check that the "Live Patch game" source still finds the window (if it's blank, choose the window again in its properties). Crop the popup's top strip, or press F in Play.
- **Codex's leftover folders:** Codex couldn't delete its two verification clones. Both are disposable, and the first is Git-ignored:
  - `D:\twitchconXcodex\app_submission\.live-patch-test-live-builds-d65cd80a`
  - `C:\Users\ROG\AppData\Local\Temp\live-patch-ls-fb63555c`
  
  Delete them when convenient.
- **Push state:** nothing is pushed, and `phase-5.5-done` is not tagged.
- **Cleanup:** I deleted my scratch clone after the run.
