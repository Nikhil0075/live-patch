# Phase 6 report

## Base

Phase 6 starts from `b3a4de0` (`phase 5.5: fixes for round 6`). The operator's review-file commit `cc85a2a` is the checked-out HEAD before Phase 6 work.

## Built

### Step 1 — platform browser tests

- Moved studio, Practice, Go Live, Library, Setup, overlay and security browser checks to `tests/browser/studio.spec.ts`. Their demo title, game name and built-in count come from the active manifest.
- Kept Arena Survivor play, mutation, fault isolation and saved-build checks in its own smoke suite.
- `npm test` now runs the studio suite once, then every built-in game suite in a separate copy. `npm run smoke` stays scoped to the active game's mutation gate.

### Step 2 — manifest-driven studio behavior

- The manifest accepts optional sample pitches and OBS keep-clear zones and widget defaults. Arena Survivor's exact existing pitches, HUD zone and layout moved into its manifest. The engine retains only the patch-toast zone and a generic fallback layout.
- Studio settings keep layouts by game key. On first load, the legacy single layout is copied to the package default game's key, preserving the operator's saved positions even if another game is selected first.
- Practice reads the active manifest's sample pitches, the overlay editor and server use its zones and layout, and AI triage receives its name, description and hint as data. Adapter `systemEvent` cues and optional methods are documented; the new-game template shows the fields.

### Step 3 — Lantern Run core

- Added a separately loadable Phaser runner with one-button jumping, scrolling ground and hazards, firefly and acorn collection, three hearts, pit recovery, a run-over card and a two-second automatic restart. The later visual round replaced its static poses with code-drawn part rigs, five parallax layers and a foreground layer. Its Web Audio adapter synthesizes cues and a short looping melody.
- The stretch generator derives gap width from the current jump reach. Unit tests cover 250 seeds at default and reduced jump ability. A browser smoke check verifies a running Lantern Run session advances.

### Step 4 — mutation API

- Defined Lantern Run's actions and hooks in the manifest and API reference, with a unit test comparing their names exactly. The adapter bounds every action, caps each entity category and the total at 80, and tracks module-owned entities, parameter and weather writes, granted power-ups, text and effects for rollback.
- Added three built-in modules using five hook types, a labelled Practice demo, and six runnable idea fixtures. The browser suite triggers each fixture and checks it remains active. It also checks keys and touch input, ledge and pit hooks, run over and restart, crowded rendering, throttling, rollback, and faulty modules.

### Step 5 — studio integration and visuals

- Shipped the operator-approved OpenArt portrait cover as a 96 KB WebP and recorded its origin in `assets/CREDITS.md`. All game art remains code-drawn; no concept image is loaded by the game.
- The isolated browser catalog now contains a copy of each built-in game, so Library switching in tests does not touch the live game folders. A browser test switches both ways and checks that the OBS page follows each saved layout. Another saves Lantern Run and opens its original and evolved views. The selected-game studio suite exercises its Practice demo and Go Live mirror.
- Captured four 1920×1080 views, four animation strips and a 1280×720 motion video in `docs/phases/phase-6-visual/`; comparisons and measured differences are below.

### Step 6 — real-build and clean-clone verification

- Submitted three different Lantern Run pitches through the simulator's normal `!idea` and moderator `!approve` path in a temporary full clone. Each produced a real Codex thread, passed the runner's gates and combined smoke test, and shipped. Exactly three real Codex builds ran, matching the operator's allowance.
- The first clone was under Windows' temp directory. Three attempted approvals there failed the sandbox preflight before invoking Codex because that sandbox permits writes to another temp path. A direct probe confirmed that writes to the project on `D:` are blocked. I placed the verification clone beside the project on `D:` for the three real builds; the sandbox probe passed without changing or weakening it.
- In a separate fresh clone, `npm ci`, `npm test`, `npm run build` and `npm audit --audit-level=high` passed. The clone had no `builds/` directory before or after testing and was deleted. The live-verification clones were also deleted.

| Pitch | Result | Time taken | Failure reason |
|---|---|---|---|
| The fox can double jump | Shipped `patch-6b6860ad0a4f.js` | 43,601 ms | — |
| Make the forest rainy and slow the fox a little | Shipped `patch-8a710321169c.js` | 35,863 ms | — |
| Spawn a mushroom spring ahead of the fox every 200 meters | Shipped `patch-8cc335c5a3ed.js` | 36,836 ms | — |

`node scripts/verify-phase6-live.mjs` is the repeatable isolated check. It exits unsuccessfully when fewer than two of its three builds ship. Do not rerun it without operator approval for three more Codex builds.

## Final stream layout

All rectangles below are `(x,y,width,height)` in a 1920×1080 capture. The engine patch-toast zone is `(685,60,550,110)`. Lantern Run protects its icon HUD `(0,0,670,130)` and run lane `(420,500,1500,364)`. Its defaults are patch card `(24,140,380,340)`, Codex card `(24,500,380,300)`, ballot `(880,175,1010,320)` and ticker `(560,1004,1336,58)`. The unit test checks every pair and every protected zone, including the ballot's required height. A narrower ballot keeps its readable height even when no collision-free location exists; the editor warns the operator instead of clipping choices.

## Visual overhaul

The first four captures below are 1920×1080. The strips are cropped from the running game at 1280×720; the run strip samples real game time at roughly 37 ms intervals, and the jump strip briefly pauses between screenshots so capture latency cannot shift the subject out of frame. The nine-second 1280×720 WebM is a Playwright recording edited in browser Canvas and MediaRecorder without a new dependency. `01-gameplay.png` waits for a naturally generated pickup and hazard and injects none; it restores the default run speed and three-heart HUD before capture. `04-evolved.png` loads five prepared modules and one visual-only module that spawns an owl, two ledges and a spring. `05-run-over.png` injects boulders for a repeatable death pose. The owl, firefly and prop strips and motion video also stage their subjects; they demonstrate art and animation, not natural generator frequency.

### `01-gameplay.png`

| Matches the concept | Differs and why |
|---|---|
| The upright courier and flat lantern light resemble R1/R2. Natural fireflies, thorns, a ledge and two rocky pits cross the moss and root ground strip of R3; the heart HUD shows the actual run state. Both visible pit walls align with the grass lip. | Ground begins at 80% of the canvas for the OBS ticker; the bridge and stone lantern are omitted per Appendix 3 row `01-gameplay.png`. The code-drawn pines and soil retain more geometric edges than R2/R3. |

### `04-evolved.png`

| Matches the concept | Differs and why |
|---|---|
| Six active modules including the demo create rain, a pulsing shield, a boss-sized flying owl, extra fireflies, mossy ledges and an animated spring. The upright fox and forest layers follow R1/R2; the pill banner sits below the patch-toast zone. | The castle is omitted and banner/HUD use the corrected positions in Appendix 3 row `04-evolved.png`. The pines remain less organic than R3. This is a local visual scenario, not a claim that these particular modules were shipped by live Codex. |

### `05-run-over.png`

| Matches the concept | Differs and why |
|---|---|
| The fox rests with closed eyes and a dropped glowing lantern. A rounded amber card with leaf corners, divider and Space keycap shows real distance, fireflies, session best and countdown; the HUD shows empty drawn hearts. R3's moss and cliff treatment remains visible behind the card. | The shrine, gate and house are omitted per Appendix 3 row `05-run-over.png`. The card uses the live countdown and a compact Space keycap instead of a separate full-width button. |

### `06-library.png`

| Matches the concept | Differs and why |
|---|---|
| Both ready-to-play games have illustrated covers. Lantern Run's portrait OpenArt cover keeps the owl and fox visible on the card and in the details panel; controls, hooks, actions, audio and effects are listed. | This is the shipped studio's Library layout. Appendix 3 row `03-cover.png` omits the castle and town; the approved new cover keeps the forest and river. The details panel contains the portrait image in a landscape slot, leaving dark side bars to preserve both characters. |

### `07-fox-run-cycle.png`

| Concepts | Matches | Differs and why |
|---|---|---|
| `02-art-sheet.png`, `06-fox-animation.png` row 1, R1 | Eight roughly 37 ms samples show an upright torso, opposing hind-leg stride, a two-part swinging free arm, tail, satchel and lantern follow-through. The two-part holding arm reaches the branch, and its paw wraps around the stick line. | One frame catches a natural blink. The painted R1 silhouette has a wider stride and softer fur than the code-drawn textures. |

### `08-fox-jump.png`

| Concepts | Matches | Differs and why |
|---|---|---|
| `06-fox-animation.png` rows 2–3, `11-effects.png`, R1 | Nine captures show takeoff, rise, the double-jump rotation with lantern and tail following, fall and landing. The jump begins on the input frame. | Glider, hurt and pit recovery poses are visible in play rather than this strip. The spin is angular compared with R1's flowing drawn poses. |

### `09-owl-flight.png`

| Concepts | Matches | Differs and why |
|---|---|---|
| `02-art-sheet.png`, `08-owl-animation.png` | Six captures show the owl facing the fox with spread two-part wings at visibly different flap angles, amber eyes, ear tufts and talons. | The code-drawn feathers are simpler than the painted sheet. There is one glide/flap path and a brief drop pose; a separate dive/perch pattern remains a permitted late cut. |

### `10-props.png`

| Concepts | Matches | Differs and why |
|---|---|---|
| `10-props-animation.png`, `12-ui-kit.png` | Crops show a glowing winged firefly, mushroom spring, mossy island ledge and amber shield. Acorn, log stack, thorns, boulder, pinecone, glider and magnet are also code-drawn textures in the running game. | The strip is four subjects rather than every prop frame; the remaining props can be inspected in play. Geometric details are less textured than the concept. |

### `lantern-run-motion.webm`

| Concepts | Matches | Differs and why |
|---|---|---|
| `05-run-over.png`, `06-fox-animation.png`, `08-owl-animation.png`, `10-props-animation.png`, `11-effects.png` | The roughly nine-second, 1280×720, 1.61 MB clip shows running, ledge landing, two jumps including a spin, an owl, a firefly collection, hits and the run-over card. All displayed counters are live game state. | The browser recording is silent and plays the source at 1.08× to fit the requested duration; it does not demonstrate the separate glider and weather modes. |

### Crowded rendering measurement

`node scripts/probe-phase6-fps.mjs` in headless Chromium at 1920×1080, after two seconds of baseline play and 1.6 seconds of the same capped 80-entity storm used by the smoke test:

| Revision | Baseline frame rate | Crowded frame rate | Worst frame gap |
|---|---:|---:|---:|
| `deab45e` before overhaul | 13.2 fps | 10.2 fps | 175.3 ms |
| `df4cadc` after overhaul | 7.7 fps | 6.1 fps | 291.1 ms |

The richer layers and animated parts cost headless Chromium throughput. The old revision was measured from a temporary worktree whose linked `node_modules` caused Vite to block font files, so the two rates are directional rather than a controlled visual comparison. The crowded smoke test still passes its existing requirements: at most 80 entities and 64 particles, worst gap below 350 ms, and crowded frame rate above 55% of the baseline. The round-2 reviewer measured 58.3 fps in a visible 1920×1080 WebGL browser and 58.9 fps with 57 entities, 64 particles and rain; those visible-GPU results better represent this operator's stream PC than the headless probe. They do not establish performance on other PCs.

## How to run and test

- Step 1: `npm test` — 92 unit tests passed (4 opt-in skipped); studio suite 28 passed; Arena Survivor suite 35 passed (1 opt-in WebGL skipped); HTTPS/HTTP2 regression passed. `npx tsc --noEmit` passed.
- Step 2: `npm test` — 94 unit tests passed (4 skipped), 29 studio browser tests passed, 35 Arena Survivor browser tests passed (1 WebGL skipped), HTTPS/HTTP2 regression passed. `npm run build` passed; `npm audit --audit-level=high` found 0 vulnerabilities.
- Step 3: `npm test` — 96 unit tests passed (4 skipped), 29 studio browser tests passed, 35 Arena Survivor browser tests passed (1 WebGL skipped), 1 Lantern Run smoke test passed, HTTPS/HTTP2 regression passed. `npm run build` passed.
- Step 4: `npm test` — 98 unit tests passed (4 skipped), 29 studio tests passed, 35 Arena Survivor smoke tests passed (1 optional WebGL test skipped), 19 Lantern Run smoke tests passed, HTTPS/HTTP2 regression passed; `builds/` unchanged. `npm run build` passed.
- Step 5, Lantern selected: `$env:LIVE_PATCH_GAME='games/lantern-run'; npm test` — 100 unit tests passed (4 skipped), 30 studio tests passed, 35 Arena Survivor smoke tests passed (1 optional WebGL test skipped), 20 Lantern Run smoke tests passed, HTTPS/HTTP2 regression passed; `builds/` unchanged.
- Step 5, Arena selected: `npm test` — the same 100 unit, 30 studio, 35 Arena, 20 Lantern and HTTPS/HTTP2 checks passed; `builds/` unchanged. `npm run build` passed and `npm audit --audit-level=high` found 0 vulnerabilities.
- Step 6, clean clone at `D:\twitchconXcodex\phase6-clean-clone-20261101` (deleted): `npm ci` added 49 packages, 0 vulnerabilities; `npm test` passed 100 unit (4 opt-in skipped), 30 studio, 35 Arena (1 optional WebGL skipped), 20 Lantern and HTTPS/HTTP2; `npm run build` passed; `npm audit --audit-level=high` found 0 vulnerabilities. `Test-Path ...\builds` was `False` both before and after `npm test`.
- Step 6, live verification: `node scripts/verify-phase6-live.mjs` on the `D:` verification clone returned `SUMMARY: 3/3 shipped` and exit 0. The three `durationMs` values and mutation filenames are in the table above. The temporary clone was deleted.
- Spec copy: a normalized text comparison of `docs/phases/phase-6.md` with the plan's `## Spec` section printed `Spec unchanged: true`.
- Round 1 functional fixes: `npm test` passed 103 unit (4 opt-in skipped), 30 studio, 35 Arena (1 optional WebGL skipped), 23 Lantern, and HTTPS/HTTP2; the test runner reported no `builds/` change.
- An initial Round 1 clone run exposed a flaky three-hit test: at maximum speed its third boulder could meet the fox over a generated pit. The test now uses the first continuous stretch at minimum speed. That failed clone was deleted before the final verification runs.
- Round 1 final verification, first fresh clone at `D:\twitchconXcodex\phase6-r1-clone-a2` (deleted): `npm ci` added 49 packages; `npm test` passed 103 unit (4 opt-in skipped), 30 studio, 35 Arena (1 optional WebGL skipped), 24 Lantern, and HTTPS/HTTP2. `npm run build` passed; `npm audit --audit-level=high` found 0 vulnerabilities. `Test-Path builds` was `False` before and after the test.
- Round 1 final verification, second fresh clone at `D:\twitchconXcodex\phase6-r1-clone-b` (deleted): the same `npm ci`, `npm test`, `npm run build`, and audit results passed; `Test-Path builds` remained `False`.
- Round 1 final verification, Lantern selected in the repository: `$env:LIVE_PATCH_GAME='games/lantern-run'; npm test` passed the same 103 unit, 30 studio, 35 Arena, 24 Lantern, and HTTPS/HTTP2 checks. The test runner reported no change to `builds/`. The three-hit run-over check was stabilized by running on the first continuous stretch; it passed twice alone and in both clean clones and the Lantern-selected full suite.
- Round 2 final repository verification: `npm test` exited 0 with 104 unit tests passed (4 opt-in skipped), 30 studio browser tests passed, 36 Arena Survivor smoke tests passed (1 optional WebGL test skipped), 26 Lantern Run smoke tests passed, and the HTTPS/HTTP2 regression passed. The runner detected no change in `builds/`. `npm run build` exited 0; `npm audit --audit-level=high` reported 0 vulnerabilities.
- Round 2 clean-clone verification of `b9d9391`: `npm ci` added 49 packages with 0 vulnerabilities. `npm test` exited 0 with the same 104 unit, 30 studio, 36 Arena, 26 Lantern and HTTPS/HTTP2 results. `builds/` was absent before and after the test. `npm run build` exited 0; `npm audit --audit-level=high` found 0 vulnerabilities. The final amend changes this report only.

## Exit criteria

Engine search, PowerShell from the repository root (tests excluded):

```text
rg -ni "(from|import\().*games[/\\]" engine --glob '!**/*.test.*'
  → no output, exit 1
rg -ni 'arena survivor|lantern run|\b(slime|coin|enemy|bomb|owl|pinecone|firefly|acorn|thorns|boulder|ledge|glider|magnet)\b|run-over' engine --glob '!**/*.test.*'
  → no output, exit 1
rg -ni "['\"](log|spring|shield|jump|land|hurt|fall|rain|wind|fog|sparks|leaves|splash|celebration)['\"]" engine --glob '!**/*.test.*'
  → no output, exit 1
```

The unquoted English word `log` occurs only as a generic chat ARIA role and Windows diagnostic text. No game entity or sound literal appears in engine code.

- [x] 1. Engine stays game-agnostic — the searches above found no game imports, names, kinds or sound literals. Arena's 35 smoke tests pass and its saved layout migrates to its manifest key.
- [x] 2. Tests are per game — `npm test` with default Arena and with `LIVE_PATCH_GAME=games/lantern-run` each ran the studio suite once, both games' isolated smoke suites, unit tests and HTTPS regression, all passing.
- [x] 3. Lantern Run is playable — `tests/phase6-generator.test.ts` checked 250 seeds × 30 stretches at defaults and 250 reduced-ability seeds; browser tests cover Space/W/Up/click, ledges, pits, three hearts, invulnerability, run-over, two-second restart and pause.
- [x] 4. Lantern Run performs — `a crowded storm stays bounded without disabling an unrelated patch` and `a mutation action storm is throttled by the host` passed in Lantern's browser suite, using Arena's frame-gap thresholds.
- [x] 5. Mutation API is complete and safe — `tests/phase6-contract.test.ts` compares the manifest and API doc; `entity caps and out-of-range actions stay bounded`, six `documented ... idea survives its trigger` cases, and rollback browser tests pass.
- [x] 6. Live Codex builds — 3/3 distinct Lantern Run pitches shipped through `!idea`, moderator `!approve`, Codex generation, file gates and combined smoke. The table above records each pitch, result and time.
- [x] 7. Studio works with Lantern Run — studio tests cover manifest sample pitches, labelled Practice demo, two-way Library switching, Go Live mirror and active patches; Lantern's saved-build browser test reopens original and evolved views.
- [x] 8. Overlay respects each game — per-game settings and Arena migration unit tests pass; `keeps all four default OBS widgets separate ... at maximum ballot height` passes; `Library switches both built-in games and the OBS layout follows the active manifest` passes.
- [x] 9. Visual captures — `docs/phases/phase-6-visual/{01-gameplay,04-evolved,05-run-over,06-library}.png` are 1920×1080; four animation strips and a 9.04 s WebM are also present. The comparison tables above cite Appendix 3 and the animation concepts. Evolved has six active local modules including the demo.
- [x] 10. Standing checks — game-specific names and kinds are absent from `engine/`; new mutations receive only the existing game handle; engine gates and sandbox were not loosened; browser tests insert viewer text as text and exercise HTML-like input; no secrets were added to tracked files or the overlay.
- [x] 11. Docs are in sync — README, adding-a-game, architecture, demo-script, Lantern's mutation API and asset credits describe the shipped features and cover provenance.
- [x] 12. Clean clone passes — Round 1 passed in two sequential fresh clones. Round 2 passed `npm ci`, `npm test`, `npm run build` and `npm audit --audit-level=high` in a clean checkout of `b9d9391`; `builds/` remained absent. The Round 2 clone remains at the path listed under Known gaps because automatic approval review blocked its deletion.

## Deferred

- A separate owl dive/perch motion pattern remains the plan's permitted late cut. Log stacks were restored as a visual variant of the existing `log` entity, keeping the mutation API and hitbox unchanged.

## Known gaps / risks

- The sandbox permits temp-to-temp writes on this Windows account, so an isolated verification clone under `%TEMP%` fails the preflight even though the normal `D:` project location passes. Keep future verification clones on a protected project drive. The three real builds ran only after the probe passed.
- The four captures are representative local states. The evolved image does not itself prove a live Codex patch shipped; the separate three-build verification above does.
- Automatic approval review blocked recursive deletion of the verification clone at `D:\twitchconXcodex\phase6-r2-clean-a-20261101` without a more specific reason. It contains a checkout of this repository and test dependencies; no operator `.env` or `.live-patch` data was copied into it.
- At 1920×1080 in headless Chromium, the crowded probe fell from 10.2 fps before the visual overhaul to 6.1 fps after it, while still passing the established smoke-test thresholds. The old worktree had blocked font files, so the comparison is directional. The round-2 reviewer measured 58.9 fps in a visible crowded WebGL browser on this machine; verify again during an encoded stream.

## Review responses

## Round 4 responses

- **P6-R4-01 — Fixed.** Pit visibility now includes the full 70 px wall on both sides, and the wall texture's top sits at the grass lip (canvas y 517). `Lantern Run edge geometry` checks both entry and exit boundaries; the refreshed `01-gameplay.png` shows aligned edges.
- **P6-R4-02 — Fixed.** Both front arms now have separate upper-arm and forearm textures and pivots. The free forearm lags its swing; the holding paw overlays the stick at the branch height. `puts the holding paw around the branch` checks the grip offset, and the refreshed `07-fox-run-cycle.png` shows the two-part motion.
- **P6-R4-03 — Fixed.** Hurt restores only the capped music level, and run over cancels pending gain automation before fading. A two-note cadence plays through the effects bus. `a hazard run-over stays faded after hurt and a hurt restore respects the music cap` renders both cases offline.
- **P6-R4-04 — Fixed.** A browser test sends exactly 20 valid parameter actions in each of four separate chat events under a fixed host clock. It requires 60 applied actions and skipped actions on the fourth event, so disabling only the per-second budget fails while the per-event cap remains active.
- **P6-R4-05 — Fixed.** Hazard, owl and ledge spawn sites use named offsets; `MAX_SPAWN_OFFSET` derives from all three. `Lantern Run edge geometry` checks the relationship.

Round 4 repository verification: `npm test` passed 107 unit tests (4 opt-in skipped), 30 studio browser tests, 37 Arena browser tests (1 optional WebGL skipped), 31 Lantern Run browser tests, and the HTTPS regression. `npm run build` exited 0 and `npm audit --audit-level=high` found 0 vulnerabilities. `git status --short -- builds` produced no output. The new budget test first exposed a sequencing mistake in the test (batched events), which was corrected; an unrelated rollback test binding accidentally changed during that edit and was restored before this green full run.

## Round 3 responses

- **P6-R3-01 — Fixed.** The Arena storm fixture now requests 100 actions in one tick, exceeding the per-event cap even on a slow machine. The focused test and full `npm test` pass.
- **P6-R3-02 — Partly fixed.** The nine-frame jump strip now includes takeoff, the second-jump spin, fall and landing. The run strip no longer uses a fake clock that could make game time go backward; seven of eight frames show the open eye, while one still catches a blink.
- **P6-R3-03 — Fixed.** Owl and firefly browser checks mask subject colours and disable each rig's `update` as a negative control. Both pass in the full suite.
- **P6-R3-04 — Fixed after Round 4.** The fox has an upright orange torso, two slim hind legs with a longer opposing stride, two-part front arms, a curved cream-tipped tail, larger ears and eye, a paw gripping the forked stick and a round ribbed lantern. The texture rig stays within the existing collider; the code-drawn silhouette is still simpler than the painted concept.
- **P6-R3-05 — Fixed.** The right despawn horizon uses named generator lead, maximum gap, largest spawn offset and margin constants. The natural-generation browser check passes.

The first Round 3 full run passed 104 unit tests (4 opt-in skipped), 30 studio tests, 36 Arena tests (1 optional WebGL skipped), 28 Lantern Run tests and the HTTPS regression. The capture and art findings P6-R3-02 and P6-R3-04 are addressed in the polish commits below.

## Polish round

The references are `plans/phase-6/reference/targets/R1-fox-construction.png`, `R2-gameplay-target.png`, `R3-environment-kit.png`, and the Phase 6 concepts. The references were read as guides; the shipped game uses only code-drawn textures.

| Target | Status | Evidence and difference from reference |
|---|---|---|
| T1 upright fox and gait | Met | `07-fox-run-cycle.png` shows an upright torso, two-part arms and opposing long hind-leg steps; the clean four-pose silhouette of R1 is still more exaggerated. |
| T2 seamless tail | Met | `07-fox-run-cycle.png` and `08-fox-jump.png` show overlapping orange segments and a cream teardrop tip, with springy follow-through. |
| T3 ears, eyes, lantern, stick | Met | `01-gameplay.png` shows tall ears, a forked chest-height stick gripped by the overlaid paw and a round paper lantern; `07-fox-run-cycle.png` shows the enlarged eye open in seven frames and one natural blink. |
| T4 ground strip | Met | `01-gameplay.png`: repeated prerendered moss lip, roots, stones and stronger dark foreground leaves. R3 has softer painterly texture. |
| T5 pit edges | Met | `01-gameplay.png`: left/right prerendered rock faces and dark gap, with moss over their lips. The rock shapes remain more geometric than R3. |
| T6 pines and haze | Partly met | `01-gameplay.png` and `04-evolved.png`: scalloped tiers, varied layers and haze bands; R2's distant forest has more natural depth and irregularity. |
| T7 lantern light | Met | `01-gameplay.png`: a shallow warm ellipse ahead of the fox stays above the soil; lantern halo remains separate. |
| T8 fireflies | Met | `10-props.png`: smaller translucent wings, bright yellow-green body and existing short particle trail. |
| T9 props | Partly met | `10-props.png` shows spring, ledge, shield and firefly; log, stack, thorns, boulder and pinecone remain simpler than R3's prop sheet. |
| T10 visual evidence | Partly met | Recaptured `01-gameplay.png`, `04-evolved.png`, `05-run-over.png`, `07-fox-run-cycle.png`, `08-fox-jump.png`, `09-owl-flight.png`, `10-props.png` and `lantern-run-motion.webm`. The run strip has one blink frame despite targeting an open-eye interval; capture samples follow real time at roughly 37 ms intervals. |
| T11 forest music | Met | `phase-6-audio/music-20s.wav` and `eight music bars render on the beat grid and meet quietly at the loop seam`: 90 BPM A minor, eight bars, scheduled pad, bass, pentatonic melody, low kick and hats. Rhythm enters at 200 m or higher speed; run over closes the filter, cancels a pending hurt restore, fades the bus and plays a two-note cadence. |
| T12 per-sound effects | Met | `phase-6-audio/sfx-all.wav` and `all 14 sound recipes render audibly and within the output ceiling, with a silent negative control`: every manifest sound has two or three oscillator/noise voices with separate envelopes; supported world positions pan, pitch varies by ±3%. |
| T13 mix and checks | Partly met | Effects and music use separate buses into a compressor; a generated impulse drives the reverb send. OfflineAudioContext accepts the same audio class as live play. Tests check non-silence, peak ≤0.9, duration, beat-grid error <5 ms and sample seam, including a silent negative recipe. A perceptual listening review remains for the operator. |

The gameplay frame has naturally generated pickups, hazard and pit. The evolved frame has six active local modules including the demo. The run-over frame stages three hits. The animation strips use controlled subjects and sampled times; their background changes are not the animation evidence, which is provided by subject-masked browser tests with disabled-rig negative controls.

### Sound design

| Names | Design |
|---|---|
| `jump`, `spring` | Two rising sine/triangle voices; spring has a longer, higher bounce. |
| `land` | Short filtered noise impact over a descending low sine. |
| `firefly`, `acorn` | Bright paired chimes; the acorn adds a triangle onset. |
| `hurt`, `fall`, `run-over` | Filtered noise and falling pitches, with increasing duration and weight. Hurt briefly ducks the score. |
| `power-up`, `round-start`, `patch-shipped` | Layered ascending or sustained chord tones with separate attacks. |
| `vote-tick` | Short high chime and a very quiet noise click. |
| `patch-failed`, `rollback` | Two descending voices; failure includes a dull noise tail. |

The Web Audio scheduler wakes every 25 ms and schedules the next bar ahead of time on `AudioContext.currentTime`; layer changes take effect only at bar boundaries. The play button is still required to unlock sound, Studio Settings control the master, music and effects buses, mute zeroes their gain, pause suspends the owned context, and the existing per-effect play cap remains five per second. The two WAVs are offline-rendered listening samples, not runtime assets.

### Clean-clone verification of the polish

The repository full run passed 104 unit, 30 studio, 36 Arena and 30 Lantern browser checks, then timed out once in the HTTPS Practice confirmation. `npm run test:https` passed on immediate isolated rerun. Clone A (`a2a17ad`) passed `npm ci`, the entire `npm test` including HTTPS, `npm run build`, and `npm audit --audit-level=high` (0 vulnerabilities); `builds/` was absent after testing. Clone B exposed a random-generation assumption in a Lantern smoke test: it required a random hazard to appear within 20 seconds, despite the generator legitimately returning `none`. The test now checks a naturally generated pickup crossing from beyond the old cutoff, which exercises the same despawn boundary without depending on hazard selection. It passed five focused runs.

| Final clean clone | Commands and output | Build data |
|---|---|---|
| C, `c6ab055` | `npm ci` added 49 packages; `npm test` passed 104 unit (4 opt-in skipped), 30 studio, 36 Arena (1 optional WebGL skipped), 30 Lantern, HTTPS regression; `npm run build` exit 0; `npm audit --audit-level=high` found 0 vulnerabilities. | `Test-Path builds` → `False` after testing. |
| D, `c6ab055` | `npm ci` added 49 packages; `npm test` passed the same 104/30/36/30 suites and HTTPS regression; `npm run build` exit 0; `npm audit --audit-level=high` found 0 vulnerabilities. | `Test-Path builds` → `False` after testing. |

After those runs, only the capture script and visual evidence were refined; game/runtime and test code is unchanged. The automatic approval review rejected a checked recursive deletion of clone A as “blocked by policy”. Clones A–D remain at `D:\twitchconXcodex\phase6-polish-clone-{a,b,c,d}-20261101`; none contains operator `.env`, `.live-patch` or `builds/` data. The earlier Round 2 verification clone path remains in Known gaps above.

## Round 1 responses

- **P6-R1-01 — Fixed.** Recomputing `maxHearts` clamps current hearts, and HUD rendering bounds the count; the five-heart removal browser test checks that frames continue.
- **P6-R1-02 — Fixed.** The Library switch waits for the restarted overlay server and gives navigation 30 seconds; the focused switch test passes.
- **P6-R1-03 — Fixed.** Legacy layouts migrate only when `overlayLayouts` is absent, and new saves omit top-level `overlayWidgets`; the fresh Lantern save → Arena test passes.
- **P6-R1-04 — Fixed.** The firefly icon, distance and five drawn heart icons fit inside the 670 px protected zone without reaching the toast; the Large five-heart bounds browser test passes.
- **P6-R1-05 — Fixed.** A fall records the ground immediately following its gap, and a milestone loop emits every crossed 100 m mark; the fall recovery browser test passes.
- **P6-R1-06 — Fixed.** Generated owls travel toward the fox and bob at three seeded heights; the 250-seed height and motion test passes, and the API doc states the path.
- **P6-R1-07 — Fixed.** The fairness test uses the same extracted flight step as the game to check held jumps across 250 seeds, gap clearance, ledge height and obstacle spacing.
- **P6-R1-08 — Fixed.** Part rigs animate the fox, owl and fireflies; mossy props, five parallax layers, detailed ground, pill banner and keycap card replace the static art. The animation, immediate-jump and pause browser test passes; the new stills and strips below show the result and its remaining differences.
- **P6-R1-09 — Fixed.** The portrait OpenArt cover replaces the landscape generated cover; the Library card and details capture show the fox and owl together. The manifest points to the 96 KB WebP, and `CREDITS.md` records the operator's permission and origin.
- **P6-R1-10 — Fixed.** Lantern's API doc states the three-second load deadline; the doc test now checks every built-in game.
- **P6-R1-11 — Fixed.** The stale criterion 6 sentence above now points to the separate three-build evidence.
- **P6-R1-12 — Fixed.** Entities far beyond the right edge release their cap slots; the crowded browser test remains the guard.

## Round 2 responses

- **P6-R2-01 — Fixed.** Right-side despawn starts past the generator's farthest ledge placement. A browser test with all modules removed observes naturally generated pickups and hazards cross from beyond the old cutoff into the visible playfield. The refreshed `01-gameplay.png` uses no injected entities.
- **Saved-build load regression — Fixed.** A module's three-second load deadline now starts when its source is sent to the sandbox frame; frame initialization has its own ten-second deadline. The saved-build browser test checks that original and evolved views both reopen with their expected patch states under the full suite.
- **Windows mutation reload lock — Fixed.** Vite retries a transient locked or not-yet-present mutation file instead of crashing its watcher. All six documented Arena mutation fixtures passed in the focused browser run.
- **Studio timeline measurement race — Fixed.** The Go Live 1080p browser test now measures all four timeline rows in one browser turn, so a live status refresh cannot replace a locator between measurements.
- **P6-R2-02 — Fixed.** Generated owls use three heights above the standing fox's hit band and appear 350 px beyond the gap landing edge. A 250-seed, four-wave-phase test runs the shared flight step, checks that the fox lands before the owl encounter and stays outside the 55 px collision band.
- **P6-R2-03 — Fixed.** Play exposes `__livePatch` immediately after creating the host and menu, before either mutation sync or run-history waits can show LIVE or an active patch list. The Arena browser regression delays `/api/runs` and checks the hook at both readiness signals.
- **P6-R2-04 — Fixed.** The fox animation test counts only orange fox pixels in a leg-height crop. It then disables `FoxRig.update` while the world keeps scrolling and requires the measured change to fall nearly to zero; jump and pause checks remain.
- **P6-R2-05 — Fixed.** The fox has a smaller head, longer raised torso, visible front legs in opposing run phases, and a stick rooted at its front paw. The fifth forest layer is behind ground; the moon is one disc; the lantern glow texture has full radial room; touching ground spans have no cliff edge; pits have jagged rock faces; clouds wrap seamlessly; the run-over lantern rests at ground level. The spring cap and floating ledge have more distinct shapes. New captures show these changes; the code-drawn shapes remain simpler than the painterly references.
- **P6-R2-06 — Fixed.** The HUD measures count and distance widths each frame, reduces their font size only when needed, and positions the hearts after the distance. A browser test collects over 1,000 fireflies at Large size with five hearts and checks no overlaps or keep-clear overflow.
- **P6-R2-07 — Fixed.** The mutation API doc now names the read-only `hudBounds` and `groundUnderFox` diagnostic snapshot fields.
