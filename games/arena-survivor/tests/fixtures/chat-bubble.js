export const meta = { id: 'bubble', title: 'Chat Bubble', author: 'fixture', description: 'Put chat over an enemy' };
export function onChat(game, e) { const foe = game.state.entities.find(entity => entity.kind === 'enemy'); if (foe) game.drawText(e.text, foe.x, foe.y - 25); }
