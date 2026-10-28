import Phaser from 'phaser';

type ArtKind = 'player' | 'enemy' | 'coin' | 'bomb' | 'fire';
const colors: Record<ArtKind, [string, string, string]> = {
  player: ['#e4fff7', '#5df0bc', '#0b806f'], enemy: ['#ffe1e6', '#ff6c8d', '#9b264a'],
  coin: ['#fff7b3', '#ffd15d', '#b16a22'], bomb: ['#eedbff', '#ae76ed', '#643e9b'],
  fire: ['#fff4b2', '#ff9951', '#d74431']
};

function texture(kind: ArtKind): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = 112; canvas.height = 112;
  const ctx = canvas.getContext('2d')!;
  const [light, body, dark] = colors[kind];
  const halo = ctx.createRadialGradient(56, 56, 19, 56, 56, 54);
  halo.addColorStop(0, `${body}bb`); halo.addColorStop(.65, `${body}55`); halo.addColorStop(1, `${body}00`);
  ctx.fillStyle = halo; ctx.fillRect(0, 0, 112, 112);
  ctx.shadowColor = body; ctx.shadowBlur = 12;
  const shape = () => {
    ctx.beginPath();
    if (kind === 'enemy') { ctx.moveTo(24, 73); ctx.bezierCurveTo(15, 62, 24, 25, 55, 24); ctx.bezierCurveTo(88, 22, 96, 63, 87, 75); ctx.quadraticCurveTo(56, 87, 24, 73); }
    else if (kind === 'coin') ctx.ellipse(56, 56, 31, 36, 0, 0, Math.PI * 2);
    else ctx.arc(56, 56, kind === 'player' ? 34 : 31, 0, Math.PI * 2);
    ctx.closePath();
  };
  shape();
  const fill = ctx.createLinearGradient(30, 24, 82, 88);
  fill.addColorStop(0, light); fill.addColorStop(.35, body); fill.addColorStop(1, dark);
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = light; ctx.stroke(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff88'; ctx.beginPath(); ctx.ellipse(43, 39, 15, 7, -.45, 0, Math.PI * 2); ctx.fill();
  if (kind === 'player' || kind === 'enemy') {
    ctx.fillStyle = kind === 'enemy' ? '#501d38' : '#164d49';
    for (const x of [45, 68]) { ctx.beginPath(); ctx.ellipse(x, 54, 4.2, 6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.lineWidth = 3; ctx.strokeStyle = kind === 'enemy' ? '#501d38' : '#164d49'; ctx.beginPath(); ctx.arc(56, 62, 12, .2, Math.PI - .2); ctx.stroke();
    if (kind === 'enemy') { ctx.beginPath(); ctx.moveTo(36, 44); ctx.lineTo(49, 48); ctx.moveTo(75, 44); ctx.lineTo(63, 48); ctx.stroke(); }
  } else if (kind === 'coin') {
    ctx.strokeStyle = '#fff4b0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(56, 56, 23, 28, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff7c7'; ctx.font = 'bold 37px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', 56, 56);
  } else if (kind === 'bomb') {
    ctx.fillStyle = '#fff1ff'; ctx.font = 'bold 39px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('✦', 56, 57);
  }
  return canvas;
}

export function createArenaTextures(scene: Phaser.Scene): void {
  for (const kind of Object.keys(colors) as ArtKind[]) if (!scene.textures.exists(`arena-${kind}`)) scene.textures.addCanvas(`arena-${kind}`, texture(kind));
  if (!scene.textures.exists('arena-floor')) {
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 640;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#071524'; ctx.fillRect(0, 0, 960, 640);
    const light = ctx.createRadialGradient(480, 320, 30, 480, 320, 440);
    light.addColorStop(0, '#164e51'); light.addColorStop(.42, '#103044'); light.addColorStop(1, '#071524');
    ctx.fillStyle = light; ctx.fillRect(0, 0, 960, 640);
    ctx.strokeStyle = '#37707c54'; ctx.lineWidth = 1;
    for (let x = 0; x <= 960; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 640); ctx.stroke(); }
    for (let y = 0; y <= 640; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(960, y); ctx.stroke(); }
    ctx.strokeStyle = '#80e7c533'; ctx.lineWidth = 3;
    for (const radius of [105, 180, 265]) { ctx.beginPath(); ctx.ellipse(480, 320, radius * 1.3, radius * .8, 0, 0, Math.PI * 2); ctx.stroke(); }
    scene.textures.addCanvas('arena-floor', canvas);
  }
}
