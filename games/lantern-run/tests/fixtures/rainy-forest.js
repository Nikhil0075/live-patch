export const meta = { id: 'rainy-forest', title: 'Rainy Forest', author: 'Fixture', description: 'Rain and a gentler running pace.' };
export function onStart(game) { game.setWeather('rain'); game.setParameter('runSpeed', 230); }
