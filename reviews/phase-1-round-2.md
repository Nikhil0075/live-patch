# Phase 1 — Review round 2

## Verdict
Fail

All of round 1's Blockers and Majors are fixed, and I reproduced each fix: Worker deadlines, the network block, per-file reloads, the free-port test harness, the renamed game folder and the arena reset. The fixes introduced two new Majors. One crowded Space attack disables every healthy patch. And the host disables a module for an out-of-range argument where the API doc promises the value will be bounded, which breaks 3 of the doc's own 6 example sketches. Both are fixable without changing the design.

How I verified: I reviewed `746863b..51251db`. I ran `npm test` in this repository while the live dev server held port 5173. I wrote probe mutations (R1–R11 below) only in a throwaway clone of `51251db` running on port 5273, never in this repository.

## Exit criteria
- [x] `npm run dev` starts a playable game with a visible mutation list — the live server at 127.0.0.1:5173 serves the manifest with its new `hint`. In the clone, the three examples load as `active`. All 15 smoke tests drive the game.
- [x] Adding or removing a file changes the game within 2 s without a page reload — `adding and removing a mutation updates the list without navigation` passed (1.7 s).
- [x] A deliberately broken mutation is disabled with a notice and the game keeps running — probe R1 ran an endless `onTick` loop and an async throw side by side. Both ended up `failed` ("Event deadline exceeded" and "Error: async boom"), and the game advanced 35 frames in the next second with a 87 ms worst frame gap. The suite's loop, top-level-loop, stall and async tests all pass.
- [x] `npm test` runs the smoke test against each example and passes — in this repository, with the live server up: vitest 5/5 and Playwright 15/15 in 1 m 13 s. No `.live-patch-test-*` folder was left behind, and `git status` stayed clean. `npm run smoke -- --mutation 02-gold-rush.js` also passed, `tsc --noEmit` is clean, the build succeeded, and `npm audit` found 0 vulnerabilities.
- [ ] The mutation API documentation is enough for an agent to write a module alone — the doc says bad arguments are "ignored or bounded by the game", but the host disables the module instead. Three of the six "idea sketches" in the doc were disabled in probes R4, R5 and R10. See **P1-R2-02**.
- [x] `engine/` has no imports from `games/`, enforced by a test — the AST-based test covers `engine/**` and `vite.config.ts`. `engine/game-api.ts` is now generic.
- [x] `--game` works; a missing or invalid manifest fails fast with a readable error — the loader code is unchanged except for the new example-path checks. The round-1 evidence still holds, and the unit test passes.
- [x] Renaming the game folder and changing only the manifest path still works — in the clone I renamed the folder to `games/arena-renamed` and changed only `livePatch.defaultGame` in `package.json`. vitest passed 5/5 and Playwright 15/15.
- [x] `docs/adding-a-game.md` exists and matches the schema — every manifest field (now including `hint`, `actions`, `hooks` and `reload.event`) is described. The four adapter methods match `engine/game-api.ts`.

## Previous findings
- P1-R1-01 — Resolved. Each module runs in a Worker with a 1.5 s load deadline and a 200 ms hook deadline (R1, plus the suite's loop tests).
- P1-R1-02 — Resolved. In R2, the module's `fetch`, `importScripts` and `eval` all failed inside the Worker, and no request left the page. There is no frame navigation from a Worker.
- P1-R1-03 — Resolved. The frame accepts messages only from `parent` and only one `load`, and module code has no `parent` or `frames` to reach.
- P1-R1-04 — Resolved. Reloads now reconcile file by file. In my probes, healthy modules stayed `active` through adds and removes, and the suite's start-effect test passes.
- P1-R1-05 — Resolved. The async rejection disabled the module with its error text (R1).
- P1-R1-06 — Resolved. The smoke test now checks the worst frame gap (< 350 ms) and frame rate against a no-mutation baseline, and stalls now happen off the game thread.
- P1-R1-07 — Resolved for runaway loops: there is a per-module budget, spawns are refused at a cap instead of evicting, and a module never receives events from its own spawns. The budget now catches legitimate modules too (P1-R2-02).
- P1-R1-08 — Resolved. The engine uses generic `{type,args}` actions and `{type,…}` events. Actions and hooks are declared in the manifest, and the frame builds the handle from them.
- P1-R1-09 — Resolved for capability. Entity IDs, positions, per-entity actions, `drawText`, enemy hits and contact events exist. Their documented use fails at runtime (P1-R2-02).
- P1-R1-10 — Resolved. One default path in `package.json`, a per-game smoke suite, and a working rename (see Exit criteria).
- P1-R1-11 — Resolved. A free port and a temporary copy of the game; the full suite passed alongside the live server.
- P1-R1-12 — Resolved. In R9 (45 s idle with the examples), enemies stayed between 0 and 5 and every new run started at full lives with a cleared arena.
- P1-R1-13 — Partly resolved. Plain words in strings and comments are now allowed, but template literals produce both a full bypass and new false positives (P1-R2-03).
- P1-R1-14 — Resolved.
- P1-R1-15 — Resolved. `ready` and `reply` messages are shape-checked and their IDs matched.
- P1-R1-16 — Resolved: the page now recovers by itself. The way it recovers is a full page reload (P1-R2-05).
- P1-R1-17 — Resolved. Failed and rejected modules stay listed with their reason (seen throughout R1–R11).
- P1-R1-18 — Resolved.
- P1-R1-19 — Resolved.
- P1-R1-20 — Resolved.
- P1-R1-21 — Resolved. `.tmp-renamed-game` is gone.

## Findings

### Blockers
None.

### Majors
- **P1-R2-01** · `engine/mutation/host.ts:63-70` — Normal play can overflow every module's event queue, and the host then disables every healthy patch at once. Every game event goes to every active module, even modules with no hook for it. Each module has only one event in flight at a time, and a queue of 64 disables it. A Space attack that hits about 20 enemies emits about 40 `hit` and `score` events in one frame. In probe R11, I spawned enemies next to the player, waited 1 s for the queues to drain, then pressed Space once. With 18 enemies alive, all three examples stayed `active`. With 22, **all three** showed `failed · Event queue limit exceeded`. With 26 or more, the spawn burst plus enemy contacts disabled them before the attack. Quick Feet and Gold Rush only have an `onStart`, yet they died from `hit` events they never handle. On stream, one good Space press in a crowd (likely once a viewer patch adds enemies or splits them) would wipe every viewer's patch. Suggested fix: send a module only the events its exports handle. Have the Worker report which hook names it exports in `ready`. Deliver one frame's events as a single batch rather than one round trip per event. When a backlog builds up, coalesce or drop the oldest non-critical events and count them, rather than disabling the module. Reserve disabling for the module's own deadline misses and invalid output. Add a smoke test with the three examples active and about 28 enemies hit by one attack, asserting that all of them stay `active`.
- **P1-R2-02** · `engine/mutation/host.ts:112-118`, `games/arena-survivor/live-patch.json:11-20`, `games/arena-survivor/docs/mutation-api.md:19-28`, `games/arena-survivor/docs/mutation-api.md:41-48` — The mutation API doc does not match the code, and its own sketches get disabled. Line 19 says "Bad arguments are ignored or bounded by the game", but the host disables any module that sends an argument outside the manifest range or longer than `maxLength`. Evidence:
  - R5: `setParameter('enemySpeed', 600)` led to `bound · failed · Invalid game action`. A `drawText` 25 px above an enemy also failed once an enemy spawned near the top edge (enemies spawn at y = 20).
  - R4: the doc's speech-bubble sketch passes chat text straight to `drawText`. An ordinary 98-character chat message disabled it ("Invalid game action"). Twitch allows 500 characters.
  - R10: the doc's fleeing-coins sketch moves every coin on every tick. With 20 coins on the field, it was disabled within 3 s ("Action rate limit exceeded"). With more than 20 coins it would also break the 20-actions-per-hook rule.

  These are exactly the free-form ideas live-Codex will copy from this doc, and they pass the 5-second smoke test (P1-R2-06) before failing on stream. Suggested fix: pick one rule and make the doc and the code agree. The safer rule: the host clamps numbers into their declared range and cuts strings to `maxLength`, and drops (and counts) only actions with a wrong type or an unknown enum value. Disable a module only for repeated invalid output. Rewrite the fleeing-coins sketch to stay within the budget, for example by setting velocities a few times per second. Turn all six sketches into fixture modules that the smoke suite runs: with Space presses, a long chat event, and enemies near the edges. That keeps the doc honest.

### Minors
- **P1-R2-03** · `engine/mutation/validate.ts:10-14` — The token gate runs TypeScript's raw scanner without re-scanning template literals. After the first `${…}`, everything that follows is scanned as plain code, or swallowed as template text. In probe R2, one `` `${0}` `` near the top hid `fetch`, `WebSocket`, `importScripts`, `Worker`, `eval` and `globalThis` in the rest of the file, and `/api/mutations` reported `error: null`. In R3, the gate rejected `` `+${e.amount} straight to the top` `` ("Forbidden token: top") and `` `… Watch your self` `` ("self"). It also rejected a plain `let frames = 0` ("frames"), a likely name for a frame counter. The runtime layer held in R2, so this is a guardrail gap, not an escape. Suggested fix: parse with `ts.createSourceFile`, walk identifier nodes, and check only free references (not property names or object keys). Add unit tests for template literals.
- **P1-R2-04** · `engine/mutation/frame.ts:35` — The Worker inherits `worker-src blob:`, so module code can start nested Workers (R2: a nested Worker was created successfully). Nested Workers could burn CPU while the module still answers its hooks in time. Disposing the module does kill them. Suggested fix: remove `Worker`, `SharedWorker` and `importScripts` from the Worker's global scope in the bootstrap before importing module code.
- **P1-R2-05** · `vite.config.ts:31`, `docs/architecture.md:3` — After any server restart, including the automatic one on every manifest edit, Vite's client reloads the whole page. In probe R7, my page marker was gone and the run timer had restarted. The doc says the client reconnects and refetches mutations, which implies the run continues. Suggested fix: say plainly that a restart reloads the page and resets the run. Consider validating manifest edits and asking for a manual restart, rather than restarting mid-stream.
- **P1-R2-06** · `games/arena-survivor/tests/smoke/smoke.spec.ts:24-29` — The 5-second smoke run only holds the arrow keys. It never presses Space, never sends a chat event, and rarely causes enemy contacts. So `onHit` (enemy), `onChat` and `onEntityCollide` code never runs inside the gate. The speech-bubble module from R4 would pass smoke and then fail live, which works against Phase 3's "a runtime crash never reaches the live game". Suggested fix: during the 5 s, press Space a few times, send one synthetic chat event with long text, and spawn a small cluster near the player.
- **P1-R2-07** · `engine/mutation/host.ts:66`, `games/arena-survivor/docs/mutation-api.md:11` — A tick is skipped while a module's previous event is still pending, so a module that adds up `delta` falls behind real time without knowing it. Suggested fix: add the skipped time to the next tick's `delta`, or document that ticks are skipped and `game.state.elapsed` is the clock.
- **P1-R2-08** · `games/arena-survivor/tests/smoke/smoke.spec.ts:113` — The test "a mutation cannot replace code in another module or navigate a frame" fails its module at `({}).constructor.constructor('return this')()`, because the CSP blocks `Function`. It never reaches the sibling-frame `postMessage` it is named after, so it would still pass if the frame's `event.source !== parent` check were removed. Suggested fix: reach a sibling with a template-literal gate bypass (as in R2), or assert inside the frame document that a non-parent `load` is ignored.

### Nits
None.

## Working well — do not change
- A Worker per module inside the opaque sandboxed frame, a private `MessagePort`, and load and hook deadlines. This is the right shape, and it held against every escape and hang probe.
- Reconciling the module list file by file, with owned entities, effects and parameter writes undone per module (last write wins on removal).
- The test harness copies the game, picks a free port and cleans up after itself. A full `npm test` ran alongside the live server and left the tree clean.
- Manifest-declared actions and hooks, with the game validating every action a second time in `apply`.
- Per-kind spawn caps that refuse spawns instead of evicting entities, enemy and coin timeouts, and a clean new-run reset: the base game now holds up over a long idle run (R9).
- All game and viewer text stays plain: `textContent` in the page, and Phaser text for `drawText` and banners.
- The review responses in the report give one line per finding, each with a reason.
