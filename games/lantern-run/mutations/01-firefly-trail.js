export const meta = { id: 'firefly-trail', title: 'Firefly Trail', author: 'Live Patch', description: 'Collected fireflies sparkle behind the fox.' };
export function onCollect(game, event) {
  if (event.kind === 'firefly') game.burst('sparks', game.state.player.x - 35, game.state.player.y);
}
