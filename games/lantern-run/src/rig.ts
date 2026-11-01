import Phaser from 'phaser';

const TAU = Math.PI * 2;
const runFrames = [0, .68, 1, .55, 0, -.68, -1, -.55];
function runFrame(phase: number): number {
  const position = ((phase % TAU) + TAU) % TAU / TAU * 8;
  const index = Math.floor(position), blend = position - index;
  return runFrames[index] * (1 - blend) + runFrames[(index + 1) % 8] * blend;
}
function part(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, key: string, x: number, y: number, w: number, h: number): Phaser.GameObjects.Image {
  const image = scene.add.image(x, y, `lantern-rig-${key}`).setDisplaySize(w, h);
  parent.add(image); return image;
}

export interface FoxMotion {
  x: number; y: number; ground: number; distancePx: number; elapsed: number; dt: number; vy: number; grounded: boolean;
  invulnerable: number; hearts: number; maxHearts: number; runOver: boolean; jumpIndex: number;
  jumpAge: number; landingAge: number; hurtAge: number; recoveryAge: number;
  glider: boolean; shield: boolean; intensity: number;
}

export class FoxRig {
  readonly container: Phaser.GameObjects.Container;
  private readonly light: Phaser.GameObjects.Image;
  private readonly tailRoot: Phaser.GameObjects.Container;
  private readonly tailMid: Phaser.GameObjects.Container;
  private readonly tailTip: Phaser.GameObjects.Container;
  private readonly legs: { upper: Phaser.GameObjects.Container; lower: Phaser.GameObjects.Container }[] = [];
  private readonly body: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly satchel: Phaser.GameObjects.Image;
  private readonly stick: Phaser.GameObjects.Container;
  private readonly lantern: Phaser.GameObjects.Container;
  private readonly lanternGlow: Phaser.GameObjects.Image;
  private readonly shield: Phaser.GameObjects.Image;
  private readonly glider: Phaser.GameObjects.Image;
  private tailAngle = 0;
  private swing = 0;
  private swingVelocity = 0;
  constructor(scene: Phaser.Scene, x: number, y: number, ground: number) {
    this.container = scene.add.container(x, y).setDepth(5).setScale(.77);
    this.light = scene.add.image(x + 57, ground - 1, 'lantern-rig-light').setDisplaySize(170, 170).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
    this.tailRoot = scene.add.container(-49, -18); this.container.add(this.tailRoot);
    part(scene, this.tailRoot, 'tail-root', -15, 0, 45, 38);
    this.tailMid = scene.add.container(-27, -3); this.tailRoot.add(this.tailMid);
    part(scene, this.tailMid, 'tail-mid', -19, -2, 59, 47);
    this.tailTip = scene.add.container(-41, -2); this.tailMid.add(this.tailTip);
    part(scene, this.tailTip, 'tail-tip', -19, -1, 63, 52);
    for (const [index, xOffset] of [-35, 11, -20, 32].entries()) {
      const upper = scene.add.container(xOffset, 4); this.container.add(upper);
      part(scene, upper, 'upper-leg', 0, 18, 30, 44);
      const lower = scene.add.container(0, 21); upper.add(lower);
      part(scene, lower, 'lower-leg', 0, 10, 26, 39);
      part(scene, lower, 'paw', 6, 21, 30, 17);
      this.legs[index] = { upper, lower };
    }
    this.body = part(scene, this.container, 'body', -5, -17, 104, 62);
    this.satchel = part(scene, this.container, 'satchel', -23, -9, 37, 37);
    this.head = part(scene, this.container, 'head', 35, -47, 72, 70);
    this.container.bringToTop(this.legs[1].upper);
    this.container.bringToTop(this.legs[3].upper);
    this.stick = scene.add.container(41, -13); this.container.add(this.stick);
    part(scene, this.stick, 'stick', 29, -5, 72, 22);
    part(scene, this.stick, 'paw', 3, 4, 23, 15);
    this.lantern = scene.add.container(60, 8); this.stick.add(this.lantern);
    this.lanternGlow = part(scene, this.lantern, 'firefly-glow', 0, 23, 106, 106);
    this.lanternGlow.setBlendMode(Phaser.BlendModes.ADD).setTint(0xffbd5b);
    part(scene, this.lantern, 'lantern', 0, 20, 42, 56);
    this.shield = part(scene, this.container, 'shield', 0, -7, 160, 160).setBlendMode(Phaser.BlendModes.ADD);
    this.glider = part(scene, this.container, 'glider', 12, -83, 112, 45);
    this.shield.setVisible(false); this.glider.setVisible(false);
  }
  update(m: FoxMotion): void {
    const gait = m.distancePx / 78 * TAU;
    const airborne = !m.grounded && !m.runOver;
    const hurt = m.hurtAge < .38;
    const running = m.grounded && !m.runOver;
    const landing = m.landingAge < .2;
    const takeoff = m.jumpAge < .16 && airborne;
    const spin = m.jumpIndex > 1 && m.jumpAge < .46 && airborne;
    const bob = running ? Math.sin(gait * 2) * 2.4 : airborne ? -1 : 0;
    this.container.setPosition(m.x, m.runOver ? m.ground - 28 : m.y + bob + (m.recoveryAge < .5 ? -Math.sin(m.recoveryAge / .5 * Math.PI) * 12 : 0));
    this.container.setScale(.77 * (takeoff ? 1.05 : landing ? .93 : 1), .77 * (takeoff ? 1.12 : landing ? .88 : 1));
    this.container.setAngle(m.runOver ? 9 : spin ? 360 * m.jumpAge / .46 : hurt ? -9 : 0);
    this.container.setAlpha(m.invulnerable > 0 && m.hearts < m.maxHearts && !m.runOver && Math.floor(m.elapsed * 13) % 2 ? .55 : 1);
    this.body.setPosition(m.runOver ? -8 : -5, m.runOver ? 8 : -17 + (running ? Math.sin(gait * 2) * 1.8 : airborne ? -3 : 0));
    this.head.setPosition(m.runOver ? 42 : 35, m.runOver ? -13 : -47 + (running ? Math.sin(gait * 2 + .5) * 2 : airborne ? -3 : 2));
    this.head.setTexture(`lantern-rig-head${m.runOver || m.elapsed % 4.4 < .11 || hurt ? '-blink' : ''}`);
    this.satchel.setAngle(running ? Math.sin(gait + .8) * 10 : airborne ? -12 : 0);
    for (const [index, leg] of this.legs.entries()) {
      const phase = gait + (index === 1 || index === 2 ? Math.PI : 0) + (index > 1 ? .24 : 0);
      const stride = runFrame(phase);
      leg.upper.setAngle(m.runOver ? 55 : running ? stride * 53 : airborne ? (m.vy < 0 ? -39 : 37) * (index % 2 ? -1 : 1) : 0);
      leg.lower.setAngle(m.runOver ? -50 : running ? Math.max(0, -stride) * 63 - 23 : airborne ? -28 : 0);
    }
    const targetTail = m.runOver ? -25 : airborne ? (m.vy < 0 ? -20 : 28) : Math.sin(gait + .6) * 13;
    this.tailAngle += (targetTail - this.tailAngle) * Math.min(1, m.dt * 11);
    this.tailRoot.setAngle(this.tailAngle); this.tailMid.setAngle(Math.sin(m.elapsed * 8 - .5) * 8); this.tailTip.setAngle(Math.sin(m.elapsed * 8 - 1.1) * 10);
    this.stick.setPosition(41, m.runOver ? -20 : -13);
    const targetSwing = m.runOver ? 44 : takeoff ? -34 : landing ? 27 : Math.sin(gait) * 8 + (airborne ? 10 : 0);
    this.swingVelocity += (targetSwing - this.swing) * 24 * m.dt;
    this.swingVelocity *= Math.exp(-6 * m.dt); this.swing += this.swingVelocity * m.dt;
    this.lantern.setAngle(this.swing);
    this.lanternGlow.setAlpha(Math.max(0, m.intensity) * (.55 + Math.sin(m.elapsed * 5) * .12));
    this.light.setPosition(m.x + 62, m.ground - 2).setAlpha(m.intensity * Math.max(.18, 1 - Math.abs(m.ground - m.y - 38) / 270));
    this.shield.setVisible(m.shield).setAlpha(.5 + Math.sin(m.elapsed * 4) * .18);
    this.glider.setVisible(m.glider && airborne).setAngle(Math.sin(m.elapsed * 3) * 4);
  }
  destroy(): void { this.container.destroy(); this.light.destroy(); }
}

export class OwlRig {
  readonly container: Phaser.GameObjects.Container;
  private readonly face: Phaser.GameObjects.Image;
  private readonly left: Phaser.GameObjects.Container;
  private readonly right: Phaser.GameObjects.Container;
  private readonly talons: Phaser.GameObjects.Image;
  private readonly tips: Phaser.GameObjects.Container[] = [];
  private readonly phase: number;
  constructor(scene: Phaser.Scene, x: number, y: number, size: number, phase: number) {
    this.phase = phase;
    this.container = scene.add.container(x, y).setDepth(4).setScale(size * .85);
    this.left = scene.add.container(-24, -10); this.container.add(this.left);
    part(scene, this.left, 'owl-wing', -29, -7, 75, 42).setFlipX(true);
    const leftTip = scene.add.container(-55, -4); this.left.add(leftTip);
    part(scene, leftTip, 'owl-wing', -15, 1, 38, 25).setFlipX(true); this.tips.push(leftTip);
    this.right = scene.add.container(25, -10); this.container.add(this.right);
    part(scene, this.right, 'owl-wing', 29, -7, 75, 42);
    const rightTip = scene.add.container(55, -4); this.right.add(rightTip);
    part(scene, rightTip, 'owl-wing', 15, 1, 38, 25); this.tips.push(rightTip);
    part(scene, this.container, 'owl-body', 0, 0, 76, 74);
    this.talons = part(scene, this.container, 'owl-talons', 0, 34, 32, 22);
    this.face = part(scene, this.container, 'owl-face', -4, -4, 76, 73);
  }
  update(x: number, y: number, seconds: number, dropping = false): void {
    const cycle = seconds * 7 + this.phase;
    const glide = Math.sin(cycle) > .9;
    const flap = (dropping ? .72 : glide ? .9 : Math.sin(cycle)) * 37;
    this.container.setPosition(x, y + Math.sin(seconds * 2 + this.phase) * 2).setAngle(Math.sin(seconds * 2.4 + this.phase) * 4);
    this.left.setAngle(-flap); this.right.setAngle(flap);
    this.tips[0].setAngle(-flap * .38); this.tips[1].setAngle(flap * .38);
    this.face.setTexture(`lantern-rig-owl-face${(seconds + this.phase) % 5.2 < .1 ? '-blink' : ''}`);
    this.talons.y = dropping ? 42 : 34 + Math.sin(cycle) * 2;
  }
}

export class FireflyRig {
  readonly container: Phaser.GameObjects.Container;
  private readonly left: Phaser.GameObjects.Image;
  private readonly right: Phaser.GameObjects.Image;
  private readonly halo: Phaser.GameObjects.Image;
  private readonly phase: number;
  constructor(scene: Phaser.Scene, x: number, y: number, size: number, phase: number) {
    this.phase = phase;
    this.container = scene.add.container(x, y).setDepth(4).setScale(size);
    this.halo = part(scene, this.container, 'firefly-glow', 0, 0, 98, 98).setBlendMode(Phaser.BlendModes.ADD);
    this.left = part(scene, this.container, 'firefly-wing', -15, -12, 30, 23).setFlipX(true);
    this.right = part(scene, this.container, 'firefly-wing', 15, -12, 30, 23);
    part(scene, this.container, 'firefly-body', 0, 0, 48, 48);
  }
  update(x: number, y: number, seconds: number, intensity: number): void {
    const flap = Math.sin(seconds * 22 + this.phase);
    this.container.setPosition(x, y + Math.sin(seconds * 3 + this.phase) * 5);
    this.left.setScale(1, .35 + .65 * Math.abs(flap)); this.right.setScale(1, .35 + .65 * Math.abs(flap));
    this.halo.setAlpha(intensity * (.48 + .18 * Math.sin(seconds * 4 + this.phase)));
  }
}
