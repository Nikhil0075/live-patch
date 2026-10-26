export const meta = { id: 'fire', title: 'Fire Trail', author: 'fixture', description: 'Leave a fire trail' };
let last = -1;
export function onTick(game) { if (Math.floor(game.state.elapsed * 5) !== last) { last = Math.floor(game.state.elapsed * 5); game.spawn('fire', game.state.player.x, game.state.player.y, 10); } }
