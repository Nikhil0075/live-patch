# Architecture

The Vite development server validates the selected game's `live-patch.json` at startup. It exposes `/api/game` and `/api/mutations`, and watches the manifest's mutation directory. File events are sent over the WebSocket endpoint named by the manifest's `reload.url`.

`engine/client.ts` imports the game entry named by the manifest and connects it to `MutationHost`. The game exposes `createGame(parent, emit)` and returns an adapter with `apply`, `snapshot`, and `destroy`. Events flow from the game to each mutation; actions flow back to the game through a validated handle. No `engine/` module imports `games/`.

Each mutation runs in a separate `sandbox="allow-scripts"` iframe with an opaque origin and restrictive Content Security Policy. Its source is checked on the server before loading. Removing or replacing a file removes the frame, which also tears down its timers and state. A throwing module is disabled while the Phaser scene continues. This is a browser isolation layer; the Phase 3 runner must also use filesystem, network, and process sandboxing before accepting generated code.

The Phase 1 arena uses a Phaser scene and intentionally simple entities. The scene sends start, tick, spawn, hit, collide and score events. Mutations may request spawns, bounded parameter changes, transient shapes and plain text messages.
