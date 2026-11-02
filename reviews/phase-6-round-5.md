# Phase 6 — Review round 5

> This round is also past the three-round cap. The operator asked for it, to check Codex's fixes for round 4 (`d86d4cd..c080132`, three commits, local only):
> - `2fa51a6` fixes for round 4;
> - `80cdb8a` the round-4 verification record;
> - `c080132` the operator's own visual follow-up: the free arm moves behind the body and head, and both legs trail during a jump.

## Verdict
Fail

All five round-4 findings are fixed, and the fixes are tested:
- the pit walls now slide in and out at both screen edges;
- the holding arm has two parts, with its paw on the stick;
- the music stays faded after a hazard run over;
- the per-second action budget has a test that fails when the budget is switched off.

Both of my clean clones passed every suite, the build and the audit.

One Major is open, and the round-4 wall fix caused it: the walls were lowered to the grass line, but the pit's dark fill wasn't. So an 11 px dark slab now sticks up above the ground at every pit (P6-R5-01). It is visible in Codex's own `01-gameplay.png`.

How I verified, at `c080132`:
- **Two clean clones** of the local repository in a scratch folder (no `.env`, no tokens). Each ran `npm ci` and `npm test`; the second also ran `npm run build` and `npm audit --audit-level=high`.
- **A third scratch clone** for the mutation checks, and for a scratch studio (`npx vite`, Lantern Run, test mode, HTTP port 5199) that my headless probes drove:
  - per-frame captures of both screen edges, 1,400 frames each, on a paused Playwright clock (each step is exactly 1/60 s);
  - fox close-ups at 3× device scale for the run cycle and a full jump;
  - an OfflineAudioContext probe of the music bus;
  - a pass with the free arm tinted magenta, to measure how much of it is still visible.
- **Mutation checks** in the scratch clone, each reverted afterwards:
  - the old pit-visibility condition;
  - the round-4 paw position;
  - `MAX_ACTIONS_PER_SECOND` set to 1e9;
  - the round-4 `audio.ts`.
- **Evidence images** are in `D:\twitchconXcodex\plans\phase-6\review-r5\`.

## Exit criteria
- [x] **1. The engine stays game-agnostic.** `git diff --stat d86d4cd..c080132 -- engine` is empty.
- [x] **2. Tests are per game.** Results were the same in both clean clones:
  - vitest: **108 passed, 4 skipped**;
  - studio: **30 passed**;
  - Arena Survivor: **37 passed, 1 skipped**;
  - Lantern Run: **31 passed**;
  - the HTTPS regression passed, and `npm test` exited 0.
- [x] **3. Lantern Run is playable.**
  - In 2,800 probe frames the fox ran, fell, respawned and recovered as before.
  - The only one-frame jumps in the scene are the intended 6 m respawn skips after a pit fall (for example, distance 313 → 319 between frames 651 and 652).
- [x] **4. Lantern Run performs.**
  - Rendering is unchanged apart from the rig parts and the wall test.
  - The crowded-storm test passed in both clones.
  - See P6-R5-04 about how the frame-gap checks are measured.
- [x] **5. The mutation API is complete and safe.**
  - There are no API changes.
  - The new Arena test proves the 60-per-second budget: with `MAX_ACTIONS_PER_SECOND` at 1e9 it fails, because "actions skipped" never appears and the status stays "Budget Probe · active".
- [x] **6. Live Codex can build for it.** No new builds were run; the round-1 evidence stands.
- [x] **7. The studio works with it.** The studio suite passed (30) in both clones.
- [x] **8. The overlay respects each game.** The HUD and overlay code are unchanged.
- [ ] **9. It looks like the concepts.**
  - **Met now:** the walls slide smoothly at both edges; the two-part holding arm puts its paw on the stick; the legs trail through the whole jump.
  - **Not met:** the dark slab above every pit (P6-R5-01).
  - **Smaller gap:** the holding forearm is flipped (P6-R5-02).
- [x] **10. The standing checks hold.** The diff adds no HTML sinks and no token-like strings, and the engine is untouched.
- [x] **11. The docs are in sync.**
  - The round-4 responses match the code.
  - Two captions overstate what the images show (P6-R5-05, Minor).
- [x] **12. A clean clone passes.**
  - Clone 2: `npm run build` exit 0, and `npm audit --audit-level=high` found **0 vulnerabilities**.
  - `builds/` is absent after testing, and `git status --porcelain` is empty.

## Previous findings
- **P6-R4-01 — Resolved for the pop. The alignment remainder is new finding P6-R5-01.**
  - Visibility now goes through `pitWallsVisible` (`games/lantern-run/src/ground-visibility.ts:4-6`), which adds the 70 px wall width on both sides.
  - **Per-frame probe:**
    - **Left edge:** all **6 of 6** exits slide out over five frames (rock columns 13 → 10 → 6 → 2 → 0). Round 4 had 5 of 5 one-frame pops.
    - **Right edge:** all **7 of 7** entries slide in (0 → 2 → 6 → 10 → 13).
    - See `plans/phase-6/review-r5/pit-walls-slide-at-both-edges.png`.
  - **Wall tops:** they now sit at canvas y 517, level with the grass.
  - **Unit test:** with the old condition, `keeps pit walls until their outer edges leave either side of the viewport` fails.
- **P6-R4-02 — Resolved.**
  - Both arms are now an upper arm plus a forearm (`games/lantern-run/src/rig.ts:61-75`).
  - At 3×, the holding paw's centre sits on the stick's line in all 8 run frames and all 13 jump frames. I checked the stick texture's line (`art-parts.ts:94`, from (3, 20) to (49, 8)) against `fox-grip.ts`: at the grip x the line is at y −2.4, which is where the paw is.
  - The report's T1 and T3 lines now say "two-part".
  - See P6-R5-02 for the forearm's orientation and P6-R5-03 for its test.
- **P6-R4-03 — Resolved.** Same probe as round 4, 3–5 s after the event:
  - **Hazard run over:** music RMS **0**, against 0.0089 before. Pit run over: 0.
  - **Music volume 0.8:** after one hurt the music RMS is **0.01612**, exactly the no-hurt level (0.0258 before), so the duck now respects the cap.
  - **Settings during run over:** changing studio settings while the run-over card shows keeps the music at 0.
  - **The new test:** against the round-4 `audio.ts` it fails (0.035 against a limit of 0.024).
  - **Cadence:** a two-note cadence now plays on the effects bus.
- **P6-R4-04 — Resolved.**
  - `the 60-action window rejects the fourth valid 20-action event` (`games/arena-survivor/tests/smoke/smoke.spec.ts:235`) freezes `Date.now`, which is the clock the host's budget uses (`engine/mutation/host.ts:154-155`).
  - It fails with the budget disabled (see criterion 5).
- **P6-R4-05 — Resolved.** The spawn sites use named offsets (`games/lantern-run/src/main.ts:84`, `:89`), and `MAX_SPAWN_OFFSET` is their maximum (`generator.ts:5-8`). See Nit P6-R5-06.

**The operator's follow-up (`c080132`) is verified:**
- **Jump:** in all 13 jump frames, ascent and descent, both legs trail behind the fox with bent knees, and none kicks forward.
- **Free arm:** it no longer crosses the cheek. It is drawn behind the body and head; only its paw shows below the chest in 5 of 8 run frames and in every jump frame (magenta-tint probe, at most about 66 game px²).

## Findings

### Majors
- **P6-R5-01** · `games/lantern-run/src/main.ts:355`, with `:231` and `games/lantern-run/src/ground-visibility.ts:8-10` — **An 11 px dark slab sticks up above the ground at every pit.**
  - **Evidence:**
    - In my left-edge frame 515, the gap's fill starts at canvas **y 506**, while the grass top on both sides is at **y 517**. See `plans/phase-6/review-r5/pit-fill-above-grass.png`.
    - The same slab is visible on both pits in Codex's `docs/phases/phase-6-visual/01-gameplay.png`: at 1080p, the dark columns rise about 16 px above the grass at x 55–165 and 1035–1150.
  - **Cause:**
    - Round 4 lowered the wall images so their tops meet the grass (`cliffCentreY`).
    - But the gap fill still starts at `GROUND - 12` (line 355). That was the top of the ground strip's grass-blade band (line 231), and it matched the old wall tops.
    - So the round-4 "raised moss step" is now a dark notch in the sky above every pit.
  - **Why it matters:**
    - It's on every pit, at stream resolution, in the headline capture.
    - It comes from the half of the round-4 fix that lined the pit tops up with the grass.
    - The report says the refreshed capture "shows aligned edges" (`docs/phases/phase-6-report.md:186`).
  - **Fix:**
    - Start the dark fill at the grass top, the same y as the wall tops.
    - The pen draws above the strip (depth 1 against 0.5), so with a lower fill the strip's grass blades would float over the gap. Keep the strip out of the gaps: for example, mask the strip where the gaps are, or draw the strip per ground span.
    - Add a check that the fill's top equals the wall top. For example, read it from one shared helper, as `cliffCentreY` does, or sample the colour just above a gap's centre on a paused clock.
    - Recapture `01-gameplay.png`.

### Minors
- **P6-R5-02** · `games/lantern-run/src/rig.ts:74`, `games/lantern-run/src/art-parts.ts:85-89` — **The holding forearm is flipped.**
  - The forearm texture darkens to the brown sock at its bottom, which is the paw end, and the free arm uses it that way.
  - The holding forearm is turned +45°, which puts that sock end down and back, at the elbow, below the stick. Its light end meets the paw.
  - So a dark-tipped blob still hangs under the stick. See the circled area in `plans/phase-6/review-r5/fox-arm-r5-vs-R1.png`.
  - In R1, the forearm darkens toward the gripping paw.
  - **Fix:** turn the holding forearm so its sock end meets the paw (about 180° from the current angle, adjusting the pivot), or mirror the texture for that arm. Then recapture `07-fox-run-cycle.png`.
- **P6-R5-03** · `tests/phase6-ground-visibility.test.ts:22-24`, `games/lantern-run/src/fox-grip.ts:4-8` — **The grip test can't see the rig.**
  - `stickLineYAtGrip` copies the stick's size, position and texture line as literals (72, 68, 23, −8, 3, 20, 49, 8), and the test compares that to another constant in the same file.
  - I put the paw back at round 4's position (13, 12) in `rig.ts`, and the test still passed (4 of 4).
  - **Fix:** take the stick's placement and line from the one place that `art-parts.ts` and `rig.ts` both use. Or expose the paw's and stick's world positions in the diagnostic snapshot, as `hudBounds` does, and check them in the browser.
- **P6-R5-04** · `games/lantern-run/tests/smoke/smoke.spec.ts:405`, `games/arena-survivor/tests/smoke/smoke.spec.ts:101`, `:158`, `games/lantern-run/src/main.ts:265` — **The remaining frame-gap checks still use the lifetime maximum, which is what flaked.**
  - `maxFrameGap` is the largest gap since the page loaded, so one scheduler or GC stall anywhere in the test fails it.
  - Codex saw 533, 386 and 1111 ms in full runs. It replaced the generic five-second check with a frame count, which is a reasonable liveness check, but the storm tests keep the lifetime assertion.
  - Codex's clone A also had the canvas-click test time out once.
  - **Severity:** Minor, because both of my full runs passed. It would be Major if it failed in a clean clone, as P6-R3-01 did.
  - **Fix:** measure the gap only over each test's own window (reset it, or record the largest gap since a marker), and keep the relative frame-rate check.
- **P6-R5-05** · `docs/phases/phase-6-report.md:87`, `:186` — **Two captions overstate their images.**
  - The `07-fox-run-cycle.png` row says the samples show "a two-part swinging free arm". Since `c080132`, that arm is drawn behind the body, and at most its paw shows.
  - The P6-R4-01 response says the refreshed `01-gameplay.png` "shows aligned edges". The walls are aligned, but the pits have the P6-R5-01 slab.
  - **Fix:** after P6-R5-01, update both captions to describe what the images show.

### Nits
- **P6-R5-06** · `tests/phase6-ground-visibility.test.ts:17-20` — **`derives the despawn offset from all generated placements` restates the definition,** so it can't fail. The real guard is the natural-spawn browser test, so this one could go.

## Working well — do not change
- **`pitWallsVisible` as a small pure helper,** used by the draw loop, with a unit test that fails on the old condition.
- **The audio fix:**
  - it cancels the scheduled gain before the fade;
  - `configure` keeps the music down once the run has ended;
  - the duck uses the capped level;
  - the offline test fails against the round-4 code.
- **The budget test:** it freezes the same clock the host uses and counts the actions actually applied, so it is deterministic at any frame rate.
- **The jump leg pose:** it is a small function with a test, and it gives a clean trailing silhouette on the way up and down.
- **Named spawn offsets,** with `MAX_SPAWN_OFFSET` derived from them.

## Notes for the operator
- **Round status:** this round was outside the three-round cap, at your request. Everything from round 4 is fixed; the one Major is a side effect of the wall fix.
- **Smallest change that clears P6-R5-01:**
  - start the pit fill at the grass top instead of 11 px above it;
  - hide the ground strip's grass blades over the gaps, so they don't float there;
  - recapture `01-gameplay.png`.
- **Your choice:**
  - one more short Codex round for P6-R5-01 (P6-R5-02 and P6-R5-05 are cheap to add), followed by a two-clone rerun;
  - or close Phase 6 and carry P6-R5-01 into Phase 5 as a Deferred item to fix before the video.
- **Leftovers** for you to delete (Codex's automatic approval refused to delete them):
  - Codex's clones `D:\twitchconXcodex\phase6-polish-clone-a-20261101` to `-d-20261101`;
  - the round-2 clone `D:\twitchconXcodex\phase6-r2-clean-a-20261101`.
- **Cleanup:** I stopped my scratch studio and deleted my scratch clones. Nothing is pushed or tagged by me. The review files remain untracked, as before.
