export const meta = { id: 'demo-quick-feet', title: 'Demo: Quick Feet', author: 'Live Patch Demo', description: 'The survivor moves faster. This prepared patch shows how shipping works in Practice.' };
export function onStart(game) { game.setParameter('playerSpeed', 300); game.showMessage('DEMO PATCH SHIPPED'); }
