# Phase 1 report

## Built

- Playable Phaser arena with movement, Space attacks, bounded enemies, coins, score, lives, a clean new-run reset and an active patch list.
- Manifest schema and startup validation, game independent engine loader, and a manifest-selected event on Vite's development WebSocket.
- Mutation API with one Worker per module inside an opaque sandboxed frame, load and hook deadlines, source checks, manifest-declared action schemas and hooks, bounded game actions, independent hot add/edit/remove, and persistent failure notices.
- Entity IDs, movement and size actions, text at a position, enemy-hit and entity-contact events, plus a chat event hook ready for Phase 2.
- Three example mutations: Quick Feet, Gold Rush and Danger Zone.
- Browser smoke tests, platform contract tests, README, architecture, API reference, adding-a-game guide and research record.

Dependencies: Phaser renders the arena; Vite serves the game, watches mutation files and carries reload events; Zod validates manifests; TypeScript checks module boundaries and tokenizes mutation source; Vitest checks the contract; Playwright exercises the running browser game. `@types/node` provides development types. Review round 1 added no dependency.

## How to run and test

- `npm install`, then `npx playwright install chromium`, then `npm run dev` and open http://127.0.0.1:5173.
- `npm test` runs five unit checks and fifteen browser tests, including five seconds of game time for each example. It copies the selected game and picks a free port, so the live server may remain open.
- `npm run smoke -- --mutation 01-quick-feet.js` runs one example's smoke test.
- `npm run build` checks TypeScript and bundles the engine client; `npm audit --audit-level=moderate` checks dependencies.

## Exit criteria

- [x] `npm run dev` starts a playable game with a visible mutation list — all three examples appeared as active in the browser smoke tests.
- [x] Add or remove a file and update without page reload within two seconds — Playwright add/remove test measures both operations and checks the navigation count.
- [x] Broken mutation is disabled while play continues — tests cover synchronous and asynchronous exceptions, an endless hook loop, a top-level loop and a three-second stall; later game frames advance.
- [x] `npm test` checks each example mutation — three separate five-second browser runs passed.
- [x] Mutation API is documented — `games/arena-survivor/docs/mutation-api.md` lists metadata, hooks, payloads, actions, limits and an example.
- [x] `engine/` imports no game code — AST-based unit boundary test covers engine modules and the Vite server plugin.
- [x] `--game` supports another folder — copied the arena folder to a renamed path, started with `npm run dev -- --game .tmp-renamed-game`, observed its manifest entry at `/api/game` and loaded the browser game.
- [x] Missing or invalid manifest fails with a readable error — unit tests passed.
- [x] `docs/adding-a-game.md` describes the schema and game adapter.

Final checks after review fixes: `npm test` passed (5 unit, 15 browser) while the live development server held port 5173; the focused `npm run smoke -- --mutation 01-quick-feet.js` passed; `npm run build` passed; `npm audit --audit-level=moderate` found zero vulnerabilities. A focused smoke run also passed with `LIVE_PATCH_GAME` pointing at a renamed copy of the game.

## Deferred

- Twitch OAuth, chat, EventSub and simulator to Phase 2.
- Codex runner, generated-code worktrees, path gates and rollback to Phase 3.
- Production packaging of a selected game and standalone deployment to a later phase. The Phase 1 Vite build is a type and bundle check; the working experience uses `npm run dev`.

## Known gaps / risks

- The static source gate rejects direct forbidden identifiers but cannot prove arbitrary JavaScript safe. The Worker, opaque frame, CSP, deadlines and action checks limit runtime access; Phase 3 still needs process, filesystem and network isolation for AI-written files.
- The manifest's reload URL supplies the local Vite port by default; its event name must be unique to this game's reload messages.
- `apiDocs` and `testCommand` are validated manifest fields; the live runner does not consume them until Phase 3.
- The Worker path is verified in Chromium through Playwright. OBS browser-source compatibility still needs a manual check on the stream machine.
- Per-entity edits to an entity owned by another module are immediate game actions; removing the editor module does not rewind past positions or resurrect removed entities. Phase 3 must define rollback semantics for those effects.

## Review responses

- **P1-R1-01 Fixed:** each mutation runs off the game thread in a Worker; load and event deadlines disable endless loops. Browser tests cover both.
- **P1-R1-02 Fixed:** mutation code has no frame navigation API; the opaque frame retains CSP and the host rejects a second frame load or changed origin.
- **P1-R1-03 Fixed:** the frame accepts `load` only once from its parent; a private `MessagePort` keeps Worker messages separate from spoofable global posts. An escape test leaves other modules active.
- **P1-R1-04 Fixed:** file-by-file reconciliation preserves unchanged Workers and `onStart` state; owned effects and parameter writes are removed only with their module. A regression test checks enemy counts across unrelated reloads.
- **P1-R1-05 Fixed:** hooks may return promises; the Worker awaits them under the event deadline and reports rejections and global Worker errors. The async-error test disables the module.
- **P1-R1-06 Fixed:** smoke checks maximum host frame gap, frame rate against a no-mutation baseline, and active status after five seconds. A deliberate three-second stall is disabled.
- **P1-R1-07 Fixed:** spawned events carry their origin and skip that mutation, the host enforces 60 actions per second, and the arena refuses spawns at per-kind caps. The action-storm test verifies disablement.
- **P1-R1-08 Fixed:** the engine now uses generic action and event envelopes; the manifest declares action argument schemas and hook mappings, while the game validates its own actions again.
- **P1-R1-09 Fixed:** entity IDs, positions, tags, radius, movement, velocity, draw-text and entity-contact hooks support the six idea sketches in the API guide. Phase 2 will supply real Twitch chat events to the existing `onChat` hook.
- **P1-R1-10 Fixed:** the default game path is in `package.json`; the selected game's own `tests/smoke/` suite and manifest mutation folder drive tests. `LIVE_PATCH_GAME` selects another game.
- **P1-R1-11 Fixed:** tests copy the active game into a temporary folder, choose a free port, and never write fixture mutations to the live folder. A full run is performed while the live server is open.
- **P1-R1-12 Fixed:** enemies and pickups expire, spawns have per-kind caps, and a new run clears the swarm and resets run time. A browser test caps 50 requested enemies and observes the clean reset.
- **P1-R1-13 Fixed:** the source gate uses the TypeScript scanner to match identifiers outside strings and comments; false-positive examples and frame-escape identifiers have unit tests.
- **P1-R1-14 Fixed:** the add-a-game guide lists every adapter method, ownership behavior, action descriptors and reload URL/event rules.
- **P1-R1-15 Fixed:** ready and reply messages are shape-checked against load state and event ID; malformed messages disable the module.
- **P1-R1-16 Fixed:** Vite's WebSocket reconnects and the client refetches mutations after each connection.
- **P1-R1-17 Fixed:** rejected and failed modules remain in the list with a reason until their file changes or is removed.
- **P1-R1-18 Fixed:** the page heading and hint come from manifest text rendered with `textContent`.
- **P1-R1-19 Fixed:** every example path is checked for containment and existence, with an escape regression test.
- **P1-R1-20 Fixed:** the boundary test parses import declarations and calls, resolves relative paths, and includes `vite.config.ts`.
- **P1-R1-21 Fixed:** removed the empty temporary folder and the dead game-path check.
