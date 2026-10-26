export const meta = { id: 'merge', title: 'Merge Enemies', author: 'fixture', description: 'Merge touching enemies' };
export function onEntityCollide(game, e) { game.removeEntity(e.a.id); game.removeEntity(e.b.id); game.spawn('enemy', (e.a.x + e.b.x) / 2, (e.a.y + e.b.y) / 2, Math.min(45, e.a.radius + 5)); }
