export const meta = { id: 'quick-feet', title: 'Quick Feet', author: 'Live Patch', description: 'The survivor moves faster.' };
export function onStart(game) { game.setParameter('playerSpeed', 300); game.showMessage('QUICK FEET ACTIVATED'); }
