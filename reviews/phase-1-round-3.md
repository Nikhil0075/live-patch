# Phase 1 — Review round 3

## Verdict
Pass with minors

Both round-2 Majors and all six round-2 Minors are fixed, and I reproduced each fix. Every exit criterion is met. Three new Minors remain; all are guardrail or polish gaps that the runtime already contains, so they can wait for the Phase 5 batch.

How I verified: I reviewed `51251db..4b9332c`. I ran the full suite in this repository and wrote probe mutations (Q1–Q5 below) only in a throwaway clone of `4b9332c` running on port 5273, never in this repository.

## Exit criteria
- [x] `npm run dev` starts a playable game with a visible mutation list — in the clone, the dev server started and the three examples loaded as `active`. Q3 then ran nine patches together through 15 s of attacks, movement and chat, and all nine stayed `active`.
- [x] Adding or removing a file changes the game within 2 s without a page reload — `adding and removing a mutation updates the list without navigation` passed.
- [x] A deliberately broken mutation is disabled with a notice and the game keeps running — in Q1, an endless `onTick` loop showed `failed · Event deadline exceeded` and an async throw showed `failed · Error: async boom`. The game then advanced 37 frames in the next second, with an 85 ms worst frame gap.
- [x] `npm test` runs the smoke test against each example and passes — in this repository: vitest 5/5, Playwright 25/25 (1.4 m). No temp folder was left behind, and `git status` stayed clean. `npm run smoke -- --mutation 03-danger-zone.js` passed, `tsc --noEmit` is clean, the build succeeded, and `npm audit` found 0 vulnerabilities.
- [x] The mutation API documentation is enough for an agent to write a module alone — the doc now matches the code on clamping, truncation, skipped actions, tick time, restart behaviour and the six sketches. All six sketches run as fixtures in the suite, and in Q3 they ran together with the examples without being disabled.
- [x] `engine/` has no imports from `games/`, enforced by a test — the boundary test passes, and none of the round-2 changes touch imports.
- [x] `--game` works; a missing or invalid manifest fails fast with a readable error — the loader is unchanged since round 2, where this was verified, and the unit test passes.
- [x] Renaming the game folder and changing only the manifest path still works — the game-selection code is unchanged since the round-2 rename check (vitest 5/5, Playwright 15/15 after the rename).
- [x] `docs/adding-a-game.md` exists and matches the schema — unchanged and still accurate.

## Previous findings
- P1-R2-01 — Resolved. Modules now receive only the events they export hooks for, and a full queue drops its oldest event instead of disabling the module. Q4 used three examples plus Split Enemy, 28 enemies next to the player and three Space attacks; all four patches stayed `active`. The new crowded-attack test passes.
- P1-R2-02 — Resolved. Out-of-range numbers are clamped and long strings truncated. Q3 sent a 98-character chat message to Chat Bubble, and it stayed `active`. The fleeing-coins sketch now sets velocity twice a second and stays within the budget. All six fixtures pass.
- P1-R2-03 — Resolved for templates and false positives: Q2's template-literal file was rejected (`Forbidden token: fetch`), and `` let frames `` with `` `…top… self` `` text was accepted. A new bypass replaced the old one (P1-R3-01).
- P1-R2-04 — Resolved. Inside the Worker, `Worker` is gone, and calling `importScripts` through the prototype was blocked (Q2 result `n-`, `i-`).
- P1-R2-05 — Resolved. The architecture and API docs say a server restart reloads the page and resets the run.
- P1-R2-06 — Resolved. The 5-second smoke run now spawns a pair of enemies, sends a long chat message and presses Space.
- P1-R2-07 — Resolved. Skipped tick time carries into the next `delta`, and a slow-hook test checks it.
- P1-R2-08 — Resolved. The test posts a non-parent `load` from inside the frame and checks that it is ignored.

## Findings

### Blockers
None.

### Majors
None.

### Minors
- **P1-R3-01** · `engine/mutation/validate.ts:12-19`, `engine/mutation/validate.ts:27` — A forbidden name is allowed anywhere in the file once it is declared anywhere, because the check ignores scope. In Q2, a file declared an unused arrow function with parameters named `fetch`, `self` and `WorkerGlobalScope`, then called the real globals. `/api/mutations` reported `error: null`. The runtime still blocked all of it: fetch failed, there was no `Worker`, prototype `importScripts` was blocked, and no request left the page. So this is a guardrail gap, not an escape. Suggested fix: reject any declaration that uses a forbidden name. That is simpler than resolving scopes, and an agent never needs those names.
- **P1-R3-02** · `engine/mutation/host.ts:144-145`, `games/arena-survivor/docs/mutation-api.md:28` — The invalid-action counter never resets while the module is loaded, so ten invalid actions over any period disable it. In Q5, a module that produced one non-finite velocity per second was disabled after 10 s. A module that hits a rare edge case once a minute (for example, normalising a zero-length vector) would die about ten minutes into a stream. The doc says "repeated invalid actions" without giving the rule. Suggested fix: count invalid actions inside a short sliding window (for example, 10 within 10 s), and state the exact rule in the API doc.
- **P1-R3-03** · `engine/mutation/host.ts:82-95`, `engine/mutation/host.ts:187` — Each module still has only one event in flight, so a hook with frequent events falls behind and sheds events. In Q3 after 15 s, Merge Enemies showed `302 events skipped` and Split Enemy `31 events skipped`: merges happen far less often than enemies actually touch. These counters only ever grow, and they sit in the patch list that will be on stream. Suggested fix: send each module one batch per frame (its matching events in order) and get one reply, keeping the same deadline and action limits. Show skip counts as a recent rate, or move them to a debug view rather than the on-stream list.

### Nits
None.

## Working well — do not change
- The isolation stack: a Worker per module inside the opaque sandboxed frame, a private port, load and hook deadlines, and Worker creation removed from the module's scope. In three rounds of probes, no hang, async fault, network attempt or spoofed message reached the game.
- The host clamps and truncates, then the game validates again in `apply`. Module authors get forgiving behaviour, and the game keeps hard limits.
- Hook-filtered delivery, drop-oldest queues, and tick time that carries over instead of vanishing.
- Six runnable fixtures that keep the API doc's sketches honest, plus a smoke run that triggers attack, contact and chat hooks.
- The isolated test harness (temp copy, free port, cleanup), so the suite can run beside a live stream.
- Plain-text rendering everywhere, and per-module ownership rollback of entities, effects and parameter writes.

## Phase 1 closed — carried to Phase 5

The operator accepted Phase 1 at `4b9332c`. Phase 5's "fix the batched Minor findings" step must cover the items below, and the Phase 5 review will check each one.

Open Minors:
- **P1-R3-01** — The source gate allows a forbidden name once it is declared anywhere in the file.
- **P1-R3-02** — The invalid-action counter never resets, so a rare edge case slowly disables a healthy module.
- **P1-R3-03** — Each module handles one event at a time, so it sheds frequent events, and the skip counters on the stream list only grow.

Checks to run before or during the real test stream:
- **OBS browser source.** The Worker-in-sandboxed-frame setup is only verified in Playwright's Chromium (the phase report's known gap). Load the game in the OBS browser source that will be used on stream. Add a looping module and confirm it is disabled while the game keeps running, and that the examples go `active`.
- **Phase report wording.** The rename criterion in `docs/phases/phase-1-report.md` still cites the deleted `.tmp-renamed-game` folder. Update the evidence to the `livePatch.defaultGame` rename check, so a judge reading the report finds a check that exists.

Look-ahead for Phase 3, from the phase report's known gaps:
- Rollback has to define what happens when one module has moved or removed another module's entities, because removing the editor does not undo those changes.
- The runner must take its prompt, paths and smoke command from the manifest (`apiDocs`, `examples`, `testCommand`). Phase 1 validates these fields but never uses them.
