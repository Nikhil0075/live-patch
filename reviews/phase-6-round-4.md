# Phase 6 — Review round 4

> This round comes after the three-round cap. The operator asked for it, to check Codex's polish round (`1a6c884..d86d4cd`, seven commits, local only) and two things they saw in play: the fox's front paw looked like only half a hand, and a pit vanished as it reached the left side of the screen.

## Verdict
Fail

The polish is a big step forward:
- the fox is now the upright courier;
- the ground, cliffs and pines follow the reference kit;
- the music and sound effects are layered and synthesized;
- the round-3 flaky test is gone, and both of my clean clones passed everything.

Two Majors are open, and they are the two things the operator noticed:
- **Pit rock walls pop.** Each one vanishes in a single frame as its pit leaves on the left, and appears in a single frame as it enters on the right (P6-R4-01).
- **Half an arm.** The fox's stick-holding arm is a short single segment, and its paw hangs below the stick instead of holding it. Meanwhile the report marks the fox targets as met (P6-R4-02).

Both are small, contained fixes.

How I verified, at `d86d4cd`:
- **Two clean clones** of the local repository in a scratch folder (no `.env`, no tokens). Each ran `npm ci` and `npm test`; the second also ran `npm run build` and `npm audit --audit-level=high`.
- **A scratch studio** (`npx vite` with Lantern Run, test mode, HTTP port 5199), driven by headless probes:
  - fox close-ups at 3× device scale;
  - per-frame captures of both screen edges with Playwright's clock paused, so each step is exactly 1/60 s (the fox moves 4.4 px per frame);
  - an OfflineAudioContext probe of the music bus at run over.
- **A budget check** in a scratch clone: I set the 60-actions-per-second limit to 1e9 and reran the unit, studio and Arena suites. I reverted it after.
- **Evidence images** are in `D:\twitchconXcodex\plans\phase-6\review-r4\`.

## Exit criteria
- [x] **1. The engine stays game-agnostic.** `git diff --stat 1a6c884..d86d4cd -- engine` is empty, and a search of `engine/` for both games' names, kinds and sounds returns nothing.
- [x] **2. Tests are per game.** Results were the same in both clean clones:
  - vitest: **104 passed, 4 skipped**;
  - studio: **30 passed**;
  - Arena Survivor: **36 passed, 1 skipped**;
  - Lantern Run: **30 passed**;
  - the HTTPS regression passed, and `npm test` exited 0.
- [x] **3. Lantern Run is playable.**
  - The generator change only names constants (`games/lantern-run/src/generator.ts:3-6`).
  - In my probes the fox ran, fell and recovered as before.
  - The round-3 fairness and spawn results stand.
- [x] **4. Lantern Run performs.** The crowded-moment tests pass. The polish replaces per-frame ground drawing with one pre-rendered strip. I didn't re-measure on a visible GPU this round; round 3 measured about 58 fps.
- [x] **5. The mutation API is complete and safe.**
  - There are no API changes.
  - The 14 sound names are unchanged (`games/lantern-run/src/audio.ts:3`).
  - The per-second action budget is still in place, but it no longer has a test (P6-R4-04).
- [x] **6. Live Codex can build for it.** No new builds were run; the round-1 evidence stands.
- [x] **7. The studio works with it.** The studio suite passed (30) in both clones.
- [x] **8. The overlay respects each game.** The HUD and overlay code are unchanged.
- [ ] **9. It looks like the concepts.**
  - **Much closer:**
    - the upright fox with a seamless tail, tall ears, a big eye and a paper lantern;
    - the moss-lipped ground strip, rock cliffs and tiered pines with haze;
    - a flat light pool and smaller firefly wings.
  - **Not met:**
    - the pit walls pop at both screen edges (P6-R4-01);
    - the holding arm doesn't match R1 (P6-R4-02).
- [x] **10. The standing checks hold.** The diff adds no HTML sinks and no token-like strings, and the engine is untouched.
- [ ] **11. The docs are in sync.**
  - The README gains the audio render command.
  - The report marks T1 and T3 as met and claims "articulated arms" and "a paw-held forked stick" (`docs/phases/phase-6-report.md:189`, `:200`, `:202`). See P6-R4-02.
  - It also says run over "fades the bus" (`:210`), which holds only for pit deaths. See P6-R4-03.
- [x] **12. A clean clone passes.**
  - Clone 2: `npm run build` exit 0, `npm audit --audit-level=high` found **0 vulnerabilities**, and `builds/` is absent after testing.
  - The listening files are mono 22.05 kHz:
    - `music-20s.wav` is 882,044 bytes and 20.0 s long, peaking at 0.11;
    - `sfx-all.wav` is 617,444 bytes, and all 14 effects are audible, peaking between 0.15 and 0.27.

## Previous findings
- **P6-R3-01 — Resolved as a flake. Coverage moved; see P6-R4-04.**
  - The storm module now requests 100 actions per event, so the 20-per-event cap trips at any frame rate.
  - The test passed in my two clean clones and in Codex's clones C and D.
- **P6-R3-02 — Resolved.**
  - The jump strip has nine frames across the arc, from takeoff to landing. The spin frame catches only a small tilt.
  - One blink frame in the run strip is disclosed in the report.
- **P6-R3-03 — Resolved.**
  - Masked owl and firefly checks are added (`games/lantern-run/tests/smoke/smoke.spec.ts:187`).
  - They hold the subject still on screen by matching its velocity to the run speed.
  - Their negative control disables `update`. Both pass.
- **P6-R3-04 — Resolved for the silhouette, tail, ears, eye, lantern and light pool.** The arms are new finding P6-R4-02.
- **P6-R3-05 — Resolved.** The bound is built from named constants (`games/lantern-run/src/main.ts:323`). See Nit P6-R4-05.

## Findings

### Majors
- **P6-R4-01** · `games/lantern-run/src/main.ts:351-366` — **Pit rock walls vanish in one frame as a pit leaves on the left, and appear in one frame as it enters on the right.** This is the "hole vanishes at the left" the operator saw.
  - **Evidence:** per-frame captures with the clock paused, one step every 1/60 s.
    - **Left edge:** in **5 of 5** pit exits, a rock wall about 52 px wide, with its moss cap, is present in one frame and gone in the next. The frame pairs are 529→530, 712→713, 893→894, 1073→1074 and 1253→1254. See `plans/phase-6/review-r4/pit-left-edge-pop-frames-712-713.png`.
    - **Right edge:** in **2 of 2** pit entries, the left wall appears fully formed at canvas x 1097–1149 in a single frame.
  - **Cause:**
    - The draw loop skips a gap, and line 366 destroys its walls, when the gap's own edges are off screen (`right < 0 || left > WIDTH`, line 352).
    - But each wall is a 70 px image drawn outside the gap: at `left - 35` and `right + 35` (lines 363-364).
    - So for the last 70 px of travel at the left edge, and the first 70 px at the right edge, the wall should be on screen but isn't drawn.
  - **Also visible in the same images:** each wall's moss cap starts at canvas y 506. That is about 11 px above the grass top of the ground strip (about y 517), so the caps read as raised steps beside every pit.
  - **Why it matters:** it happens at every pit during normal play, at stream resolution, and the operator spotted it straight away.
  - **Fix:**
    - Test a gap's visibility by its walls, not by its own edges: widen the test by the wall width on both sides.
    - Line the moss cap up with the strip's grass lip.
    - Add a check that a pit's right wall is still drawn while its gap's right edge is between −70 and 0. For example, expose the drawn wall positions in the diagnostic snapshot, as `hudBounds` does, and step a paused clock across the edge.
- **P6-R4-02** · `games/lantern-run/src/rig.ts:58-68`, `games/lantern-run/src/art-parts.ts:80-81` — **The stick-holding arm reads as half an arm, and its paw doesn't hold the stick.** This is the "front hand only half" the operator saw.
  - **Evidence:**
    - See `plans/phase-6/review-r4/fox-arm-vs-R1.png`: the game at 3× beside R1's CONTACT pose.
    - Both arms are one short segment: a single `arm` part, 20×28 (lines 59 and 66).
    - The holding paw is placed at stick-local (13, 12), but the stick's line starts near (0, 1) and rises forward. At the paw, the stick passes about 14 px above the paw's centre, which is about 10 px on screen at the 0.72 rig scale.
    - So the stick appears to come out of the shoulder, and a dark paw hangs under it.
  - **Reference:** R1 has a two-segment arm (an orange upper arm and a brown forearm) that reaches forward, with the paw wrapped around the stick.
  - **Report:** it says "articulated arms" and "a paw-held forked stick", and marks T1 and T3 as met (`docs/phases/phase-6-report.md:189`, `:200`, `:202`).
  - **Why it matters:**
    - It's visible in every frame, on the game's main character.
    - The report's claim doesn't match what's drawn, and the demo-honesty check rates that Major.
  - **Fix:**
    - Build both arms from two parts, as R1's exploded diagram shows: an upper arm and a forearm with the brown sock and paw, each with a pivot.
    - Point the holding forearm forward, so that the paw's centre sits on the stick's line. Draw the paw over the stick, with part of it above the stick and part below, so it reads as a grip.
    - Give the free arm the same two segments, with the forearm lagging the swing.
    - Keep everything inside the existing hit box.
    - Recapture `07-fox-run-cycle.png` and `01-gameplay.png`, and correct the T1, T3 and P6-R3-04 lines in the report.

### Minors
- **P6-R4-03** · `games/lantern-run/src/audio.ts:130-133`, `:91`; `games/lantern-run/src/main.ts:121` — **When the last heart is lost to a hazard, the run-over fade is undone, and the hurt duck restores the music above its cap.**
  - **Evidence:** an OfflineAudioContext probe of the music bus, measured 3–5 s after the event.
    - After a run over by a **pit**, the music RMS is 0.0002: faded, as intended.
    - After a run over by a **hazard**, it is 0.0089, **44 times louder**: no fade, just the filter closed.
    - With music volume at 0.8, one hurt leaves the music at RMS 0.0258, against 0.0161 without a hurt. That is **1.6×**, which equals 0.8 / 0.5: the cap at line 84 is bypassed.
  - **Cause:**
    - `play('hurt')` schedules a restore to `settings.musicVolume` at t + 0.2 s.
    - `setRunState(false)` then schedules the fade at t. The later restore wins.
    - The restore also skips the 0.5 cap that `configure` applies.
  - **Also:** T11 asked for a closing cadence at run over. There is none. The report doesn't claim one, but it marks T11 as met.
  - **Severity:** Minor, because the filter still closes, so a run over still sounds different, and at the default music volume (0.25) the cap isn't exceeded.
  - **Fix:**
    - Duck and restore relative to the same capped level that `configure` uses.
    - Cancel scheduled values before the fade.
    - Skip the restore once the run has ended.
    - Add an offline test: hurt, then run over, then expect near silence after 2 s.
- **P6-R4-04** · `games/arena-survivor/tests/smoke/smoke.spec.ts:222-233`, `games/lantern-run/tests/smoke/smoke.spec.ts:385-391`, `engine/mutation/host.ts:34`, `:156-158` — **No test covers the 60-actions-per-second budget any more.**
  - **Evidence:**
    - In a scratch clone, I set `MAX_ACTIONS_PER_SECOND` to 1e9.
    - The Arena storm test still passed. So did all 104 unit tests, 30 studio tests and 36 Arena tests.
    - Both storm tests send 100 actions in one event, so the 20-per-event cap (`host.ts:156-157`) does all the work.
  - **Severity:** Minor, because the flake is gone. The per-event cap, the 80-entity cap and the effect limits still bound a runaway module. But the per-second budget is now unguarded.
  - **Fix:**
    - Add a test that emits exactly 20 actions per tick under a paused Playwright clock.
    - Step about 2 s, then assert skipped actions and a coin count near the budget.
    - Or test the host's budget with a fake clock.

### Nits
- **P6-R4-05** · `games/lantern-run/src/main.ts:83`, `:88`, `:323` — **The despawn bound and the spawn offsets can drift apart.** `MAX_SPAWN_OFFSET` names the 350 px offset, but the spawn sites still use the literals 350 and 220. A larger offset added later wouldn't move the despawn bound. Use the constant where the entities are placed.

## Working well — do not change
- **The upright fox rig:**
  - an upright torso;
  - a two-leg stride;
  - a seamless cream-tipped tail;
  - a big eye with a blink;
  - a swinging paper lantern with spring follow-through.
- **The pre-rendered ground strip** in place of per-frame Graphics drawing, plus a pre-rendered cliff texture and scalloped pines with haze.
- **The audio architecture:**
  - separate effects and music buses into a compressor;
  - a generated reverb impulse;
  - a 25 ms lookahead scheduler on the audio clock;
  - layers that change only at bar lines;
  - recipes in a table that tests can break on purpose.
- **The audio tests:** every sound is rendered offline, and a deliberately silenced recipe proves the check can fail. The music is checked for beat-grid error and a seamless loop.
- **The WAV render script:** it writes to a temp folder inside the repository and checks the path before deleting it.
- **The owl and firefly checks:** each stops the rig's `update` as its negative control.
- **The storm test** now passes at any frame rate. Keep it, and add the budget test from P6-R4-04 beside it.

## Notes for the operator
- **Round status:** this round was outside the three-round cap, at your request. The two Majors are the two things you saw.
- **Smallest change that clears each Major:**
  - **P6-R4-01:** widen the pit-visibility test at `main.ts:352` by the 70 px wall width on each side. That is one condition. Lining the moss cap up with the grass is a one-number change in the cliff texture or its y position.
  - **P6-R4-02:** split each arm into an upper arm and a forearm, and move the holding paw onto the stick's line. Then recapture 07 and 01.
- **Your choice:**
  - one short Codex round for the two Majors (the two Minors are cheap to include), followed by a two-clone rerun;
  - or close Phase 6 and carry them into Phase 5 as Deferred items to fix before the video.
- **Leftovers** for you to delete:
  - Codex's clones `D:\twitchconXcodex\phase6-polish-clone-a-20261101` to `-d-20261101`;
  - the round-2 clone `D:\twitchconXcodex\phase6-r2-clean-a-20261101`.
- **Cleanup:** I stopped my scratch studio. My scratch clones are deleted after this review. Nothing is pushed or tagged by me.
