# Phase 6 — Review round 1

## Verdict
Fail

The platform work is solid. The engine names no game, the studio suite is split cleanly, Lantern Run plays, and three real Codex builds shipped. But one Blocker and five Majors are open:
- a patch that raises `maxHearts` freezes the whole game when it is removed;
- the Library switch test is flaky in a fresh clone;
- overlay layouts leak from Lantern Run into Arena Survivor;
- the HUD sits outside its own keep-clear zone;
- a pit fall skips the next ground and its milestones;
- owls neither glide nor vary in height, although the report says they do.

How I verified, at `deab45e` (`b3a4de0..deab45e`, six commits, local only):
- **Two clean clones** of the local repository in a scratch folder (no `.env`, no tokens). Each ran `npm ci` and `npm test`; the second also ran `npm run build` and `npm audit --audit-level=high`. I also ran the studio suite with `LIVE_PATCH_GAME=games/lantern-run`.
- **Re-runs of the Library switch test alone:** twice with a warm Vite cache, and once after deleting `node_modules/.vite`.
- **A scratch studio** (`npm run dev` with Lantern Run, test mode, HTTP port 5199):
  - headless Chromium probes of hearts, pit falls and HUD bounds;
  - a walkthrough of Practice, Play, Go Live and the OBS overlay.
- **A vitest probe** of the per-game settings store.
- **Codex's local session logs**, for the three real builds. I read only file names, working folders and event types.
- **Screenshots** are in `D:\twitchconXcodex\plans\phase-6\review-r1\`.

## Exit criteria
- [x] **1. The engine stays game-agnostic.**
  - My own search of `engine/` (`.ts`, `.css` and `.html`, tests excluded) finds no import from `games/`. It also finds none of: `arena`, `lantern`, `fox`, `slime`, `coin`, `enemy`, `bomb`, `owl`, `pinecone`, `firefl`, `acorn`, `thorns`, `boulder`, `ledge`, `glider`, `magnet`, `spring`, `shield`, `run-over`, `heart`. The root HTML pages and `vite.config.ts` have no game names either.
  - Arena's HUD zone and default layout now live in its manifest (`games/arena-survivor/live-patch.json:23-31`), and its 35 smoke tests pass.
  - The diff touches nothing under `engine/runner/`, `engine/mutation/` or `engine/manifest/load.ts`, so the gates are unchanged.
- [x] **2. Tests are per game.**
  - Clean clone 2, `npm test`: vitest **100 passed, 4 skipped**; studio **30 passed**; Arena Survivor **35 passed, 1 skipped** (opt-in WebGL); Lantern Run **20 passed**; then "HTTPS regression passed…"; exit 0.
  - With `LIVE_PATCH_GAME=games/lantern-run`, the studio suite ("Browser suite: studio · Lantern Run") gave **30 passed**.
  - Every test name from the old Arena suite is still present; one was renamed, and two are new.
  - The Library switch test is flaky: see P6-R1-02.
- [x] **3. Lantern Run is playable.**
  - Space, W, Up and click jump, and the pause freezes frames (smoke test, both clones).
  - The 250-seed generator test passes.
  - Run over and the 2-second restart work.
  - In my probe, hearts, invulnerability and the run-over card behaved as specified.
  - Pit respawn doesn't put the fox on the *next* ground: see P6-R1-05.
- [x] **4. Lantern Run performs.** "a crowded storm stays bounded without disabling an unrelated patch" and "a mutation action storm is throttled by the host" pass in both clones.
- [ ] **5. The mutation API is complete and safe.**
  - The manifest and the doc match (`tests/phase6-contract.test.ts`), and all six fixtures pass with their triggers.
  - But rollback isn't safe: removing a module that raised `maxHearts` freezes the game (P6-R1-01).
  - And the documented "milestone every 100 metres" doesn't hold after a pit fall (P6-R1-05).
- [x] **6. Live Codex can build for it.**
  - The report lists 3/3 shipped (`phase-6-report.md:43-47`).
  - Codex's local session logs agree. There are three sessions on 1 Nov, started at 03:08:47, 03:09:31 and 03:10:09, one per pitch.
  - Each session's working folder carries a run ID that matches the shipped file name (`6b6860ad…`, `8a710321…`, `8cc335c5…`), and each ends with `task_complete`.
  - The verification clone was deleted, so I couldn't see the gate and smoke steps myself.
- [x] **7. The studio works with it.** In my scratch studio with Lantern Run:
  - Practice's placeholder read "!idea The fox can double jump".
  - A full practice round shipped "Demo: Firefly Swarm".
  - Play listed the three built-ins plus the demo as active.
  - Go Live mirrored the game, and Active patches showed 4 (`w3-go-live.png`).
  - Codex's saved-build test reopens Lantern Run's original and evolved views (passed in both clones).
- [ ] **8. The overlay respects each game.**
  - Lantern Run's default layout has no overlaps (unit test). The OBS page used it exactly: 24,140,380×340 · 24,500,380×300 · 880,175,1010×320 · 560,1004,1336×58.
  - But layouts leak between games (P6-R1-03).
  - And the HUD zone doesn't contain the HUD (P6-R1-04).
- [x] **9. It looks like the concepts.**
  - The four captures exist at 1920×1080, and the report has a table for each.
  - The tables leave out several real differences: see P6-R1-08 and P6-R1-09.
- [x] **10. The standing checks hold.**
  - The only added `innerHTML` is the existing static Practice template (`engine/twitch/simulator.ts:4`).
  - Game text uses Phaser text objects, and the speech-bubble fixture test sends `<img src=x onerror=…>` with no `img` created.
  - There are no changes under `engine/runner`, `engine/mutation` or `engine/manifest/load.ts`.
  - There are no token-like strings in the diff.
- [ ] **11. The docs are in sync.**
  - The Lantern API doc promises a milestone every 100 m (P6-R1-05) and doesn't state the load deadline (P6-R1-10).
  - The report claims variable-height owls (P6-R1-06) and contradicts itself on criterion 6 (P6-R1-11).
- [x] **12. A clean clone passes.**
  - Clean clone 2: `npm test` exit 0, and no `builds/` folder before or after. `npm run build` exit 0. `npm audit --audit-level=high`: **0 vulnerabilities**.
  - Clean clone 1 failed one studio test on its first run (P6-R1-02).

## Findings

### Blockers
- **P6-R1-01** · `games/lantern-run/src/main.ts:325` (with `:112-116`) — **Lowering `maxHearts` below the current hearts throws on every frame, and the game freezes for good.**
  - **Cause:** the HUD builds its empty hearts with `'♡'.repeat(player.maxHearts - player.hearts)`. When a write is removed or replaced, `recomputeParameter` lowers `player.maxHearts` but leaves `player.hearts` above it. A negative `repeat` throws a `RangeError` inside `draw()`. Phaser schedules the next frame only after its callback returns (`node_modules/phaser/src/dom/RequestAnimationFrame.js:89-96`), so the game loop stops.
  - **Probe:** a module ran `onStart(game){ game.setParameter('maxHearts',5); game.heal(2); }`, and then I removed it with `host.sync([])`, as a rollback does. Before removal: hearts **5/5**. After: hearts 5/3, **0 frames in 1.5 s**, the distance stuck at 85 m, and the page error "Invalid count value: -2" (`p1-after-maxhearts-removal.png`).
  - **Other triggers:** the same freeze follows when such a module crashes and is disabled, when it is edited, or when a second module sets a lower `maxHearts`. Any run that started while the 5-heart patch was active also starts with 5 hearts.
  - **Why it matters:** this is the standing check "a crashing mutation can take down the game". On stream, a `!rollback` of a "more hearts" idea would freeze the game until the page is reloaded.
  - **Fix:**
    - When `maxHearts` is recomputed, clamp the current hearts to the new maximum. Also make the HUD string safe against a negative count.
    - Add a smoke test that raises `maxHearts`, heals, removes the module and checks that frames keep advancing.
    - Consider whether any other draw-time value can be pushed out of range by a removal.

### Majors
- **P6-R1-02** · `tests/browser/studio.spec.ts:630-634` — **The Library switch test is flaky in a fresh clone.**
  - **What happened:** in clean clone 1, the first `npm test` failed "Library switches both built-in games and the OBS layout follows the active manifest". The failure was "Timeout 15000ms exceeded while waiting on the predicate", while it loaded `/overlay.html` after the server restart. The page snapshot was still on Library. Because the studio suite failed, both game suites and the HTTPS check never ran.
  - **Re-runs:** the same test alone passed in 4.6 s and 3.6 s with a warm cache. With `node_modules/.vite` deleted it passed in **13.4 s**, against the step's 15 s budget. In clean clone 2 it passed in 4.2 s.
  - **Why it matters:** a judge's or Codex's first `npm test` can fail on a cold machine. The log shows Vite "Re-optimizing dependencies because vite config has changed" around the restart.
  - **Fix:** after the switch, wait until the restarted server has settled before the overlay step. For example, poll until the overlay page loads, or until the dependency re-optimization reload has finished. Give that step a budget at least as long as the 20 s switch poll. Then show two `npm test` runs in two new clean clones in the report.
- **P6-R1-03** · `engine/studio/settings.ts:40-42`, `:52` — **Overlay layouts leak from Lantern Run into Arena Survivor.**
  - **Cause:** every settings save writes the active game's widgets to the top-level `overlayWidgets` field. On the next start, if Arena's key is missing, that field is treated as a legacy layout and copied to Arena's key.
  - **Probe** (vitest, in the scratch clone; a settings store constructed with the same options the server passes):
    1. A fresh install starts with Lantern Run active, and only `musicVolume` changes.
    2. The file then has `overlayWidgets` and an empty `overlayLayouts`.
    3. After switching to Arena, Arena's ballot is at **880,175**, which is Lantern's default, instead of Arena's own 24,650.
  - **A plausible path:** a judge opens the studio in Arena without saving anything, switches to Lantern Run, presses **M** in Play (mute saves settings, `engine/play-menu.ts:23-28`), and switches back. Arena's ballot then sits over the top right of the arena.
  - Codex's switch test doesn't save anything between the two switches, so it can't catch this.
  - **Fix:**
    - Migrate the legacy field only from a file that has no `overlayLayouts` yet.
    - Once layouts are per game, stop writing the top-level `overlayWidgets`, or ignore it.
    - Add a test of this path.
- **P6-R1-04** · `games/lantern-run/src/main.ts:203-205`, `games/lantern-run/live-patch.json` `overlay.keepClear[0]` — **The HUD is wider than its keep-clear zone.**
  - **Measurement:** the "Game HUD" zone is 0,0,460×130, but the hearts start at canvas x 340. Measured in stream pixels on `/play` at 1920×1080, the hearts end at **x 648**. With HUD size Large and 5 hearts, they end at **x 737** (`p3-hud-default.png`, `p3-hud-large-five-hearts.png`).
  - **Why it matters:**
    - The spec asks for the HUD "inside the game's HUD keep-clear zone". Here the overlay editor and placement let a widget cover the hearts without a warning.
    - At Large with 5 hearts, the hearts reach into the engine's patch-toast zone (685–1235 × 60–170), so a ship toast covers them.
    - The concepts' HUD is compact, ending around x 470.
  - **Fix:** pack the three HUD items closer, as in concept 01. Size the zone to the widest HUD (Large, 5 hearts), and keep it clear of the toast zone. Add a test that measures the HUD text bounds against the zone.
- **P6-R1-05** · `games/lantern-run/src/main.ts:255-259` (with `:240-241`) — **A pit fall respawns the fox past the next ground and skips milestones.**
  - **Cause:**
    - The fox keeps moving forward while it falls (about 0.5 s). When it reaches y > 688 it is usually already under the next ground span.
    - `spans.find(span => span.from > at)` then returns the span *after* that one, and the world jumps forward by a whole span.
    - The milestone check runs before the jump and compares only against the previous frame, so a crossed 100 m mark never fires.
  - **Probe** (no jumping, a module recording milestones; distances by frame around each respawn):
    - **249 → 252 → 345 m**, and **231 → 301 m**: jumps of 70–93 m in one frame. Two other falls jumped only 8–10 m.
    - **The 300 m milestone never fired in either run.** Run 1 went 200 → 400 → 500; run 2 went 100 → 200 → 400.
  - **Why it matters:**
    - The spec says the fox "reappears on the next ground".
    - `docs/mutation-api.md` promises `milestone` "every 100 metres", which is a mutation API mismatch. Live Codex's own third build ("a spring every 200 meters") and two of the six documented sketches depend on it.
    - A fall also hands out up to 90 free metres.
  - **Fix:** respawn on the ground span that follows the gap the fox fell into. Emit every milestone crossed when the distance changes in one step, or document that milestones may be skipped. Add a smoke test that forces a fall and checks the respawn position and the milestone sequence.
- **P6-R1-06** · `games/lantern-run/src/main.ts:69`, `docs/phases/phase-6-report.md:121` — **Owls don't glide or vary in height, but the report says they do.**
  - Generated owls always spawn at `GROUND - 125`, with zero velocity, and nothing moves them.
  - The spec asks for "owls that glide at varying heights". The report's Deferred list cuts only "a second owl motion pattern", and it says "the playable game retains … variable-height owls". The first pattern doesn't exist either.
  - This is the standing demo-honesty check.
  - **Fix:** give generated owls a glide (for example, a slow drift with a gentle bob) at a few seeded heights, and keep them inside the fairness bounds. Or move owls to Deferred and correct the sentence.

### Minors
- **P6-R1-07** · `games/lantern-run/src/generator.ts:28-30`, `tests/phase6-generator.test.ts` — **The fairness test checks the generator against a copy of its own formula.**
  - `stretchIsClearable` restates the bound that `generateStretch` already applies, so the test can't find a physics mismatch. It also doesn't cover obstacle spacing or ledge heights, which the spec names, and the reduced-ability case checks only stretch 10.
  - **Ledges:** a simulation of the game's own jump step (semi-implicit, 60 fps) peaks at **156 px** for a tap and 185 px for a full hold. A generated ledge (y 363) needs **171 px**, so ledges are reachable only with a held jump.
  - The smoke test's ledge sits lower, at y 400, so it doesn't show that generated ledges are reachable.
  - **Fix:** drive the check with the game's own step function and a scripted jumper across the seeds. Include obstacle-to-gap spacing and a held-jump ledge landing.
- **P6-R1-08** · `games/lantern-run/src/art.ts:83-95`, `docs/phases/phase-6-report.md:55-77` — **The art is well below the concepts in places, and the tables don't say so.**
  - **Sprites:**
    - the owl is a head with small ellipse wings, where concept 02 shows spread wings;
    - ledges are flat grey slabs, where the concept shows mossy floating islands;
    - the fox's lantern is a small square with no pole or satchel;
    - the amber horizon shows as a jagged band behind the near trees in every capture.
  - **The run-over card** has no Space keycap, divider or rounded corners. Appendix 3 row 05 names the keycap.
  - **`04-evolved.png`** catches the fox mid-fall in a pit, half below the frame.
  - **The tables** mention only "simpler shapes" for the trees.
  - **Fix:** improve the cheap ones: owl wings, a mossy ledge, a lantern on a pole, the keycap card, a smoother horizon. Recapture 04 with the fox visible, and list the real differences in the tables.
- **P6-R1-09** · `games/lantern-run/assets/generate-cover.mjs:17` — **The cover is cropped badly on its card.** The cover is landscape (768×512), but Library cards are portrait. In `06-library.png` the card cuts the fox in half at its right edge, and the owl is barely visible. Compose a portrait cover (the plan's concept 03 is portrait), or centre the subject so the card crop keeps it.
- **P6-R1-10** · `games/lantern-run/docs/mutation-api.md:3`, `tests/phase55.test.ts:23-26` — **The Lantern API doc doesn't state the 3 second load deadline.**
  - The doc gives the event deadline but not the load deadline. Arena's doc states it, and since Phase 5.5 a test ties that sentence to `LOAD_DEADLINE_MS`, but only for Arena.
  - **Fix:** add the sentence, and run the doc test over every built-in game's API doc.
- **P6-R1-11** · `docs/phases/phase-6-report.md:126` — **The report contradicts itself on criterion 6.** "Known gaps" ends with "criterion 6 remains open", while criterion 6 is checked as met with three shipped builds. Correct or remove the stale sentence.

### Nits
- **P6-R1-12** · `games/lantern-run/src/main.ts:265` — **Fast entities moving right never despawn.** Entities are removed only when they leave the left edge. An entity given a rightward velocity faster than the run speed drifts off to the right and keeps its cap slot until the run ends. Also remove entities well past the right edge.

## Working well — do not change
- **The platform split:**
  - `tests/browser/` runs once with whichever game is selected;
  - each game's suite runs in its own isolated catalog copy;
  - `npm run smoke` still runs only the active game.
- **The manifest-driven studio:** the `samplePitches` and `overlay` schemas are bounded (3–6 pitches, 6 zones, 4 widgets). The engine keeps only the toast zone, and triage receives game metadata as JSON data.
- **The Lantern Run adapter's ownership model:**
  - parameter and weather writes are ordered per module, so the last remaining write wins;
  - granted power-ups are keyed by owner;
  - drawings, labels and particles are tracked per module;
  - one 64-particle budget covers effects and weather.
- **Entity caps:**
  - the 150 px hazard safe zone applies to mutation spawns too;
  - `drawText` and `showMessage` use Phaser text, never HTML.
- **The `verify-phase6-live.mjs` gate:** it's repeatable, it exits non-zero below two shipped builds, and it is kept out of `npm test`.
- **The real build evidence:** the three builds ran fast (36–44 s).

## Notes for the operator
- **Round 2 must fix:** P6-R1-01 to P6-R1-06. The Minors can wait for Phase 5's batch, but R1-08 and R1-09 affect the demo video, if you plan to show Lantern Run in it.
- **A clean-clone `npm test` takes about 7 minutes now** (studio 1.1 min, Arena 3.2 min, Lantern 2.3 min, then HTTPS).
- **Leftover folders** still yours to delete: the five old `.live-patch-test-*` folders in `app_submission` (2EbgTp, 5XNASn, 7XbNYR, WIIqxM, studio). `games\phase45-switch-probe` and the round-5 temp clone are gone.
- **Cleanup:** I stopped my scratch studio. My two scratch clones are deleted after this review. Nothing is pushed or tagged by me.
