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

- Added a separately loadable Phaser runner with one-button jumping, scrolling ground and hazards, firefly and acorn collection, three hearts, pit recovery, a run-over card and a two-second automatic restart. The scene draws its fox poses, three forest layers and entities in code. Its Web Audio adapter synthesizes cues and a short looping melody.
- The stretch generator derives gap width from the current jump reach. Unit tests cover 250 seeds at default and reduced jump ability. A browser smoke check verifies a running Lantern Run session advances.

### Step 4 — mutation API

- Defined Lantern Run's actions and hooks in the manifest and API reference, with a unit test comparing their names exactly. The adapter bounds every action, caps each entity category and the total at 80, and tracks module-owned entities, parameter and weather writes, granted power-ups, text and effects for rollback.
- Added three built-in modules using five hook types, a labelled Practice demo, and six runnable idea fixtures. The browser suite triggers each fixture and checks it remains active. It also checks keys and touch input, ledge and pit hooks, run over and restart, crowded rendering, throttling, rollback, and faulty modules.

### Step 5 — studio integration and visuals

- Generated an original vector Library cover with `games/lantern-run/assets/generate-cover.mjs`, rasterized it with the installed Playwright browser, and recorded its origin in `assets/CREDITS.md`. The game art remains code-drawn and no concept image was imported.
- The isolated browser catalog now contains a copy of each built-in game, so Library switching in tests does not touch the live game folders. A browser test switches both ways and checks that the OBS page follows each saved layout. Another saves Lantern Run and opens its original and evolved views. The selected-game studio suite exercises its Practice demo and Go Live mirror.
- Captured the four required 1920×1080 views in `docs/phases/phase-6-visual/` and compared them below.

## Final stream layout

All rectangles below are `(x,y,width,height)` in a 1920×1080 capture. The engine patch-toast zone is `(685,60,550,110)`. Lantern Run protects its HUD `(0,0,460,130)` and run lane `(420,500,1500,364)`. Its defaults are patch card `(24,140,380,340)`, Codex card `(24,500,380,300)`, ballot `(880,175,1010,320)` and ticker `(560,1004,1336,58)`. The unit test checks every pair and every protected zone, including the ballot's required height. A narrower ballot keeps its readable height even when no collision-free location exists; the editor warns the operator instead of clipping choices.

### `01-gameplay.png`

| Matches the concept | Differs and why |
|---|---|
| Fixed left-side fox, one-row firefly/distance/hearts HUD, twilight sky, three scrolling forest layers, glowing pickups and a running lane. | Ground begins at 80% of the canvas for the OBS ticker, and the bridge and stone lantern are omitted, as required by Appendix 3 row `01-gameplay.png`. The code-drawn tree silhouettes use simpler shapes than the painted reference. |

### `04-evolved.png`

| Matches the concept | Differs and why |
|---|---|
| Six active modules including the demo create rain, a shield ring, a large owl, extra fireflies, ledges and a spring. The game banner is below the patch-toast zone and the HUD stays in one row. | The castle is omitted and the banner/HUD use the corrected positions in Appendix 3 row `04-evolved.png`. The captured patch state is a local visual scenario, not a claim that those modules were shipped by live Codex. |

### `05-run-over.png`

| Matches the concept | Differs and why |
|---|---|
| A centered compact card shows the actual run distance, collected fireflies, session best and automatic restart; the HUD shows three empty hearts. | The shrine, gate and house are omitted. The card uses the real countdown and “Space to start now” wording from Appendix 3 row `05-run-over.png`. |

### `06-library.png`

| Matches the concept | Differs and why |
|---|---|
| Both ready-to-play games have distinct illustrated covers, with Lantern Run selected and its controls, hooks, actions, audio and effects visible in details. | This is the shipped studio's Library layout rather than a game concept image. The cover follows the mood of Appendix 3 row `03-cover.png` but omits the castle and town, and contains no text. |

## How to run and test

- Step 1: `npm test` — 92 unit tests passed (4 opt-in skipped); studio suite 28 passed; Arena Survivor suite 35 passed (1 opt-in WebGL skipped); HTTPS/HTTP2 regression passed. `npx tsc --noEmit` passed.
- Step 2: `npm test` — 94 unit tests passed (4 skipped), 29 studio browser tests passed, 35 Arena Survivor browser tests passed (1 WebGL skipped), HTTPS/HTTP2 regression passed. `npm run build` passed; `npm audit --audit-level=high` found 0 vulnerabilities.
- Step 3: `npm test` — 96 unit tests passed (4 skipped), 29 studio browser tests passed, 35 Arena Survivor browser tests passed (1 WebGL skipped), 1 Lantern Run smoke test passed, HTTPS/HTTP2 regression passed. `npm run build` passed.
- Step 4: `npm test` — 98 unit tests passed (4 skipped), 29 studio tests passed, 35 Arena Survivor smoke tests passed (1 optional WebGL test skipped), 19 Lantern Run smoke tests passed, HTTPS/HTTP2 regression passed; `builds/` unchanged. `npm run build` passed.
- Step 5, Lantern selected: `$env:LIVE_PATCH_GAME='games/lantern-run'; npm test` — 100 unit tests passed (4 skipped), 30 studio tests passed, 35 Arena Survivor smoke tests passed (1 optional WebGL test skipped), 20 Lantern Run smoke tests passed, HTTPS/HTTP2 regression passed; `builds/` unchanged.
- Step 5, Arena selected: `npm test` — the same 100 unit, 30 studio, 35 Arena, 20 Lantern and HTTPS/HTTP2 checks passed; `builds/` unchanged. `npm run build` passed and `npm audit --audit-level=high` found 0 vulnerabilities.

## Exit criteria

- [ ] 1. Engine stays game-agnostic — manifest work and Arena regression pass; Lantern Run and final search evidence remain.
- [ ] 2. Tests are per game — studio suite is split; second game is pending.
- [ ] 3–12. Lantern Run, integration, visual and clean-clone criteria — later steps.

## Deferred

## Known gaps / risks

## Review responses
