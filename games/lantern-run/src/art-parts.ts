import Phaser from 'phaser';

const TAU = Math.PI * 2;
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

export function createLanternParts(scene: Phaser.Scene): void {
  texture(scene, 'rig-body', 90, 66, c => {
    ellipse(c, 46, 35, 39, 27, shade(c, 22, 4, 72, 62, ['#ffc45e', '#ee7b2a', '#9c4225']), -.13);
    ellipse(c, 65, 48, 19, 14, '#fff0d9', -.3); stroke(c, [53, 15, 43, 36, 36, 45], '#985028', 3);
  });
  texture(scene, 'rig-head', 88, 85, c => {
    poly(c, [14, 42, 18, 4, 38, 24, 58, 3, 72, 40], '#9b4025');
    poly(c, [22, 32, 23, 12, 38, 28], '#ffe7be'); poly(c, [54, 28, 60, 13, 67, 34], '#ffe1af');
    ellipse(c, 43, 45, 33, 30, shade(c, 13, 10, 73, 78, ['#ffc565', '#f58e36', '#b94e24']));
    poly(c, [11, 55, 1, 63, 17, 65, 9, 72, 31, 73], '#df6e2e');
    ellipse(c, 54, 65, 27, 15, '#fff0d6', -.14); ellipse(c, 67, 64, 17, 9, '#fff8e8', -.1);
    ellipse(c, 80, 61, 5, 4, '#3b2927'); ellipse(c, 56, 45, 8, 11, '#fff6dc');
    ellipse(c, 57, 46, 5, 8, '#3d2b2d'); ellipse(c, 59, 42, 2, 3, '#ffffff');
    stroke(c, [64, 69, 70, 72, 76, 69], '#793b2b', 2); ellipse(c, 31, 57, 7, 4, '#ffa568');
  });
  texture(scene, 'rig-head-blink', 88, 85, c => {
    c.drawImage(scene.textures.get('lantern-rig-head').getSourceImage() as HTMLCanvasElement, 0, 0, 88, 85);
    ellipse(c, 56, 46, 9, 12, '#f38b36'); stroke(c, [49, 47, 63, 47], '#482c2c', 3);
  });
  texture(scene, 'rig-tail-root', 45, 38, c => ellipse(c, 24, 19, 21, 16, shade(c, 2, 7, 44, 34, ['#8f3823', '#e8792d']), -.2));
  texture(scene, 'rig-tail-mid', 59, 47, c => ellipse(c, 29, 24, 28, 20, shade(c, 4, 5, 52, 42, ['#ad4624', '#ff9b3a', '#da6a2b']), -.2));
  texture(scene, 'rig-tail-tip', 63, 52, c => {
    ellipse(c, 34, 26, 29, 22, '#ef842b', -.2);
    poly(c, [3, 24, 24, 7, 20, 20, 34, 13, 27, 34, 38, 47, 15, 41], '#fff0d5');
    stroke(c, [24, 8, 43, 11, 57, 20], '#ffb756', 2);
  });
  texture(scene, 'rig-upper-leg', 29, 40, c => { ellipse(c, 14, 18, 12, 17, '#da622b', -.3); ellipse(c, 15, 30, 10, 9, '#8e4029'); });
  texture(scene, 'rig-lower-leg', 26, 36, c => { ellipse(c, 13, 16, 9, 15, '#773c27', .13); ellipse(c, 14, 29, 11, 6, '#4b2d27'); });
  texture(scene, 'rig-paw', 29, 16, c => { ellipse(c, 15, 8, 13, 6, '#432a25'); stroke(c, [18, 10, 23, 10], '#b27953', 1.4); });
  texture(scene, 'rig-satchel', 38, 38, c => {
    ellipse(c, 19, 20, 17, 16, '#56362d', -.2); poly(c, [4, 14, 35, 13, 29, 28, 9, 28], '#794b34');
    stroke(c, [8, 11, 29, 10], '#d19a54', 2); ellipse(c, 19, 22, 3, 3, '#efb45f');
  });
  texture(scene, 'rig-stick', 72, 22, c => { stroke(c, [4, 18, 49, 7, 66, 3], '#583a2b', 8); stroke(c, [5, 15, 49, 5, 66, 2], '#a07141', 3); stroke(c, [49, 7, 53, 17], '#95673b', 3); });
  texture(scene, 'rig-lantern', 42, 56, c => {
    c.shadowColor = '#ffcf65'; c.shadowBlur = 16;
    ellipse(c, 21, 30, 18, 21, shade(c, 5, 14, 37, 46, ['#fff9b1', '#ffe16b', '#ed9f35'])); c.shadowBlur = 0;
    ellipse(c, 21, 8, 12, 5, '#965e31'); ellipse(c, 21, 51, 12, 4, '#965e31');
    for (const x of [10, 21, 32]) stroke(c, [x, 11, x, 48], '#d8953c', 1.5);
    stroke(c, [5, 24, 37, 24], '#e7a946', 1.5); stroke(c, [5, 38, 37, 38], '#e7a946', 1.5);
    stroke(c, [14, 4, 21, 0, 28, 4], '#b17a45', 2);
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
  texture(scene, 'rig-light', 170, 60, c => glow(c, 85, 30, 83, '#ffd57788'));
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
    glow(c, 24, 29, 22, '#efff91bb'); ellipse(c, 24, 31, 9, 10, '#e9ff72'); ellipse(c, 24, 18, 8, 7, '#8ea53c');
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
