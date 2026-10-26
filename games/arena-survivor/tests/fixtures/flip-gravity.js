export const meta = { id: 'gravity', title: 'Flip Gravity', author: 'fixture', description: 'Flip gravity periodically' };
export function onTick(game) { game.setParameter('gravityY', Math.floor(game.state.elapsed / 30) % 2 ? -80 : 80); }
