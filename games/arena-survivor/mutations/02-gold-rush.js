export const meta = { id: 'gold-rush', title: 'Gold Rush', author: 'Live Patch', description: 'Coins are worth twice as much.' };
export function onStart(game) { game.setParameter('coinValue', 20); game.drawShape(480, 320, 80, '#ffd263'); }
