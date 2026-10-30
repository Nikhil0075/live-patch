# Arena Survivor mutation API

## Sound and effects

`game.playSound(name)` accepts the manifest's nine named sounds: `coin`, `hit`, `death`, `hurt`, `round-start`, `vote-tick`, `patch-shipped`, `patch-failed`, and `rollback`. `game.burst(kind, x, y)` accepts `spark`, `coin`, `slime`, or `celebration` at arena coordinates. `game.shake(strength)` accepts 0–0.01. `game.flash(colour)` accepts `#ffffff`, `#8bffcf`, or `#ff8d82`.

```js
export const meta = { id: 'coin-spark', title: 'Coin spark', author: 'Viewer', description: 'Coins sparkle on score.' };
export function onScore(game) {
  game.playSound('coin');
  game.burst('coin', 480, 320);
}
```

The host drops excess requests: at most four sounds or eight bursts per module each second, one shake per second, and three full-screen flashes in any rolling second across all modules. Operator settings cap volume and intensity; reduced flashing and shake makes those effects no-ops. Sound starts only after the streamer clicks **Enable sound** in the play view. The OBS overlay remains silent.

Place one `.js` module in `mutations/`. Export `meta = { id, title, author, description }` with four nonempty strings under 120 characters. Export any of `onStart(game)`, `onTick(game, event)`, `onSpawn(game, event)`, `onHit(game, event)`, `onCollide(game, event)`, `onEntityCollide(game, event)`, `onScore(game, event)` or `onChat(game, event)`. No imports or browser globals are available. The module runs in its own sandboxed Worker, and its hooks may return promises. Each load has a 1.5 second deadline; an event batch has a 1.8–2.2 second wall-clock deadline to tolerate scheduler stalls on a busy streaming PC. A timeout or error disables the module without stopping the game.

`onStart` runs once when this file is added or changed. Adding, removing or failing another module does not rerun it. Editing this file replaces its Worker, reruns its `onStart`, and removes its owned entities, effects and parameter writes. Removing or failing this file also removes those owned effects. Score already earned remains. Module-local variables persist until this file changes or is removed. A full development-server restart, including one caused by editing the manifest, reloads the page and resets the run.

While the game is paused, `onTick` and game event delivery stop; `elapsed` and `runElapsed` do not advance. Actions from hook replies already in flight are held until resume. Removing or disabling a module while paused drops its held actions.

Rollback removes the module, its owned entities, drawings, messages and parameter writes. Changes it made to other modules' entities (including velocity, radius, tag, position or removal) are not reversed. Score already earned remains.

`game.state` is a JSON snapshot. It contains `player: {x,y,lives}`, `score`, `elapsed` (active seconds since page load), `runElapsed` (active seconds in current run), `frame`, `enemies`, `coins`, `floatingTexts`, `frameRate`, `maxFrameGap`, and `entities`. `entities` contains at most 100 live `{id,kind,x,y,radius,vx,vy,tag}` records. IDs are stable for an entity's lifetime. Kinds are `enemy`, `coin`, `bomb` and `fire`. Arena coordinates are 1152×648 (16:9).

Events:

- `onTick`: `{type:'tick', delta}` where `delta` is seconds, including time from ticks skipped while this hook was busy.
- `onSpawn`: `{type:'spawn', id, kind, x, y}`. A module does not receive spawn events caused by its own actions.
- `onHit`: `{type:'hit', target, id, kind, x, y}` where `target` is `enemy` for Space attacks or fire damage, and `player` for player damage.
- `onCollide`: `{type:'collide', id, kind, x, y}` when the player begins touching an entity.
- `onEntityCollide`: `{type:'entityCollide', a, b}` when two enemies begin touching; `a` and `b` each have `id,kind,x,y,radius`.
- `onScore`: `{type:'score', amount}`.
- `onChat`: `{type:'chat', text, author}`. Twitch EventSub and the local simulator both deliver chat through the engine host. Treat both strings as untrusted text.

The `game` handle has only these methods. Bad arguments are ignored or bounded by the game:

- `spawn(kind,x,y,radius?)`: add an entity; radius is 4–45. Per-kind live caps are 28 enemies, 36 coins, 12 bombs and 20 fire, with 96 total.
- `removeEntity(id)`, `moveEntity(id,x,y)`, `setVelocity(id,vx,vy)`, `setRadius(id,radius)`, `setTag(id,tag)`: edit a live entity. Position stays inside the arena, velocity is -250–250 per axis, radius 4–45, and tags are 24 characters at most.
- `setParameter(key,value)`: `enemySpeed` 0–350, `coinValue` 1–100, `playerSpeed` 30–500, `spawnInterval` 0.2–5 seconds, `gravityX` and `gravityY` -100–100. When a module is removed, its parameter writes are removed and the most recent remaining write wins.
- `drawShape(x,y,radius,color)`: fading ring with radius 1–100 and a six-digit hex color.
- `drawText(text,x,y)`: plain-text label at a position for two seconds, up to 80 characters.
- `showMessage(text)`: plain-text banner for two seconds, up to 100 characters.

The host processes matching events in ordered batches of up to 16 and applies at most 20 actions from one batch and 60 from one module per second. Hooks must return quickly: the wall-clock limit starts at 1.8 seconds and grows to at most 2.2 seconds for a full batch; long loops disable the module. Further valid actions are skipped and counted in the patch list. Numbers outside declared bounds are clamped and long strings are truncated. Wrong types and unknown enum values are ignored; ten invalid actions within a rolling 60-second window disable the module. Use `game.state.elapsed` for timing; do not create timers. Rendering text as HTML is never allowed.

Example:

```js
export const meta = { id: 'fast', title: 'Fast', author: 'viewer', description: 'Move faster' };
export function onStart(game) { game.setParameter('playerSpeed', 300); }
```

## Six idea sketches

These one-line sketches show the intended handle calls; they are not full modules with metadata. Runnable versions of all six live in `tests/fixtures/` and run in the browser suite with their relevant events.

```js
function onHit(game, e) { if (e.target === 'enemy') { game.spawn('enemy', e.x - 12, e.y, 8); game.spawn('enemy', e.x + 12, e.y, 8); } } // split enemy on hit
function onTick(game) { game.setParameter('gravityY', Math.floor(game.state.elapsed / 30) % 2 ? -80 : 80); } // flip gravity
function onTick(game) { if (Math.floor(game.state.elapsed * 2) !== last) { last = Math.floor(game.state.elapsed * 2); for (const e of game.state.entities.filter(e => e.kind === 'coin')) game.setVelocity(e.id, Math.sign(e.x - game.state.player.x) * 80, 0); } } // fleeing coins; declare let last = -1
function onTick(game) { if (Math.floor(game.state.elapsed * 5) !== last) { last = Math.floor(game.state.elapsed * 5); game.spawn('fire', game.state.player.x, game.state.player.y, 10); } } // fire trail; declare let last = -1
function onChat(game, e) { const foe = game.state.entities.find(e => e.kind === 'enemy'); if (foe) game.drawText(e.text, foe.x, foe.y - 25); } // chat speech bubble
function onEntityCollide(game, e) { game.removeEntity(e.a.id); game.removeEntity(e.b.id); game.spawn('enemy', (e.a.x + e.b.x) / 2, (e.a.y + e.b.y) / 2, Math.min(45, e.a.radius + 5)); } // merging enemies
```

The source gate limits a module to 120 lines and 12,000 bytes. It rejects direct use of imports, network, DOM, storage, frame navigation, globals and timers. The gate is a guardrail; the Worker, frame CSP, deadlines and action validation provide runtime isolation. The Phase 3 runner must also apply filesystem and process isolation before generated code ships.
