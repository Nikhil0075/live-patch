# Phase 1 foundation

Goal: a playable browser game whose behavior can be extended through small mutation modules, with an automated smoke test. The platform contract added on October 26 is included before Phase 2.

## Build

- Scaffold the repository with standing instructions, reviewer instructions, vision and architecture.
- Build a simple arena survivor with player movement, enemies, pickups, score and lives. It should be fun for 60 seconds without mutations.
- Define modules in the active game's `mutationDir`. Each exports `id`, `title`, `author`, `description` metadata and optional hooks including `onStart`, `onTick`, `onSpawn`, `onCollide` and `onScore`. Hooks receive a narrow handle, never raw Phaser or page globals.
- Load, unload and hot reload modules without restarting the game. A failing module is disabled and play continues.
- Supply three hand-specified example mutations.
- Run a Playwright smoke test for five seconds with the requested mutation. Fail on a thrown error, stalled frames or non-finite game state.
- Place the game under `games/arena-survivor/` and game-independent code under `engine/`.
- Validate `live-patch.json` on startup with clear errors. Discover game paths and reload behavior through the manifest.
- Document how another developer adds a game.

## Exit criteria

- [ ] `npm run dev` starts a playable game with a visible mutation list.
- [ ] Adding or removing a file in `mutationDir` changes the game within two seconds without page reload.
- [ ] A deliberately broken mutation is disabled with an on-screen notice and the game keeps running.
- [ ] `npm test` runs the smoke test against each example mutation and passes.
- [ ] The mutation API documentation is sufficient for an agent to write a module alone.
- [ ] `engine/` has no imports from `games/`, enforced by a test or lint rule.
- [ ] `--game games/arena-survivor` works; missing or invalid manifests fail fast with readable errors.
- [ ] Renaming the game folder and changing only the manifest path still works.
- [ ] `docs/adding-a-game.md` exists and matches the schema.

Reviewer focus: Is the API small but expressive enough for free-form ideas? Can a mutation reach DOM, network, globals or persistent timers? Does a crashing module take down the game? Does the engine remain independent of this particular game?
