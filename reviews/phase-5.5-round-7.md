# Phase 5.5 — Review round 7

An extra round, asked for by the operator: a confirmation of Codex's fixes for round 6 (`plans/phase-5.5/codex-round-6-fixes-prompt.md`).

## Verdict
Pass with minors

All four round-6 findings are fixed, and I checked each one myself. No Blocker or Major is open. One new Nit remains: at 1536×864, the last Codex timeline step is cut off by 9 px.

How I verified, at `b3a4de0` (`36e906d..b3a4de0`, one commit, local only, 7 files):
- I cloned the local repository into a scratch folder (no `.env`, no tokens) and ran `npm ci`, `npm test`, `npm run build` and `npm audit --audit-level=high` there.
- I ran a headless Chromium check against the clone's real `npm run dev` (HTTPS, port 5199):
  - Go Live with no run, then with a shipped Practice demo, at 1920×1080, 1536×864 and 1366×768;
  - a viewer pitch rejected from Go Live.

  Practice only, with no Codex build.
- My screenshots are in `D:\twitchconXcodex\plans\phase-5.5\review-r1\r7\`.

## Exit criteria
- [x] **Clean clone: tests, build and audit.**
  - `npm test`: vitest **92 passed, 4 skipped**; Playwright **63 passed, 1 skipped** (opt-in WebGL); "HTTPS regression passed…"; exit 0. No `builds/` folder was created.
  - `npm run build`: exit 0. `npm audit --audit-level=high`: **0 vulnerabilities**.
- [x] **The report has "Round 6 responses" for P55-R6-01 to P55-R6-04** (`docs/phases/phase-5.5-report.md:164-171`).
- [x] **No Blockers or Majors open.**

## Previous findings
- **P55-R6-01** — **Resolved.** `games/arena-survivor/docs/mutation-api.md:17` now says "Each load has a 3 second deadline", matching `engine/mutation/host.ts:29` and `docs/architecture.md:9`. A new unit test reads `LOAD_DEADLINE_MS` from the host and checks that the doc states it (`tests/phase55.test.ts:20-26`), so the two can't drift apart again.
- **P55-R6-02** — **Resolved at 1920×1080.**
  - Timeline rows are more compact at widths of 1500 px and over (`engine/overlay/dashboard.css:122`).
  - With no run, the last step ends at y 1005, inside the panel's 1022.
  - With a shipped run's title line above the steps (the case that was cut before), it ends at y 1011, and "Shipped · Done" is fully visible (`r7-go-live-run-1920x1080.png`).
  - Three patch cards stay fully visible, and Quick actions doesn't scroll.
  - Codex's geometry test checks every step against the panel, though only in the no-run state (`smoke.spec.ts:442-451`).
  - At 1536×864 the step is still cut: P55-R7-01.
- **P55-R6-03** — **Resolved.**
  - Local operator commands (`viewer.id === 'local-operator'`) no longer enter Recent chat (`engine/twitch/server.ts:150`).
  - After my Go Live reject, Recent chat had no "Operator" line. The viewer's own `!idea` still showed.
  - The notice read "rejected @R7Viewer: Coins orbit the player for a few seconds".
  - Codex's reject test checks the Recent chat API.
- **P55-R6-04** — **Resolved.** `LIVE_PATCH_BUILDS_DIR` is gone from `.env.example`. The test scripts still set it (`scripts/test.mjs:45`, `scripts/test-https.mjs:42`), and the clean-clone run left no `builds/` folder.

## Findings

### Blockers
None.

### Majors
None.

### Minors
None.

### Nits
- **P55-R7-01** · `engine/overlay/dashboard.css:122` — At 1536×864 (a common laptop size at 125% scaling), the "Shipped" step still ends 9 px below the Codex at work panel (y 1031 against 1022) while a run is showing. The panel scrolls, so the step can still be reached, and 1920×1080 is fine.
  - Suggestion: check the timeline at 1536×864 as well, and run the geometry test with a run title showing.

## Working well — do not change
- **The doc-versus-code test for the load deadline.** It turns a doc mismatch into a failing test.
- **Recent chat filtering:** operator button presses stay out, and viewer commands stay in.
- **Everything listed under "Working well" in round 6.**

## Notes for the operator
- **Phase 5.5 can close.** In `D:\twitchconXcodex\app_submission`:
  - commit the three untracked review files (rounds 5, 6 and 7) if you want them in the repository;
  - tag the code with `git tag phase-5.5-done b3a4de0`;
  - push with `git push origin master --tags` when you want it public.
- **Carried to Phase 5's final review:**
  - Nit P55-R7-01;
  - Nit P55-R2-08 (deferred);
  - the timeline edge cases of P55-R4-10 (deferred).
- **Still yours:**
  - the demo video (the Phase 6 plan's default is to record it after Phase 6);
  - checking on your next live stream that a viewer's `!idea` appears in Recent chat.
- **Leftover folders** you can delete:
  - `C:\Users\ROG\AppData\Local\Temp\live-patch-r5-9dc6301`;
  - the five old `.live-patch-test-*` folders in `app_submission`;
  - `games\phase45-switch-probe`.
- **Next:** Phase 6 starts from `b3a4de0`. Give Codex `plans/phase-6/codex-start-prompt.md`.
- **Cleanup:** I stopped my scratch studio and deleted my scratch clone. Nothing is pushed or tagged by me.
