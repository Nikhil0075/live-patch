export const meta = { id: 'firefly-magnet', title: 'Milestone Magnet', author: 'Fixture', description: 'Pull fireflies close every 300 metres.' };
export function onMilestone(game, event) { if (event.meters % 300 === 0) game.grantPowerUp('magnet', 5); }
