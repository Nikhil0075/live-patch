## Spec

### Goal

Ship a second playable game that has almost nothing in common with Arena Survivor, and prove with it that Live Patch is a platform:
- the engine runs it through its manifest alone, with no engine code that names it;
- every studio feature works with it unchanged: Practice, Go Live, real Codex builds, rollback, saved builds, the original-versus-evolved comparison, the OBS overlay and the Library switch;
- live Codex can build viewer ideas for it from its API documentation alone.

The engine changes this needs are generic platform features, listed under "Platform work". They land before the game, each in its own commit.

### Design principles

1. **The platform boundary holds.** `engine/` never imports from `games/` and never names a game, an entity kind or a sound of any game. Anything game-specific moves into the manifest.
2. **A different game, not a reskin.** Different genre, physics, input, hooks, actions and entity kinds. If the runner's manifest looks like Arena Survivor's with renamed kinds, the phase has missed its point.
3. **Built for a stream.** One button, so the streamer can talk while playing. Short runs, so each new patch gets tested again and again. Chat ideas show on screen within seconds. The play area leaves room for the OBS overlay.
4. **Fair by construction.** At default parameters, every stretch the level generator makes can be cleared. A chat patch can make the game harder, never impossible: caps, safe starts, and rollback.
5. **Same quality bar as Arena Survivor.** Code-drawn art in the concepts' style, synthesized sound and music, effects within the existing budgets, and the same robustness tests.

### Build

#### Platform work (engine, generic; first)

1. **Studio tests leave Arena Survivor's folder.**
   - Today every studio browser test (Go Live, Practice, Setup, overlay, security) lives in `games/arena-survivor/tests/smoke/smoke.spec.ts`, and Playwright's `testDir` is the selected game's `tests/smoke`. With `LIVE_PATCH_GAME` set to another game, `npm test` silently skips them.
   - Move the engine and studio tests into a top-level browser suite that runs against whichever game is selected. Each game keeps only its own game tests.
   - The moved tests read game facts from the manifest (demo title, built-in patch count, hint), never from Arena Survivor's names.
   - `npm test` runs: the unit tests, the studio suite once, every built-in game's own smoke suite (each in its own isolated copy), then the HTTPS regression.
   - `npm run smoke -- --mutation <file>` (the runner's gate) still runs only the active game's suite.
2. **Practice sample pitches come from the manifest.**
   - New optional manifest field `samplePitches`: 3 to 6 plain-text strings, each at most 120 characters.
   - Practice's "Generate sample pitch" and the text box's placeholder use the active game's list (today they're hard-coded for Arena Survivor in `engine/twitch/simulator.ts:4` and `:24`). A game without the field gets a short generic list.
   - Arena Survivor's manifest gets its current three pitches.
3. **Overlay keep-clear zones and layouts per game.**
   - New optional manifest field `overlay`, in 1920×1080 stream coordinates:
     - `keepClear`: up to 6 labelled rectangles the overlay widgets must not cover;
     - `defaultLayout`: the game's starting positions for the four widgets (patch card, Codex card, ballot, ticker).
   - The engine keeps only its own zone (the patch toast). Arena Survivor's HUD zone moves from `engine/studio/overlay-placement.ts:9-12` into its manifest, together with today's default layout, so its behaviour doesn't change.
   - Overlay layouts are saved **per game**. The operator's existing saved layout becomes Arena Survivor's; it's never discarded. A game without a saved layout starts from its `defaultLayout`, or from the engine default.
   - Placement and the overlay layout editor respect the active game's zones. Switching games in Library switches the overlay layout, including in the OBS page.
4. **Triage knows the game.** The AI triage prompt (`engine/pipeline/triage.ts:28`) includes the active game's name, description and hint as data, so a pitch that can't apply to this game can be flagged.
5. **The system-event contract is documented.** The engine sends `systemEvent` actions to the game (`vote-tick`, `round-start`, `shipped`, `failed`, `rolled_back`; `engine/client.ts:42,81,87`), but `docs/adding-a-game.md` doesn't mention them. Document them, and the optional adapter methods (`enableSound`, `configure`, `pause`, `resume`, `captureFrame`).
6. **Docs:** `docs/adding-a-game.md` (the new fields), `docs/architecture.md`, and `scripts/new-game.mjs` (the template writes the new optional fields as examples).

#### The game: Lantern Run (`games/lantern-run`)

**Play.**
- The fox runs right automatically, and the world scrolls. **One button jumps:** Space, W, Up arrow, or a click or tap on the game canvas. Holding the button a little longer jumps a little higher, up to a cap.
- The ground has gaps (pits). There are floating ledges to land on, ground obstacles (log, thorn bush, boulder, log stack), owls that glide at varying heights, and collectibles: fireflies (+1) and the rarer golden acorns (+5).
- Power-ups are rare by default; mutations can grant them: a lantern shield (absorbs one hit), a leaf glider (slow fall) and a firefly magnet.
- Mushroom springs bounce the fox high.
- **Hearts:**
  - Each run starts with 3 hearts.
  - Hitting an obstacle or an owl costs a heart and gives 1 second of blinking invulnerability; the fox keeps running.
  - Falling into a pit costs a heart, and the fox reappears on the next ground with a short float.
  - At 0 hearts, a small "Run over" card shows the distance, fireflies and the session best (concept 05). The next run starts automatically after 2 seconds, or immediately on the jump button.
  - The session best stays in memory only; nothing is written to storage.
- **Pace:** speed and obstacle density rise with distance, up to caps, and reset each run. A run at default parameters should typically last 30–90 seconds for a casual player.
- **Fairness:** at the current parameters, the generator only makes gaps, obstacle spacing and ledge heights the fox can clear. A test checks this across many generator seeds. Every run starts with 3 seconds of invulnerability, and no hazard may spawn within 150 px of the fox.
- **HUD** (concept 01): fireflies, distance in metres and hearts, in one row at the top left, inside the game's HUD keep-clear zone. Game banners (`showMessage`) appear below the engine's patch-toast zone, not at the top centre.

**Engine features the game must honour:**
- the play window's pause, which freezes the world, physics and hooks;
- `configure(settings)`: volumes, mute, effects intensity, reduced flashing and shake, HUD size;
- `captureFrame` for the Go Live mirror;
- `enableSound` after the streamer's click;
- `systemEvent` cues with its own sounds.

**Look and sound.**
- Canvas 1152×648 (16:9), like Arena Survivor, so Play and OBS sizing don't change.
- Phaser, already a dependency; no new runtime dependencies.
- All art is drawn in code (canvas gradients and shapes, as in `games/arena-survivor/src/art.ts`) in the concepts' style: chunky silhouettes, soft gradients and glows, and the palette in Appendix 2. Parallax background in at least three layers.
- The fox has run, jump, fall and hurt poses (concept 02).
- Sounds and a looping music track are synthesized in code with Web Audio, like Arena Survivor's.
- Effects (`sparks`, `leaves`, `splash`, `celebration`) and weather particles share one per-frame budget, the lesson of P45-R3-01.
- `assets/CREDITS.md` records the origin of every asset. The cover follows the Phase 4.5 rule (Codex's own art), unless the operator decides otherwise.

**Stream layout.**
- The ground top sits at about 80% of the canvas height (canvas y ≈ 518). The soil band below it is decorative, so the overlay's ticker can cover it.
- The fox runs at about 30% of the width (canvas x ≈ 346).
- Generated hazards and pickups appear inside the run lane. Starting keep-clear zones and a starting default layout are in Appendix 4. Codex may tune them and records the final values in the report.

**Mutation API (manifest `actions` and `hooks`).** Starting values are in Appendix 1. The API must:
- use the runner's own hooks and events (jump, land, collect, hit, fall, run start and end, distance milestones, spawn, tick, chat) and its own entity kinds;
- bound every action, as Arena Survivor does: clamped numbers, capped strings, enum values, per-kind and total entity caps, rate limits through the engine;
- define ownership and rollback: removing a module removes its entities, parameter writes, weather and granted power-ups. Fireflies, distance and hearts already earned remain;
- render all text as plain text;
- have `docs/mutation-api.md` complete against the checklist in `docs/adding-a-game.md`, with six idea sketches. Runnable versions of all six go in `tests/fixtures/` and run in the browser suite with their triggers.

**Built-in patches and Practice:**
- **Three built-in patches** in `mutations/`. They are active from the start and are Codex's examples, so between them they use at least four different hooks.
- **Practice demo:** `demo/` holds a labelled demo patch whose title says "Demo" (for example "Demo: Firefly swarm"), and the manifest's `demoMutation` points to it.
- **`samplePitches`:** six runner ideas (Appendix 1 has starting text).

**The game's own smoke suite** (`games/lantern-run/tests/smoke/`), at least:
- the game plays for five seconds with a chosen module (the manifest `testCommand`);
- jump, ledge landing, pit fall and respawn, run over and automatic restart;
- generator fairness across seeds;
- entity caps, and an action storm being throttled;
- a crowded moment keeps frame time healthy: all caps reached, weather on, bursts firing;
- rollback removes everything the module owns and keeps what was earned;
- out-of-range arguments are bounded, and unknown kinds are ignored;
- each of the six fixture ideas survives its trigger;
- a crashing or stalling module is disabled while the game keeps running.

#### Studio integration
- **Library:** both games appear with their covers, and **Make active** switches between them. Concept cards, if any remain, don't count as games.
- **Practice:** with Lantern Run active, sample pitches are runner ideas, and a full practice round ships the runner's labelled demo.
- **Go Live:** the mirror, ballot, timeline and Active patches work with Lantern Run, and Active patches lists its three built-ins.
- **Saved builds:** saving during a Lantern Run session creates a build that reopens Lantern Run. The comparison shows its original against its evolved version.
- **Demo script:** `docs/demo-script.md` gets an optional 10-second scene that switches to Lantern Run in Library, without making the video longer than 3 minutes.
- **README:** say that two games ship, how to switch between them, and what makes the second one different.

### Out of scope
- A third game, turn-based games, and changes to the engine's tick or deadline model.
- Touch controls beyond click or tap on the canvas, leaderboards, and anything saved to storage.
- New Twitch features, and changes to the runner sandbox or the engine gates (they may only become stricter).
- Rebinding keys.

### Exit criteria
1. **The engine stays game-agnostic.**
   - `engine/` imports nothing from `games/`.
   - A case-insensitive search of `engine/` (tests excluded) for both games' names, entity kinds and sound names finds nothing. The report shows the command and its output.
   - Arena Survivor's behaviour is unchanged: its tests pass, and its overlay layout and zones come from its manifest.
2. **Tests are per game.**
   - The studio browser suite runs once per `npm test`, whichever game is selected.
   - Each built-in game's own smoke suite runs in its own isolated copy.
   - `npm test` passes both by default and with `LIVE_PATCH_GAME=games/lantern-run`.
3. **Lantern Run is playable.**
   - One-button controls: Space, W, Up arrow, and click or tap.
   - Jumps, ledges, pits, hearts, invulnerability, run over and the 2-second automatic restart all work.
   - The fairness test passes across at least 200 generator seeds.
   - The pause menu really pauses the game.
4. **Lantern Run performs.** In the crowded-moment test (all caps reached, weather on, bursts firing), the game stays within the frame-time thresholds Arena Survivor's tests use, and no unrelated module is disabled.
5. **The mutation API is complete and safe.**
   - The manifest's actions and hooks match `docs/mutation-api.md` exactly (a test compares them).
   - Every action is bounded.
   - All six fixture ideas run in the browser suite with their triggers.
   - Rollback removes a module's entities, parameter writes, weather and power-ups, and keeps what was earned.
6. **Live Codex can build for it.** Three real Codex builds from three different runner pitches, through the normal approval path. At least two ship. The report lists each pitch, the result, the time taken and, for a failure, the reason.
7. **The studio works with it.** With Lantern Run active:
   - Library shows both games with covers, and switching works both ways;
   - Practice uses the runner's sample pitches and ships its labelled demo;
   - Go Live, the Play window, the mirror and Active patches work;
   - a saved build reopens Lantern Run, and the comparison works.

   Browser tests cover the switch, Practice and the saved build.
8. **The overlay respects each game.**
   - Layouts are saved per game, and the operator's existing layout becomes Arena Survivor's.
   - In Lantern Run's default layout at 1920×1080, no two widgets overlap and no widget covers a keep-clear zone, including the ballot at its tallest. A test checks this.
   - Switching games switches the OBS page's layout.
9. **It looks like the concepts.**
   - Captures at 1920×1080 go in `docs/phases/phase-6-visual/`: `01-gameplay.png`, `04-evolved.png` (after at least five patches, including the demo), `05-run-over.png`, plus `06-library.png` showing both games.
   - The report has a table per capture: what matches the concept, and what differs and why (cite Appendix 3).
10. **The standing checks hold.** No viewer or game text is inserted as HTML. Mutations get no new globals. Gates are unchanged or stricter. No secrets appear in code, logs or the overlay.
11. **The docs are in sync.** README, `docs/adding-a-game.md`, `docs/architecture.md`, `docs/demo-script.md`, the game's `docs/mutation-api.md` and `assets/CREDITS.md`.
12. **A clean clone passes.** `npm test` (unit, studio, both games' smoke suites, HTTPS regression), `npm run build` and `npm audit --audit-level=high` pass in a clean clone, and `builds/` is unchanged after `npm test`.
