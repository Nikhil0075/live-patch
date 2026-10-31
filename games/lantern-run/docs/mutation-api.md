# Lantern Run mutation API

Each load has a 3 second deadline. A module that does not load in time is disabled; the game keeps running.

Generated owls fly toward the fox at one of three seeded heights, with a gentle vertical wave. Mutation-spawned owls can be moved with `setVelocity` and `moveEntity`.

Put one `.js` module in `mutations/`. Export `meta` with nonempty `id`, `title`, `author`, and `description` strings under 120 characters, plus any of the hooks below. Modules have no imports, DOM, network, storage, timers or browser globals. The sandboxed Worker runs `onStart` once when that file is added or changed. Other module reloads do not restart it. An error, unhandled rejection or 1.8–2.2 second event deadline disables only that module. A full dev-server restart resets the run.

```js
export const meta = { id: 'double-jump', title: 'Double Jump', author: 'Viewer', description: 'Jump again before landing.' };
export function onStart(game) { game.setParameter('maxJumps', 2); }
```

All time values are seconds; distance is metres. Canvas coordinates are 1152×648, with ground top at y=518 and the fox near x=346. Spawn x may be up to 1400, just beyond the right edge. The fox runs automatically; Space, W, Up or a canvas click/tap jumps, and a short hold adds lift. The game has a three-second safe start, three hearts, one second of invulnerability after damage, and a two-second automatic restart after run over.

## State and hooks

`game.state` is a JSON snapshot: `player {x,y,vy,grounded,jumpsLeft,hearts,maxHearts,powerUps}`, `run {number,distance,fireflies,best,speed}`, `elapsed`, `runElapsed`, `frame`, `frameRate`, `maxFrameGap`, `weather`, `parameters`, and up to 100 `entities` of `{id,kind,x,y,size,vx,vy,tag}`. `elapsed` excludes paused time. Distance, fireflies and hearts already earned remain when a module is removed. Entity IDs stay stable for their lifetime.

| Event | Hook | Payload |
|---|---|---|
| `start` | `onStart` | Module load, once |
| `tick` | `onTick` | `{delta,distance}`; skipped ticks are added to the next `delta` |
| `runStart` | `onRunStart` | `{run}` |
| `runEnd` | `onRunEnd` | `{run,distance,fireflies}` |
| `jump` | `onJump` | `{jumpIndex,x,y}`; first jump is 1 |
| `land` | `onLand` | `{x,y,on}`; `on` is `ground`, `ledge` or `spring` |
| `collect` | `onCollect` | `{id,kind,value}` |
| `hit` | `onHit` | `{id,kind,hearts}` |
| `fall` | `onFall` | `{hearts}` |
| `milestone` | `onMilestone` | `{meters}` every 100 metres |
| `spawn` | `onSpawn` | `{id,kind,x,y}`; a module does not receive its own spawn |
| `chat` | `onChat` | `{text,author}` from Twitch or Practice; both are untrusted plain text |

While Play is paused, physics, time, hook delivery and audio stop. Actions in flight wait until resume; removing the module discards them.

## Actions

Bad numeric arguments are clamped, long strings truncated, wrong types and unknown values ignored. Ten invalid actions in 60 seconds disable a module. The host allows at most 20 actions per event batch and 60 per module per second. Per-module effects are further limited to four sounds, eight bursts and one shake per second; only three full-screen flashes may fire globally per second. The adapter checks every action again.

| Handle method | Bounds and behavior |
|---|---|
| `spawn(kind,x,y,size?)` | Kinds: `log`, `thorns`, `boulder` (12 combined); `owl` (6); `pinecone` (10); `firefly` (40); `acorn` (10); `ledge` (10); `spring` (4); `shield`, `glider`, `magnet` (4 combined). Maximum 80 live entities. x 0–1400, y 0–648, size 0.5–2.5. |
| `removeEntity(id)` | Remove a live entity by positive ID. |
| `moveEntity(id,x,y)` | Move a live entity; x 0–1400, y 0–648. |
| `setVelocity(id,vx,vy)` | World-relative velocity, -300–300 px/s per axis. |
| `setSize(id,size)` | Size 0.5–2.5. |
| `setTag(id,tag)` | Plain-text tag up to 24 characters. |
| `setParameter(key,value)` | `runSpeed` 120–600 px/s, `speedRamp` 0–3, `gravity` 300–2400 px/s², `jumpPower` 300–1100, `maxJumps` 1–3, `spawnRate` 0.3–3, `fireflyValue` 1–10, `maxHearts` 3–5. |
| `grantPowerUp(kind,seconds)` | `shield`, `glider` or `magnet`, 1–15 seconds. Shield absorbs one hit; glider slows descent; magnet draws nearby fireflies. |
| `heal(amount)` | 1–2 hearts, capped at `maxHearts`. |
| `setWeather(kind)` | `clear`, `rain`, `wind` or `fog`, visual only. |
| `drawShape(x,y,radius,color)` | Fading ring at x 0–1152, y 0–648, radius 1–100, six-digit hex color. |
| `drawText(text,x,y)` | Plain-text label up to 80 characters; x 0–1152, y 0–648. |
| `showMessage(text)` | Plain-text banner up to 100 characters, below the engine patch toast. |
| `playSound(name)` | `jump`, `land`, `firefly`, `acorn`, `hurt`, `fall`, `run-over`, `spring`, `power-up`, `round-start`, `vote-tick`, `patch-shipped`, `patch-failed`, `rollback`. Sound needs a streamer click to unlock. |
| `burst(kind,x,y)` | `sparks`, `leaves`, `splash`, `celebration` at canvas coordinates; a shared 64-particle budget applies. |
| `shake(strength)` | 0–0.01, disabled by reduced flashing/shake settings. |
| `flash(colour)` | `#ffffff`, `#ffd56b` or `#ff5a6e`; disabled by reduced flashing/shake settings. |

The engine sends `systemEvent` actions for `round-start`, `vote-tick`, `shipped`, `failed`, and `rolled_back`; the game translates these to its synthesized audio cues. `configure(settings)` applies mute, volume, effects intensity, reduced flashing/shake and HUD size. `captureFrame()` supplies the studio mirror.

Removing, editing, failing or rolling back a module removes its spawned entities, drawings, particles, parameter writes, weather write and granted power-ups. The latest remaining parameter or weather write wins. Collected fireflies, travelled distance, lost or healed hearts and changes to another module's entities are not reversed. Module-local variables persist while that module stays loaded. Run best lives in memory for this session only.

## Six idea sketches

Runnable modules for these sketches live in `tests/fixtures/`; the browser suite sends each required trigger.

```js
function onStart(game) { game.setParameter('maxJumps', 2); } // double jump
function onMilestone(game, event) { if (event.meters % 300 === 0) game.grantPowerUp('magnet', 5); } // firefly magnet
function onTick(game) { if (game.state.elapsed - last >= 3) { const owl = game.state.entities.find(e => e.kind === 'owl'); if (owl) { last = game.state.elapsed; game.spawn('pinecone', owl.x, owl.y + 35); } } } // owl pinecones; declare let last = -3
function onStart(game) { game.setWeather('rain'); game.setParameter('runSpeed', 230); } // rainy forest
function onChat(game, event) { game.drawText(event.text, game.state.player.x, game.state.player.y - 80); } // speech bubble
function onMilestone(game, event) { if (event.meters % 200 === 0) game.spawn('spring', 1250, 498); } // milestone springs
```

The source gate caps a module at 120 lines and 12,000 bytes and rejects imports and forbidden identifiers. The host's Worker isolation, deadlines and validated action envelope apply even when source inspection misses a pattern. Renderer text uses Phaser text objects, never HTML.
