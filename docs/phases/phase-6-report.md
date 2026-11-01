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

The first four captures below are 1920×1080. The strips are cropped from the running game at 1280×720; the capture script briefly pauses the game between jump screenshots so browser screenshot latency cannot shift the subject out of frame. The nine-second 1280×720 WebM is a Playwright recording edited in browser Canvas and MediaRecorder without a new dependency.

### `01-gameplay.png`

| Matches the concept | Differs and why |
|---|---|
| Fixed left-side animated fox, one-row firefly/distance/icon-heart HUD, twilight sky, five scrolling layers plus foreground leaves, animated pickups and a running lane. | Ground begins at 80% of the canvas for the OBS ticker; the bridge and stone lantern are omitted per Appendix 3 row `01-gameplay.png`. The geometric code-drawn trees, moon and soil are simpler than the painted reference, and the foreground leaves are a subtle accent rather than a thick frame. |

### `04-evolved.png`

| Matches the concept | Differs and why |
|---|---|
| Six active modules including the demo create rain, a pulsing shield, a boss-sized flying owl, extra fireflies, mossy ledges and an animated spring. The fox is fully visible; the pill banner sits below the patch-toast zone. | The castle is omitted and banner/HUD use the corrected positions in Appendix 3 row `04-evolved.png`. The artwork is geometric rather than painterly. This is a local visual scenario, not a claim that these particular modules were shipped by live Codex. |

### `05-run-over.png`

| Matches the concept | Differs and why |
|---|---|
| The fox rests with closed eyes and a dropped glowing lantern. A rounded amber card with leaf corners, divider and Space keycap shows real distance, fireflies, session best and countdown; the HUD shows empty drawn hearts. | The shrine, gate and house are omitted per Appendix 3 row `05-run-over.png`. The card uses the live countdown and a compact Space keycap instead of a separate full-width button. |

### `06-library.png`

| Matches the concept | Differs and why |
|---|---|
| Both ready-to-play games have illustrated covers. Lantern Run's portrait OpenArt cover keeps the owl and fox visible on the card and in the details panel; controls, hooks, actions, audio and effects are listed. | This is the shipped studio's Library layout. Appendix 3 row `03-cover.png` omits the castle and town; the approved new cover keeps the forest and river. The details panel contains the portrait image in a landscape slot, leaving dark side bars to preserve both characters. |

### `07-fox-run-cycle.png`

| Concepts | Matches | Differs and why |
|---|---|---|
| `02-art-sheet.png`, `06-fox-animation.png` row 1, `07-fox-parts.png` | Eight successive captures show separate leg, paw, tail, satchel and lantern motion. Stride is driven by travelled distance; the lantern swings from its stick and casts light. | The silhouettes are pre-rendered Canvas shapes rather than the reference's painted frames. The segmented tail is more visible at this scale. |

### `08-fox-jump.png`

| Concepts | Matches | Differs and why |
|---|---|---|
| `06-fox-animation.png` rows 2–3, `11-effects.png` | Six captures show takeoff, rise and a double-jump rotation with lantern and tail following. The jump begins on the input frame. | This strip samples the double jump; glider, hurt, pit recovery and run-over poses are visible in game states or other captures, rather than all being placed in this strip. |

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
| `05-run-over.png`, `06-fox-animation.png`, `08-owl-animation.png`, `10-props-animation.png`, `11-effects.png` | The 9.04 s, 1280×720, 2.06 MB clip shows running, ledge landing, two jumps including a spin, an owl, a firefly collection, hits and the run-over card. All displayed counters are live game state. | The browser recording is silent and plays the source at 1.08× to fit the requested duration; it does not demonstrate the separate glider and weather modes. |

### Crowded rendering measurement

`node scripts/probe-phase6-fps.mjs` in headless Chromium at 1920×1080, after two seconds of baseline play and 1.6 seconds of the same capped 80-entity storm used by the smoke test:

| Revision | Baseline frame rate | Crowded frame rate | Worst frame gap |
|---|---:|---:|---:|
| `deab45e` before overhaul | 13.2 fps | 10.2 fps | 175.3 ms |
| `df4cadc` after overhaul | 7.7 fps | 6.1 fps | 291.1 ms |

The richer layers and animated parts cost software-renderer throughput. The crowded smoke test still passes its existing requirements: fewer than 80 entities, at most 64 particles, worst gap below 350 ms, and crowded frame rate above 55% of the baseline. A visible hardware-accelerated stream has not been measured in this round, so that performance remains a manual risk.

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
- [x] 12. Clean clone passes — `npm ci`, `npm test`, `npm run build` and `npm audit --audit-level=high` passed in the fresh clone; `builds/` was absent before and after the test; clone deleted.

## Deferred

- A separate owl dive/perch motion pattern remains the plan's permitted late cut. Log stacks were restored as a visual variant of the existing `log` entity, keeping the mutation API and hitbox unchanged.

## Known gaps / risks

- The sandbox permits temp-to-temp writes on this Windows account, so an isolated verification clone under `%TEMP%` fails the preflight even though the normal `D:` project location passes. Keep future verification clones on a protected project drive. The three real builds ran only after the probe passed.
- The four captures are representative local states. The evolved image does not itself prove a live Codex patch shipped; the separate three-build verification above does.
- At 1920×1080 in headless Chromium's software renderer, the crowded probe fell from 10.2 fps before the visual overhaul to 6.1 fps after it, while still passing the established smoke-test thresholds. Validate frame rate on the streamer's visible, hardware-accelerated browser before relying on this art under encoding load.

## Review responses

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
