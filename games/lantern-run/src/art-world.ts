import Phaser from 'phaser';

type Draw = (c: CanvasRenderingContext2D) => void;
const worldPalette = { moss: '#6f9c42', mossLight: '#b4c95b', soil: '#674431', soilDeep: '#302b33', rock: '#59677a', farPine: '#777796', middlePine: '#3e6673', nearPine: '#244b4b' };
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
  const tierCount = tall > 175 ? 5 : 4;
  if (tall > 175) line(c, [x, base, x, base - tall * .48], '#344c52', Math.max(3, tall / 24));
  for (let tier = tierCount - 1; tier >= 0; tier--) {
    const top = base - tall + tier * tall * .17, half = tall * (.115 + tier * .024), bottom = top + tall * .38;
    const crown = new Path2D(); crown.moveTo(x, top); crown.bezierCurveTo(x - half * .22, top + tall * .12, x - half * .64, bottom - 9, x - half, bottom);
    crown.quadraticCurveTo(x - half * .64, bottom + 6, x - half * .38, bottom - 1);
    crown.quadraticCurveTo(x - half * .15, bottom + 7, x, bottom + 1);
    crown.quadraticCurveTo(x + half * .3, bottom + 8, x + half * .46, bottom);
    crown.quadraticCurveTo(x + half * .8, bottom + 7, x + half, bottom);
    crown.bezierCurveTo(x + half * .65, bottom - 12, x + half * .25, top + tall * .12, x, top); crown.closePath();
    c.fillStyle = gradient(c, x - half, top, x + half, bottom, [lit, color, color]); c.fill(crown);
    c.save(); c.clip(crown); c.fillStyle = color; c.globalAlpha = .3; c.fillRect(x - half, bottom - 8, half * 2, 12); c.restore();
    line(c, [x + 1, top + 8, x + half * .69, bottom - 8], lit, Math.max(1, tall / 110));
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
  const haze = c.createLinearGradient(0, h - 74, 0, h);
  haze.addColorStop(0, '#bec1ca00'); haze.addColorStop(1, index < 2 ? '#c7a2b324' : '#8ca8a418');
  c.fillStyle = haze; c.fillRect(0, h - 74, w, 74);
}

function groundStrip(c: CanvasRenderingContext2D): void {
  const w = 1152, h = 142, tau = Math.PI * 2;
  c.fillStyle = gradient(c, 0, 10, 0, h, ['#7e5738', worldPalette.soil, '#4d382f', worldPalette.soilDeep]); c.fillRect(0, 10, w, h);
  for (let i = 0; i < 78; i++) {
    const x = (i * 227 + i * i * 31) % w, y = 38 + (i * 43) % 95, r = 3 + i % 7;
    ellipse(c, x, y, r * 1.4, r, i % 3 ? '#87705a88' : '#424657aa', i % 4 * .2);
    if (i % 4 === 0) line(c, [x - 2, 17, x + 2, y - 6, x + 11, y + 5], '#8d694c88', 1.2);
  }
  const lip = new Path2D(); lip.moveTo(0, 10);
  for (let x = 0; x <= w; x += 8) lip.lineTo(x, 11 + Math.sin(x / w * tau * 12) * 2);
  lip.lineTo(w, 28);
  for (let x = w; x >= 0; x -= 12) lip.lineTo(x, 23 + Math.sin(x / w * tau * 11) * 3 + (x % 5));
  lip.closePath(); c.fillStyle = worldPalette.moss; c.fill(lip);
  const crown = c.createLinearGradient(0, 8, 0, 27); crown.addColorStop(0, worldPalette.mossLight); crown.addColorStop(.5, '#8db84c'); crown.addColorStop(1, '#3d7338');
  c.fillStyle = crown; c.fill(lip);
  for (let i = 0; i < 140; i++) {
    const x = i * w / 140, len = 6 + (i * 17) % 13;
    const strand = new Path2D(); strand.moveTo(x - 3, 20); strand.quadraticCurveTo(x + 3, 29 + len * .5, x + 1, 25 + len); strand.quadraticCurveTo(x - 3, 29, x - 7, 22); strand.closePath();
    c.fillStyle = i % 3 ? '#609039' : '#426f37'; c.fill(strand);
  }
  for (let i = 0; i < 46; i++) {
    const x = (i * 193 + i * i * 13) % w;
    line(c, [x, 10, x - 4, 3], '#86b44b', 1.4); line(c, [x, 10, x + 5, 1], '#c1cf65', 1.3);
    if (i % 6 === 0) { ellipse(c, x + 8, 4, 3, 3, '#f5deb1'); ellipse(c, x + 8, 4, 1, 1, '#e3a86e'); }
  }
  c.fillStyle = '#202e34bb'; c.fillRect(0, 122, w, 20);
}
function cliff(c: CanvasRenderingContext2D, right: boolean): void {
  if (right) { c.translate(70, 0); c.scale(-1, 1); }
  const rock = new Path2D(); rock.moveTo(70, 0); rock.lineTo(18, 0); rock.lineTo(26, 23); rock.lineTo(10, 44); rock.lineTo(20, 70); rock.lineTo(4, 100); rock.lineTo(0, 142); rock.lineTo(70, 142); rock.closePath();
  c.fillStyle = gradient(c, 0, 0, 68, 140, ['#839199', worldPalette.rock, '#26394e']); c.fill(rock);
  c.save(); c.clip(rock);
  const facets = [[20, 27, 48, 42, 34, 72], [10, 77, 39, 65, 21, 110], [27, 107, 60, 78, 55, 140]];
  for (const [x1,y1,x2,y2,x3,y3] of facets) path(c,[x1,y1,x2,y2,x3,y3], '#9fabb146');
  c.restore();
  const moss = new Path2D(); moss.moveTo(10, 0); moss.lineTo(70, 0); moss.lineTo(70, 20); moss.quadraticCurveTo(50, 23, 39, 32); moss.quadraticCurveTo(30, 25, 23, 38); moss.lineTo(20, 13); moss.closePath();
  c.fillStyle = gradient(c, 10, 0, 30, 38, ['#b8cd5d', '#6f9c42', '#3c7137']); c.fill(moss);
  for (let x = 27; x < 65; x += 10) line(c,[x,17,x-3,36 + x%7], '#5f8b3d',2);
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
    path(c, [4, 39, 86, 38, 91, 51, 80, 68, 62, 73, 52, 88, 39, 76, 21, 73, 8, 60], gradient(c, 24, 39, 71, 84, ['#8b9292', '#53616a', '#344454']));
    path(c, [10, 49, 29, 57, 40, 75, 28, 68, 15, 65], '#667475');
    path(c, [55, 53, 79, 47, 73, 68, 55, 80, 61, 65], '#46545f');
    path(c, [2, 41, 13, 30, 38, 28, 56, 31, 80, 29, 92, 39, 75, 46, 18, 47], gradient(c, 25, 28, 70, 48, ['#a4c873', '#689950', '#4c7545']));
    for (let i = 0; i < 8; i++) line(c, [12 + i * 10, 44, 14 + i * 10, 51 + i % 3 * 5], '#81ae5c', 2);
    for (let i = 0; i < 5; i++) ellipse(c, 18 + i * 15, 33, 5, 3, '#b1cf7b');
  } else if (kind === 'spring') {
    ellipse(c, 48, 80, 37, 8, '#354b50');
    ellipse(c, 48, 73, 29, 6, '#a68362');
    line(c, [30, 68, 64, 64, 32, 57, 62, 51, 34, 44, 62, 39], '#d8e0d9', 5);
    line(c, [31, 66, 64, 62, 32, 55, 62, 49], '#87959c', 2);
    ellipse(c, 48, 38, 16, 6, '#f4e2c2');
    path(c, [9, 37, 18, 19, 33, 11, 51, 8, 69, 13, 81, 23, 87, 37, 74, 42, 22, 42], gradient(c, 24, 8, 70, 41, ['#ff8b6b', '#e74842', '#9f303d']));
    for (const [x, y, rx] of [[30, 23, 7], [59, 19, 8], [73, 31, 5]] as const) ellipse(c, x, y, rx, rx * .52, '#ffe9c8');
    ellipse(c, 25, 18, 8, 3, '#ffd5b7b0', -.4);
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
  texture(scene, 'ground-strip', 1152, 142, groundStrip);
  texture(scene, 'cliff-left', 70, 142, c => cliff(c, false));
  texture(scene, 'cliff-right', 70, 142, c => cliff(c, true));
  texture(scene, 'sky', 1152, 648, c => {
    c.fillStyle = gradient(c, 0, 0, 0, 648, ['#15233f', '#2d3d64', '#78587a', '#d48b72', '#f0bb83']); c.fillRect(0, 0, 1152, 648);
    const halo = c.createRadialGradient(740, 215, 10, 740, 215, 180);
    halo.addColorStop(0, '#ffe1a675'); halo.addColorStop(1, '#ffe1a600'); ellipse(c, 740, 215, 180, 180, halo);
    ellipse(c, 740, 215, 54, 54, '#f7d39e');
    ellipse(c, 722, 198, 15, 5, '#ffe8bd4d', -.45);
    for (let i = 0; i < 34; i++) ellipse(c, (i * 227 + 45) % 1152, (i * 71 + 33) % 300, i % 4 ? 1 : 2, 1, '#fff2d8aa');
    for (let i = 0; i < 9; i++) ellipse(c, (i * 307 + 25) % 1152, 290 + i % 3 * 27, 85, 11, '#edb3a02b');
  });
  texture(scene, 'clouds', 1152, 200, c => {
    for (let i = 0; i < 10; i++) {
      const x = (i * 311 + 71) % 1152, y = 52 + i % 4 * 31;
      for (const wrap of [-1152, 0, 1152]) {
        ellipse(c, x + wrap, y, 74 + i % 3 * 19, 14, '#f1c6b429');
        ellipse(c, x + wrap + 37, y - 6, 44, 11, '#ecd4c035');
      }
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
