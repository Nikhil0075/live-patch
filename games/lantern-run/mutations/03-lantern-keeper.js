export const meta = { id: 'lantern-keeper', title: 'Lantern Keeper', author: 'Live Patch', description: 'A warm greeting at the start of every run, and a soft landing effect.' };
export function onRunStart(game) { game.showMessage('The forest lights your way'); }
export function onLand(game, event) { if (event.on === 'ledge') game.burst('leaves', event.x, event.y + 35); }
