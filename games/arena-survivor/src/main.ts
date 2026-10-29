import Phaser from 'phaser';
import type { GameAction, GameAdapter, GameEvent } from '../../../engine/game-api';
import type { GameManifest } from '../../../engine/manifest/schema';
import { defaultSettings, type StudioSettings } from '../../../engine/studio/settings-defaults';
import { ArenaAudio, soundEvents, type SoundEvent } from './audio';
import { createArenaTextures } from './art';
import { maxParticles, ParticleBudget } from './particle-budget';

const width = 1152, height = 648;
type Kind = 'enemy' | 'coin' | 'bomb' | 'fire';
type Parameter = 'enemySpeed' | 'coinValue' | 'playerSpeed' | 'spawnInterval' | 'gravityX' | 'gravityY';
interface Entity { id: number; kind: Kind; x: number; y: number; radius: number; vx: number; vy: number; tag: string; owner?: string; ttl: number; alive: boolean; sprite?: Phaser.GameObjects.Image }
const defaults: Record<Parameter, number> = { enemySpeed: 68, coinValue: 10, playerSpeed: 230, spawnInterval: 1.35, gravityX: 0, gravityY: 0 };
const limits: Record<Parameter, [number, number]> = { enemySpeed: [0, 350], coinValue: [1, 100], playerSpeed: [30, 500], spawnInterval: [.2, 5], gravityX: [-100, 100], gravityY: [-100, 100] };
const caps: Record<Kind, number> = { enemy: 28, coin: 36, bomb: 12, fire: 20 };
const validKind = (value: unknown): value is Kind => typeof value === 'string' && Object.hasOwn(caps, value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Phaser.Math.Clamp(value, min, max);

export function createGame(parent: HTMLElement, emit: (event: GameEvent) => void, options?: { manifest?: GameManifest; settings?: StudioSettings }): GameAdapter {
  let settings = options?.settings ?? defaultSettings;
  const audio = new ArenaAudio(settings);
  const allowedAudio = new Set(options?.manifest?.audio ?? []);
  const allowedEffects = new Set(options?.manifest?.effects ?? []);
  const player = { x: width / 2, y: height / 2, lives: 3 };
  let score = 0, elapsed = 0, runElapsed = 0, frame = 0, nextId = 1, spawnClock = 0, invincible = 0, attackClock = 0, maxFrameGap = 0, lastFrameAt = 0;
  const recentFrames: number[] = [];
  const entities: Entity[] = [];
  const parameters: Record<Parameter, number> = { ...defaults };
  const writes = new Map<string, Map<Parameter, { value: number; order: number }>>();
  type Editable = 'x' | 'y' | 'vx' | 'vy' | 'radius' | 'tag';
  const entityEdits = new Map<string, Map<number, Partial<Pick<Entity, Editable>>>>();
  const removedEntities = new Map<string, Entity[]>();
  const scoreCredits = new Map<string, number>();
  let writeOrder = 0;
  const effects: { x: number; y: number; radius: number; color: number; life: number; owner?: string }[] = [];
  const particles: { x: number; y: number; vx: number; vy: number; life: number; color: number; owner?: string }[] = [];
  const particleBudget = new ParticleBudget();
  let hitStop = 0, flashLife = 0, flashColor = 0xffffff;
  let flashTimes: number[] = [];
  const messages: { text: string; life: number; owner?: string }[] = [];
  const floating: { label: Phaser.GameObjects.Text; life: number; owner?: string }[] = [];
  let scene: Arena | undefined;

  const active = (kind: Kind) => entities.filter(entity => entity.alive && entity.kind === kind);
  function credit(origin: string | undefined, amount: number) { if (origin) scoreCredits.set(origin, (scoreCredits.get(origin) ?? 0) + amount); }
  function parameterOwner(key: Parameter): string | undefined {
    let latest: { origin: string; order: number } | undefined;
    for (const [origin, values] of writes) { const value = values.get(key); if (value && (!latest || value.order > latest.order)) latest = { origin, order: value.order }; }
    return latest?.origin;
  }
  function remember(entity: Entity, origin: string, keys: Editable[]) {
    let byEntity = entityEdits.get(origin); if (!byEntity) { byEntity = new Map(); entityEdits.set(origin, byEntity); }
    let prior = byEntity.get(entity.id); if (!prior) { prior = {}; byEntity.set(entity.id, prior); }
    for (const key of keys) if (!(key in prior)) Object.assign(prior, { [key]: entity[key] });
  }
  const snapshot = () => ({
    player: { ...player }, score, elapsed, runElapsed, frame, renderer: phaser.renderer?.type === Phaser.WEBGL ? 'webgl' : 'canvas', maxFrameGap, flashesLastSecond: flashTimes.filter(time => performance.now() - time < 1000).length,
    frameRate: recentFrames.length > 1 ? (recentFrames.length - 1) * 1000 / (recentFrames.at(-1)! - recentFrames[0]) : 60,
    enemies: active('enemy').length, coins: active('coin').length, floatingTexts: floating.length, particles: particles.length,
    entities: entities.filter(entity => entity.alive).slice(0, 100).map(({ id, kind, x, y, radius, vx, vy, tag }) => ({ id, kind, x, y, radius, vx, vy, tag }))
  });

  function spawn(kind: Kind, x: number, y: number, radius?: number, owner?: string) {
    if (active(kind).length >= caps[kind] || entities.filter(entity => entity.alive).length >= 96) return;
    const entity: Entity = { id: nextId++, kind, x: clamp(x, 12, width - 12), y: clamp(y, 12, height - 12), radius: clamp(radius ?? (kind === 'enemy' ? 19 : kind === 'coin' ? 12 : 15), 4, 45), vx: 0, vy: 0, tag: '', owner, ttl: kind === 'enemy' ? 35 : kind === 'coin' ? 40 : kind === 'fire' ? 3 : 12, alive: true };
    if (scene) entity.sprite = scene.add.image(entity.x, entity.y, `arena-${kind}`).setDepth(1).setDisplaySize(entity.radius * 3.6, entity.radius * 3.6);
    entities.push(entity);
    emit({ type: 'spawn', id: entity.id, kind, x: entity.x, y: entity.y, origin: owner });
  }
  function removeEntity(id: number, origin?: string) {
    const entity = entities.find(item => item.id === id && item.alive);
    if (!entity) return;
    if (origin && entity.owner !== origin && entity.kind === 'coin') {
      const removed = removedEntities.get(origin) ?? []; removed.push({ ...entity, ...entityEdits.get(origin)?.get(entity.id), sprite: undefined }); if (removed.length > 96) removed.shift(); removedEntities.set(origin, removed);
    }
    entity.alive = false;
  }
  function hitEntity(entity: Entity, origin?: string) {
    if (!entity.alive) return;
    entity.alive = false;
    hitStop = Math.max(hitStop, .055);
    burst('slime', entity.x, entity.y, origin);
    audio.play('death');
    if (scene) floating.push({ label: scene.add.text(entity.x, entity.y - 18, '+2', { fontFamily: 'Arial', fontSize: '25px', color: '#ffe395', fontStyle: 'bold', stroke: '#4f2a0c', strokeThickness: 4 }).setDepth(3), life: 1, owner: origin });
    emit({ type: 'hit', target: 'enemy', id: entity.id, kind: entity.kind, x: entity.x, y: entity.y, origin });
    score += 2; credit(origin, 2); emit({ type: 'score', amount: 2, origin });
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
    for (const [id, prior] of entityEdits.get(origin) ?? []) {
      const entity = entities.find(item => item.id === id && item.alive);
      if (entity) Object.assign(entity, prior);
    }
    entityEdits.delete(origin);
    for (const removed of removedEntities.get(origin) ?? []) if (!entities.some(item => item.id === removed.id && item.alive)) {
      const restored = { ...removed, alive: true, sprite: scene?.add.image(removed.x, removed.y, `arena-${removed.kind}`).setDepth(1).setDisplaySize(removed.radius * 3.6, removed.radius * 3.6) };
      entities.push(restored);
    }
    removedEntities.delete(origin);
    score = Math.max(0, score - (scoreCredits.get(origin) ?? 0)); scoreCredits.delete(origin);
    for (const entity of entities) if (entity.owner === origin) entity.alive = false;
    for (let i = effects.length - 1; i >= 0; i--) if (effects[i].owner === origin) effects.splice(i, 1);
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].owner === origin) messages.splice(i, 1);
    for (let i = floating.length - 1; i >= 0; i--) if (floating[i].owner === origin) { floating[i].label.destroy(); floating.splice(i, 1); }
    for (let i = particles.length - 1; i >= 0; i--) if (particles[i].owner === origin) particles.splice(i, 1);
  }
  function burst(kind: string, x: number, y: number, owner?: string) {
    const color = kind === 'coin' ? 0xffd263 : kind === 'slime' ? 0xff7f9d : kind === 'celebration' ? 0x8bffcf : 0xffffff;
    const count = particleBudget.take(frame, particles.length, Math.round(8 * settings.effectsIntensity));
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * 2 * i / Math.max(1, count), speed = 45 + Math.random() * 100;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .35 + Math.random() * .25, color, owner });
    }
  }
  function apply(action: GameAction, origin: string) {
    if (!action || !Array.isArray(action.args)) return;
    const [a, b, c, d] = action.args;
    switch (action.type) {
      case 'spawn': if (validKind(a) && finite(b) && finite(c) && (d === undefined || finite(d))) spawn(a, b, c, d as number | undefined, origin); break;
      case 'removeEntity': if (finite(a)) removeEntity(a, origin); break;
      case 'moveEntity': if (finite(a) && finite(b) && finite(c)) { const entity = entities.find(item => item.id === a && item.alive); if (entity) { remember(entity, origin, ['x', 'y']); entity.x = clamp(b, 12, width - 12); entity.y = clamp(c, 12, height - 12); } } break;
      case 'setVelocity': if (finite(a) && finite(b) && finite(c)) { const entity = entities.find(item => item.id === a && item.alive); if (entity) { remember(entity, origin, ['vx', 'vy']); entity.vx = clamp(b, -250, 250); entity.vy = clamp(c, -250, 250); } } break;
      case 'setRadius': if (finite(a) && finite(b)) { const entity = entities.find(item => item.id === a && item.alive); if (entity) { remember(entity, origin, ['radius']); entity.radius = clamp(b, 4, 45); } } break;
      case 'setTag': if (finite(a) && typeof b === 'string') { const entity = entities.find(item => item.id === a && item.alive); if (entity) { remember(entity, origin, ['tag']); entity.tag = b.slice(0, 24); } } break;
      case 'setParameter': if (typeof a === 'string' && Object.hasOwn(parameters, a) && finite(b)) {
        const key = a as Parameter; let own = writes.get(origin); if (!own) { own = new Map(); writes.set(origin, own); }
        own.set(key, { value: clamp(b, ...limits[key]), order: ++writeOrder }); recomputeParameter(key);
        if ((key === 'gravityX' || key === 'gravityY') && effects.length < 30) effects.push({ x: player.x, y: player.y, radius: 100, color: 0x80f9d6, life: 1.2, owner: origin });
      } break;
      case 'drawShape': if (finite(a) && finite(b) && finite(c) && typeof d === 'string' && /^#[0-9a-fA-F]{6}$/.test(d)) effects.push({ x: a, y: b, radius: clamp(c, 1, 100), color: parseInt(d.slice(1), 16), life: .5, owner: origin }); break;
      case 'drawText': if (typeof a === 'string' && finite(b) && finite(c) && scene) floating.push({ label: scene.add.text(clamp(b, 0, width), clamp(c, 0, height), a.slice(0, 80), { fontFamily: 'Arial', fontSize: '16px', color: '#ffffff', backgroundColor: '#183044' }).setDepth(3), life: 2, owner: origin }); break;
      case 'showMessage': if (typeof a === 'string') messages.push({ text: a.slice(0, 100), life: 2, owner: origin }); break;
      case 'playSound': if (typeof a === 'string' && allowedAudio.has(a) && soundEvents.includes(a as SoundEvent)) audio.play(a as SoundEvent); break;
      case 'burst': if (typeof a === 'string' && allowedEffects.has(a) && finite(b) && finite(c)) burst(a, clamp(b, 0, width), clamp(c, 0, height), origin); break;
      case 'shake': if (!settings.reduceFlashing && finite(a) && scene) scene.cameras.main.shake(160, clamp(a, 0, .01) * settings.effectsIntensity); break;
      case 'flash': if (!settings.reduceFlashing && typeof a === 'string' && /^#[0-9a-fA-F]{6}$/.test(a)) {
        const now = performance.now(); flashTimes = flashTimes.filter(time => now - time < 1000);
        if (flashTimes.length < 3) { flashTimes.push(now); flashColor = parseInt(a.slice(1), 16); flashLife = .11 * settings.effectsIntensity; }
      } break;
      case 'systemEvent': if (origin === 'system' && typeof a === 'string') {
        if (a === 'shipped') { messages.push({ text: '✦ PATCH SHIPPED ✦', life: 3 }); burst('celebration', player.x, player.y); audio.play('patch-shipped'); }
        else if (a === 'failed') audio.play('patch-failed');
        else if (a === 'rolled_back') audio.play('rollback');
        else if (a === 'round-start') audio.play('round-start');
        else if (a === 'vote-tick') audio.play('vote-tick');
      } break;
    }
  }

  class Arena extends Phaser.Scene {
    private pen!: Phaser.GameObjects.Graphics;
    private hud!: Phaser.GameObjects.Text;
    private avatar!: Phaser.GameObjects.Image;
    private banner!: Phaser.GameObjects.Text;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    private touching = new Set<string>();
    private playerTouching = new Set<number>();
    constructor() { super('arena'); }
    setHudSize(size: StudioSettings['hudSize']) { this.hud?.setFontSize(size === 'large' ? 24 : size === 'small' ? 16 : 19); }
    create() {
      scene = this;
      createArenaTextures(this, width, height);
      this.add.image(width / 2, height / 2, 'arena-floor').setDepth(-2);
      this.pen = this.add.graphics();
      this.avatar = this.add.image(player.x, player.y, 'arena-player').setDepth(2).setDisplaySize(78, 78);
      this.hud = this.add.text(20, 16, '', { fontFamily: 'Arial', fontSize: `${settings.hudSize === 'large' ? 24 : settings.hudSize === 'small' ? 16 : 19}px`, color: '#edffff', fontStyle: 'bold' }).setDepth(2);
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
      if (hitStop > 0) { hitStop = Math.max(0, hitStop - dt); this.draw(); emit({ type: 'tick', delta: 0 }); return; }
      const left = this.keys.A.isDown || this.keys.LEFT.isDown, right = this.keys.D.isDown || this.keys.RIGHT.isDown;
      const up = this.keys.W.isDown || this.keys.UP.isDown, down = this.keys.S.isDown || this.keys.DOWN.isDown;
      let dx = Number(right) - Number(left), dy = Number(down) - Number(up);
      const length = Math.hypot(dx, dy) || 1; dx /= length; dy /= length;
      player.x = clamp(player.x + (dx * parameters.playerSpeed + parameters.gravityX) * dt, 22, width - 22);
      player.y = clamp(player.y + (dy * parameters.playerSpeed + parameters.gravityY) * dt, 22, height - 22);
      if ((dx || dy) && frame % 3 === 0 && particles.length < maxParticles) particles.push({ x: player.x - dx * 18, y: player.y - dy * 18, vx: -dx * 45, vy: -dy * 45, life: .32, color: 0x69ffd2 });
      if (this.keys.SPACE.isDown && attackClock === 0) {
        attackClock = .45; effects.push({ x: player.x, y: player.y, radius: 72, color: 0x5df0bc, life: .25 });
        audio.play('hit');
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
        if (Math.hypot(entity.x - player.x, entity.y - player.y) < entity.radius + 19) {
          playerContacts.add(entity.id);
          if (!this.playerTouching.has(entity.id)) emit({ type: 'collide', id: entity.id, kind: entity.kind, x: entity.x, y: entity.y });
          if (entity.kind === 'coin') {
            entity.alive = false; score += parameters.coinValue;
            if (entity.owner) credit(entity.owner, parameters.coinValue);
            else credit(parameterOwner('coinValue'), parameters.coinValue - defaults.coinValue);
            emit({ type: 'score', amount: parameters.coinValue });
            burst('coin', entity.x, entity.y); audio.play('coin');
            floating.push({ label: this.add.text(entity.x, entity.y - 20, `+${parameters.coinValue}`, { fontFamily: 'Arial', fontSize: '26px', color: '#ffe395', fontStyle: 'bold', stroke: '#4b2d0a', strokeThickness: 4 }).setDepth(3), life: 1 });
          }
          else if (entity.kind !== 'fire' && !invincible) {
            invincible = 1.1; player.lives--;
            audio.play('hurt'); if (!settings.reduceFlashing) this.cameras.main.shake(160, .006 * settings.effectsIntensity);
            burst('spark', player.x, player.y);
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
      for (const particle of particles) { particle.life -= dt; particle.x += particle.vx * dt; particle.y += particle.vy * dt; }
      for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
      flashLife = Math.max(0, flashLife - dt);
      for (const message of messages) message.life -= dt;
      for (const text of floating) { text.life -= dt; text.label.setAlpha(Math.max(0, text.life / 2)); }
      for (let i = effects.length - 1; i >= 0; i--) if (effects[i].life <= 0) effects.splice(i, 1);
      for (let i = messages.length - 1; i >= 0; i--) if (messages[i].life <= 0) messages.splice(i, 1);
      for (let i = floating.length - 1; i >= 0; i--) if (floating[i].life <= 0) { floating[i].label.destroy(); floating.splice(i, 1); }
      for (let i = entities.length - 1; i >= 0; i--) if (!entities[i].alive) { const id = entities[i].id; entities[i].sprite?.destroy(); entities.splice(i, 1); for (const edits of entityEdits.values()) edits.delete(id); }
      this.draw(); emit({ type: 'tick', delta: dt });
    }
    private newRun() {
      player.lives = 3; player.x = width / 2; player.y = height / 2;
      score = 0; scoreCredits.clear(); entityEdits.clear(); removedEntities.clear(); runElapsed = 0; spawnClock = 0; invincible = 1.5;
      for (const entity of entities) entity.sprite?.destroy(); entities.length = 0; this.touching.clear(); this.playerTouching.clear();
      particles.length = 0;
      for (let i = 0; i < 4; i++) spawn('coin', 130 + i * 200, 160 + (i % 2) * 280);
      messages.push({ text: 'NEW RUN', life: 2 });
    }
    private draw() {
      const g = this.pen; g.clear();
      g.fillStyle(0x6cffcc, .055 * settings.effectsIntensity); g.fillCircle(player.x, player.y, 86);
      g.lineStyle(2, 0x78f7d0, .18 * settings.effectsIntensity); g.strokeCircle(player.x, player.y, 58);
      for (const entity of entities) if (entity.alive) {
        entity.sprite?.setPosition(entity.x, entity.y);
        entity.sprite?.setDisplaySize(entity.radius * 3.6, entity.radius * 3.6);
        if (entity.kind === 'enemy') entity.sprite?.setScale((entity.radius * 3.6 / 112) * (1 + Math.sin(elapsed * 6 + entity.id) * .035));
        if (entity.kind === 'coin') { entity.sprite?.setScale((entity.radius * 3.6 / 112) * (.38 + .62 * Math.abs(Math.cos(elapsed * 4 + entity.id))), entity.radius * 3.6 / 112); g.fillStyle(0xffe17d, .3); g.fillCircle(entity.x, entity.y, entity.radius * 2.4); }
      }
      for (const effect of effects) { g.lineStyle(5, effect.color, Math.min(.9, effect.life)); g.strokeCircle(effect.x, effect.y, effect.radius * (1.3 - effect.life * .2)); g.lineStyle(2, 0xffffff, effect.life * .6); g.strokeCircle(effect.x, effect.y, effect.radius * .65); }
      for (const color of [0xff7f9d, 0xffd263, 0x8bffcf, 0x69ffd2, 0xffffff]) {
        g.fillStyle(color, .85);
        for (const particle of particles) if (particle.color === color) g.fillCircle(particle.x, particle.y, Math.max(1, particle.life * 5));
      }
      this.avatar.setPosition(player.x, player.y).setAlpha(invincible > 0 && frame % 8 < 4 ? .65 : 1);
      if (player.lives === 1) { g.lineStyle(32, 0xff3e5f, .25); g.strokeRect(0, 0, width, height); }
      if (flashLife > 0) { g.fillStyle(flashColor, Math.min(.18, flashLife)); g.fillRect(0, 0, width, height); }
      this.hud.setText(`SCORE ${score}      LIVES ${'♥'.repeat(player.lives)}      TIME ${Math.floor(runElapsed)}s`);
      this.banner.setText(messages.at(-1)?.text ?? '');
    }
  }
  const phaser = new Phaser.Game({ type: Phaser.AUTO, width, height, parent, backgroundColor: '#102337', scene: Arena, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
  const captureFrame = () => new Promise<ImageBitmap | null>(resolve => {
    let done = false;
    const timeout = window.setTimeout(() => { if (!done) { done = true; resolve(null); } }, 1500);
    phaser.renderer.snapshot(async image => {
      if (done) return;
      done = true; clearTimeout(timeout);
      if (!(image instanceof HTMLImageElement)) { resolve(null); return; }
      try {
        const small = document.createElement('canvas'); small.width = 480; small.height = 270;
        small.getContext('2d')!.drawImage(image, 0, 0, small.width, small.height);
        resolve(await createImageBitmap(small));
      } catch { resolve(null); }
    }, 'image/jpeg', .65);
  });
  return { apply, removeMutation, snapshot, enableSound: () => audio.enable(), configure: value => { settings = value as StudioSettings; audio.configure(settings); scene?.setHudSize(settings.hudSize); }, pause: () => { scene?.scene.pause(); audio.pause(); }, resume: () => { lastFrameAt = 0; scene?.scene.resume(); audio.resume(); }, captureFrame, destroy: () => { audio.destroy(); phaser.destroy(true); } };
}
