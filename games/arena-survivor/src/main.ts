import Phaser from 'phaser';
import type { GameAction, GameAdapter, GameEvent } from '../../../engine/game-api';

const width = 960, height = 640;
type Kind = 'enemy' | 'coin' | 'bomb' | 'fire';
type Parameter = 'enemySpeed' | 'coinValue' | 'playerSpeed' | 'spawnInterval' | 'gravityX' | 'gravityY';
interface Entity { id: number; kind: Kind; x: number; y: number; radius: number; vx: number; vy: number; tag: string; owner?: string; ttl: number; alive: boolean }
const defaults: Record<Parameter, number> = { enemySpeed: 68, coinValue: 10, playerSpeed: 230, spawnInterval: 1.35, gravityX: 0, gravityY: 0 };
const limits: Record<Parameter, [number, number]> = { enemySpeed: [0, 350], coinValue: [1, 100], playerSpeed: [30, 500], spawnInterval: [.2, 5], gravityX: [-100, 100], gravityY: [-100, 100] };
const caps: Record<Kind, number> = { enemy: 28, coin: 36, bomb: 12, fire: 20 };
const validKind = (value: unknown): value is Kind => typeof value === 'string' && Object.hasOwn(caps, value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Phaser.Math.Clamp(value, min, max);

export function createGame(parent: HTMLElement, emit: (event: GameEvent) => void): GameAdapter {
  const player = { x: width / 2, y: height / 2, lives: 3 };
  let score = 0, elapsed = 0, runElapsed = 0, frame = 0, nextId = 1, spawnClock = 0, invincible = 0, attackClock = 0, maxFrameGap = 0, lastFrameAt = 0;
  const recentFrames: number[] = [];
  const entities: Entity[] = [];
  const parameters: Record<Parameter, number> = { ...defaults };
  const writes = new Map<string, Map<Parameter, { value: number; order: number }>>();
  let writeOrder = 0;
  const effects: { x: number; y: number; radius: number; color: number; life: number; owner?: string }[] = [];
  const messages: { text: string; life: number; owner?: string }[] = [];
  const floating: { label: Phaser.GameObjects.Text; life: number; owner?: string }[] = [];
  let scene: Arena | undefined;

  const active = (kind: Kind) => entities.filter(entity => entity.alive && entity.kind === kind);
  const snapshot = () => ({
    player: { ...player }, score, elapsed, runElapsed, frame, maxFrameGap,
    frameRate: recentFrames.length > 1 ? (recentFrames.length - 1) * 1000 / (recentFrames.at(-1)! - recentFrames[0]) : 60,
    enemies: active('enemy').length, coins: active('coin').length, floatingTexts: floating.length,
    entities: entities.filter(entity => entity.alive).slice(0, 100).map(({ id, kind, x, y, radius, vx, vy, tag }) => ({ id, kind, x, y, radius, vx, vy, tag }))
  });

  function spawn(kind: Kind, x: number, y: number, radius?: number, owner?: string) {
    if (active(kind).length >= caps[kind] || entities.filter(entity => entity.alive).length >= 96) return;
    const entity: Entity = { id: nextId++, kind, x: clamp(x, 12, width - 12), y: clamp(y, 12, height - 12), radius: clamp(radius ?? (kind === 'enemy' ? 15 : kind === 'coin' ? 9 : 12), 4, 45), vx: 0, vy: 0, tag: '', owner, ttl: kind === 'enemy' ? 35 : kind === 'coin' ? 40 : kind === 'fire' ? 3 : 12, alive: true };
    entities.push(entity);
    emit({ type: 'spawn', id: entity.id, kind, x: entity.x, y: entity.y, origin: owner });
  }
  function removeEntity(id: number) { const entity = entities.find(item => item.id === id && item.alive); if (entity) entity.alive = false; }
  function hitEntity(entity: Entity, origin?: string) {
    if (!entity.alive) return;
    entity.alive = false;
    emit({ type: 'hit', target: 'enemy', id: entity.id, kind: entity.kind, x: entity.x, y: entity.y, origin });
    score += 2; emit({ type: 'score', amount: 2, origin });
  }
  function recomputeParameter(key: Parameter) {
    let latest: { value: number; order: number } | undefined;
    for (const values of writes.values()) { const item = values.get(key); if (item && (!latest || item.order > latest.order)) latest = item; }
    parameters[key] = latest?.value ?? defaults[key];
  }
  function removeMutation(origin: string) {
    const values = writes.get(origin);
    writes.delete(origin);
    if (values) for (const key of values.keys()) recomputeParameter(key);
    for (const entity of entities) if (entity.owner === origin) entity.alive = false;
    for (let i = effects.length - 1; i >= 0; i--) if (effects[i].owner === origin) effects.splice(i, 1);
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].owner === origin) messages.splice(i, 1);
    for (let i = floating.length - 1; i >= 0; i--) if (floating[i].owner === origin) { floating[i].label.destroy(); floating.splice(i, 1); }
  }
  function apply(action: GameAction, origin: string) {
    if (!action || !Array.isArray(action.args)) return;
    const [a, b, c, d] = action.args;
    switch (action.type) {
      case 'spawn': if (validKind(a) && finite(b) && finite(c) && (d === undefined || finite(d))) spawn(a, b, c, d as number | undefined, origin); break;
      case 'removeEntity': if (finite(a)) removeEntity(a); break;
      case 'moveEntity': if (finite(a) && finite(b) && finite(c)) { const entity = entities.find(item => item.id === a && item.alive); if (entity) { entity.x = clamp(b, 12, width - 12); entity.y = clamp(c, 12, height - 12); } } break;
      case 'setVelocity': if (finite(a) && finite(b) && finite(c)) { const entity = entities.find(item => item.id === a && item.alive); if (entity) { entity.vx = clamp(b, -250, 250); entity.vy = clamp(c, -250, 250); } } break;
      case 'setRadius': if (finite(a) && finite(b)) { const entity = entities.find(item => item.id === a && item.alive); if (entity) entity.radius = clamp(b, 4, 45); } break;
      case 'setTag': if (finite(a) && typeof b === 'string') { const entity = entities.find(item => item.id === a && item.alive); if (entity) entity.tag = b.slice(0, 24); } break;
      case 'setParameter': if (typeof a === 'string' && Object.hasOwn(parameters, a) && finite(b)) {
        const key = a as Parameter; let own = writes.get(origin); if (!own) { own = new Map(); writes.set(origin, own); }
        own.set(key, { value: clamp(b, ...limits[key]), order: ++writeOrder }); recomputeParameter(key);
      } break;
      case 'drawShape': if (finite(a) && finite(b) && finite(c) && typeof d === 'string' && /^#[0-9a-fA-F]{6}$/.test(d)) effects.push({ x: a, y: b, radius: clamp(c, 1, 100), color: parseInt(d.slice(1), 16), life: .5, owner: origin }); break;
      case 'drawText': if (typeof a === 'string' && finite(b) && finite(c) && scene) floating.push({ label: scene.add.text(clamp(b, 0, width), clamp(c, 0, height), a.slice(0, 80), { fontFamily: 'Arial', fontSize: '16px', color: '#ffffff', backgroundColor: '#183044' }).setDepth(3), life: 2, owner: origin }); break;
      case 'showMessage': if (typeof a === 'string') messages.push({ text: a.slice(0, 100), life: 2, owner: origin }); break;
    }
  }

  class Arena extends Phaser.Scene {
    private pen!: Phaser.GameObjects.Graphics;
    private hud!: Phaser.GameObjects.Text;
    private banner!: Phaser.GameObjects.Text;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    private touching = new Set<string>();
    private playerTouching = new Set<number>();
    constructor() { super('arena'); }
    create() {
      scene = this;
      this.pen = this.add.graphics();
      this.hud = this.add.text(20, 16, '', { fontFamily: 'Arial', fontSize: '19px', color: '#edffff', fontStyle: 'bold' }).setDepth(2);
      this.banner = this.add.text(width / 2, 65, '', { fontFamily: 'Arial', fontSize: '22px', color: '#ffe187', align: 'center' }).setOrigin(.5).setDepth(2);
      this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
      for (let i = 0; i < 4; i++) spawn('coin', 100 + i * 225, 150 + (i % 2) * 320);
      spawn('enemy', 80, 80); spawn('enemy', 870, 555);
    }
    update(_time: number, deltaMs: number) {
      const now = performance.now();
      if (lastFrameAt) maxFrameGap = Math.max(maxFrameGap, now - lastFrameAt);
      lastFrameAt = now; recentFrames.push(now);
      while (recentFrames.length && recentFrames[0] < now - 2000) recentFrames.shift();
      const dt = Math.min(deltaMs / 1000, .05);
      frame++; elapsed += dt; runElapsed += dt; spawnClock += dt; invincible = Math.max(0, invincible - dt); attackClock = Math.max(0, attackClock - dt);
      const left = this.keys.A.isDown || this.keys.LEFT.isDown, right = this.keys.D.isDown || this.keys.RIGHT.isDown;
      const up = this.keys.W.isDown || this.keys.UP.isDown, down = this.keys.S.isDown || this.keys.DOWN.isDown;
      let dx = Number(right) - Number(left), dy = Number(down) - Number(up);
      const length = Math.hypot(dx, dy) || 1; dx /= length; dy /= length;
      player.x = clamp(player.x + (dx * parameters.playerSpeed + parameters.gravityX) * dt, 16, width - 16);
      player.y = clamp(player.y + (dy * parameters.playerSpeed + parameters.gravityY) * dt, 16, height - 16);
      if (this.keys.SPACE.isDown && attackClock === 0) {
        attackClock = .45; effects.push({ x: player.x, y: player.y, radius: 72, color: 0x5df0bc, life: .25 });
        for (const enemy of active('enemy')) if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < enemy.radius + 72) hitEntity(enemy);
      }
      if (spawnClock >= parameters.spawnInterval) {
        spawnClock = 0;
        const edge = Math.floor(Math.random() * 4);
        spawn('enemy', edge === 0 ? 20 : edge === 1 ? width - 20 : Math.random() * width, edge === 2 ? 20 : edge === 3 ? height - 20 : Math.random() * height);
        if (Math.random() < .8) spawn('coin', 30 + Math.random() * (width - 60), 30 + Math.random() * (height - 60));
      }
      const playerContacts = new Set<number>();
      for (const entity of entities) {
        if (!entity.alive) continue;
        entity.ttl -= dt; if (entity.ttl <= 0) { entity.alive = false; continue; }
        if (entity.kind === 'enemy' && entity.vx === 0 && entity.vy === 0) {
          const angle = Math.atan2(player.y - entity.y, player.x - entity.x);
          entity.x += Math.cos(angle) * parameters.enemySpeed * dt; entity.y += Math.sin(angle) * parameters.enemySpeed * dt;
        } else { entity.x += entity.vx * dt; entity.y += entity.vy * dt; }
        entity.x = clamp(entity.x, 12, width - 12); entity.y = clamp(entity.y, 12, height - 12);
        if (Math.hypot(entity.x - player.x, entity.y - player.y) < entity.radius + 13) {
          playerContacts.add(entity.id);
          if (!this.playerTouching.has(entity.id)) emit({ type: 'collide', id: entity.id, kind: entity.kind, x: entity.x, y: entity.y });
          if (entity.kind === 'coin') { entity.alive = false; score += parameters.coinValue; emit({ type: 'score', amount: parameters.coinValue }); }
          else if (entity.kind !== 'fire' && !invincible) {
            invincible = 1.1; player.lives--;
            emit({ type: 'hit', target: 'player', id: entity.id, kind: entity.kind, x: entity.x, y: entity.y });
            if (entity.kind === 'bomb') entity.alive = false;
            if (player.lives <= 0) this.newRun();
          }
        }
      }
      this.playerTouching = playerContacts;
      const contacts = new Set<string>(); let emittedContacts = 0;
      const enemies = active('enemy');
      for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
        const a = enemies[i], b = enemies[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius) continue;
        const key = `${a.id}:${b.id}`; contacts.add(key);
        if (!this.touching.has(key) && emittedContacts++ < 8) emit({ type: 'entityCollide', a: { id: a.id, kind: a.kind, x: a.x, y: a.y, radius: a.radius }, b: { id: b.id, kind: b.kind, x: b.x, y: b.y, radius: b.radius } });
      }
      this.touching = contacts;
      for (const fire of active('fire')) for (const enemy of active('enemy')) if (Math.hypot(fire.x - enemy.x, fire.y - enemy.y) < fire.radius + enemy.radius) hitEntity(enemy, fire.owner);
      for (const effect of effects) effect.life -= dt;
      for (const message of messages) message.life -= dt;
      for (const text of floating) { text.life -= dt; text.label.setAlpha(Math.max(0, text.life / 2)); }
      for (let i = effects.length - 1; i >= 0; i--) if (effects[i].life <= 0) effects.splice(i, 1);
      for (let i = messages.length - 1; i >= 0; i--) if (messages[i].life <= 0) messages.splice(i, 1);
      for (let i = floating.length - 1; i >= 0; i--) if (floating[i].life <= 0) { floating[i].label.destroy(); floating.splice(i, 1); }
      for (let i = entities.length - 1; i >= 0; i--) if (!entities[i].alive) entities.splice(i, 1);
      this.draw(); emit({ type: 'tick', delta: dt });
    }
    private newRun() {
      player.lives = 3; player.x = width / 2; player.y = height / 2;
      score = 0; runElapsed = 0; spawnClock = 0; invincible = 1.5;
      entities.length = 0; this.touching.clear(); this.playerTouching.clear();
      for (let i = 0; i < 4; i++) spawn('coin', 130 + i * 200, 160 + (i % 2) * 280);
      messages.push({ text: 'NEW RUN', life: 2 });
    }
    private draw() {
      const g = this.pen; g.clear(); g.fillStyle(0x102337); g.fillRect(0, 0, width, height);
      g.lineStyle(1, 0x1f4054, .5);
      for (let x = 0; x < width; x += 40) g.lineBetween(x, 0, x, height);
      for (let y = 0; y < height; y += 40) g.lineBetween(0, y, width, y);
      for (const entity of entities) if (entity.alive) {
        g.fillStyle(entity.kind === 'enemy' ? 0xf36b79 : entity.kind === 'coin' ? 0xffd263 : entity.kind === 'fire' ? 0xff9b51 : 0xb475ff);
        g.fillCircle(entity.x, entity.y, entity.radius);
        if (entity.kind === 'enemy') { g.fillStyle(0x541b2c); g.fillCircle(entity.x - 5, entity.y - 2, 2); g.fillCircle(entity.x + 5, entity.y - 2, 2); }
      }
      for (const effect of effects) { g.lineStyle(3, effect.color, effect.life * 2); g.strokeCircle(effect.x, effect.y, effect.radius); }
      g.fillStyle(invincible > 0 && frame % 8 < 4 ? 0x8ce9d7 : 0x5df0bc); g.fillCircle(player.x, player.y, 14);
      g.lineStyle(3, 0xffffff); g.strokeCircle(player.x, player.y, 14);
      this.hud.setText(`SCORE ${score}      LIVES ${'♥'.repeat(player.lives)}      TIME ${Math.floor(runElapsed)}s`);
      this.banner.setText(messages.at(-1)?.text ?? '');
    }
  }
  const phaser = new Phaser.Game({ type: Phaser.AUTO, width, height, parent, backgroundColor: '#102337', scene: Arena, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
  return { apply, removeMutation, snapshot, destroy: () => phaser.destroy(true) };
}
