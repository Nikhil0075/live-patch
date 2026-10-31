export const meta = { id: 'forest-breeze', title: 'Forest Breeze', author: 'Live Patch', description: 'A gentle wind and a celebration at each distance milestone.' };
export function onStart(game) { game.setWeather('wind'); }
export function onMilestone(game) { game.burst('leaves', game.state.player.x, game.state.player.y); }
