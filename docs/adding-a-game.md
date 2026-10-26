# Adding a game

Create a folder containing `live-patch.json`, a TypeScript entry, API documentation, a mutation directory, and a smoke test. Start with `npm run dev -- --game path/to/game`. The engine reads the manifest and does not need a code change.

Manifest fields: `name` is a display name; `entry` is the relative `src/*.ts` entry exporting `createGame`; `mutationDir` is the relative folder for `.js` mutation modules; `apiDocs` is the relative API reference; `examples` lists relative example folders; `forbidden` adds tokens rejected before loading; `testCommand` is the smoke command with `{file}` as a substitution placeholder; `reload` has `type: "websocket"` and a URL; `maxFileLines` is a positive integer no greater than 120. Paths must stay inside the game folder. An invalid or missing manifest stops startup with an error.

`createGame(parent, emit)` returns `apply(action)`, `snapshot()` and `destroy()`. Emit typed events for your important game actions and implement only the bounded actions your game supports. Make `snapshot()` JSON serializable and finite. Keep text output as text, never HTML.

Document for mutation authors: metadata fields; every hook with its event payload; state snapshot fields; exact action names, parameter names and limits; timing units; an example module; what happens when a hook throws. Provide a smoke test that runs five seconds with a named mutation and fails on errors, stalls or invalid state. File changes in `mutationDir` must reach the page through the manifest's reload method.
