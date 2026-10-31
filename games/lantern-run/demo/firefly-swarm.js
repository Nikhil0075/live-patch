export const meta = { id: 'demo-firefly-swarm', title: 'Demo: Firefly Swarm', author: 'Live Patch Demo', description: 'A prepared Practice patch brings a cluster of fireflies into the run lane.' };
export function onStart(game) {
  for (let i = 0; i < 8; i++) game.spawn('firefly', 650 + i * 55, 338 + (i % 3) * 26);
  game.burst('celebration', 790, 350);
  game.showMessage('DEMO PATCH: FIREFLY SWARM');
}
