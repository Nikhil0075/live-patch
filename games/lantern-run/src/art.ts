import Phaser from 'phaser';

const width = 1152, height = 648;
function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const result = document.createElement('canvas'); result.width = w; result.height = h;
  draw(result.getContext('2d')!); return result;
}
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient, angle = 0) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2); ctx.fill();
}
function triangle(ctx: CanvasRenderingContext2D, points: number[], color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) ctx.lineTo(points[index], points[index + 1]);
  ctx.closePath(); ctx.fill();
}
function fox(pose: 'run' | 'jump' | 'fall' | 'hurt'): HTMLCanvasElement {
  return canvas(144, 128, ctx => {
    const lift = pose === 'jump' ? -13 : pose === 'fall' ? 8 : 0;
    const fur = ctx.createLinearGradient(48, 30, 102, 102); fur.addColorStop(0, '#ffab46'); fur.addColorStop(.5, '#f07a2a'); fur.addColorStop(1, '#a84821');
    ellipse(ctx, 43, 80 + lift, 36, 20, '#b65022', -.25);
    ellipse(ctx, 28, 77 + lift, 26, 13, '#f07a2a', -.25);
    triangle(ctx, [6, 68 + lift, 22, 59 + lift, 20, 78 + lift, 7, 84 + lift], '#fff1d3');
    ellipse(ctx, 69, 79 + lift, 36, 25, fur, -.15);
    ellipse(ctx, 80, 88 + lift, 20, 14, '#fbe9d0', -.15);
    for (const x of [54, 91]) {
      const legLift = pose === 'run' && x === 54 ? -8 : pose === 'jump' ? -10 : pose === 'fall' ? 12 : 0;
      ellipse(ctx, x, 105 + lift + legLift, 8, 17, '#803c20', x === 54 ? .38 : -.45);
      ellipse(ctx, x + 2, 115 + lift + legLift, 10, 5, '#3a2418');
    }
    triangle(ctx, [71, 50 + lift, 75, 15 + lift, 91, 35 + lift], '#8d3f22');
    triangle(ctx, [91, 42 + lift, 105, 14 + lift, 112, 53 + lift], '#ad4d21');
    triangle(ctx, [79, 45 + lift, 80, 26 + lift, 90, 39 + lift], '#fbe9d0');
    ellipse(ctx, 92, 59 + lift, 32, 28, fur);
    ellipse(ctx, 104, 74 + lift, 25, 12, '#fbe9d0');
    triangle(ctx, [115, 69 + lift, 137, 76 + lift, 113, 83 + lift], '#fbe9d0');
    ellipse(ctx, 134, 76 + lift, 4, 4, '#2b1e22');
    ellipse(ctx, 101, 59 + lift, 5, pose === 'hurt' ? 2 : 7, '#2b1e22');
    ellipse(ctx, 103, 57 + lift, 1.5, 2, '#fff');
    ctx.strokeStyle = '#5b2b1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(116, 76 + lift, 8, .2, 1.3); ctx.stroke();
    ellipse(ctx, 61, 87 + lift, 15, 10, '#5a3329');
    ctx.strokeStyle = '#7e4d2b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(98, 78 + lift); ctx.lineTo(118, 44 + lift); ctx.stroke();
    ctx.shadowColor = '#ffd56b'; ctx.shadowBlur = 18; ellipse(ctx, 119, 56 + lift, 9, 12, '#ffd56b');
    ctx.shadowBlur = 0; ctx.strokeStyle = '#a5662d'; ctx.lineWidth = 3; ctx.strokeRect(110, 48 + lift, 18, 18);
  });
}
function sky(): HTMLCanvasElement {
  return canvas(width, height, ctx => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1f2b5c'); gradient.addColorStop(.52, '#5b3f86'); gradient.addColorStop(.82, '#f2a25a'); gradient.addColorStop(1, '#324765');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    ctx.shadowColor = '#ffc77c'; ctx.shadowBlur = 38; ellipse(ctx, 620, 380, 36, 36, '#ffcf79'); ctx.shadowBlur = 0;
    for (let index = 0; index < 30; index++) ellipse(ctx, (index * 211 + 43) % width, (index * 67 + 19) % 260, index % 5 === 0 ? 2 : 1, 1, '#fff5d6');
  });
}
function forest(layer: 'far' | 'middle' | 'near'): HTMLCanvasElement {
  const base = layer === 'far' ? 450 : layer === 'middle' ? 490 : 540;
  const color = layer === 'far' ? '#344066' : layer === 'middle' ? '#253f5d' : '#183b4d';
  return canvas(width, height, ctx => {
    if (layer === 'far') {
      triangle(ctx, [0, base, 190, 300, 370, base], '#5a5680'); triangle(ctx, [280, base, 510, 330, 740, base], '#505779');
      triangle(ctx, [660, base, 880, 305, 1152, base], '#4d5276');
    }
    const count = layer === 'near' ? 24 : 33;
    for (let index = 0; index < count; index++) {
      const x = (index * 79 + (index % 4) * 19) % width;
      const tall = 55 + (index * 37) % (layer === 'near' ? 160 : 115);
      const y = base + (index * 29) % 45;
      ctx.fillStyle = color; ctx.fillRect(x - 4, y - tall * .5, 8, tall * .5);
      for (let tier = 0; tier < 3; tier++) triangle(ctx, [x, y - tall + tier * tall * .25, x - 27 + tier * 3, y - tall * .36 + tier * tall * .19, x + 27 - tier * 3, y - tall * .36 + tier * tall * .19], color);
    }
  });
}
function icon(kind: string): HTMLCanvasElement {
  return canvas(96, 96, ctx => {
    if (kind === 'firefly') {
      ctx.shadowColor = '#d9ff5a'; ctx.shadowBlur = 24; ellipse(ctx, 48, 49, 17, 17, '#e9ff82');
      ctx.shadowBlur = 0; ellipse(ctx, 33, 32, 11, 5, '#f3f2cb9c', -.5); ellipse(ctx, 63, 32, 11, 5, '#f3f2cb9c', .5);
      ellipse(ctx, 48, 38, 7, 6, '#687c22');
    } else if (kind === 'acorn') {
      ctx.shadowColor = '#f5b52e'; ctx.shadowBlur = 18; ellipse(ctx, 48, 55, 24, 28, '#f5b52e'); ctx.shadowBlur = 0;
      ellipse(ctx, 48, 35, 27, 12, '#8c5b2e'); ctx.strokeStyle = '#6d451e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(48, 29); ctx.lineTo(55, 15); ctx.stroke();
    } else if (kind === 'owl') {
      ellipse(ctx, 48, 51, 32, 27, '#4a5577'); ellipse(ctx, 31, 54, 20, 9, '#343e60', -.35); ellipse(ctx, 65, 54, 20, 9, '#343e60', .35);
      for (const x of [35, 61]) { ellipse(ctx, x, 46, 12, 13, '#f6b13a'); ellipse(ctx, x, 46, 5, 7, '#1d263d'); }
      triangle(ctx, [44, 61, 52, 61, 48, 69], '#e89d39');
    } else if (kind === 'log') {
      ellipse(ctx, 48, 67, 40, 17, '#6b4428'); ellipse(ctx, 25, 67, 12, 16, '#a57643'); ellipse(ctx, 25, 67, 7, 9, '#6b4428');
      ellipse(ctx, 48, 54, 28, 6, '#7fae3a');
    } else if (kind === 'thorns') {
      for (let i = 0; i < 5; i++) triangle(ctx, [8 + i * 16, 76, 17 + i * 16, 31 + (i % 2) * 10, 28 + i * 16, 76], i % 2 ? '#6b2fa0' : '#a738a8');
    } else if (kind === 'boulder') {
      ellipse(ctx, 48, 66, 36, 28, '#68737b'); ellipse(ctx, 40, 53, 21, 11, '#8c9896');
    } else if (kind === 'ledge') {
      ctx.fillStyle = '#424c5e'; ctx.fillRect(5, 47, 86, 25); ctx.fillStyle = '#7fae3a'; ctx.fillRect(5, 40, 86, 12);
    } else if (kind === 'spring') {
      ellipse(ctx, 48, 41, 36, 15, '#d44836'); ellipse(ctx, 48, 37, 26, 6, '#f6d39c');
      ctx.strokeStyle = '#d5d7dd'; ctx.lineWidth = 4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(33, 55 + i * 8); ctx.lineTo(63, 60 + i * 8); ctx.stroke(); }
    } else if (kind === 'shield') {
      ctx.strokeStyle = '#ffb84a'; ctx.lineWidth = 7; ctx.shadowColor = '#ffd56b'; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(48, 48, 36, 0, Math.PI * 2); ctx.stroke();
    }
  });
}

export function createLanternArt(scene: Phaser.Scene): void {
  for (const [name, texture] of [['sky', sky()], ['far', forest('far')], ['middle', forest('middle')], ['near', forest('near')]] as const)
    if (!scene.textures.exists(`lantern-${name}`)) scene.textures.addCanvas(`lantern-${name}`, texture);
  for (const pose of ['run', 'jump', 'fall', 'hurt'] as const) if (!scene.textures.exists(`lantern-fox-${pose}`)) scene.textures.addCanvas(`lantern-fox-${pose}`, fox(pose));
  for (const kind of ['firefly', 'acorn', 'owl', 'log', 'thorns', 'boulder', 'ledge', 'spring', 'shield'])
    if (!scene.textures.exists(`lantern-${kind}`)) scene.textures.addCanvas(`lantern-${kind}`, icon(kind));
}
