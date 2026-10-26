import Phaser from 'phaser';
import type { Action, GameAdapter, GameEvent, Kind, Parameter, Snapshot } from '../../../engine/game-api';

const width = 960, height = 640;
type Entity = { kind: Kind; x: number; y: number; radius: number; alive: boolean };

export function createGame(parent: HTMLElement, emit: (event: GameEvent) => void): GameAdapter {
  const player = { x: width / 2, y: height / 2, lives: 3 };
  let score = 0, elapsed = 0, frame = 0, spawnClock = 0, invincible = 0;
  const entities: Entity[] = [];
  const defaults: Record<Parameter, number> = { enemySpeed: 68, coinValue: 10, playerSpeed: 230, spawnInterval: 1.35, gravityX: 0, gravityY: 0 };
  const parameters: Record<Parameter, number> = { ...defaults };
  const effects: { x: number; y: number; radius: number; color: number; life: number }[] = [];
  const messages: { text: string; life: number }[] = [];
  const snapshot = (): Snapshot => ({ player: { ...player }, score, elapsed, frame, enemies: entities.filter(e => e.kind === 'enemy' && e.alive).length, coins: entities.filter(e => e.kind === 'coin' && e.alive).length });
  function spawn(kind: Kind, x: number, y: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !['enemy', 'coin', 'bomb'].includes(kind)) return;
    x = Phaser.Math.Clamp(x, 12, width - 12); y = Phaser.Math.Clamp(y, 12, height - 12);
    entities.push({ kind, x, y, radius: kind === 'enemy' ? 15 : kind === 'bomb' ? 12 : 9, alive: true });
    emit({ type: 'spawn', kind, x, y });
  }
  function apply(action: Action) {
    if (!action || typeof action !== 'object') return;
    if (action.type === 'spawn') spawn(action.kind, action.x, action.y);
    else if (action.type === 'setParameter' && Object.hasOwn(parameters, action.key) && Number.isFinite(action.value)) {
      const limits: Record<Parameter, [number, number]> = { enemySpeed: [0, 350], coinValue: [1, 100], playerSpeed: [30, 500], spawnInterval: [.2, 5], gravityX: [-100, 100], gravityY: [-100, 100] };
      parameters[action.key] = Phaser.Math.Clamp(action.value, ...limits[action.key]);
    } else if (action.type === 'drawShape' && [action.x, action.y, action.radius].every(Number.isFinite) && /^#[0-9a-fA-F]{6}$/.test(action.color)) {
      effects.push({ x: action.x, y: action.y, radius: Phaser.Math.Clamp(action.radius, 1, 100), color: parseInt(action.color.slice(1), 16), life: .5 });
    } else if (action.type === 'showMessage' && typeof action.text === 'string') {
      messages.push({ text: action.text.slice(0, 100), life: 2 });
    }
  }
  class Arena extends Phaser.Scene {
    private pen!: Phaser.GameObjects.Graphics;
    private hud!: Phaser.GameObjects.Text;
    private banner!: Phaser.GameObjects.Text;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    constructor() { super('arena'); }
    create() {
      this.pen = this.add.graphics();
      this.hud = this.add.text(20, 16, '', { fontFamily: 'Arial', fontSize: '19px', color: '#edffff', fontStyle: 'bold' }).setDepth(2);
      this.banner = this.add.text(width / 2, 65, '', { fontFamily: 'Arial', fontSize: '22px', color: '#ffe187', align: 'center' }).setOrigin(.5).setDepth(2);
      this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
      for (let i = 0; i < 4; i++) spawn('coin', 100 + i * 225, 150 + (i % 2) * 320);
      spawn('enemy', 80, 80); spawn('enemy', 870, 555);
    }
    update(_time: number, deltaMs: number) {
      const dt = Math.min(deltaMs / 1000, .05);
      frame++; elapsed += dt; spawnClock += dt; invincible = Math.max(0, invincible - dt);
      const left = this.keys.A.isDown || this.keys.LEFT.isDown, right = this.keys.D.isDown || this.keys.RIGHT.isDown;
      const up = this.keys.W.isDown || this.keys.UP.isDown, down = this.keys.S.isDown || this.keys.DOWN.isDown;
      let dx = Number(right) - Number(left), dy = Number(down) - Number(up);
      const length = Math.hypot(dx, dy) || 1; dx /= length; dy /= length;
      player.x = Phaser.Math.Clamp(player.x + (dx * parameters.playerSpeed + parameters.gravityX) * dt, 16, width - 16);
      player.y = Phaser.Math.Clamp(player.y + (dy * parameters.playerSpeed + parameters.gravityY) * dt, 16, height - 16);
      if (spawnClock >= parameters.spawnInterval) {
        spawnClock = 0;
        const edge = Math.floor(Math.random() * 4);
        spawn('enemy', edge === 0 ? 20 : edge === 1 ? width - 20 : Math.random() * width, edge === 2 ? 20 : edge === 3 ? height - 20 : Math.random() * height);
        if (Math.random() < .8) spawn('coin', 30 + Math.random() * (width - 60), 30 + Math.random() * (height - 60));
      }
      for (const entity of entities) {
        if (!entity.alive) continue;
        if (entity.kind === 'enemy') {
          const angle = Math.atan2(player.y - entity.y, player.x - entity.x);
          entity.x += Math.cos(angle) * parameters.enemySpeed * dt; entity.y += Math.sin(angle) * parameters.enemySpeed * dt;
        }
        if (Math.hypot(entity.x - player.x, entity.y - player.y) < entity.radius + 13) {
          emit({ type: 'collide', kind: entity.kind, x: entity.x, y: entity.y });
          if (entity.kind === 'coin') {
            entity.alive = false; score += parameters.coinValue;
            emit({ type: 'score', amount: parameters.coinValue });
          } else if (!invincible) {
            invincible = 1.1; player.lives = Math.max(0, player.lives - 1);
            emit({ type: 'hit', kind: entity.kind, x: entity.x, y: entity.y });
            if (entity.kind === 'bomb') entity.alive = false;
            if (!player.lives) { player.lives = 3; score = 0; player.x = width / 2; player.y = height / 2; messages.push({ text: 'NEW RUN', life: 2 }); }
          }
        }
      }
      for (const effect of effects) effect.life -= dt;
      for (const message of messages) message.life -= dt;
      for (let i = effects.length - 1; i >= 0; i--) if (effects[i].life <= 0) effects.splice(i, 1);
      for (let i = messages.length - 1; i >= 0; i--) if (messages[i].life <= 0) messages.splice(i, 1);
      if (entities.length > 250) entities.splice(0, entities.length - 250);
      this.draw(); emit({ type: 'tick', delta: dt });
    }
    private draw() {
      const g = this.pen; g.clear(); g.fillStyle(0x102337); g.fillRect(0, 0, width, height);
      g.lineStyle(1, 0x1f4054, .5);
      for (let x = 0; x < width; x += 40) g.lineBetween(x, 0, x, height);
      for (let y = 0; y < height; y += 40) g.lineBetween(0, y, width, y);
      for (const entity of entities) if (entity.alive) {
        g.fillStyle(entity.kind === 'enemy' ? 0xf36b79 : entity.kind === 'coin' ? 0xffd263 : 0xb475ff);
        g.fillCircle(entity.x, entity.y, entity.radius);
        if (entity.kind === 'enemy') { g.fillStyle(0x541b2c); g.fillCircle(entity.x - 5, entity.y - 2, 2); g.fillCircle(entity.x + 5, entity.y - 2, 2); }
      }
      for (const effect of effects) { g.lineStyle(3, effect.color, effect.life * 2); g.strokeCircle(effect.x, effect.y, effect.radius); }
      g.fillStyle(invincible > 0 && frame % 8 < 4 ? 0x8ce9d7 : 0x5df0bc); g.fillCircle(player.x, player.y, 14);
      g.lineStyle(3, 0xffffff); g.strokeCircle(player.x, player.y, 14);
      this.hud.setText(`SCORE ${score}      LIVES ${'♥'.repeat(player.lives)}      TIME ${Math.floor(elapsed)}s`);
      this.banner.setText(messages.at(-1)?.text ?? '');
    }
  }
  const phaser = new Phaser.Game({ type: Phaser.AUTO, width, height, parent, backgroundColor: '#102337', scene: Arena, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
  return { emit, apply, snapshot, resetMutations: () => { Object.assign(parameters, defaults); effects.length = 0; messages.length = 0; }, destroy: () => phaser.destroy(true) };
}
