import Phaser from 'phaser';

type Draw = (c: CanvasRenderingContext2D) => void;
function texture(scene: Phaser.Scene, key: string, w: number, h: number, draw: Draw): void {
  if (scene.textures.exists(`lantern-world-${key}`)) return;
  const ratio = key === 'sky' || key === 'clouds' || key === 'foreground' || key.startsWith('layer-') ? 1 : 2;
  const canvas = document.createElement('canvas'); canvas.width = w * ratio; canvas.height = h * ratio;
  const c = canvas.getContext('2d')!; c.scale(ratio, ratio); draw(c);
  scene.textures.addCanvas(`lantern-world-${key}`, canvas);
}
function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient, angle = 0): void {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2); c.fill();
}
function path(c: CanvasRenderingContext2D, points: number[], color: string | CanvasGradient): void {
  c.fillStyle = color; c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath(); c.fill();
}
function line(c: CanvasRenderingContext2D, points: number[], color: string, width: number): void {
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]); c.stroke();
}
function gradient(c: CanvasRenderingContext2D, x: number, y: number, x2: number, y2: number, colors: string[]): CanvasGradient {
  const g = c.createLinearGradient(x, y, x2, y2); colors.forEach((color, i) => g.addColorStop(i / (colors.length - 1), color)); return g;
}
function pine(c: CanvasRenderingContext2D, x: number, base: number, tall: number, color: string, lit: string): void {
  line(c, [x, base, x, base - tall], '#453d46', Math.max(3, tall / 18));
  for (let tier = 0; tier < 4; tier++) {
    const top = base - tall + tier * tall * .16, half = tall * (.15 + tier * .035);
    path(c, [x, top, x - half, top + tall * .38, x + half, top + tall * .38], color);
    line(c, [x + 2, top + 8, x + half * .54, top + tall * .31], lit, 1);
  }
}
function forest(c: CanvasRenderingContext2D, index: number): void {
  const w = 1152, h = 330;
  const colors = [
    ['#77718d', '#9e8294'], ['#565b7b', '#82778d'], ['#3a5564', '#607276'],
    ['#294e52', '#4e7864'], ['#1e3b3e', '#3c6251']
  ][index];
  if (index === 0) {
    for (let j = 0; j < 8; j++) {
      const x = j * 180 - 80, peak = 90 + (j * 53) % 72;
      path(c, [x - 210, h, x, peak, x + 220, h], j % 2 ? '#766f89' : '#8d8193');
      path(c, [x - 18, peak + 22, x, peak, x + 23, peak + 25], '#b2a0a4');
    }
  }
  const count = [22, 28, 34, 24, 18][index];
  for (let i = 0; i < count; i++) {
    const x = (i * 227 + i * i * 31 + index * 19) % w;
    const tall = 102 + (i * 47 + index * 23) % (index > 2 ? 172 : 125);
    pine(c, x, h + 20, tall, colors[0], colors[1]);
  }
  if (index >= 3) {
    for (let i = 0; i < 7; i++) {
      const x = (i * 171 + index * 51) % w;
      line(c, [x, h - 22, x + 12, h - 5, x + 19, h + 10], '#658253', 3);
      ellipse(c, x + 9, h - 25, 8, 4, '#83a969', -.3);
    }
    if (index === 3) for (let i = 0; i < 10; i++) {
      const x = (i * 139 + 48) % w, y = h - 30 - i % 3 * 15;
      c.shadowColor = '#f5d479'; c.shadowBlur = 13;
      ellipse(c, x, y, 7, 4, '#e8bc6b'); c.shadowBlur = 0;
      line(c, [x, y + 2, x, y + 14], '#b7b08a', 2);
    }
  }
}
function prop(c: CanvasRenderingContext2D, kind: string): void {
  if (kind === 'log' || kind === 'log-stack') {
    const rows = kind === 'log-stack' ? [0, -20, -39] : [0];
    for (const [i, offset] of rows.entries()) {
      const x = 20 + i * 12, y = 71 + offset;
      ellipse(c, 48, y, 39 - i * 7, 13, gradient(c, 10, y - 15, 90, y + 14, ['#9c6639', '#65402a', '#3e2d27']), -.09);
      ellipse(c, x, y + 1, 11, 13, '#b28354'); ellipse(c, x, y + 1, 7, 8, '#765032');
      line(c, [40, y - 6, 73, y - 8], '#c09057', 2);
    }
    ellipse(c, 56, 46 - (rows.length - 1) * 16, 29, 5, '#60904c');
    for (let i = 0; i < 7; i++) line(c, [31 + i * 7, 44 - (rows.length - 1) * 16, 32 + i * 7, 37 - (rows.length - 1) * 16], '#93b85b', 2);
  } else if (kind === 'thorns') {
    for (let i = 0; i < 6; i++) {
      const x = 8 + i * 15, top = 26 + i % 3 * 8;
      path(c, [x, 81, x + 11, top, x + 22, 81], gradient(c, x, top, x + 16, 82, ['#d786c7', '#783d8c', '#393353']));
      line(c, [x + 11, top + 8, x + 13, 72], '#e8a5d6', 1.3);
    }
    path(c, [2, 80, 93, 80, 85, 88, 12, 88], '#493446');
  } else if (kind === 'boulder') {
    path(c, [12, 75, 23, 40, 52, 26, 78, 37, 91, 68, 80, 86, 20, 87], gradient(c, 28, 23, 80, 88, ['#b8ac9d', '#78898a', '#3d5362']));
    path(c, [23, 40, 52, 26, 48, 51, 16, 68], '#a7ada7');
    line(c, [59, 38, 65, 54, 52, 70], '#576568', 2);
    ellipse(c, 38, 37, 10, 3, '#d5c1a3', -.3);
  } else if (kind === 'ledge') {
    path(c, [3, 46, 88, 43, 91, 64, 74, 72, 10, 70], gradient(c, 15, 44, 75, 78, ['#9f8d68', '#56544a', '#38464d']));
    path(c, [3, 45, 12, 35, 83, 34, 91, 44, 76, 49, 16, 50], '#709650');
    for (let i = 0; i < 9; i++) line(c, [9 + i * 9, 48, 10 + i * 9, 52 + i % 3 * 6], '#a5bb68', 2);
    for (let i = 0; i < 5; i++) ellipse(c, 18 + i * 15, 37, 5, 3, '#9db970');
  } else if (kind === 'spring') {
    ellipse(c, 48, 76, 35, 8, '#374d52');
    line(c, [31, 68, 61, 61, 32, 54, 62, 47, 32, 40], '#d7d5bc', 5);
    ellipse(c, 48, 35, 35, 12, '#b84836'); ellipse(c, 48, 31, 27, 6, '#f7bb74');
    for (let i = 0; i < 5; i++) ellipse(c, 25 + i * 11, 31, 2, 2, '#ffe6a0');
  } else if (kind === 'acorn') {
    ellipse(c, 48, 55, 19, 25, gradient(c, 32, 33, 62, 77, ['#f7c563', '#a56a36', '#6a412a']));
    ellipse(c, 48, 38, 23, 12, '#765131');
    for (let i = 0; i < 6; i++) line(c, [30 + i * 7, 38, 34 + i * 7, 46], '#b38d55', 1);
    line(c, [48, 29, 53, 17], '#6d4d32', 3); ellipse(c, 43, 55, 6, 12, '#ffd98288');
  } else if (kind === 'pinecone') {
    ellipse(c, 48, 53, 24, 31, '#573b30');
    for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
      const x = 31 + col * 17 + row % 2 * 5, y = 31 + row * 10;
      path(c, [x - 8, y, x + 8, y, x, y + 12], row % 2 ? '#b47e49' : '#98643b');
      line(c, [x - 3, y + 2, x, y + 5], '#e5aa62', 1);
    }
  } else if (kind === 'shield') {
    c.strokeStyle = '#ffd278'; c.lineWidth = 6; c.shadowColor = '#ffca61'; c.shadowBlur = 15;
    c.beginPath(); c.arc(48, 48, 34, 0, Math.PI * 2); c.stroke(); c.shadowBlur = 0;
    path(c, [48, 27, 65, 35, 62, 56, 48, 68, 34, 56, 31, 35], '#9cd7d8aa');
    line(c, [48, 33, 48, 61], '#fff2c8', 2);
  } else if (kind === 'glider') {
    path(c, [8, 62, 29, 25, 59, 17, 88, 39, 60, 54, 35, 50], gradient(c, 28, 20, 66, 60, ['#c0df88', '#689a54', '#3f7145']));
    line(c, [8, 62, 49, 37, 88, 39], '#497a45', 3);
  } else if (kind === 'magnet') {
    c.strokeStyle = '#e0c675'; c.lineWidth = 15; c.beginPath(); c.arc(48, 43, 29, 0, Math.PI); c.stroke();
    ellipse(c, 19, 49, 9, 11, '#ec785a'); ellipse(c, 77, 49, 9, 11, '#ec785a');
    line(c, [18, 41, 18, 48], '#ffe0a0', 2);
  }
}

export function createWorldArt(scene: Phaser.Scene): void {
  texture(scene, 'sky', 1152, 648, c => {
    c.fillStyle = gradient(c, 0, 0, 0, 648, ['#15233f', '#2d3d64', '#78587a', '#d48b72', '#f0bb83']); c.fillRect(0, 0, 1152, 648);
    const halo = c.createRadialGradient(740, 215, 10, 740, 215, 180);
    halo.addColorStop(0, '#ffe1a675'); halo.addColorStop(1, '#ffe1a600'); ellipse(c, 740, 215, 180, 180, halo);
    ellipse(c, 740, 215, 54, 54, '#ffe8b9'); ellipse(c, 724, 207, 52, 52, '#f1c391');
    for (let i = 0; i < 34; i++) ellipse(c, (i * 227 + 45) % 1152, (i * 71 + 33) % 300, i % 4 ? 1 : 2, 1, '#fff2d8aa');
    for (let i = 0; i < 9; i++) ellipse(c, (i * 307 + 25) % 1152, 290 + i % 3 * 27, 85, 11, '#edb3a02b');
  });
  texture(scene, 'clouds', 1152, 200, c => {
    for (let i = 0; i < 10; i++) {
      const x = (i * 311 + 71) % 1152, y = 52 + i % 4 * 31;
      ellipse(c, x, y, 74 + i % 3 * 19, 14, '#f1c6b429');
      ellipse(c, x + 37, y - 6, 44, 11, '#ecd4c035');
    }
  });
  for (let i = 0; i < 5; i++) texture(scene, `layer-${i}`, 1152, 330, c => forest(c, i));
  texture(scene, 'foreground', 1152, 190, c => {
    for (let i = 0; i < 32; i++) {
      const x = (i * 191 + i * i * 17) % 1152, y = 166 + i % 3 * 10;
      line(c, [x, 198, x - 10, y - 40], '#203c3e', 3);
      ellipse(c, x - 22, y - 38, 24, 7, '#203f3d', -.5);
      ellipse(c, x + 7, y - 56, 21, 6, '#2c4b43', .5);
      if (i % 4 === 0) ellipse(c, x + 9, y - 61, 3, 3, '#d9b97588');
    }
  });
  for (const kind of ['log', 'log-stack', 'thorns', 'boulder', 'ledge', 'spring', 'acorn', 'pinecone', 'shield', 'glider', 'magnet'])
    texture(scene, kind, 96, 96, c => prop(c, kind));
}
