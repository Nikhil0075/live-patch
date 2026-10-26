# Arena Survivor mutation API

Place one `.js` module in `mutations/`. Export `meta = { id, title, author, description }` with four nonempty strings under 120 characters. Export any of `onStart(game)`, `onTick(game, event)`, `onSpawn(game, event)`, `onHit(game, event)`, `onCollide(game, event)`, `onEntityCollide(game, event)`, `onScore(game, event)` or `onChat(game, event)`. No imports or browser globals are available. The module runs in its own sandboxed Worker, and its hooks may return promises. Each load has a 1.5 second deadline; each hook call has a 200 ms deadline. A timeout or error disables the module without stopping the game.

`onStart` runs once when this file is added or changed. Adding, removing or failing another module does not rerun it. Editing this file replaces its Worker, reruns its `onStart`, and removes its owned entities, effects and parameter writes. Removing or failing this file also removes those owned effects. Score already earned remains. Module-local variables persist until this file changes or is removed.

`game.state` is a JSON snapshot. It contains `player: {x,y,lives}`, `score`, `elapsed` (seconds since page load), `runElapsed` (seconds in current run), `frame`, `enemies`, `coins`, `floatingTexts`, `frameRate`, `maxFrameGap`, and `entities`. `entities` contains at most 100 live `{id,kind,x,y,radius,vx,vy,tag}` records. IDs are stable for an entity's lifetime. Kinds are `enemy`, `coin`, `bomb` and `fire`. Arena coordinates are 960×640.

Events:

- `onTick`: `{type:'tick', delta}` where `delta` is seconds.
- `onSpawn`: `{type:'spawn', id, kind, x, y}`. A module does not receive spawn events caused by its own actions.
- `onHit`: `{type:'hit', target, id, kind, x, y}` where `target` is `enemy` for Space attacks or fire damage, and `player` for player damage.
- `onCollide`: `{type:'collide', id, kind, x, y}` when the player begins touching an entity.
- `onEntityCollide`: `{type:'entityCollide', a, b}` when two enemies begin touching; `a` and `b` each have `id,kind,x,y,radius`.
- `onScore`: `{type:'score', amount}`.
- `onChat`: `{type:'chat', text, author}`. The game accepts this event through the engine host; Twitch will supply it in Phase 2. Treat both strings as untrusted text.

The `game` handle has only these methods. Bad arguments are ignored or bounded by the game:

- `spawn(kind,x,y,radius?)`: add an entity; radius is 4–45. Per-kind live caps are 28 enemies, 36 coins, 12 bombs and 20 fire, with 96 total.
- `removeEntity(id)`, `moveEntity(id,x,y)`, `setVelocity(id,vx,vy)`, `setRadius(id,radius)`, `setTag(id,tag)`: edit a live entity. Position stays inside the arena, velocity is -250–250 per axis, radius 4–45, and tags are 24 characters at most.
- `setParameter(key,value)`: `enemySpeed` 0–350, `coinValue` 1–100, `playerSpeed` 30–500, `spawnInterval` 0.2–5 seconds, `gravityX` and `gravityY` -100–100. When a module is removed, its parameter writes are removed and the most recent remaining write wins.
- `drawShape(x,y,radius,color)`: fading ring with radius 1–100 and a six-digit hex color.
- `drawText(text,x,y)`: plain-text label at a position for two seconds, up to 80 characters.
- `showMessage(text)`: plain-text banner for two seconds, up to 100 characters.

At most 20 actions may come from one hook call and 60 from one module per second. Exceeding a limit disables the module. Use `game.state.elapsed` for timing; do not create timers. Rendering text as HTML is never allowed.

Example:

```js
export const meta = { id: 'fast', title: 'Fast', author: 'viewer', description: 'Move faster' };
export function onStart(game) { game.setParameter('playerSpeed', 300); }
```

## Six idea sketches

These one-line sketches show the intended handle calls; they are not full modules with metadata.

```js
function onHit(game, e) { if (e.target === 'enemy') { game.spawn('enemy', e.x - 12, e.y, 8); game.spawn('enemy', e.x + 12, e.y, 8); } } // split enemy on hit
function onTick(game) { game.setParameter('gravityY', Math.floor(game.state.elapsed / 30) % 2 ? -80 : 80); } // flip gravity
function onTick(game) { for (const e of game.state.entities.filter(e => e.kind === 'coin')) game.moveEntity(e.id, e.x + Math.sign(e.x - game.state.player.x) * 2, e.y); } // fleeing coins
function onTick(game) { if (Math.floor(game.state.elapsed * 5) !== last) { last = Math.floor(game.state.elapsed * 5); game.spawn('fire', game.state.player.x, game.state.player.y, 10); } } // fire trail; declare let last = -1
function onChat(game, e) { const foe = game.state.entities.find(e => e.kind === 'enemy'); if (foe) game.drawText(e.text, foe.x, foe.y - 25); } // chat speech bubble
function onEntityCollide(game, e) { game.removeEntity(e.a.id); game.removeEntity(e.b.id); game.spawn('enemy', (e.a.x + e.b.x) / 2, (e.a.y + e.b.y) / 2, Math.min(45, e.a.radius + 5)); } // merging enemies
```

The source gate limits a module to 120 lines and 12,000 bytes. It rejects direct use of imports, network, DOM, storage, frame navigation, globals and timers. The gate is a guardrail; the Worker, frame CSP, deadlines and action validation provide runtime isolation. The Phase 3 runner must also apply filesystem and process isolation before generated code ships.
