export const meta = { id: 'milestone-springs', title: 'Milestone Springs', author: 'Fixture', description: 'A spring appears every 200 metres.' };
export function onMilestone(game, event) { if (event.meters % 200 === 0) game.spawn('spring', 1250, 498); }
