export const meta = { id: 'split', title: 'Split Enemy', author: 'fixture', description: 'Split enemies on hit' };
export function onHit(game, e) { if (e.target === 'enemy') { game.spawn('enemy', e.x - 12, e.y, 8); game.spawn('enemy', e.x + 12, e.y, 8); } }
