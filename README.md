# Live Patch

Live Patch is a browser arena game that gains new rules from small JavaScript mutation modules while play continues. This repository currently implements Phase 1: the game, manifest contract, isolated mutation loader and smoke tests. Twitch input and the live Codex runner are later phases.

## Run

Requires Node.js 20 or newer.

```sh
npm install
npx playwright install chromium
npm run dev
```

Open http://127.0.0.1:5173. Move with WASD or arrow keys, use Space to attack, collect coins and watch the active patches at right. Add, edit or delete a `.js` file in `games/arena-survivor/mutations/` while the game runs; its module updates without page navigation.

```sh
npm test
npm run smoke -- --mutation 01-quick-feet.js
npm run build
npm run dev -- --game games/arena-survivor
```

`npm test` runs manifest and boundary checks plus five second browser smoke checks for each example, fault isolation and live reload. `npm run smoke` focuses on one mutation. Both commands copy the game to a temporary folder and use free ports, so they work while `npm run dev` is still running and never put test mutations into the live game. Set `LIVE_PATCH_GAME=path/to/game` to test another game. The `--game` path starts another game folder with a valid manifest; `package.json` → `livePatch.defaultGame` selects the default folder. `npm run build` checks TypeScript and builds the engine client; Phase 1 runs games through the development server. The project needs no environment variables or Twitch OAuth scopes yet.

## Add a game or mutation

Read [the game contract](docs/adding-a-game.md) and [the Arena Survivor mutation API](games/arena-survivor/docs/mutation-api.md). Each mutation exports metadata and optional hooks. The loader rejects files over 120 lines or 12,000 bytes and direct use of forbidden APIs. It runs accepted modules in dedicated Workers inside sandboxed, opaque-origin frames with a restrictive Content Security Policy. Load and hook deadlines stop loops without freezing the game. Each module can only request bounded game actions; failures disable that module and leave the game running.

## Research used for Phase 1

- [Phaser Scene lifecycle](https://docs.phaser.io/phaser/concepts/scenes) establishes the scene update loop used by the game.
- [Vite plugin API](https://vite.dev/guide/api-plugin.html) supports watching mutation files from the development server.
- [MDN iframe sandbox guidance](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe) explains why the mutation frame uses `allow-scripts` without `allow-same-origin`.
- [Playwright web server and browser setup](https://playwright.dev/docs/test-webserver) informs the browser smoke test setup.

The browser frame is one layer of isolation for the local Phase 1 app. Phase 3 must additionally isolate the code-writing process and apply filesystem and test gates before any generated module is accepted.
