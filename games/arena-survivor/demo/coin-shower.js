export const meta = { id: 'demo-coin-shower', title: 'Demo patch: Coin Shower', author: 'Live Patch Demo', description: 'A prepared Practice patch scatters bright coins around the survivor.' };
export function onStart(game) {
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI / 5;
    const x = game.state.player.x + Math.cos(angle) * 80;
    const y = game.state.player.y + Math.sin(angle) * 80;
    game.spawn('coin', x, y, 9);
  }
  game.burst('coin', game.state.player.x, game.state.player.y);
  game.showMessage('DEMO PATCH: COIN SHOWER');
}
