import Phaser from 'phaser';

const TAU = Math.PI * 2;
const foxPalette = { orange: '#ec792c', light: '#ffc168', shadow: '#a84425', cream: '#fff0d7', sock: '#56352d', rim: '#ffda91' };
type Draw = (ctx: CanvasRenderingContext2D) => void;
function texture(scene: Phaser.Scene, name: string, w: number, h: number, draw: Draw): void {
  if (scene.textures.exists(`lantern-${name}`)) return;
  const canvas = document.createElement('canvas'); canvas.width = w * 2; canvas.height = h * 2;
  const ctx = canvas.getContext('2d')!; ctx.scale(2, 2); draw(ctx);
  scene.textures.addCanvas(`lantern-${name}`, canvas);
}
function ellipse(c: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string | CanvasGradient, angle = 0): void {
  c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, angle, 0, TAU); c.fill();
}
function poly(c: CanvasRenderingContext2D, points: number[], color: string | CanvasGradient): void {
  c.fillStyle = color; c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]); c.closePath(); c.fill();
}
function stroke(c: CanvasRenderingContext2D, points: number[], color: string, width: number): void {
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]); c.stroke();
}
function shade(c: CanvasRenderingContext2D, x: number, y: number, x2: number, y2: number, stops: string[]): CanvasGradient {
  const g = c.createLinearGradient(x, y, x2, y2); stops.forEach((color, i) => g.addColorStop(i / (stops.length - 1), color)); return g;
}
function glow(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, '#ffffff00'); ellipse(c, x, y, r, r, g);
}
function curved(c: CanvasRenderingContext2D, outline: Path2D, base: string | CanvasGradient, dark: string, highlight: string): void {
  c.fillStyle = base; c.fill(outline);
  c.save(); c.clip(outline);
  c.fillStyle = dark; c.fillRect(0, 53, 120, 45);
  const rim = c.createLinearGradient(0, 0, 60, 45); rim.addColorStop(0, highlight); rim.addColorStop(.55, '#ffffff00');
  c.fillStyle = rim; c.fillRect(0, 0, 100, 80);
  c.restore(); c.lineWidth = 1.7; c.strokeStyle = dark; c.stroke(outline);
}
function foxBody(c: CanvasRenderingContext2D): void {
  const p = new Path2D(); p.moveTo(14, 69); p.bezierCurveTo(6, 53, 16, 22, 37, 13); p.bezierCurveTo(52, 7, 71, 14, 78, 29);
  p.bezierCurveTo(90, 50, 78, 75, 52, 81); p.bezierCurveTo(31, 87, 19, 79, 14, 69); p.closePath();
  curved(c, p, shade(c, 18, 8, 83, 79, [foxPalette.light, foxPalette.orange, foxPalette.shadow]), '#9d4227', foxPalette.rim);
  const bib = new Path2D(); bib.moveTo(68, 21); bib.bezierCurveTo(81, 31, 81, 57, 68, 70); bib.quadraticCurveTo(51, 86, 35, 78);
  bib.quadraticCurveTo(51, 72, 51, 57); bib.quadraticCurveTo(50, 35, 68, 21); bib.closePath();
  c.fillStyle = shade(c, 45, 30, 76, 77, ['#fff9ec', foxPalette.cream, '#dcbf9e']); c.fill(bib);
  for (let i = 0; i < 5; i++) { const x = 40 + i * 5, y = 76 + i % 2 * 2; stroke(c, [x, y, x + 3, y + 4], '#f4d8b7', 1.2); }
}
function foxHead(c: CanvasRenderingContext2D): void {
  const earBack = new Path2D(); earBack.moveTo(54, 38); earBack.quadraticCurveTo(59, 3, 68, 2); earBack.quadraticCurveTo(78, 18, 75, 48); earBack.closePath();
  curved(c, earBack, shade(c, 58, 3, 76, 49, ['#a24a2a', '#6f3529']), '#683527', '#ffb360');
  const earNear = new Path2D(); earNear.moveTo(17, 43); earNear.quadraticCurveTo(12, 5, 24, 2); earNear.quadraticCurveTo(45, 11, 44, 47); earNear.closePath();
  curved(c, earNear, shade(c, 13, 2, 45, 45, ['#ffae50', '#d55f28', '#8d3828']), '#8b3929', '#ffd496');
  const inner = new Path2D(); inner.moveTo(23, 37); inner.quadraticCurveTo(20, 13, 26, 11); inner.quadraticCurveTo(38, 19, 37, 40); inner.closePath(); c.fillStyle = '#ffe9d1'; c.fill(inner);
  const face = new Path2D(); face.moveTo(12, 43); face.bezierCurveTo(20, 23, 53, 24, 71, 42); face.quadraticCurveTo(82, 51, 85, 62);
  face.quadraticCurveTo(83, 75, 62, 82); face.quadraticCurveTo(24, 89, 11, 67); face.quadraticCurveTo(2, 62, 12, 43); face.closePath();
  curved(c, face, shade(c, 13, 34, 75, 83, ['#ffc56c', '#f68d35', '#bd4d27']), '#a44526', '#ffe1a1');
  const cheek = new Path2D(); cheek.moveTo(17, 60); cheek.quadraticCurveTo(27, 66, 39, 59); cheek.quadraticCurveTo(52, 68, 68, 59);
  cheek.quadraticCurveTo(82, 63, 84, 69); cheek.quadraticCurveTo(69, 85, 39, 83); cheek.quadraticCurveTo(21, 80, 10, 72); cheek.closePath();
  c.fillStyle = shade(c, 29, 59, 70, 86, ['#fff9e9', foxPalette.cream, '#e2c5a4']); c.fill(cheek);
  ellipse(c, 61, 50, 11, 14, '#fff8e9'); ellipse(c, 63, 51, 7, 10, '#372b2b'); ellipse(c, 65, 46, 3, 4, '#ffffff');
  ellipse(c, 84, 63, 4, 3, '#3c2c2b'); stroke(c, [64, 71, 71, 75, 79, 71], '#8c4934', 1.8);
  for (let i = 0; i < 3; i++) stroke(c, [12 + i * 5, 70, 7 + i * 5, 75], '#ffe7c5', 1.3);
}

export function createLanternParts(scene: Phaser.Scene): void {
  texture(scene, 'rig-body', 90, 86, foxBody);
  texture(scene, 'rig-head', 88, 85, foxHead);
  texture(scene, 'rig-head-blink', 88, 85, c => {
    c.drawImage(scene.textures.get('lantern-rig-head').getSourceImage() as HTMLCanvasElement, 0, 0, 88, 85);
    ellipse(c, 62, 51, 11, 14, '#f38b36'); stroke(c, [53, 52, 72, 51], '#482c2c', 2.5);
  });
  texture(scene, 'rig-tail-root', 45, 38, c => { const p = new Path2D(); p.moveTo(45, 12); p.bezierCurveTo(27, 2, 5, 6, 1, 23); p.quadraticCurveTo(20, 43, 44, 32); p.closePath(); curved(c, p, shade(c, 5, 4, 43, 38, ['#ffb24c', '#e9772c', '#a94327']), '#a04427', '#ffd187'); });
  texture(scene, 'rig-tail-mid', 59, 47, c => { const p = new Path2D(); p.moveTo(59, 13); p.bezierCurveTo(38, 2, 9, 2, 1, 24); p.bezierCurveTo(16, 50, 45, 49, 59, 37); p.closePath(); curved(c, p, shade(c, 6, 5, 54, 42, ['#ffbd5a', '#f08731', '#b64d28']), '#a34727', '#ffcf80'); });
  texture(scene, 'rig-tail-tip', 63, 52, c => {
    const p = new Path2D(); p.moveTo(61, 14); p.bezierCurveTo(40, 1, 12, 4, 1, 21); p.bezierCurveTo(14, 46, 46, 53, 62, 37); p.closePath();
    curved(c, p, shade(c, 5, 7, 54, 48, ['#ffd18a', '#fff1d7', '#edaa60']), '#e4b78b', '#ffffff');
    const orange = new Path2D(); orange.moveTo(63, 13); orange.bezierCurveTo(45, 5, 30, 6, 27, 14); orange.bezierCurveTo(36, 23, 28, 30, 29, 39); orange.quadraticCurveTo(47, 49, 63, 37); orange.closePath();
    c.fillStyle = shade(c, 30, 6, 58, 45, ['#ffc066', '#f18831', '#b94f2a']); c.fill(orange);
  });
  texture(scene, 'rig-upper-leg', 29, 40, c => { const p = new Path2D(); p.moveTo(9, 2); p.quadraticCurveTo(24, -1, 26, 11); p.quadraticCurveTo(22, 31, 20, 39); p.lineTo(7, 37); p.quadraticCurveTo(6, 17, 9, 2); p.closePath(); curved(c, p, shade(c, 7, 2, 25, 39, ['#ffb452', '#e16c2b', '#a34428']), '#9d4228', '#ffcd77'); });
  texture(scene, 'rig-lower-leg', 26, 36, c => { const p = new Path2D(); p.moveTo(7, 1); p.quadraticCurveTo(23, 0, 23, 12); p.lineTo(19, 34); p.quadraticCurveTo(6, 39, 4, 31); p.closePath(); curved(c, p, shade(c, 5, 1, 24, 35, ['#e8762e', '#a24b2c', foxPalette.sock]), '#623a2b', '#eaa067'); });
  texture(scene, 'rig-paw', 29, 16, c => { ellipse(c, 15, 8, 13, 6, '#432a25'); stroke(c, [18, 10, 23, 10], '#b27953', 1.4); });
  texture(scene, 'rig-arm', 30, 42, c => { const p = new Path2D(); p.moveTo(6, 3); p.quadraticCurveTo(19, -1, 24, 9); p.quadraticCurveTo(31, 21, 22, 39); p.quadraticCurveTo(8, 44, 4, 32); p.closePath(); curved(c, p, shade(c, 3, 3, 26, 42, ['#ffb454', '#e9782b', '#9b4629']), '#94422a', '#ffd18a'); ellipse(c, 18, 34, 9, 7, foxPalette.sock); });
  texture(scene, 'rig-satchel', 38, 38, c => {
    ellipse(c, 19, 20, 17, 16, '#56362d', -.2); poly(c, [4, 14, 35, 13, 29, 28, 9, 28], '#794b34');
    stroke(c, [8, 11, 29, 10], '#d19a54', 2); ellipse(c, 19, 22, 3, 3, '#efb45f');
  });
  texture(scene, 'rig-stick', 72, 22, c => { stroke(c, [3, 20, 49, 8, 66, 2], '#593926', 7); stroke(c, [4, 18, 49, 6, 66, 2], '#b47b43', 2.5); stroke(c, [48, 8, 54, 19], '#8b5d35', 3); stroke(c, [54, 18, 64, 13], '#9b6d3e', 2); });
  texture(scene, 'rig-lantern', 42, 56, c => {
    c.shadowColor = '#ffcf65'; c.shadowBlur = 14;
    const paper = new Path2D(); paper.moveTo(21, 8); paper.bezierCurveTo(1, 9, -2, 42, 21, 49); paper.bezierCurveTo(45, 44, 42, 11, 21, 8); paper.closePath();
    c.fillStyle = shade(c, 4, 12, 38, 47, ['#fffad2', '#ffe786', '#e9a946']); c.fill(paper); c.shadowBlur = 0;
    c.save(); c.clip(paper); for (const x of [10, 21, 32]) stroke(c, [x, 9, x, 48], '#d89d42', 1.5); stroke(c, [2, 27, 40, 27], '#f4c969', 1.4); c.restore();
    ellipse(c, 21, 7, 11, 5, '#80532f'); ellipse(c, 21, 50, 10, 3, '#80532f'); stroke(c, [15, 3, 21, 0, 27, 3], '#b98346', 2);
  });
  texture(scene, 'rig-glider', 112, 45, c => {
    poly(c, [3, 36, 16, 12, 48, 2, 79, 8, 109, 25, 75, 34, 43, 28], shade(c, 18, 2, 86, 38, ['#b9e475', '#5e9c48']));
    stroke(c, [4, 36, 47, 18, 108, 25], '#3c7439', 3);
    for (const x of [33, 62, 82]) stroke(c, [48, 18, x, 7], '#7eaf51', 1.5);
  });
  texture(scene, 'rig-shield', 160, 160, c => {
    glow(c, 80, 80, 78, '#ffc86935'); c.strokeStyle = '#ffd276'; c.lineWidth = 4; c.shadowColor = '#ffcd65'; c.shadowBlur = 15;
    c.beginPath(); c.arc(80, 80, 72, 0, TAU); c.stroke(); c.shadowBlur = 0; ellipse(c, 40, 41, 11, 5, '#fff3b888', -.6);
  });
  texture(scene, 'rig-light', 200, 50, c => { const g = c.createRadialGradient(100, 25, 5, 100, 25, 98); g.addColorStop(0, '#ffe49a85'); g.addColorStop(.45, '#ffd57843'); g.addColorStop(1, '#ffd57800'); ellipse(c, 100, 25, 98, 24, g); });
  texture(scene, 'rig-owl-body', 76, 74, c => {
    ellipse(c, 38, 39, 33, 29, shade(c, 9, 8, 68, 70, ['#8f9ac4', '#56698f', '#303c63']));
    ellipse(c, 39, 57, 20, 12, '#7a89b1');
    for (let i = 0; i < 4; i++) ellipse(c, 29 + i * 7, 62, 5, 2, '#a6aecb');
  });
  texture(scene, 'rig-owl-face', 76, 73, c => {
    poly(c, [8, 34, 13, 7, 29, 23, 39, 10, 54, 22, 66, 7, 69, 40], '#4c5a7e');
    ellipse(c, 38, 40, 31, 28, '#66769d');
    for (const x of [26, 51]) {
      ellipse(c, x, 39, 16, 19, '#ece4d7'); ellipse(c, x, 39, 10, 12, '#efac43');
      ellipse(c, x - 1, 40, 6, 8, '#303044'); ellipse(c, x + 1, 35, 2, 3, '#fff8dc');
    }
    poly(c, [34, 51, 42, 51, 38, 60], '#df9139');
    stroke(c, [13, 24, 29, 28], '#344361', 3); stroke(c, [48, 28, 64, 24], '#344361', 3);
  });
  texture(scene, 'rig-owl-face-blink', 76, 73, c => {
    c.drawImage(scene.textures.get('lantern-rig-owl-face').getSourceImage() as HTMLCanvasElement, 0, 0, 76, 73);
    for (const x of [26, 51]) { ellipse(c, x, 39, 11, 13, '#ece4d7'); stroke(c, [x - 8, 41, x + 8, 41], '#39435e', 3); }
  });
  texture(scene, 'rig-owl-wing', 75, 42, c => {
    poly(c, [70, 21, 49, 2, 25, 5, 2, 20, 14, 34, 38, 40, 60, 32], shade(c, 4, 3, 70, 39, ['#9aa5ca', '#627296', '#374568']));
    for (let i = 0; i < 5; i++) ellipse(c, 13 + i * 9, 29 + i % 2 * 3, 11, 5, '#7989ad', -.2);
  });
  texture(scene, 'rig-owl-talons', 32, 22, c => { for (const x of [10, 22]) { stroke(c, [x, 2, x, 15, x + 5, 19], '#cf8d4a', 3); stroke(c, [x, 14, x - 4, 18], '#cf8d4a', 2); } });
  texture(scene, 'rig-firefly-body', 48, 48, c => {
    glow(c, 24, 29, 23, '#efff91dd'); ellipse(c, 24, 31, 10, 11, '#f4ff83'); ellipse(c, 24, 18, 8, 7, '#8ea53c');
    for (const x of [21, 27]) ellipse(c, x, 17, 1.5, 2, '#25341f');
    stroke(c, [20, 12, 16, 5], '#7d963f', 1.5); stroke(c, [28, 12, 32, 5], '#7d963f', 1.5);
  });
  texture(scene, 'rig-firefly-wing', 30, 23, c => { ellipse(c, 15, 11, 13, 8, '#fffbe8c4', -.3); stroke(c, [5, 14, 25, 8], '#ffffff8a', 1); });
  texture(scene, 'rig-firefly-glow', 98, 98, c => glow(c, 49, 49, 47, '#e4ff8499'));
  texture(scene, 'rig-hud-heart', 40, 40, c => {
    c.fillStyle = shade(c, 9, 2, 32, 37, ['#ffaaa0', '#ff5d6b', '#ca344f']);
    c.beginPath(); c.moveTo(20, 36); c.bezierCurveTo(-9, 17, 4, -2, 20, 11); c.bezierCurveTo(36, -2, 49, 17, 20, 36); c.fill();
    ellipse(c, 12, 10, 5, 2, '#ffe1d5', -.6);
  });
  texture(scene, 'rig-hud-heart-empty', 40, 40, c => {
    c.strokeStyle = '#ffe0c3'; c.lineWidth = 3; c.beginPath(); c.moveTo(20, 36);
    c.bezierCurveTo(-9, 17, 4, -2, 20, 11); c.bezierCurveTo(36, -2, 49, 17, 20, 36); c.stroke();
  });
  texture(scene, 'rig-spark', 20, 20, c => poly(c, [10, 0, 12, 8, 20, 10, 12, 12, 10, 20, 8, 12, 0, 10, 8, 8], '#fff6ab'));
}
