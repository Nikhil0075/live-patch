# Adding a game

Create a folder containing `live-patch.json`, a TypeScript entry, API documentation, a mutation directory and a game-specific Playwright suite under `tests/smoke/`. Start with `npm run new-game -- "My Game"` for a working template. Import an existing folder through Library after manifest validation and smoke testing, then use **Make active** to switch the running game without editing `package.json`. The engine never imports game source directly.

## Manifest reference

- `name`: display name shown on the page.
- Optional `description`, `tags`, `version`, and `author`: Library card metadata.
- Optional `cover`: relative PNG, JPEG or WebP inside the game folder, at most 1 MB.
- Optional `audio` and `effects`: allow lists of names for sound and effect actions. Games should validate the action again in their adapter, and the engine enforces per-module and global rate limits.
- `hint`: short game-specific control instructions, rendered as plain text.
- `entry`: relative `src/*.ts` entry exporting `createGame`.
- `mutationDir`: relative folder containing `.js` mutation modules.
- `apiDocs`: relative mutation API reference.
- `examples`: relative example folders; all must exist inside the game folder.
- `forbidden`: extra source identifiers rejected before loading. Manifests add restrictions to the engine's fixed list.
- `testCommand`: command with `{file}` placeholder for a mutation smoke test. The Phase 3 runner will invoke it.
- `actions`: object mapping handle method names to positional argument schemas. Each argument declares `type` (`number`, `string` or `boolean`) and may declare `min`, `max`, `maxLength`, allowed string `values`, or `optional`. The engine checks this envelope and the game validates again in `apply`.
- `hooks`: mapping from emitted event types to export names, for example `"entityCollide": "onEntityCollide"`.
- `reload`: `{"type":"websocket","url":"ws://127.0.0.1:5173","event":"live-patch:changed"}`. Use a local host, explicit port and a unique custom event name. Phase 1 sends that event over Vite's development WebSocket. The test runner overrides the port to isolate itself from a live server.
- `maxFileLines`: positive integer up to 120; the engine also caps files at 12,000 bytes.

The manifest is validated before any server port opens. Paths must stay inside the game folder. `npm run smoke -- --mutation file.js` copies the selected game to a temporary directory, starts the engine on free ports, and runs that game's smoke suite there. `LIVE_PATCH_GAME=path/to/game` selects a different game for `npm test` and `npm run smoke`.

## Game adapter contract

The entry exports `createGame(parent, emit)`. `parent` is the game's container; `emit(event)` sends `{type: string, ...payload}` to mutations. The function returns:

- `apply(action, origin)`: validate and apply a game-specific `{type,args}` action. `origin` is the mutation filename for ownership and loop suppression.
- `removeMutation(origin)`: remove effects, entities and parameter writes owned by the removed or failed module without replaying unrelated modules.
- `snapshot()`: return a JSON-serializable state with only finite numbers and bounded lists.
- `destroy()`: free game resources.

The engine adds `origin` to actions and skips a module's own spawned events when sending that event back to it. Keep entity creation bounded; refuse new spawns at a cap instead of silently deleting old entities. Render all game and viewer text as plain text. The game-specific smoke suite must run for five seconds with a chosen module and fail on errors, disabled modules, frame stalls, excessive slowdown or invalid state.

## API documentation checklist

Document metadata fields, all hook names and event payloads, the snapshot schema, every action and its limits, timing units, ownership and reload semantics, error behavior, and at least one complete module. Explain how chat events enter when the game supports them. The [Arena Survivor API](../games/arena-survivor/docs/mutation-api.md) is the reference example.
- `controls` (optional): read-only key map shown in the `/play` pause menu. Each entry has an `action` label and a nonempty `keys` array. The engine handles Menu (Esc or P), Full screen (F) and Mute (M); include those in the map so players can discover them.
- `demoMutation` (optional): relative path to a prepared `.js` mutation inside the game folder. Practice may copy this file into `mutationDir` after a Practice pitch reaches approval. Its metadata must clearly say **Demo**. The live Twitch pipeline cannot invoke this action for a Twitch pitch.
