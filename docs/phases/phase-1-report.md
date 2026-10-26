# Phase 1 report

## Built

- Playable Phaser arena with movement, enemies, coins, score, lives and an active patch list.
- Manifest schema and startup validation, game independent engine loader, and local WebSocket reload endpoint selected by the manifest.
- Mutation API with isolated per-module frames, source checks, bounded game actions, hot add/edit/remove, fault notices and reset of persistent parameter changes when a module is removed or fails.
- Three example mutations: Quick Feet, Gold Rush and Danger Zone.
- Browser smoke tests, platform contract tests, README, architecture, API reference, adding-a-game guide and research record.

New dependencies: Phaser renders the arena; Vite serves the game and watches mutation files; Zod validates manifests; `ws` hosts the manifest-selected reload endpoint; TypeScript checks module boundaries; Vitest checks the contract; Playwright exercises the running browser game. `@types/node` and `@types/ws` provide types for development code.

## How to run and test

- `npm install`, then `npx playwright install chromium`, then `npm run dev` and open http://127.0.0.1:5173.
- `npm test` runs four unit checks and six browser tests, including five seconds of game time for each example.
- `npm run smoke -- --mutation 01-quick-feet.js` runs one example's smoke test.
- `npm run build` checks TypeScript and bundles the engine client; `npm audit --audit-level=moderate` checks dependencies.

## Exit criteria

- [x] `npm run dev` starts a playable game with a visible mutation list — all three examples appeared as active in the browser smoke tests.
- [x] Add or remove a file and update without page reload within two seconds — Playwright add/remove test measures both operations and checks the navigation count.
- [x] Broken mutation is disabled while play continues — Playwright fault isolation test observes the notice and later frames.
- [x] `npm test` checks each example mutation — three separate five-second browser runs passed.
- [x] Mutation API is documented — `games/arena-survivor/docs/mutation-api.md` lists metadata, hooks, payloads, actions, limits and an example.
- [x] `engine/` imports no game code — unit boundary test passed.
- [x] `--game` supports another folder — copied the arena folder to a renamed path, started with `npm run dev -- --game .tmp-renamed-game`, observed its manifest entry at `/api/game` and loaded the browser game.
- [x] Missing or invalid manifest fails with a readable error — unit tests passed.
- [x] `docs/adding-a-game.md` describes the schema and game adapter.

Final checks: `npm test` passed (4 unit, 6 browser); `npm run build` passed; `npm audit --audit-level=moderate` found zero vulnerabilities. The focused `npm run smoke` command also passed.

## Deferred

- Twitch OAuth, chat, EventSub and simulator to Phase 2.
- Codex runner, generated-code worktrees, path gates and rollback to Phase 3.
- Production packaging of a selected game and standalone deployment to a later phase. The Phase 1 Vite build is a type and bundle check; the working experience uses `npm run dev`.

## Known gaps / risks

- The static source gate rejects obvious unsafe APIs, but cannot prove arbitrary JavaScript safe. Browser frame isolation and CSP reduce access; the Phase 3 runner must apply process, filesystem and network isolation before it accepts AI-generated source.
- The local reload socket uses the explicit URL and port in the manifest. A second game must choose an available local port.
- `apiDocs` and `testCommand` are validated manifest fields; the live runner does not consume them until Phase 3.

## Review responses

No operator review received yet.
