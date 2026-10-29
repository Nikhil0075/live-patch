const palettes = [
  ['#11152d', '#7540de', '#f6ba5d'],
  ['#071d2b', '#168e9b', '#f4b87e'],
  ['#27112b', '#c84b84', '#ffcf65'],
  ['#152317', '#5ba46b', '#f0d77b'],
  ['#23171b', '#c96345', '#e9ba79']
];

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);

export function generatedCover(name: string): string {
  let hash = 2166136261;
  for (const char of name) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619) >>> 0;
  const [dark, bright, light] = palettes[hash % palettes.length];
  const title = escape(name.slice(0, 45));
  const offset = hash % 90;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960" role="img" aria-label="Artwork for ${title}">
<defs><linearGradient id="sky" x2="1" y2="1"><stop stop-color="${dark}"/><stop offset=".7" stop-color="${bright}"/><stop offset="1" stop-color="${dark}"/></linearGradient><radialGradient id="orb"><stop stop-color="${light}"/><stop offset=".65" stop-color="${bright}"/><stop offset="1" stop-color="${dark}"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="28"/></filter></defs>
<rect width="720" height="960" fill="url(#sky)"/><circle cx="${350 + offset}" cy="380" r="230" fill="${light}" opacity=".4" filter="url(#glow)"/><circle cx="${350 + offset}" cy="380" r="170" fill="url(#orb)" stroke="${light}" stroke-width="10"/>
<path d="M0 640 Q180 550 360 640 T720 630 V960 H0Z" fill="${dark}" opacity=".8"/><path d="M0 730 Q180 650 360 730 T720 720" fill="none" stroke="${light}" stroke-width="8" opacity=".7"/>
<g fill="${light}" opacity=".9"><circle cx="120" cy="210" r="13"/><circle cx="600" cy="170" r="8"/><circle cx="580" cy="555" r="12"/><circle cx="130" cy="540" r="7"/></g>
<rect x="38" y="790" width="644" height="130" rx="16" fill="${dark}" opacity=".85"/><text x="64" y="865" fill="#fff" font-size="42" font-weight="800" font-family="Arial,sans-serif">${title}</text></svg>`;
}
