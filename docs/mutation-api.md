# Mutation sound and effects

The game manifest declares which mutation actions exist. A mutation can call only those actions through its `game` handle. Arena Survivor declares `playSound(name)`, `burst(kind, x, y)`, `shake(strength)` and `flash(colour)` in addition to its earlier actions.

```js
export const meta = { id: 'coin-party', title: 'Coin party', author: 'Viewer', description: 'Celebrate score.' };
export function onScore(game, event) {
  game.playSound('coin');
  game.burst('coin', event.x ?? 480, event.y ?? 320);
}
```

The action names and allowed values come from the active game's `live-patch.json`. The host clamps numeric arguments, caps each module at four sounds and eight bursts per second, permits at most one shake per second, and allows no more than three full-screen flashes globally in any rolling second. The game applies the operator's volume, intensity and reduced-motion settings. The same narrow Worker sandbox and source gates apply to these actions.
