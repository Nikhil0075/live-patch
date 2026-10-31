export const meta = { id: 'speech-bubble', title: 'Speech Bubble', author: 'Fixture', description: 'Show chat as plain text above the fox.' };
export function onChat(game, event) { game.drawText(event.text, game.state.player.x, game.state.player.y - 80); }
