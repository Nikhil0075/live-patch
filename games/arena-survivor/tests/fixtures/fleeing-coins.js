export const meta = { id: 'flee', title: 'Fleeing Coins', author: 'fixture', description: 'Coins flee from the player' };
let last = -1;
export function onTick(game) { if (Math.floor(game.state.elapsed * 2) !== last) { last = Math.floor(game.state.elapsed * 2); for (const e of game.state.entities.filter(e => e.kind === 'coin')) game.setVelocity(e.id, Math.sign(e.x - game.state.player.x) * 80, 0); } }
