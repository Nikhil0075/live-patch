export const meta = { id: 'owl-pinecones', title: 'Owl Pinecones', author: 'Fixture', description: 'Owls drop pinecones at a bounded pace.' };
let last = -3;
export function onTick(game) {
  if (game.state.elapsed - last < 3) return;
  const owl = game.state.entities.find(entity => entity.kind === 'owl');
  if (owl) { last = game.state.elapsed; game.spawn('pinecone', owl.x, owl.y + 35); }
}
