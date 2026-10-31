import Phaser from 'phaser';
import type { GameAction, GameAdapter, GameEvent } from '../../../engine/game-api';
import type { GameManifest } from '../../../engine/manifest/schema';
import { defaultSettings, type StudioSettings } from '../../../engine/studio/settings-defaults';
import { createLanternArt } from './art';
import { LanternAudio, sounds, type SoundName } from './audio';
import { generateStretch, type Stretch } from './generator';

const WIDTH = 1152, HEIGHT = 648, GROUND = 518, FOX_X = 346;
type Kind = 'log' | 'thorns' | 'boulder' | 'owl' | 'pinecone' | 'firefly' | 'acorn' | 'ledge' | 'spring' | 'shield' | 'glider' | 'magnet';
type Parameter = 'runSpeed' | 'speedRamp' | 'gravity' | 'jumpPower' | 'maxJumps' | 'spawnRate' | 'fireflyValue' | 'maxHearts';
type PowerUp = 'shield' | 'glider' | 'magnet';
type Weather = 'clear' | 'rain' | 'wind' | 'fog';
const kinds: Kind[] = ['log', 'thorns', 'boulder', 'owl', 'pinecone', 'firefly', 'acorn', 'ledge', 'spring', 'shield', 'glider', 'magnet'];
const caps: Record<Kind, number> = { log: 12, thorns: 12, boulder: 12, owl: 6, pinecone: 10, firefly: 40, acorn: 10, ledge: 10, spring: 4, shield: 4, glider: 4, magnet: 4 };
const parameterBounds: Record<Parameter, [number, number]> = { runSpeed: [120, 600], speedRamp: [0, 3], gravity: [300, 2400], jumpPower: [300, 1100], maxJumps: [1, 3], spawnRate: [.3, 3], fireflyValue: [1, 10], maxHearts: [3, 5] };
const powerUps: PowerUp[] = ['shield', 'glider', 'magnet'];
const weathers: Weather[] = ['clear', 'rain', 'wind', 'fog'];
interface Entity { id: number; kind: Kind; worldX: number; y: number; size: number; vx: number; vy: number; tag: string; owner?: string; alive: boolean; sprite?: Phaser.GameObjects.Image }
interface GroundSpan { from: number; to: number; stretch?: Stretch }
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createGame(parent: HTMLElement, emit: (event: GameEvent) => void, options?: { manifest?: GameManifest; settings?: StudioSettings }): GameAdapter {
  let settings = options?.settings ?? defaultSettings;
  const audio = new LanternAudio(settings);
  const allowedSounds = new Set(options?.manifest?.audio ?? []);
  const player = { x: FOX_X, y: GROUND - 38, vy: 0, grounded: true, jumpsLeft: 1, hearts: 3, maxHearts: 3, powerUps: [] as string[] };
  const run = { number: 1, distance: 0, fireflies: 0, best: 0, speed: 260 };
  const defaults: Record<Parameter, number> = { runSpeed: 260, speedRamp: 1, gravity: 1600, jumpPower: 720, maxJumps: 1, spawnRate: 1, fireflyValue: 1, maxHearts: 3 };
  const parameters = { ...defaults };
  const parameterWrites = new Map<string, Map<Parameter, { value: number; order: number }>>();
  const weatherWrites = new Map<string, { value: Weather; order: number }>();
  const granted = new Map<string, { kind: PowerUp; until: number; owner: string }>();
  let writeOrder = 0, weather: Weather = 'clear';
  let elapsed = 0, runElapsed = 0, frame = 0, distancePx = 0, maxFrameGap = 0, lastFrameAt = 0;
  let invulnerable = 3, runOver = 0, jumpHeld = false, jumpLift = 0, nextId = 1, seed = Math.floor(Math.random() * 1_000_000);
  const recentFrames: number[] = [];
  const spans: GroundSpan[] = [{ from: 0, to: 1200 }];
  const entities: Entity[] = [];
  const drawings: { x: number; y: number; radius: number; color: number; life: number; owner?: string }[] = [];
  const labels: { text: Phaser.GameObjects.Text; life: number; owner?: string }[] = [];
  const particles: { x: number; y: number; vx: number; vy: number; color: number; life: number; owner?: string }[] = [];
  let flashLife = 0, flashColor = 0xffffff;
  let scene: LanternScene | undefined;
  let message = '', messageLife = 0, messageOwner = '';
  const screenX = (worldX: number) => worldX - distancePx;
  const worldX = (screen: number) => screen + distancePx;

  function addEntity(kind: Kind, at: number, y: number, size = 1, owner?: string) {
    const alive = entities.filter(item => item.alive);
    const category = (value: Kind) => ['log', 'thorns', 'boulder'].includes(value) ? 'obstacle' : powerUps.includes(value as PowerUp) ? 'power-up' : value;
    const categoryCap = category(kind) === 'obstacle' ? 12 : category(kind) === 'power-up' ? 4 : caps[kind];
    if (alive.length >= 80 || alive.filter(item => category(item.kind) === category(kind)).length >= categoryCap) return;
    if (['log', 'thorns', 'boulder', 'owl', 'pinecone'].includes(kind) && Math.abs(screenX(at) - FOX_X) < 150) at = worldX(FOX_X + 150);
    const item: Entity = { id: nextId++, kind, worldX: at, y, size, vx: 0, vy: 0, tag: '', owner, alive: true };
    if (scene) item.sprite = scene.add.image(screenX(at), y, `lantern-${kind}`).setDepth(3).setScale(size);
    entities.push(item);
    emit({ type: 'spawn', id: item.id, kind, x: screenX(at), y, origin: owner });
    return item;
  }
  function ensureWorld() {
    while (spans.at(-1)!.to < distancePx + WIDTH + 500) {
      const index = spans.length - 1;
      const stretch = generateStretch(seed, index, { speed: Math.max(120, run.speed), jumpPower: parameters.jumpPower, gravity: parameters.gravity });
      const from = spans.at(-1)!.to + stretch.gap;
      spans.push({ from, to: from + stretch.groundLength, stretch });
      if (stretch.hazard !== 'none' && (index * 47 + seed * 13) % 100 < Math.min(100, parameters.spawnRate * 70))
        addEntity(stretch.hazard, from + 220, stretch.hazard === 'owl' ? GROUND - 125 : GROUND - 32);
      const collectible = stretch.pickup;
      for (let i = 0; i < 3; i++) addEntity(collectible === 'acorn' && i === 1 ? 'acorn' : 'firefly', from + 110 + i * 58, GROUND - 125 - Math.sin(i / 2) * 35);
      if (stretch.ledge) addEntity('ledge', from + 350, GROUND - 155, 1.3);
    }
    while (spans.length > 2 && spans[1].to < distancePx - 400) spans.shift();
  }
  function jump() {
    if (runOver > 0) { startRun(); return; }
    if (player.jumpsLeft <= 0) return;
    player.vy = -parameters.jumpPower; player.grounded = false; player.jumpsLeft--; jumpLift = 0;
    audio.play('jump'); emit({ type: 'jump', jumpIndex: parameters.maxJumps - player.jumpsLeft, x: player.x, y: player.y });
  }
  function startRun() {
    run.number++; run.distance = 0; run.fireflies = 0; run.speed = parameters.runSpeed;
    runElapsed = 0; distancePx = 0; runOver = 0; invulnerable = 3; seed++;
    Object.assign(player, { y: GROUND - 38, vy: 0, grounded: true, jumpsLeft: parameters.maxJumps, hearts: parameters.maxHearts });
    for (const item of entities) item.sprite?.destroy(); entities.length = 0;
    granted.clear(); player.powerUps = [];
    spans.length = 0; spans.push({ from: 0, to: 1200 }); ensureWorld();
    emit({ type: 'runStart', run: run.number });
  }
  function hurt(kind: Kind | 'pit', id = 0) {
    if (invulnerable > 0 || runOver > 0) return;
    const shield = [...granted].find(([, power]) => power.kind === 'shield');
    if (shield) { granted.delete(shield[0]); player.powerUps = [...granted.values()].map(power => power.kind); invulnerable = .7; audio.play('power-up'); return; }
    player.hearts = Math.max(0, player.hearts - 1); invulnerable = 1;
    audio.play(kind === 'pit' ? 'fall' : 'hurt');
    emit(kind === 'pit' ? { type: 'fall', hearts: player.hearts } : { type: 'hit', id, kind, hearts: player.hearts });
    if (player.hearts === 0) {
      run.best = Math.max(run.best, run.distance); runOver = 2; audio.play('run-over');
      emit({ type: 'runEnd', run: run.number, distance: run.distance, fireflies: run.fireflies });
    }
  }
  function snapshot() {
    const now = performance.now();
    return { player: { ...player, powerUps: [...player.powerUps] }, run: { ...run }, elapsed, runElapsed, frame, maxFrameGap,
      frameRate: recentFrames.length > 1 ? (recentFrames.length - 1) * 1000 / (recentFrames.at(-1)! - recentFrames[0]) : 60,
      renderer: phaser.renderer?.type === Phaser.WEBGL ? 'webgl' : 'canvas', runOver: runOver > 0, restartIn: runOver,
      weather, parameters: { ...parameters }, particles: particles.length, drawings: drawings.length,
      entities: entities.filter(item => item.alive).slice(0, 100).map(item => ({ id: item.id, kind: item.kind, x: screenX(item.worldX), y: item.y, size: item.size, vx: item.vx, vy: item.vy, tag: item.tag })),
      activeEntities: entities.filter(item => item.alive).length, measuredAt: now };
  }
  function recomputeParameter(key: Parameter) {
    let latest: { value: number; order: number } | undefined;
    for (const writes of parameterWrites.values()) { const write = writes.get(key); if (write && (!latest || write.order > latest.order)) latest = write; }
    parameters[key] = latest?.value ?? defaults[key];
    player.maxHearts = parameters.maxHearts;
  }
  function recomputeWeather() {
    const latest = [...weatherWrites.values()].sort((a, b) => b.order - a.order)[0];
    weather = latest?.value ?? 'clear';
  }
  function removeMutation(origin: string) {
    const writes = parameterWrites.get(origin); parameterWrites.delete(origin);
    if (writes) for (const key of writes.keys()) recomputeParameter(key);
    weatherWrites.delete(origin); recomputeWeather();
    for (const [key, power] of granted) if (power.owner === origin) granted.delete(key);
    player.powerUps = [...granted.values()].map(power => power.kind);
    for (const item of entities) if (item.owner === origin) { item.alive = false; item.sprite?.destroy(); }
    for (const label of labels) if (label.owner === origin) label.text.destroy();
    for (let index = labels.length - 1; index >= 0; index--) if (labels[index].owner === origin) labels.splice(index, 1);
    for (let index = drawings.length - 1; index >= 0; index--) if (drawings[index].owner === origin) drawings.splice(index, 1);
    for (let index = particles.length - 1; index >= 0; index--) if (particles[index].owner === origin) particles.splice(index, 1);
    if (messageOwner === origin) { message = ''; messageLife = 0; messageOwner = ''; }
  }
  function burst(kind: string, x: number, y: number, owner?: string) {
    const colors: Record<string, number> = { sparks: 0xffd56b, leaves: 0x8fbd46, splash: 0x9cc6e8, celebration: 0xffa96a };
    if (!Object.hasOwn(colors, kind)) return;
    for (let i = 0; i < 8 && particles.length < 64; i++) {
      const angle = i * Math.PI / 4; particles.push({ x, y, vx: Math.cos(angle) * 85, vy: Math.sin(angle) * 85, color: colors[kind], life: .5, owner });
    }
  }
  function apply(action: GameAction, origin: string) {
    if (!action || !Array.isArray(action.args)) return;
    const [name, second, third, fourth] = action.args;
    if (action.type === 'systemEvent' && typeof name === 'string') {
      const cue = ({ shipped: 'patch-shipped', failed: 'patch-failed', rolled_back: 'rollback', 'round-start': 'round-start', 'vote-tick': 'vote-tick' } as Record<string, SoundName>)[name];
      if (cue && allowedSounds.has(cue)) audio.play(cue);
    } else if (action.type === 'spawn' && typeof name === 'string' && kinds.includes(name as Kind) && finite(second) && finite(third)) {
      addEntity(name as Kind, worldX(clamp(second, 0, 1400)), clamp(third, 0, HEIGHT), finite(fourth) ? clamp(fourth, .5, 2.5) : 1, origin);
    } else if (['removeEntity', 'moveEntity', 'setVelocity', 'setSize', 'setTag'].includes(action.type) && finite(name)) {
      const item = entities.find(entity => entity.alive && entity.id === name);
      if (!item) return;
      if (action.type === 'removeEntity') { item.alive = false; item.sprite?.destroy(); }
      else if (action.type === 'moveEntity' && finite(second) && finite(third)) { item.worldX = worldX(clamp(second, 0, 1400)); item.y = clamp(third, 0, HEIGHT); }
      else if (action.type === 'setVelocity' && finite(second) && finite(third)) { item.vx = clamp(second, -300, 300); item.vy = clamp(third, -300, 300); }
      else if (action.type === 'setSize' && finite(second)) { item.size = clamp(second, .5, 2.5); item.sprite?.setScale(item.size); }
      else if (action.type === 'setTag' && typeof second === 'string') item.tag = second.slice(0, 24);
    } else if (action.type === 'setParameter' && typeof name === 'string' && Object.hasOwn(parameterBounds, name) && finite(second)) {
      const key = name as Parameter, [min, max] = parameterBounds[key];
      const value = clamp(second, min, max);
      const writes = parameterWrites.get(origin) ?? new Map(); writes.set(key, { value: key === 'maxJumps' || key === 'maxHearts' ? Math.round(value) : value, order: ++writeOrder }); parameterWrites.set(origin, writes);
      recomputeParameter(key);
    } else if (action.type === 'grantPowerUp' && typeof name === 'string' && powerUps.includes(name as PowerUp) && finite(second)) {
      const kind = name as PowerUp; granted.set(`${origin}:${kind}`, { kind, until: runElapsed + clamp(second, 1, 15), owner: origin });
      player.powerUps = [...granted.values()].map(power => power.kind); audio.play('power-up');
    } else if (action.type === 'heal' && finite(name)) player.hearts = Math.min(parameters.maxHearts, player.hearts + clamp(Math.round(name), 1, 2));
    else if (action.type === 'setWeather' && typeof name === 'string' && weathers.includes(name as Weather)) {
      weatherWrites.set(origin, { value: name as Weather, order: ++writeOrder }); recomputeWeather();
    } else if (action.type === 'drawShape' && finite(name) && finite(second) && finite(third) && typeof fourth === 'string' && /^#[0-9a-f]{6}$/i.test(fourth)) {
      if (drawings.length < 32) drawings.push({ x: clamp(name, 0, WIDTH), y: clamp(second, 0, HEIGHT), radius: clamp(third, 1, 100), color: Number.parseInt(fourth.slice(1), 16), life: 1.5, owner: origin });
    } else if (action.type === 'drawText' && typeof name === 'string' && finite(second) && finite(third) && scene && labels.length < 24) {
      labels.push({ text: scene.add.text(clamp(second, 0, WIDTH), clamp(third, 0, HEIGHT), name.slice(0, 80), { fontFamily: 'Arial', fontSize: '22px', color: '#f4f1ff', stroke: '#192039', strokeThickness: 4 }).setDepth(8), life: 2, owner: origin });
    } else if (action.type === 'showMessage' && typeof name === 'string') { message = name.slice(0, 100); messageLife = 2; messageOwner = origin; }
    else if (action.type === 'playSound' && typeof name === 'string' && sounds.includes(name as SoundName) && allowedSounds.has(name)) audio.play(name as SoundName);
    else if (action.type === 'burst' && typeof name === 'string' && finite(second) && finite(third)) burst(name, clamp(second, 0, WIDTH), clamp(third, 0, HEIGHT), origin);
    else if (action.type === 'shake' && finite(name) && !settings.reduceFlashing) scene?.cameras.main.shake(120, clamp(name, 0, .01) * settings.effectsIntensity);
    else if (action.type === 'flash' && typeof name === 'string' && ['#ffffff', '#ffd56b', '#ff5a6e'].includes(name) && !settings.reduceFlashing) { flashLife = .12; flashColor = Number.parseInt(name.slice(1), 16); }
  }

  class LanternScene extends Phaser.Scene {
    private pen!: Phaser.GameObjects.Graphics;
    private sky!: Phaser.GameObjects.Image;
    private layers!: Phaser.GameObjects.TileSprite[];
    private fox!: Phaser.GameObjects.Image;
    private hudCount!: Phaser.GameObjects.Text;
    private hudDistance!: Phaser.GameObjects.Text;
    private hudHearts!: Phaser.GameObjects.Text;
    private banner!: Phaser.GameObjects.Text;
    private card!: Phaser.GameObjects.Container;
    constructor() { super('lantern-run'); }
    create() {
      scene = this;
      createLanternArt(this);
      this.sky = this.add.image(WIDTH / 2, HEIGHT / 2, 'lantern-sky').setDepth(-10);
      this.layers = [
        this.add.tileSprite(WIDTH / 2, 450 - 128, WIDTH, 256, 'lantern-far').setDepth(-8),
        this.add.tileSprite(WIDTH / 2, 490 - 128, WIDTH, 256, 'lantern-middle').setDepth(-7),
        this.add.tileSprite(WIDTH / 2, 540 - 128, WIDTH, 256, 'lantern-near').setDepth(-6)
      ];
      this.pen = this.add.graphics().setDepth(1);
      this.fox = this.add.image(FOX_X, player.y, 'lantern-fox-run').setDepth(4).setDisplaySize(116, 103);
      const style = { fontFamily: 'Inter, Arial', fontSize: '27px', color: '#f4f1ff', fontStyle: 'bold', stroke: '#192039', strokeThickness: 5 };
      this.hudCount = this.add.text(26, 18, '', style).setDepth(10);
      this.hudDistance = this.add.text(168, 18, '', style).setDepth(10);
      this.hudHearts = this.add.text(340, 18, '', { ...style, color: '#ff5a6e' }).setDepth(10);
      this.applyHudSize();
      this.banner = this.add.text(WIDTH / 2, 186, '', { ...style, fontSize: '25px', color: '#ffe1a7' }).setOrigin(.5).setDepth(10);
      const backing = this.add.rectangle(0, 0, 440, 210, 0x141a32, .94).setStrokeStyle(3, 0xf2a25a);
      const title = this.add.text(0, -72, 'RUN OVER', { ...style, fontSize: '38px', color: '#ffb45c' }).setOrigin(.5);
      const result = this.add.text(0, -15, '', { ...style, fontSize: '25px' }).setOrigin(.5);
      const best = this.add.text(0, 30, '', { ...style, fontSize: '21px', color: '#b9b4c8' }).setOrigin(.5);
      const next = this.add.text(0, 75, 'Next run in 2 s · Space to start now', { ...style, fontSize: '17px' }).setOrigin(.5);
      this.card = this.add.container(WIDTH / 2, HEIGHT / 2, [backing, title, result, best, next]).setDepth(20).setVisible(false);
      this.card.setData('result', result); this.card.setData('best', best);
      this.input.keyboard?.on('keydown', (event: KeyboardEvent) => { if (['Space', 'ArrowUp', 'KeyW'].includes(event.code) && !event.repeat) { jumpHeld = true; jump(); event.preventDefault(); } });
      this.input.keyboard?.on('keyup', (event: KeyboardEvent) => { if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) jumpHeld = false; });
      this.input.on('pointerdown', () => { jumpHeld = true; jump(); });
      this.input.on('pointerup', () => { jumpHeld = false; });
      ensureWorld(); emit({ type: 'runStart', run: run.number });
    }
    update(_time: number, deltaMs: number) {
      const now = performance.now(); const actualDelta = lastFrameAt ? now - lastFrameAt : deltaMs;
      if (lastFrameAt) maxFrameGap = Math.max(maxFrameGap, actualDelta);
      lastFrameAt = now; recentFrames.push(now); while (recentFrames.length && recentFrames[0] < now - 2000) recentFrames.shift();
      const dt = Math.min(actualDelta / 1000, .1);
      frame++; elapsed += dt;
      if (runOver > 0) { runOver = Math.max(0, runOver - dt); if (runOver === 0) startRun(); this.draw(); emit({ type: 'tick', delta: dt, distance: run.distance }); return; }
      runElapsed += dt; invulnerable = Math.max(0, invulnerable - dt); messageLife = Math.max(0, messageLife - dt);
      flashLife = Math.max(0, flashLife - dt);
      for (const [key, power] of granted) if (runElapsed >= power.until) granted.delete(key);
      player.powerUps = [...granted.values()].map(power => power.kind);
      for (const drawing of drawings) drawing.life -= dt;
      for (let i = drawings.length - 1; i >= 0; i--) if (drawings[i].life <= 0) drawings.splice(i, 1);
      for (const label of labels) { label.life -= dt; label.text.setAlpha(Math.min(1, label.life)); if (label.life <= 0) label.text.destroy(); }
      for (let i = labels.length - 1; i >= 0; i--) if (labels[i].life <= 0) labels.splice(i, 1);
      for (const particle of particles) { particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.life -= dt; }
      for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
      run.speed = clamp(parameters.runSpeed + (run.distance / 1000) * 35 * parameters.speedRamp, 120, 600);
      distancePx += run.speed * dt; run.distance = Math.floor(distancePx / 10);
      const priorMilestone = Math.floor((distancePx - run.speed * dt) / 1000);
      if (Math.floor(distancePx / 1000) > priorMilestone) emit({ type: 'milestone', meters: Math.floor(distancePx / 1000) * 100 });
      ensureWorld();
      if (jumpHeld && player.vy < 0 && jumpLift < .16) { player.vy -= 450 * dt; jumpLift += dt; }
      const previousFeet = player.y + 38;
      player.vy = clamp(player.vy + parameters.gravity * dt, -1200, player.powerUps.includes('glider') ? 280 : 1800);
      player.y += player.vy * dt;
      const at = distancePx + FOX_X;
      const ground = spans.some(span => at >= span.from && at <= span.to);
      const landingLedge = entities.find(item => item.alive && item.kind === 'ledge' && Math.abs(item.worldX - at) < 65 && previousFeet <= item.y - 16 && player.y + 38 >= item.y - 16 && player.vy >= 0);
      const landing = landingLedge ? landingLedge.y - 16 : ground ? GROUND : undefined;
      if (landing !== undefined && previousFeet <= landing + 8 && player.y + 38 >= landing && player.vy >= 0) {
        const wasGrounded = player.grounded; player.y = landing - 38; player.vy = 0; player.grounded = true; player.jumpsLeft = parameters.maxJumps;
        if (!wasGrounded) { audio.play('land'); emit({ type: 'land', x: player.x, y: player.y, on: landingLedge ? 'ledge' : 'ground' }); }
      } else player.grounded = false;
      if (player.y > HEIGHT + 40) {
        hurt('pit');
        const next = spans.find(span => span.from > at) ?? spans.at(-1)!;
        distancePx = Math.max(distancePx, next.from - FOX_X + 45);
        player.y = GROUND - 80; player.vy = 0; player.grounded = false; invulnerable = Math.max(invulnerable, 1.2);
      }
      for (const item of entities) {
        if (!item.alive) continue;
        item.worldX += item.vx * dt; item.y += item.vy * dt;
        const x = screenX(item.worldX);
        if (item.kind === 'pinecone' && item.vy === 0) item.vy = 220;
        if (player.powerUps.includes('magnet') && item.kind === 'firefly' && Math.abs(x - FOX_X) < 180) item.worldX -= Math.sign(x - FOX_X) * 300 * dt;
        if (x < -140) { item.alive = false; item.sprite?.destroy(); continue; }
        if (Math.abs(x - FOX_X) > 49 || Math.abs(item.y - player.y) > (item.kind === 'owl' ? 55 : 48)) continue;
        if (item.kind === 'firefly' || item.kind === 'acorn') {
          item.alive = false; item.sprite?.destroy(); const value = item.kind === 'acorn' ? 5 : parameters.fireflyValue;
          run.fireflies += value; audio.play(item.kind); emit({ type: 'collect', id: item.id, kind: item.kind, value });
        } else if (powerUps.includes(item.kind as PowerUp)) {
          item.alive = false; item.sprite?.destroy(); apply({ type: 'grantPowerUp', args: [item.kind, 8] }, item.owner ?? 'world');
        } else if (['log', 'thorns', 'boulder', 'owl', 'pinecone'].includes(item.kind) && invulnerable === 0) {
          hurt(item.kind, item.id); item.alive = false; item.sprite?.destroy();
        } else if (item.kind === 'spring' && player.vy >= 0) {
          player.vy = -Math.max(900, parameters.jumpPower); player.grounded = false; audio.play('spring'); emit({ type: 'land', x: player.x, y: player.y, on: 'spring' });
        }
      }
      for (let i = entities.length - 1; i >= 0; i--) if (!entities[i].alive) entities.splice(i, 1);
      this.draw(); emit({ type: 'tick', delta: dt, distance: run.distance });
    }
    private draw() {
      this.layers[0].tilePositionX = distancePx * .08;
      this.layers[1].tilePositionX = distancePx * .17;
      this.layers[2].tilePositionX = distancePx * .32;
      const g = this.pen; g.clear();
      g.fillStyle(0x1b1f33); g.fillRect(0, GROUND, WIDTH, HEIGHT - GROUND);
      for (const span of spans) {
        const left = screenX(span.from), right = screenX(span.to);
        if (right < 0 || left > WIDTH) continue;
        g.fillStyle(0x5a3a24); g.fillRect(left, GROUND + 13, right - left, HEIGHT - GROUND);
        g.fillStyle(0x7fae3a); g.fillRect(left, GROUND, right - left, 17);
        g.fillStyle(0xa1c45a); g.fillRect(left, GROUND, right - left, 5);
      }
      for (const item of entities) if (item.alive) {
        item.sprite?.setPosition(screenX(item.worldX), item.y);
        if (item.kind === 'firefly') { g.fillStyle(0xd9ff5a, .18 * settings.effectsIntensity); g.fillCircle(screenX(item.worldX), item.y, 25); }
      }
      if (player.powerUps.includes('shield')) { g.lineStyle(4, 0xffb84a, .8); g.strokeCircle(FOX_X, player.y, 68); }
      if (weather !== 'clear') {
        const count = Math.max(0, Math.min(32, 64 - particles.length, Math.round(20 * settings.effectsIntensity)));
        for (let i = 0; i < count; i++) {
          const x = (i * 97 + frame * (weather === 'wind' ? 5 : 2)) % WIDTH;
          const y = (i * 149 + frame * 7) % HEIGHT;
          g.fillStyle(weather === 'rain' ? 0xaed8ed : weather === 'fog' ? 0xc7c1d4 : 0xa4c481, .5);
          g.fillRect(x, y, weather === 'fog' ? 16 : 3, weather === 'rain' ? 14 : 3);
        }
      }
      for (const drawing of drawings) { g.lineStyle(3, drawing.color, Math.min(1, drawing.life)); g.strokeCircle(drawing.x, drawing.y, drawing.radius); }
      for (const particle of particles) { g.fillStyle(particle.color, Math.min(1, particle.life * 2)); g.fillCircle(particle.x, particle.y, 3); }
      if (flashLife > 0) { g.fillStyle(flashColor, flashLife * .8); g.fillRect(0, 0, WIDTH, HEIGHT); }
      const pose = runOver > 0 || invulnerable > 0 && player.hearts < player.maxHearts && frame % 8 < 4 ? 'hurt' : player.grounded ? 'run' : player.vy < 0 ? 'jump' : 'fall';
      this.fox.setTexture(`lantern-fox-${pose}`).setPosition(FOX_X, player.y + (pose === 'run' ? Math.sin(elapsed * 13) * 2 : 0));
      this.hudCount.setText(`✦ ${run.fireflies}`); this.hudDistance.setText(`${run.distance} m`);
      this.hudHearts.setText(`${'♥'.repeat(player.hearts)}${'♡'.repeat(player.maxHearts - player.hearts)}`);
      this.banner.setText(messageLife > 0 ? message : '');
      this.card.setVisible(runOver > 0);
      if (runOver > 0) {
        (this.card.getData('result') as Phaser.GameObjects.Text).setText(`${run.distance} m with ${run.fireflies} fireflies`);
        (this.card.getData('best') as Phaser.GameObjects.Text).setText(`Best ${run.best} m`);
      }
    }
    applyHudSize() {
      const size = settings.hudSize === 'large' ? 34 : settings.hudSize === 'small' ? 22 : 27;
      for (const label of [this.hudCount, this.hudDistance, this.hudHearts]) label.setFontSize(size);
    }
  }

  const phaser = new Phaser.Game({ type: Phaser.AUTO, width: WIDTH, height: HEIGHT, parent, backgroundColor: '#1f2b5c', scene: LanternScene, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
  const captureFrame = () => new Promise<ImageBitmap | null>(resolve => {
    let done = false;
    const timeout = window.setTimeout(() => { if (!done) { done = true; resolve(null); } }, 1500);
    phaser.renderer.snapshot(async image => {
      if (done) return; done = true; clearTimeout(timeout);
      if (!(image instanceof HTMLImageElement)) { resolve(null); return; }
      try { const small = document.createElement('canvas'); small.width = 480; small.height = 270;
        small.getContext('2d')!.drawImage(image, 0, 0, 480, 270); resolve(await createImageBitmap(small));
      } catch { resolve(null); }
    }, 'image/jpeg', .65);
  });
  return { apply, removeMutation, snapshot, enableSound: () => audio.enable(), configure: value => { settings = value as StudioSettings; audio.configure(settings); scene?.applyHudSize(); },
    pause: () => { scene?.scene.pause(); audio.pause(); }, resume: () => { lastFrameAt = 0; scene?.scene.resume(); audio.resume(); }, captureFrame,
    destroy: () => { audio.destroy(); phaser.destroy(true); } };
}
