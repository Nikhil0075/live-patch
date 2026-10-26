export const meta = { id: 'danger-zone', title: 'Danger Zone', author: 'Live Patch', description: 'Bombs appear every twelve seconds.' };
let last = -1;
export function onTick(game) {
  const slot = Math.floor(game.state.elapsed / 12);
  if (slot > last) { last = slot; if (slot > 0) { game.spawn('bomb', 80 + (slot * 137) % 800, 80 + (slot * 73) % 480); game.showMessage('BOMB INCOMING'); } }
}
