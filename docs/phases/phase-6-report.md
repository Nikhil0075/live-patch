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
- [x] 9. Visual captures — `docs/phases/phase-6-visual/{01-gameplay,04-evolved,05-run-over,06-library}.png` are 1920×1080; the four comparison tables above cite Appendix 3. Evolved has six active local modules including the demo.
- [x] 10. Standing checks — game-specific names and kinds are absent from `engine/`; new mutations receive only the existing game handle; engine gates and sandbox were not loosened; browser tests insert viewer text as text and exercise HTML-like input; no secrets were added to tracked files or the overlay.
- [x] 11. Docs are in sync — README, adding-a-game, architecture, demo-script, Lantern's mutation API and asset credits describe the shipped features and cover provenance.
- [x] 12. Clean clone passes — `npm ci`, `npm test`, `npm run build` and `npm audit --audit-level=high` passed in the fresh clone; `builds/` was absent before and after the test; clone deleted.

## Deferred

- Log stacks and a second owl motion pattern, the plan's permitted late cuts. The playable game retains logs, thorns, boulders and variable-height owls.

## Known gaps / risks

- The sandbox permits temp-to-temp writes on this Windows account, so an isolated verification clone under `%TEMP%` fails the preflight even though the normal `D:` project location passes. Keep future verification clones on a protected project drive. The three real builds ran only after the probe passed.
- The four captures are representative local states. The evolved image does not itself prove a live Codex patch shipped; the separate three-build verification above does.

## Review responses

## Round 1 responses

- **P6-R1-01 — Fixed.** Recomputing `maxHearts` clamps current hearts, and HUD rendering bounds the count; the five-heart removal browser test checks that frames continue.
- **P6-R1-02 — Fixed.** The Library switch waits for the restarted overlay server and gives navigation 30 seconds; the focused switch test passes.
- **P6-R1-03 — Fixed.** Legacy layouts migrate only when `overlayLayouts` is absent, and new saves omit top-level `overlayWidgets`; the fresh Lantern save → Arena test passes.
- **P6-R1-04 — Fixed.** The HUD row is compact and the protected zone is widened without reaching the toast; the Large five-heart bounds browser test passes. The icon HUD follows in the visual commit.
- **P6-R1-05 — Fixed.** A fall records the ground immediately following its gap, and a milestone loop emits every crossed 100 m mark; the fall recovery browser test passes.
- **P6-R1-06 — Fixed.** Generated owls travel toward the fox and bob at three seeded heights; the 250-seed height and motion test passes, and the API doc states the path.
- **P6-R1-07 — Fixed.** The fairness test uses the same extracted flight step as the game to check held jumps across 250 seeds, gap clearance, ledge height and obstacle spacing.
- **P6-R1-08 — In progress.** The visual and animation overhaul is the next commit in this round.
- **P6-R1-09 — In progress.** The portrait OpenArt cover is the third commit in this round.
- **P6-R1-10 — Fixed.** Lantern's API doc states the three-second load deadline; the doc test now checks every built-in game.
- **P6-R1-11 — Fixed.** The stale criterion 6 sentence above now points to the separate three-build evidence.
- **P6-R1-12 — Fixed.** Entities far beyond the right edge release their cap slots; the crowded browser test remains the guard.
