# Phase 6 — Review round 3

## Verdict
Fail

Every round-2 finding is fixed, and Lantern Run now plays as designed:
- generated obstacles, owls, pickups and ledges reach the screen;
- every generated owl can be passed;
- the animation test has a real negative control;
- the art defects from round 2 are gone.

One Major is open. An old Arena Survivor test failed in one of my two clean clones because it depends on machine load. Phase 6 didn't add that test, and it's cheap to fix, but by the verdict rule it keeps this round at Fail. See the notes for the operator: this is the last review round, so the next step is the operator's choice.

How I verified, at `1a6c884` (`d4a4881..1a6c884`, one commit, local only):
- **Two clean clones** of the local repository in a scratch folder (no `.env`, no tokens), each running `npm ci` and `npm test`. The second also ran `npm run build` and `npm audit --audit-level=high`, and then the failing test five more times on its own.
- **A scratch studio** (`npx vite` with Lantern Run, test mode, HTTP port 5199):
  - headless probes of generated spawns (25 s and 60 s), the five-heart removal, pit falls, milestones and HUD bounds;
  - frames captured with Playwright's clock;
  - the visible built-in browser (WebGL, 1920×1080) for frame rate.
- **Three Node probes** that import the game's own `generator.ts` and `physics.ts`:
  - the farthest generated spawn position;
  - whether a scripted jumper can pass every generated owl, using the new 350 px owl offset;
  - spawn positions over 200 seeds at three speeds.
- **Screenshots** are in `D:\twitchconXcodex\plans\phase-6\review-r3\`.

## Exit criteria
- [x] **1. The engine stays game-agnostic.**
  - My search of `engine/` finds no import from `games/` and no game names, kinds or sounds.
  - The engine changes are generic:
    - an optional adapter `ready` promise (`engine/game-api.ts:5`, `engine/client.ts:97`);
    - the test hook exposed earlier (`engine/client.ts:47`);
    - the mutation load deadline now starts when the source is posted to the sandbox frame, with a separate 10 s frame-setup deadline (`engine/mutation/host.ts:126`, `:129`);
    - a watcher retry for locked files (`vite.config.ts:48-60`).
  - A module still gets exactly 3 s to load, and no manifest field can change that. The Arena load-deadline tests still pass.
- [x] **2. Tests are per game.**
  - Clean clone 1, `npm test`: vitest **104 passed, 4 skipped**; studio **30 passed**; Arena Survivor **36 passed, 1 skipped**; Lantern Run **26 passed**; HTTPS regression passed; exit 0.
  - Clean clone 2 failed one Arena test (P6-R3-01).
- [x] **3. Lantern Run is playable.**
  - **Generated spawns:** with no modules loaded, all **25 of 25** entities generated in 25 s reached a snapshot (round 2: 3 of 32). In 60 s, the game generated 57 fireflies, 7 logs, 3 boulders, 1 thorn bush, 3 acorns and 2 ledges. The ones that never appeared were cleared when the run restarted after pit falls.
  - **Despawn margin:** the farthest generated spawn over 200 seeds at 120, 260 and 600 px/s is screen x **2,150**, inside the new 2,252 bound (`games/lantern-run/src/main.ts:318`).
  - **Owl fairness:** my scripted jumper passes **every** generated owl: 0 of 536 fail (round 2: 65). The lowest owl now flies at y 389 or above, which clears a standing fox's hit band by 36 px.
- [x] **4. Lantern Run performs.**
  - The crowded-moment tests pass.
  - In the visible built-in browser at 1920×1080 (WebGL), the game ran at **58.9 fps**. Crowded to the 80-entity cap with rain, it ran at **58.4 fps**, with a worst gap of 70 ms.
- [x] **5. The mutation API is complete and safe.**
  - **Five-heart removal:** 5/5 → **3/3**, with frames running and no page errors.
  - **Pit falls:** six falls jumped 2–3 m each, and milestones ran 100, 200, 300 (and 400) in both runs.
  - **Docs:** the API doc describes the new owl heights and the diagnostic snapshot fields.
- [x] **6. Live Codex can build for it.** No new builds were run; the round-1 evidence stands.
- [x] **7. The studio works with it.** The studio suite passed (30) in both clones.
- [x] **8. The overlay respects each game.** At Large HUD size with 5 hearts, the HUD's right edge is at stream **x 560**, inside the 670 px zone. The new four-digit test passes.
- [x] **9. It looks like the concepts.**
  - `01-gameplay.png` now waits for naturally generated entities and injects none.
  - The report says which captures are staged.
  - Fixed since round 2:
    - one moon;
    - the fifth tree layer behind the ground;
    - rocky pits;
    - no seams on joined spans;
    - wrapping clouds;
    - a mushroom spring;
    - an island ledge;
    - a smaller head and a paw-held stick on the fox.
  - Two evidence strips have gaps (P6-R3-02), and the fox still differs from the concept's silhouette (P6-R3-04).
- [x] **10. The standing checks hold.**
  - Security: no new HTML sinks in the diff, no token-like strings, and no secret files in history.
  - The fox animation test now masks to fox colours and fails when `FoxRig.update` is disabled (`games/lantern-run/tests/smoke/smoke.spec.ts:102-125`).
- [x] **11. The docs are in sync.**
  - `docs/architecture.md` and `docs/adding-a-game.md` describe `ready`.
  - The report describes each staged capture.
  - One table overstates the jump strip (P6-R3-02).
- [x] **12. A clean clone passes.**
  - Clean clone 1 passed everything, with no `builds/` folder before or after.
  - In clean clone 2, `npm run build` exit 0, and `npm audit --audit-level=high` found **0 vulnerabilities**.
  - Codex ran only one clean clone this round. I ran the second.

## Previous findings
- **P6-R2-01 — Resolved.** The right-edge bound is now `WIDTH + 1100`. Generated entities survive: 25 of 25 in my probe, and the farthest spawn is at x 2,150. A new smoke test watches generated entities cross from beyond the old cutoff into view (`smoke.spec.ts:50`).
- **P6-R2-02 — Resolved.**
  - Owl heights are now 378, 353 and 328 (`games/lantern-run/src/generator.ts:15`), and owls start 350 px into their stretch (`main.ts:83`).
  - My scripted jumper passes all 536 generated owls.
  - The new unit test (`tests/phase6-generator.test.ts:34`) starts the owl at its offset and doesn't model the drift before the fox arrives, so my simulation is the stronger check. It agrees.
- **P6-R2-03 — Resolved.**
  - The hook is set before any startup wait (`engine/client.ts:47`).
  - A new Arena test delays `/api/runs` and checks the hook at both ready signals (`games/arena-survivor/tests/smoke/smoke.spec.ts:13`).
  - **Side effect:** a test that syncs modules before LIVE now gets overwritten by the page's own first sync. Codex's tests wait for LIVE; future tests must too.
- **P6-R2-04 — Resolved for the fox.** The masked crop has a real negative control. The owl and firefly checks were dropped: see P6-R3-03.
- **P6-R2-05 — Resolved**, apart from the silhouette notes in P6-R3-04. Every listed defect is fixed in code and visible in the captures and in the live game.
- **P6-R2-06 — Resolved.** The HUD lays out from measured widths and shrinks its font only when it must. A browser test collects over 1,000 fireflies at Large size.
- **P6-R2-07 — Resolved.** The doc names the diagnostic fields.

## Findings

### Majors
- **P6-R3-01** · `games/arena-survivor/tests/smoke/smoke.spec.ts:222-233` (with `engine/mutation/host.ts:34`, `:155-158`) — **"an action storm is throttled before it fills the arena" depends on machine load, and it failed in clean clone 2.**
  - **What happened:** the storm module loaded ("Storm · active"), but "actions skipped" never appeared within 5 s. Because the Arena suite failed, the Lantern suite and the HTTPS check didn't run in that clone.
  - **Reruns:** the test passed 5 of 5 times on its own and in clean clone 1. During the failed run, my browser pane was also running the game.
  - **Cause:**
    - The module spawns 10 coins per tick, and the host allows 60 actions per module per second.
    - So the throttle trips only if the game delivers more than 6 ticks a second to the module.
    - On a busy or slow machine, headless Arena can drop below that. The engine also merges skipped ticks into the next one.
  - **Background:** the test is older than Phase 6 and never failed in my earlier rounds.
  - **Why it matters:** this is the same risk as P6-R1-02 and P6-R2-03. A judge's or Codex's first `npm test` can fail at random. Phase 5's fresh-clone README check counts a failing step as a Blocker.
  - **Fix:**
    - Make the test exceed the limit whatever the frame rate. For example, spawn the batch maximum (20) per tick and allow 10 s. Or, better, prove the per-second budget in a unit test of the host with a fake clock, and keep the browser test only for "skipped actions are shown".
    - Then run two clean clones again.

### Minors
- **P6-R3-02** · `docs/phases/phase-6-visual/08-fox-jump.png`, `docs/phases/phase-6-report.md:93`, `scripts/capture-phase6.mjs:99-110` — **The jump strip doesn't show what its table claims.**
  - The table says the six captures show "takeoff, rise and a double-jump rotation". The new strip shows six nearly identical tucked poses, with no rotation.
  - The code does spin: my capture shows the fox mid-rotation inside the gold ring (`plans/phase-6/review-r3/fox-double-jump-round3.png`).
  - `07-fox-run-cycle.png` shows the fox with closed eyes in all eight frames: the stepped capture falls inside a blink or hurt state.
  - **Fix:** recapture both strips. Spread the jump strip over the whole arc, including the spin, and keep the eyes open in the run strip.
- **P6-R3-03** · `games/lantern-run/tests/smoke/smoke.spec.ts:102-125` — **The owl and firefly animation checks were dropped.**
  - Round 2's test also covered the owl and the firefly. The new masked version covers only the fox.
  - The owl and firefly rigs could stop animating with no test failing.
  - **Fix:** add masked checks for both, with the same negative control (disable `OwlRig.update` and `FireflyRig.update`).
- **P6-R3-04** · `games/lantern-run/src/rig.ts:40-110`, `src/art-parts.ts:30-80` — **The fox still differs from the concept's silhouette, and the light pool spills into the soil.**
  - **Silhouette, compared with concept 06:**
    - the fox runs low and horizontal on four legs, where the concept runs upright on its hind legs;
    - the tail is three visible blobs;
    - the ears and eyes are small;
    - the lantern is a cage, not a round paper lantern.
  - **Light pool:** the light is a 170 px round glow centred on the ground line (`rig.ts:42`), so half of it lights the soil.
  - **Severity:** this is Minor because the round-2 defects are fixed and what's left is a design gap. The operator has asked for a reference pack to close it in a polish round. See `plans/phase-6/reference/` (outside the repo).

### Nits
- **P6-R3-05** · `games/lantern-run/src/main.ts:318` — **The despawn bound is set by hand.**
  - `WIDTH + 1100` comes from the generator's lead (`WIDTH + 500`), its 150 px maximum gap and the 350 px ledge and owl offset, which leaves a 102 px margin.
  - Derive it from those values, so that a later generator change can't silently cut generated entities again. The new smoke test is the safety net.

## Working well — do not change
- **The generated-entity smoke test:** it records entities beyond the old cutoff and requires both a pickup and a hazard to reach the playfield.
- **The masked fox animation test:** it disables the rig and checks that the change drops to near zero.
- **The startup order:**
  - the hook is set first;
  - then `ready`, sync and LIVE;
  - the module's 3 s budget is unchanged.
- **Owl heights:** they keep owls out of a running fox's hit band, while still punishing a badly timed jump.
- **The HUD:** it lays itself out from measured text widths.
- **Honest captures:** the report says which captures are staged and which aren't, and 01 uses natural spawns.
- **Visible-GPU frame rate:** about 58 fps at stream size, even at the entity cap.

## Notes for the operator
- **This was review round 3, the last allowed for Phase 6.**
  - The only open item that blocks a pass is P6-R3-01, an old Arena test that depends on load.
  - **Smallest change that clears it:** have the storm module emit 20 actions per tick and wait up to 10 s, or move the budget check into a unit test with a fake clock.
  - **Your choice:** one small Codex fix plus a two-clone rerun, or close Phase 6 and carry P6-R3-01 into Phase 5 as a Deferred item that must be fixed before the judge run.
- **The reference pack** you asked for is in `D:\twitchconXcodex\plans\phase-6\reference\`. Its Codex prompt is meant for a polish round after this review.
- **A clean-clone `npm test` takes about 7–8 minutes** (studio 0.8 min, Arena 2.5–3.1 min, Lantern 3.3 min, then HTTPS).
- **Leftovers** for you to delete:
  - Codex's verification clone `D:\twitchconXcodex\phase6-r2-clean-a-20261101` (742 MB, no links inside, no `.env`);
  - the five old `.live-patch-test-*` folders and `.test-runner-jhEObE` in `app_submission`.
- **Cleanup:** I stopped my scratch studio. My scratch clones are deleted after this review. Nothing is pushed or tagged by me.
