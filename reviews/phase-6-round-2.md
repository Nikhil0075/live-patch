# Phase 6 — Review round 2

## Verdict
Fail

Most round-1 findings are fixed, and the art and animation are a large step up. But:
- **One Blocker:** after the first few metres of every run, Lantern Run deletes every obstacle, owl, firefly, acorn and ledge in the frame it spawns, so the game is an empty runner with pits. The new "despawn far right" rule (the round-1 Nit) causes it.
- **Four Majors:**
  - low owls placed after wide gaps can't always be cleared;
  - an old Arena test races the page startup and failed in one of my clean clones;
  - the new animation test can't fail;
  - the fox still misses the concepts' silhouette, and several rendering defects show in every frame.

How I verified, at `d4a4881` (`deab45e..d4a4881`, five commits, local only):
- **Two clean clones** of the local repository in a scratch folder (no `.env`, no tokens). Each ran `npm ci` and `npm test`; the second also ran `npm run build` and `npm audit --audit-level=high`.
- **A scratch studio** (`npx vite` with Lantern Run, test mode, HTTP port 5199):
  - headless Chromium probes of generated spawns, the five-heart removal, pit falls, milestones and HUD bounds;
  - exact 60 fps frame captures with Playwright's fake clock;
  - the visible built-in browser (WebGL) for frame rate and the Library.
- **Two Node probes** that import the game's own `generator.ts` and `physics.ts`: where generated entities appear on screen, and whether a scripted jumper can pass each generated owl.
- **Frames extracted** from `lantern-run-motion.webm`.
- **Screenshots** are in `D:\twitchconXcodex\plans\phase-6\review-r2\`.

## Exit criteria
- [x] **1. The engine stays game-agnostic.**
  - My search of `engine/` (`.ts`, `.css`, `.html`, tests excluded) finds no import from `games/`. It also finds none of the game names, kinds or sounds listed in round 1.
  - The only engine changes are generic:
    - `engine/overlay/library.ts:49-50` marks a portrait cover with a CSS class;
    - `engine/studio/settings.ts:40-44` and `:53-54` contain the R1-03 fix.
  - Nothing under `engine/runner`, `engine/mutation` or `engine/manifest` changed.
- [x] **2. Tests are per game.**
  - Clean clone 2, `npm test`: vitest **103 passed, 4 skipped**; studio **30 passed**; Arena Survivor **35 passed, 1 skipped**; Lantern Run **24 passed**; HTTPS regression passed; exit 0.
  - Clean clone 1 failed one Arena test (P6-R2-03), so its Lantern suite and HTTPS check never ran.
- [ ] **3. Lantern Run is playable.**
  - Controls, pits, hearts, invulnerability, run over, restart and pause work. The 250-seed tests pass.
  - But after the first stretch the game has no obstacles, owls, pickups or ledges (P6-R2-01).
  - And once they come back, some generated owls can't be cleared (P6-R2-02).
- [x] **4. Lantern Run performs.**
  - Both crowded-moment tests pass in clean clone 2.
  - In the visible built-in browser (WebGL, 1920×1080 viewport), the game ran at **58.3 fps**. After spawning to every cap (57 live entities, 64 particles, rain) it ran at **58.9 fps**, with a worst gap of 75 ms. The report's 6.1 fps figure is a headless software-rendering number. On this machine's GPU, the overhaul doesn't hurt the stream.
- [x] **5. The mutation API is complete and safe.**
  - **Rollback:** my probe raised `maxHearts` to 5 and healed to 5/5, then removed the module. Hearts went to **3/3**, the game ran 12 frames in 1.5 s, and there were no page errors.
  - **Milestones:** across six pit falls in two runs, milestones arrived as **100, 200, 300** in both runs.
  - **Docs:** the doc test matches the manifest.
- [x] **6. Live Codex can build for it.** No new builds were run this round, as the prompt instructed. The round-1 evidence stands.
- [x] **7. The studio works with it.**
  - The studio suite passed (30) in both clones, including the Library switch from P6-R1-02.
  - In my scratch studio, the Library card and the details panel both show the fox and the owl from the new cover.
- [x] **8. The overlay respects each game.**
  - At Large HUD size with 5 hearts, the HUD's right edge is at stream **x 644** and its bottom at **y 107**. Both are inside the 670×130 zone and clear of the toast zone, which starts at x 685.
  - Per-game layouts no longer leak (`tests/phase6-contract.test.ts:13-26`).
- [ ] **9. It looks like the concepts.**
  - All captures exist.
  - But `01-gameplay.png` and the motion video show hazards and owls that the capture script spawned (`scripts/capture-phase6.mjs:28-31`). Normal play has none after the first stretch (P6-R2-01).
  - The fox and several world details still miss the operator's quality bar (P6-R2-05).
- [ ] **10. The standing checks hold.**
  - Security is clean:
    - no new `innerHTML`, `insertAdjacentHTML` or `outerHTML` in the diff;
    - no token-like strings;
    - mutation gates unchanged.
  - But the new animation test can't fail (P6-R2-04): standing check "tests that cannot fail".
- [ ] **11. The docs are in sync.**
  - The Lantern API doc says generated owls fly toward the fox (`games/lantern-run/docs/mutation-api.md:5`).
  - The report marks P6-R1-06 and P6-R1-12 as fixed.
  - At runtime, no generated owl ever reaches the screen (P6-R2-01).
- [x] **12. A clean clone passes.**
  - Clean clone 2: `npm test` exit 0, and no `builds/` folder before or after. `npm run build` exit 0. `npm audit --audit-level=high`: **0 vulnerabilities**.
  - Clean clone 1 hit the startup race (P6-R2-03).

## Previous findings
- **P6-R1-01 — Resolved.** Hearts clamp when `maxHearts` is recomputed (`games/lantern-run/src/main.ts:136`). My probe gave 5/5 → 3/3 with frames running and no errors (`r1-01-after-removal.png`). The new smoke test covers it.
- **P6-R1-02 — Resolved.** The Library switch test passed in both clean clones. A different first-run race remains: see P6-R2-03.
- **P6-R1-03 — Resolved.** Migration runs only when the file has no `overlayLayouts`, and saves no longer write the top-level `overlayWidgets`. A unit test covers the exact path.
- **P6-R1-04 — Resolved.**
  - The icon HUD ends at stream x 644. The zone is now 0,0,670×130, which stays clear of the toast zone (685+). A browser test measures it.
  - A spacing problem inside the row remains: see P6-R2-06.
- **P6-R1-05 — Resolved.** Six probe falls jumped only **2–10 m** (round 1: 70–93 m). Each left the fox over ground, and milestones ran 100, 200, 300 in both runs.
- **P6-R1-06 — Not resolved in play.**
  - The glide path is written and unit-tested (`games/lantern-run/src/generator.ts:15-16`, `main.ts:80-82`).
  - But generated owls are deleted before they are ever drawn (P6-R2-01).
  - When they return, low owls create unclearable stretches (P6-R2-02).
- **P6-R1-07 — Partly resolved.** The fairness test now drives the game's own flight step, and it proves that held jumps reach the ledges. It doesn't cover owls: see P6-R2-02.
- **P6-R1-08 — Partly resolved.**
  - Part rigs, flapping owls, winged fireflies, five parallax layers, an icon HUD, a banner pill and a keycap card replace the static art.
  - Remaining gaps are in P6-R2-05.
- **P6-R1-09 — Resolved.**
  - `assets/cover.webp` is 800×1200 and 96 KB.
  - `CREDITS.md` records the origin, and the old cover and its script are gone.
  - Both Library crops keep the fox and the owl.
- **P6-R1-10 — Resolved.** The Lantern API doc states the 3 second load deadline, and `tests/phase55.test.ts:23-35` now checks every game's doc.
- **P6-R1-11 — Resolved.** The stale sentence is gone.
- **P6-R1-12 — Not resolved.** The new right-edge rule deletes the generator's own entities: see P6-R2-01. (My round-1 suggestion didn't warn about the generation lead.)

## Findings

### Blockers
- **P6-R2-01** · `games/lantern-run/src/main.ts:313` (with `:74`, `:79-86`, `:277`) — **Every generated obstacle, owl, firefly, acorn and ledge is deleted in the frame it spawns, except the first stretch's pickups.**
  - **Cause:**
    - `ensureWorld()` adds a stretch only when the last span ends within `WIDTH + 500` px of the camera. It runs at the start of each update (`:277`).
    - So a new stretch begins at least about 1,650 px ahead, and its entities spawn at screen x **1,759 or more** (first pickup at `from + 110`, hazard at `+ 220`, ledge at `+ 350`).
    - Later in the same update, the new rule `x > WIDTH + 300` (1,452) kills them.
    - Only the run's first stretch, generated at distance 0, lands on screen (pickups at x 1,310–1,426). It has no hazard, because stretches 0–1 never do.
  - **Evidence:**
    - A Node probe using `generator.ts`: the first pickup's screen x per stretch is 1310, 1759, 1868, 1849, 1838…; after the first stretch, the minimum is 1759.
    - A runtime probe with no modules loaded: in 25 s, the game generated **32** entities. Only **3** (fireflies at x 1310/1368/1426) ever appeared in a snapshot. **29 never did**, including `boulder@2005`, `log@1927` and `ledge@2057`.
    - In the visible browser at **944 m**, the screen showed no obstacle or pickup (`live-944m-empty-world.jpg`).
  - **Why it was missed:**
    - No test checks that generated entities survive.
    - The crowded, rollback, hit and ledge tests all spawn their own.
    - `01-gameplay.png` adds a log and an owl by hand (`scripts/capture-phase6.mjs:28-31`).
    - The video's owl, fireflies and boulders also come from the capture script.
  - **Why it matters:** it breaks criterion 3, design principle 4 and the live demo. Viewers would see an empty forest, and patches like "owl pinecones" have no owls to work with.
  - **Fix:**
    - Despawn on the right only beyond the generation horizon, for example well past `WIDTH + 500 +` the largest spawn offset. Or apply the rule only to entities moving right faster than the run, or to module-owned entities.
    - Add a smoke test: with no modules loaded, run for several seconds, then check that generator-owned hazards and pickups appear in snapshots and scroll past the fox.
    - In the report, say which entities each capture script spawns.

### Majors
- **P6-R2-02** · `games/lantern-run/src/generator.ts:15-16`, `main.ts:79-82`, `tests/phase6-generator.test.ts:24-33` — **A low owl that follows a wide gap can't always be cleared.**
  - **The low owl's height:** the lowest seeded owl flies at y 425 ± 11. A running fox's centre is at y 480, and the owl hitbox is ±55 px. So this owl hits a fox that stays on the ground whenever it is in the lower half of its wave.
  - **Where it meets the fox:** the owl spawns at `from + 220` and drifts at -24 px/s, so it meets the fox about 85 px after the gap's landing edge.
  - **Probe:** I wrote a scripted jumper that uses `advanceFoxFlight` and the game's collision boxes. It tries every takeoff frame with tap, half and full holds, plus an optional second jump after landing.
    - Over 250 seeds × 30 stretches, there were **536** generated owls, and **178** were low.
    - For **65** of those 178, no plan passes for at least one of four wave timings. All 65 are low owls; examples are seed 4 stretch 2 (gap 102) and seed 13 stretch 2 (gap 93).
    - My reading: after a gap wider than about 75 px, the fox can't land and clear the owl in time.
  - **Why it matters:** this breaks design principle 4 ("every stretch the level generator makes can be cleared"). The new test checks only that owls stay above y 355, not that the fox can pass them.
  - **Status:** the problem is hidden today only because of P6-R2-01. Fixing that Blocker brings it out.
  - **Fix:** keep generated owls out of a running fox's hit band, or keep them away from gap landings. For example, use only heights whose lowest wave point stays more than 55 px above y 480, or place owls only on stretches whose gap the fox can clear before reaching them. Extend the fairness test with the owl's real path and hitbox, using a scripted jumper like the one above.
- **P6-R2-03** · `engine/client.ts:93`, `:96`, `:99`, `:107`; `games/arena-survivor/tests/smoke/smoke.spec.ts:350-352` — **The page reports itself ready before the test hook exists, and an Arena test failed on it in a clean clone.**
  - **What happened:** in clean clone 1, "one crowded Space attack keeps unrelated patches active" failed with "TypeError: Cannot read properties of undefined (reading 'game')" at `:352`. The page snapshot already showed "Arena Survivor · LIVE". Because the Arena suite failed, the Lantern suite and the HTTPS check never ran. Clean clone 2 passed.
  - **Cause:**
    - `start()` fills the patch list during `await sync()` (`:96`).
    - The WebSocket connect handler can set "LIVE" (`:93`).
    - Both happen before the awaited `/api/runs` fetch (`:99`).
    - Only after that fetch is `window.__livePatch` assigned (`:107`).
    - Tests wait for "LIVE" or for the patch list, then call `__livePatch` straight away. That covers about 110 uses across both game suites, and none waits for the hook itself.
  - **Background:** this has existed since Phase 5.5. Phase 6's per-game suite runs are where it showed up.
  - **Why it matters:** as with P6-R1-02, a judge's or Codex's first `npm test` can fail at random.
  - **Fix:** expose the test hook before the startup awaits. Or set "LIVE" only after the hook exists, and have the suites wait for the hook in their page setup. Then run two clean clones again.
- **P6-R2-04** · `games/lantern-run/tests/smoke/smoke.spec.ts:66-90` (the pause check at `:94-98` is real) — **The animation test can't fail.**
  - The fox crop (170×125 around the fox) also contains five scrolling parallax layers, the ground and weather. More than 150 changed pixels in 125 ms happen even if the fox were a still image. The owl and firefly crops also include their own movement across the screen.
  - This is the guard for the operator's main request, and it is the standing check "tests that cannot fail".
  - **Fix:** compare only the subject's own pixels, for example a mask of fox colours, or the rig's part angles over one stride. Then show that the test fails when the rig's update is skipped.
- **P6-R2-05** · `games/lantern-run/src/rig.ts`, `art-parts.ts`, `art-world.ts`, `main.ts:223-225`, `:342-352` — **The overhaul still misses the operator's quality bar ("same silhouettes, proportions, colours, faces and details") in places that show on every frame.**
  - **The fox, compared with concepts 02 and 06** (`run-cycle-vs-concept.png`, `run-sheet-60fps.png`):
    - The body is a hunched block under an oversized round head.
    - The legs are short stumps half hidden by the torso. At an exact 60 fps the stride is real but small, so it reads as a shuffle, not the concept's open running stride.
    - The stick starts at the head (`rig.ts:60`, at 35,-27, next to the head at 29,-31), so it pokes out of the face instead of being held by a front paw.
  - **The world:**
    - The fifth tree layer is drawn **over** the ground at 45% opacity (`main.ts:223-224`, depth 2 against the ground's depth 1). Ghost tree tops show on the moss and soil in every capture.
    - The moon is two offset discs (`art-world.ts:132`), so it looks like a double moon.
    - The lantern's light pool is a 170×60 texture holding a radius-83 glow (`art-parts.ts:80`). Its top and bottom are cut flat, so a bright box shows under the fox.
    - Spans that meet with no gap get pit edges, so dark vertical seams cross solid ground (`main.ts:348`).
    - Pits are flat dark rectangles, where concept 09 has rocky cliff faces.
    - The cloud strip ends in a hard vertical edge where its tile wraps.
    - In the run-over pose, the lantern sinks into the soil (`05-run-over.png`).
  - **Props:** the ledge is a flat slab with drips, not concept 10's floating island. The spring reads as a red disc.
  - **Evidence:** strip 07 was sampled at about 7 fps with 45 ms gaps, so it shows only two or three distinct poses. My fake-clock capture gives the true stride.
  - **Why Major:** the operator asked for this in this round, Codex marked P6-R1-08 fixed, and this art goes into the demo video. If the operator accepts the current look, this drops to Minor.
  - **Fix (smallest set, in order):**
    1. Rebuild the fox's proportions from concept 07: a smaller head, a longer body, visible two-part legs with a longer stride, and the stick held by a front paw.
    2. Move the fifth layer behind the ground, or stop it at the ground line.
    3. Make the moon a single disc with a halo.
    4. Make the light texture tall enough for its glow, or give it an elliptical gradient.
    5. Draw pit edges only where there is a gap.
    6. Give pits cliff faces.
    7. Keep the run-over lantern on the ground.
    8. Recapture strip 07 with a fixed time step.

### Minors
- **P6-R2-06** · `games/lantern-run/src/main.ts:230-232`, `:406` — **The HUD items have fixed positions, so long numbers overlap.**
  - The count starts at canvas x 61 and the distance at x 130.
  - Measured in the HUD font (bold, plus stroke):
    - at Large, **"999"** is 71 px wide and ends at x 132, on top of the distance;
    - at Normal, "1000" is 71 px wide;
    - at Large, "12345 m" is 146 px wide and ends at x 276, past the first heart at about x 257.
  - The count's pop scales it up by 1.2, which makes this worse. Firefly counts in the hundreds are normal on long runs or with a `fireflyValue` patch.
  - **Fix:** place each item from the measured width of the item before it, and size the zone (and its test) for the widest values you expect.

### Nits
- **P6-R2-07** · `games/lantern-run/src/main.ts:128` — **Test-only snapshot fields reach mutations.** `hudBounds` and `groundUnderFox` are now part of `game.state` that modules receive (`engine/mutation/host.ts:179`). The API doc doesn't list them, and the HUD bounds are computed on every event batch. Either document them, or expose them only to tests.

## Working well — do not change
- **The pit and milestone rework:**
  - a fall records its target span;
  - the respawn moves at most to that span;
  - every crossed 100 m mark is emitted (`main.ts:276`, `:290-297`).
- **The settings migration:** it runs once, only from a file without `overlayLayouts`, and saves drop the top-level field.
- **The shared physics step:** `games/lantern-run/src/physics.ts` is used by both the game and the fairness test.
- **Time-based animation that pause freezes:** the pause test compares two canvas screenshots, and the jump leaves the ground in the keydown handler.
- **The art budget:** parts are pre-rendered and animated with transforms. Visible WebGL holds about 58 fps at 1920×1080, even with every cap reached.
- **The cover:** a portrait WebP under 100 KB with a clear credit; the generic portrait class in the Library details is used only when the image is taller than wide.
- **The icon HUD and pill banner:** they stay inside their zones, and all text is Phaser text.

## Notes for the operator
- **Round 3 is the last round.**
  - **Smallest changes that clear the Blocker and Majors:**
    - R2-01: change one despawn bound and add one smoke test.
    - R2-02: drop or raise the lowest owl height and extend the fairness test.
    - R2-03: assign the test hook before the startup awaits.
    - R2-04: mask the animation test to the subject.
  - **R2-05 is the large item.** If time is short, items 2–5 and 7 in its list are quick. The fox rebuild (item 1) is the slow one.
- **A clean-clone `npm test` now takes about 8 minutes** (studio 1.2 min, Arena 3.3 min, Lantern 3.3 min, then HTTPS).
- **The leftover folders** from round 1 are still in `app_submission`: five `.live-patch-test-*` folders and an older `.test-runner-jhEObE` (27 Oct). They are ignored by git, and deleting them is up to you.
- **Cleanup:** I stopped my scratch studio. My scratch clones are deleted after this review. Nothing is pushed or tagged by me.
