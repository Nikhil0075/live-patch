# Arena Survivor mutation API

Place one `.js` file in `mutations/`. Export `meta = { id, title, author, description }` with four strings shorter than 120 characters. Export any of `onStart(game)`, `onTick(game, event)`, `onSpawn(game, event)`, `onHit(game, event)`, `onCollide(game, event)`, or `onScore(game, event)`. Hooks run in an isolated iframe, not in the Phaser scene. A hook that throws is disabled with a visible notice. Removing or editing its file unloads the old frame.

`game.state` is a snapshot: `player: {x, y, lives}`, `score`, `elapsed` in seconds, `frame`, `enemies`, `coins`. `onTick` receives `{type:'tick', delta}` with `delta` in seconds. Spawn, hit and collide events contain `kind` (`enemy`, `coin`, `bomb`) and `x, y`. Score events contain `amount`. `onStart` runs after the module loads.

The handle has four methods: `spawn(kind, x, y)` adds an enemy, coin or bomb inside the 960×640 arena; `setParameter(key, value)` changes `enemySpeed` (0–350), `coinValue` (1–100), `playerSpeed` (30–500), `spawnInterval` (0.2–5 seconds), `gravityX` and `gravityY` (-100–100); `drawShape(x, y, radius, color)` draws a fading ring with radius 1–100 and six digit hex color; `showMessage(text)` displays up to 100 plain text characters for two seconds. Per event, at most 20 actions are accepted.

Example:

```js
export const meta = { id: 'fast', title: 'Fast', author: 'viewer', description: 'Move faster' };
export function onStart(game) { game.setParameter('playerSpeed', 300); }
```

Do not import modules or use browser globals, network, storage, timers or DOM. Use `game.state.elapsed` for timing. The source gate rejects forbidden tokens and files over 120 lines or 12,000 bytes. Avoid spawning on every `onSpawn`, which can form a loop. Use `onTick` and state to pace effects.
