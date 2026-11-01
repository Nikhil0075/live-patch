import Phaser from 'phaser';
import type { GameAction, GameAdapter, GameEvent } from '../../../engine/game-api';
import type { GameManifest } from '../../../engine/manifest/schema';
import { defaultSettings, type StudioSettings } from '../../../engine/studio/settings-defaults';
import { createLanternParts } from './art-parts';
import { createWorldArt } from './art-world';
import { FireflyRig, FoxRig, OwlRig } from './rig';
import { LanternAudio, sounds, type SoundName } from './audio';
import { DESPAWN_MARGIN, GENERATION_LEAD, MAX_GAP, MAX_SPAWN_OFFSET, OWL_SPAWN_OFFSET, LEDGE_SPAWN_OFFSET, OBSTACLE_SPAWN_OFFSET, generateStretch, owlFlightHeight, owlFlightY, type Stretch } from './generator';
import { CLIFF_HEIGHT, CLIFF_WIDTH, cliffCentreY, cliffTopY, pitWallsVisible, visibleGroundRects } from './ground-visibility';
import { advanceFoxFlight } from './physics';

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
interface Entity { id: number; kind: Kind; worldX: number; y: number; size: number; vx: number; vy: number; tag: string; owner?: string; alive: boolean; sprite?: Phaser.GameObjects.Image | Phaser.GameObjects.Container; owlRig?: OwlRig; fireflyRig?: FireflyRig; flightY?: number; flightPhase?: number; dropUntil?: number; kickUntil?: number }
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
  let fallTarget: number | undefined, lastMilestone = 0;
  let jumpAge = 10, landingAge = 10, hurtAge = 10, recoveryAge = 10, jumpIndex = 0;
  const recentFrames: number[] = [];
  const spans: GroundSpan[] = [{ from: 0, to: 1200 }];
  const entities: Entity[] = [];
  const drawings: { x: number; y: number; radius: number; color: number; life: number; owner?: string }[] = [];
  const labels: { text: Phaser.GameObjects.Text; life: number; owner?: string }[] = [];
  const particles: { x: number; y: number; vx: number; vy: number; color: number; kind: string; life: number; owner?: string }[] = [];
  let flashLife = 0, flashColor = 0xffffff;
  let countPulse = 0, heartPulse = 0;
  let scene: LanternScene | undefined;
  let resolveReady: (() => void) | undefined;
  const ready = new Promise<void>(resolve => { resolveReady = resolve; });
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
    if (scene) {
      if (kind === 'owl') { item.owlRig = new OwlRig(scene, screenX(at), y, size, item.id * .7); item.sprite = item.owlRig.container; }
      else if (kind === 'firefly') { item.fireflyRig = new FireflyRig(scene, screenX(at), y, size, item.id * .7); item.sprite = item.fireflyRig.container; }
      else item.sprite = scene.add.image(screenX(at), y, `lantern-world-${kind === 'log' && item.id % 4 === 0 ? 'log-stack' : kind}`).setDepth(3).setDisplaySize(96 * size, 96 * size);
    }
    if (kind === 'pinecone') for (const owl of entities) if (owl.alive && owl.kind === 'owl' && Math.abs(owl.worldX - at) < 90 && owl.y < y) owl.dropUntil = elapsed + .45;
    entities.push(item);
    emit({ type: 'spawn', id: item.id, kind, x: screenX(at), y, origin: owner });
    return item;
  }
  function ensureWorld() {
    while (spans.at(-1)!.to < distancePx + WIDTH + GENERATION_LEAD) {
      const index = spans.length - 1;
      const stretch = generateStretch(seed, index, { speed: Math.max(120, run.speed), jumpPower: parameters.jumpPower, gravity: parameters.gravity });
      const from = spans.at(-1)!.to + stretch.gap;
      spans.push({ from, to: from + stretch.groundLength, stretch });
      if (stretch.hazard !== 'none' && (index * 47 + seed * 13) % 100 < Math.min(100, parameters.spawnRate * 70)) {
        const height = owlFlightHeight(seed, index);
        const item = addEntity(stretch.hazard, from + (stretch.hazard === 'owl' ? OWL_SPAWN_OFFSET : OBSTACLE_SPAWN_OFFSET), stretch.hazard === 'owl' ? height : GROUND - 32);
        if (item && stretch.hazard === 'owl') { item.vx = -24; item.flightY = height; item.flightPhase = (seed + index * 7) % 19; }
      }
      const collectible = stretch.pickup;
      for (let i = 0; i < 3; i++) addEntity(collectible === 'acorn' && i === 1 ? 'acorn' : 'firefly', from + 110 + i * 58, GROUND - 125 - Math.sin(i / 2) * 35);
      if (stretch.ledge) addEntity('ledge', from + LEDGE_SPAWN_OFFSET, GROUND - 155, 1.3);
    }
    while (spans.length > 2 && spans[1].to < distancePx - 400) spans.shift();
  }
  function jump() {
    if (runOver > 0) { startRun(); return; }
    if (player.jumpsLeft <= 0) return;
    player.vy = -parameters.jumpPower; player.grounded = false; player.jumpsLeft--; jumpLift = 0;
    jumpIndex = parameters.maxJumps - player.jumpsLeft; jumpAge = 0;
    burst('splash', player.x, player.y + 37);
    audio.play('jump'); emit({ type: 'jump', jumpIndex: parameters.maxJumps - player.jumpsLeft, x: player.x, y: player.y });
  }
  function startRun() {
    run.number++; run.distance = 0; run.fireflies = 0; run.speed = parameters.runSpeed;
    runElapsed = 0; distancePx = 0; runOver = 0; invulnerable = 3; seed++; fallTarget = undefined; lastMilestone = 0;
    jumpAge = landingAge = hurtAge = recoveryAge = 10; jumpIndex = 0;
    Object.assign(player, { y: GROUND - 38, vy: 0, grounded: true, jumpsLeft: parameters.maxJumps, hearts: parameters.maxHearts });
    for (const item of entities) item.sprite?.destroy(); entities.length = 0;
    granted.clear(); player.powerUps = [];
    spans.length = 0; spans.push({ from: 0, to: 1200 }); ensureWorld();
    audio.setRunState(true, 0, run.speed, parameters.runSpeed);
    emit({ type: 'runStart', run: run.number });
  }
  function hurt(kind: Kind | 'pit', id = 0) {
    if (invulnerable > 0 || runOver > 0) return;
    const shield = [...granted].find(([, power]) => power.kind === 'shield');
    if (shield) { granted.delete(shield[0]); player.powerUps = [...granted.values()].map(power => power.kind); invulnerable = .7; audio.play('power-up'); return; }
    player.hearts = Math.max(0, player.hearts - 1); invulnerable = 1;
    hurtAge = 0;
    heartPulse = .45; burst('hurt', player.x, player.y);
    audio.play(kind === 'pit' ? 'fall' : 'hurt');
    emit(kind === 'pit' ? { type: 'fall', hearts: player.hearts } : { type: 'hit', id, kind, hearts: player.hearts });
    if (player.hearts === 0) {
      run.best = Math.max(run.best, run.distance); runOver = 2; audio.play('run-over'); audio.setRunState(false, run.distance, run.speed, parameters.runSpeed);
      emit({ type: 'runEnd', run: run.number, distance: run.distance, fireflies: run.fireflies });
    }
  }
  function snapshot() {
    const now = performance.now();
    return { player: { ...player, powerUps: [...player.powerUps] }, run: { ...run }, elapsed, runElapsed, frame, maxFrameGap,
      frameRate: recentFrames.length > 1 ? (recentFrames.length - 1) * 1000 / (recentFrames.at(-1)! - recentFrames[0]) : 60,
      renderer: phaser.renderer?.type === Phaser.WEBGL ? 'webgl' : 'canvas', runOver: runOver > 0, restartIn: runOver,
      weather, parameters: { ...parameters }, particles: particles.length, drawings: drawings.length,
      hudBounds: scene?.hudBounds() ?? [], gripError: scene?.gripError() ?? 0,
      groundUnderFox: spans.some(span => distancePx + FOX_X >= span.from && distancePx + FOX_X <= span.to),
      entities: entities.filter(item => item.alive).slice(0, 100).map(item => ({ id: item.id, kind: item.kind, x: screenX(item.worldX), y: item.y, size: item.size, vx: item.vx, vy: item.vy, tag: item.tag })),
      activeEntities: entities.filter(item => item.alive).length, measuredAt: now };
  }
  function recomputeParameter(key: Parameter) {
    let latest: { value: number; order: number } | undefined;
    for (const writes of parameterWrites.values()) { const write = writes.get(key); if (write && (!latest || write.order > latest.order)) latest = write; }
    parameters[key] = latest?.value ?? defaults[key];
    if (key === 'maxHearts') { player.maxHearts = parameters.maxHearts; player.hearts = clamp(player.hearts, 0, player.maxHearts); }
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
    const colors: Record<string, number> = { sparks: 0xffd56b, leaves: 0x8fbd46, splash: 0x9cc6e8, celebration: 0xffa96a, hurt: 0xff7e85 };
    if (!Object.hasOwn(colors, kind)) return;
    for (let i = 0; i < 8 && particles.length < 64; i++) {
      const angle = i * Math.PI / 4; particles.push({ x, y, vx: Math.cos(angle) * 85, vy: Math.sin(angle) * 85, color: colors[kind], kind, life: .5, owner });
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
      else if (action.type === 'moveEntity' && finite(second) && finite(third)) { item.worldX = worldX(clamp(second, 0, 1400)); item.y = clamp(third, 0, HEIGHT); if (item.flightY !== undefined) item.flightY = item.y; }
      else if (action.type === 'setVelocity' && finite(second) && finite(third)) { item.vx = clamp(second, -300, 300); item.vy = clamp(third, -300, 300); }
      else if (action.type === 'setSize' && finite(second)) { item.size = clamp(second, .5, 2.5); if (item.sprite instanceof Phaser.GameObjects.Image) item.sprite.setDisplaySize(96 * item.size, 96 * item.size); else item.sprite?.setScale(item.size * (item.kind === 'owl' ? .85 : 1)); }
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
    private groundMask!: Phaser.GameObjects.Graphics;
    private sky!: Phaser.GameObjects.Image;
    private layers!: Phaser.GameObjects.TileSprite[];
    private foreground!: Phaser.GameObjects.TileSprite;
    private groundStrip!: Phaser.GameObjects.TileSprite;
    private cliffs = new Map<number, { left: Phaser.GameObjects.Image; right: Phaser.GameObjects.Image }>();
    private clouds!: Phaser.GameObjects.TileSprite;
    private stars: Phaser.GameObjects.Arc[] = [];
    private fox!: FoxRig;
    private hudCount!: Phaser.GameObjects.Text;
    private hudDistance!: Phaser.GameObjects.Text;
    private hudHearts!: Phaser.GameObjects.Image[];
    private hudFirefly!: Phaser.GameObjects.Image;
    private banner!: Phaser.GameObjects.Text;
    private bannerBack!: Phaser.GameObjects.Graphics;
    private card!: Phaser.GameObjects.Container;
    constructor() { super('lantern-run'); }
    create() {
      scene = this;
      createLanternParts(this);
      createWorldArt(this);
      this.sky = this.add.image(WIDTH / 2, HEIGHT / 2, 'lantern-world-sky').setDisplaySize(WIDTH, HEIGHT).setDepth(-10);
      this.clouds = this.add.tileSprite(WIDTH / 2, 210, WIDTH, 200, 'lantern-world-clouds').setDepth(-9).setAlpha(.6);
      this.stars = Array.from({ length: 20 }, (_, index) => this.add.circle((index * 227 + 45) % WIDTH, (index * 71 + 33) % 280, index % 4 ? 1 : 2, 0xffecc2, .4).setDepth(-9));
      this.layers = Array.from({ length: 5 }, (_, index) => this.add.tileSprite(WIDTH / 2, 362 + index * 8, WIDTH, 330, `lantern-world-layer-${index}`)
        .setDepth(-8 + index).setAlpha(index === 4 ? .72 : 1));
      this.groundStrip = this.add.tileSprite(0, GROUND - 12, WIDTH, 142, 'lantern-world-ground-strip').setOrigin(0, 0).setDepth(.5).setTileScale(.5);
      this.groundMask = this.add.graphics().setVisible(false);
      this.groundStrip.setMask(this.groundMask.createGeometryMask());
      this.foreground = this.add.tileSprite(WIDTH / 2, 563, WIDTH, 190, 'lantern-world-foreground').setDepth(6).setAlpha(.72);
      this.pen = this.add.graphics().setDepth(1);
      this.fox = new FoxRig(this, FOX_X, player.y, GROUND);
      const style = { fontFamily: 'Inter, Arial', fontSize: '27px', color: '#f4f1ff', fontStyle: 'bold', stroke: '#192039', strokeThickness: 5 };
      this.hudFirefly = this.add.image(39, 37, 'lantern-rig-firefly-body').setDisplaySize(31, 31).setDepth(10);
      this.hudCount = this.add.text(61, 18, '', style).setDepth(10);
      this.hudDistance = this.add.text(130, 18, '', style).setDepth(10);
      this.hudHearts = Array.from({ length: 5 }, (_, index) => this.add.image(270 + index * 26, 37, 'lantern-rig-hud-heart').setDisplaySize(23, 23).setDepth(10));
      this.applyHudSize();
      this.bannerBack = this.add.graphics().setDepth(9).setVisible(false);
      this.banner = this.add.text(WIDTH / 2, 196, '', { ...style, fontSize: '23px', color: '#ffe6ad' }).setOrigin(.5).setDepth(10);
      const backing = this.add.graphics();
      backing.fillStyle(0x121b2e, .96).fillRoundedRect(-236, -121, 472, 242, 24);
      backing.lineStyle(3, 0xe8ad63).strokeRoundedRect(-236, -121, 472, 242, 24);
      backing.fillStyle(0x74935d).fillTriangle(-228, -95, -204, -118, -199, -89).fillTriangle(228, -95, 204, -118, 199, -89);
      backing.lineStyle(2, 0x8f906c, .65).lineBetween(-192, 26, 192, 26);
      const title = this.add.text(0, -81, 'RUN OVER', { ...style, fontSize: '37px', color: '#ffca79' }).setOrigin(.5);
      const result = this.add.text(0, -29, '', { ...style, fontSize: '24px' }).setOrigin(.5);
      const best = this.add.text(0, 53, '', { ...style, fontSize: '20px', color: '#d7cfbd' }).setOrigin(.5);
      const keycap = this.add.graphics().fillStyle(0x334650).fillRoundedRect(-190, 82, 70, 30, 6).lineStyle(1, 0xa9bf9d).strokeRoundedRect(-190, 82, 70, 30, 6);
      const keyLabel = this.add.text(-155, 97, 'SPACE', { ...style, fontSize: '15px', color: '#f6e6bc' }).setOrigin(.5);
      const next = this.add.text(12, 96, 'Next run in 2 s', { ...style, fontSize: '17px' }).setOrigin(.5);
      this.card = this.add.container(WIDTH / 2, HEIGHT / 2, [backing, title, result, best, keycap, keyLabel, next]).setDepth(20).setVisible(false);
      this.card.setData('result', result); this.card.setData('best', best); this.card.setData('next', next);
      this.input.keyboard?.on('keydown', (event: KeyboardEvent) => { if (['Space', 'ArrowUp', 'KeyW'].includes(event.code) && !event.repeat) { jumpHeld = true; jump(); event.preventDefault(); } });
      this.input.keyboard?.on('keyup', (event: KeyboardEvent) => { if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) jumpHeld = false; });
      this.input.on('pointerdown', () => { jumpHeld = true; jump(); });
      this.input.on('pointerup', () => { jumpHeld = false; });
      ensureWorld(); emit({ type: 'runStart', run: run.number });
      resolveReady?.();
    }
    update(_time: number, deltaMs: number) {
      const now = performance.now(); const actualDelta = lastFrameAt ? now - lastFrameAt : deltaMs;
      if (lastFrameAt) maxFrameGap = Math.max(maxFrameGap, actualDelta);
      lastFrameAt = now; recentFrames.push(now); while (recentFrames.length && recentFrames[0] < now - 2000) recentFrames.shift();
      const dt = Math.min(actualDelta / 1000, .1);
      frame++; elapsed += dt;
      jumpAge += dt; landingAge += dt; hurtAge += dt; recoveryAge += dt;
      if (runOver > 0) { runOver = Math.max(0, runOver - dt); if (runOver === 0) startRun(); this.draw(); emit({ type: 'tick', delta: dt, distance: run.distance }); return; }
      runElapsed += dt; invulnerable = Math.max(0, invulnerable - dt); messageLife = Math.max(0, messageLife - dt);
      countPulse = Math.max(0, countPulse - dt); heartPulse = Math.max(0, heartPulse - dt);
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
      audio.setRunState(true, run.distance, run.speed, parameters.runSpeed);
      while (lastMilestone + 100 <= run.distance) { lastMilestone += 100; emit({ type: 'milestone', meters: lastMilestone }); }
      ensureWorld();
      const previousFeet = player.y + 38;
      const flight = advanceFoxFlight({ y: player.y, vy: player.vy, jumpLift }, dt, parameters.gravity, jumpHeld, player.powerUps.includes('glider'));
      player.y = flight.y; player.vy = flight.vy; jumpLift = flight.jumpLift;
      const at = distancePx + FOX_X;
      const ground = spans.some(span => at >= span.from && at <= span.to);
      const landingLedge = entities.find(item => item.alive && item.kind === 'ledge' && Math.abs(item.worldX - at) < 65 && previousFeet <= item.y - 16 && player.y + 38 >= item.y - 16 && player.vy >= 0);
      const landing = landingLedge ? landingLedge.y - 16 : ground ? GROUND : undefined;
      if (landing !== undefined && previousFeet <= landing + 8 && player.y + 38 >= landing && player.vy >= 0) {
        const wasGrounded = player.grounded; player.y = landing - 38; player.vy = 0; player.grounded = true; player.jumpsLeft = parameters.maxJumps;
        if (!wasGrounded) { landingAge = 0; burst('splash', player.x, landing - 4); audio.play('land'); emit({ type: 'land', x: player.x, y: player.y, on: landingLedge ? 'ledge' : 'ground' }); }
        if (ground) fallTarget = undefined;
      } else player.grounded = false;
      if (!ground && fallTarget === undefined && player.y + 38 >= GROUND) fallTarget = spans.find(span => span.from > at)?.from;
      if (player.y > HEIGHT + 40) {
        hurt('pit');
        const next = spans.find(span => span.from === fallTarget) ?? spans.find(span => span.from > at) ?? spans.at(-1)!;
        if (at < next.from || at > next.to - 20) distancePx = next.from - FOX_X + 45;
        run.distance = Math.floor(distancePx / 10);
        while (lastMilestone + 100 <= run.distance) { lastMilestone += 100; emit({ type: 'milestone', meters: lastMilestone }); }
        fallTarget = undefined;
        player.y = GROUND - 80; player.vy = 0; player.grounded = false; invulnerable = Math.max(invulnerable, 1.2);
        recoveryAge = 0;
      }
      let trails = 0;
      for (const item of entities) {
        if (!item.alive) continue;
        item.worldX += item.vx * dt;
        if (item.flightY !== undefined) { item.flightY += item.vy * dt; item.y = owlFlightY(item.flightY, elapsed, item.flightPhase ?? 0); }
        else item.y += item.vy * dt;
        const x = screenX(item.worldX);
        if (item.kind === 'firefly' && frame % 8 === 0 && trails < 2 && particles.length < 64 && settings.effectsIntensity > 0) {
          particles.push({ x: x - 8, y: item.y + 5, vx: -17, vy: 8, color: 0xe8ff94, kind: 'sparks', life: .28, owner: item.owner }); trails++;
        }
        if (item.kind === 'pinecone' && item.vy === 0) item.vy = 220;
        if (player.powerUps.includes('magnet') && item.kind === 'firefly' && Math.abs(x - FOX_X) < 180) item.worldX -= Math.sign(x - FOX_X) * 300 * dt;
        // Generated ledges are placed 350 px into the next stretch, which itself
        // can begin 650 px beyond the viewport when ensureWorld extends it.
        if (x < -140 || x > WIDTH + GENERATION_LEAD + MAX_GAP + MAX_SPAWN_OFFSET + DESPAWN_MARGIN) { item.alive = false; item.sprite?.destroy(); continue; }
        if (Math.abs(x - FOX_X) > 49 || Math.abs(item.y - player.y) > (item.kind === 'owl' ? 55 : 48)) continue;
        if (item.kind === 'firefly' || item.kind === 'acorn') {
          item.alive = false; item.sprite?.destroy(); const value = item.kind === 'acorn' ? 5 : parameters.fireflyValue;
          run.fireflies += value; countPulse = .28; burst(item.kind === 'acorn' ? 'celebration' : 'sparks', x, item.y);
          audio.play(item.kind, x); emit({ type: 'collect', id: item.id, kind: item.kind, value });
        } else if (powerUps.includes(item.kind as PowerUp)) {
          item.alive = false; item.sprite?.destroy(); apply({ type: 'grantPowerUp', args: [item.kind, 8] }, item.owner ?? 'world');
        } else if (['log', 'thorns', 'boulder', 'owl', 'pinecone'].includes(item.kind) && invulnerable === 0) {
          hurt(item.kind, item.id); item.alive = false; item.sprite?.destroy();
        } else if (item.kind === 'spring' && player.vy >= 0) {
          player.vy = -Math.max(900, parameters.jumpPower); player.grounded = false; item.kickUntil = elapsed + .3;
          audio.play('spring', x); emit({ type: 'land', x: player.x, y: player.y, on: 'spring' });
        }
      }
      for (let i = entities.length - 1; i >= 0; i--) if (!entities[i].alive) entities.splice(i, 1);
      this.draw(); emit({ type: 'tick', delta: dt, distance: run.distance });
    }
    private draw() {
      this.layers.forEach((layer, index) => { layer.tilePositionX = distancePx * [.06, .12, .22, .36, .53][index]; });
      this.groundStrip.tilePositionX = distancePx * 2;
      this.groundMask.clear().fillStyle(0xffffff);
      for (const rect of visibleGroundRects(spans, distancePx, WIDTH)) this.groundMask.fillRect(rect.x, GROUND - 12, rect.width, HEIGHT - GROUND + 12);
      this.foreground.tilePositionX = distancePx * .68;
      this.clouds.tilePositionX = elapsed * 5;
      this.stars.forEach((star, index) => star.setAlpha(.25 + .25 * (1 + Math.sin(elapsed * (1.2 + index % 3 * .35) + index))));
      this.layers[3].setAlpha(.92 + .08 * Math.sin(elapsed * 2));
      const g = this.pen; g.clear();
      const visibleGaps = new Set<number>();
      for (let index = 1; index < spans.length; index++) {
        const left = screenX(spans[index - 1].to), right = screenX(spans[index].from);
        if (!pitWallsVisible(left, right, WIDTH)) continue;
        const key = spans[index - 1].to; visibleGaps.add(key);
        g.fillStyle(0x111b2b); g.fillRect(left, cliffTopY(GROUND), right - left, HEIGHT - cliffTopY(GROUND));
        g.fillStyle(0x23354a, .55);
        for (let x = left + 18; x < right; x += 30) g.fillTriangle(x - 14, HEIGHT, x, GROUND + 72 + Math.sin(x * .12) * 8, x + 20, HEIGHT);
        let faces = this.cliffs.get(key);
        if (!faces) {
          faces = { left: this.add.image(0, 0, 'lantern-world-cliff-left').setDepth(1.5).setDisplaySize(CLIFF_WIDTH, CLIFF_HEIGHT),
            right: this.add.image(0, 0, 'lantern-world-cliff-right').setDepth(1.5).setDisplaySize(CLIFF_WIDTH, CLIFF_HEIGHT) };
          this.cliffs.set(key, faces);
        }
        faces.left.setPosition(left - CLIFF_WIDTH / 2, cliffCentreY(GROUND));
        faces.right.setPosition(right + CLIFF_WIDTH / 2, cliffCentreY(GROUND));
      }
      for (const [key, faces] of this.cliffs) if (!visibleGaps.has(key)) { faces.left.destroy(); faces.right.destroy(); this.cliffs.delete(key); }
      for (const item of entities) if (item.alive) {
        if (item.owlRig) item.owlRig.update(screenX(item.worldX), item.y, elapsed, (item.dropUntil ?? 0) > elapsed);
        else if (item.fireflyRig) item.fireflyRig.update(screenX(item.worldX), item.y, elapsed, settings.effectsIntensity);
        else item.sprite?.setPosition(screenX(item.worldX), item.y);
        if (item.sprite instanceof Phaser.GameObjects.Image) {
          if (item.kind === 'spring') item.sprite.setScale(item.size * .5, item.size * .5 * ((item.kickUntil ?? 0) > elapsed ? .55 + (item.kickUntil! - elapsed) * .9 : .9 + .1 * Math.sin(elapsed * 5 + item.id)));
          else if (item.kind === 'acorn') item.sprite.setAngle(Math.sin(elapsed * 4 + item.id) * 20);
          else if (['shield', 'glider', 'magnet', 'ledge', 'thorns'].includes(item.kind)) item.sprite.setAngle(Math.sin(elapsed * 2 + item.id) * (item.kind === 'ledge' ? 2 : 6));
          else if (item.kind === 'pinecone') item.sprite.setAngle(elapsed * 110);
        }
      }
      if (player.powerUps.includes('shield')) { g.lineStyle(4, 0xffb84a, .8); g.strokeCircle(FOX_X, player.y, 68); }
      if (weather !== 'clear') {
        const count = Math.max(0, Math.min(32, 64 - particles.length, Math.round(20 * settings.effectsIntensity)));
        for (let i = 0; i < count; i++) {
          const x = (i * 97 + elapsed * (weather === 'wind' ? 90 : 30)) % WIDTH;
          const y = (i * 149 + elapsed * 115) % HEIGHT;
          if (weather === 'rain') {
            g.lineStyle(2, 0xaed8ed, .5).lineBetween(x, y, x - 5, y + 18);
            if (y > GROUND - 25) { g.lineStyle(1, 0xc8e2e6, .45).strokeEllipse(x, GROUND + 3, 10, 3); }
          } else if (weather === 'wind') {
            g.lineStyle(2, 0xa4c481, .6).lineBetween(x - 9, y, x + 8, y - 4);
            g.fillStyle(0x8eb067, .55).fillTriangle(x, y, x + 7, y - 9, x + 12, y + 1);
          } else { g.fillStyle(0xb6bfca, .045).fillEllipse(x, y, 180, 25); }
        }
      }
      for (const drawing of drawings) { g.lineStyle(3, drawing.color, Math.min(1, drawing.life)); g.strokeCircle(drawing.x, drawing.y, drawing.radius); }
      for (const particle of particles) {
        const alpha = Math.min(1, particle.life * 2) * settings.effectsIntensity;
        g.fillStyle(particle.color, alpha);
        if (particle.kind === 'leaves') g.fillTriangle(particle.x - 3, particle.y + 2, particle.x + 5, particle.y - 5, particle.x + 7, particle.y + 4);
        else if (particle.kind === 'splash') g.fillEllipse(particle.x, particle.y, 9, 3);
        else if (particle.kind === 'celebration' || particle.kind === 'hurt') { g.fillTriangle(particle.x, particle.y - 5, particle.x + 4, particle.y, particle.x, particle.y + 5); g.fillTriangle(particle.x, particle.y - 5, particle.x - 4, particle.y, particle.x, particle.y + 5); }
        else g.fillCircle(particle.x, particle.y, 3);
      }
      if (hurtAge < .35 && settings.effectsIntensity > 0) { g.lineStyle(3, 0xffcb88, (1 - hurtAge / .35) * settings.effectsIntensity).strokeCircle(FOX_X, player.y, 30 + hurtAge * 100); }
      if (jumpIndex > 1 && jumpAge < .4 && !player.grounded && settings.effectsIntensity > 0) { g.lineStyle(2, 0xffd770, (1 - jumpAge / .4) * settings.effectsIntensity).strokeEllipse(FOX_X, player.y, 98, 46); }
      if (flashLife > 0) { g.fillStyle(flashColor, flashLife * .8); g.fillRect(0, 0, WIDTH, HEIGHT); }
      this.fox.update({ x: FOX_X, y: player.y, ground: GROUND, distancePx, elapsed, dt: Math.min(1 / 30, Math.max(1 / 120, recentFrames.length > 1 ? (recentFrames.at(-1)! - recentFrames.at(-2)!) / 1000 : 1 / 60)), vy: player.vy, grounded: player.grounded,
        invulnerable, hearts: player.hearts, maxHearts: player.maxHearts, runOver: runOver > 0, jumpIndex, jumpAge, landingAge, hurtAge, recoveryAge,
        glider: player.powerUps.includes('glider'), shield: player.powerUps.includes('shield'), intensity: settings.effectsIntensity });
      this.hudCount.setText(String(run.fireflies)); this.hudDistance.setText(`${run.distance} m`);
      this.hudCount.setScale(1 + countPulse * .7);
      this.hudFirefly.setScale((settings.hudSize === 'large' ? 35 : settings.hudSize === 'small' ? 27 : 31) / 96 * (1 + countPulse * .6));
      this.hudHearts.forEach((icon, index) => icon.setVisible(index < player.maxHearts).setTexture(index < player.hearts ? 'lantern-rig-hud-heart' : 'lantern-rig-hud-heart-empty'));
      this.hudHearts.forEach(icon => icon.setScale((settings.hudSize === 'large' ? 25 : settings.hudSize === 'small' ? 19 : 23) / 80 * (1 + heartPulse * .35)));
      const iconWidth = settings.hudSize === 'large' ? 25 : settings.hudSize === 'small' ? 19 : 23;
      const baseFont = settings.hudSize === 'large' ? 34 : settings.hudSize === 'small' ? 22 : 27;
      const textBudget = 398 - 61 - player.maxHearts * (iconWidth + 1) - 28;
      const currentFont = Number.parseInt(String(this.hudCount.style.fontSize), 10) || baseFont;
      const naturalWidth = (this.hudCount.width * this.hudCount.scaleX + this.hudDistance.width) * baseFont / currentFont;
      const fontSize = Math.max(17, Math.floor(baseFont * Math.min(1, textBudget / Math.max(1, naturalWidth))));
      if (currentFont !== fontSize) {
        this.hudCount.setFontSize(fontSize); this.hudDistance.setFontSize(fontSize);
      }
      this.hudDistance.x = this.hudCount.x + this.hudCount.displayWidth + 14;
      const firstHeart = this.hudDistance.x + this.hudDistance.displayWidth + 14 + iconWidth / 2;
      this.hudHearts.forEach((icon, index) => { icon.x = firstHeart + index * (iconWidth + 1); });
      this.banner.setText(messageLife > 0 ? message : '');
      this.bannerBack.clear().setVisible(messageLife > 0);
      if (messageLife > 0) {
        const w = Math.min(760, Math.max(260, this.banner.width + 66)), slide = Math.min(1, (2 - messageLife) * 5);
        this.banner.setPosition(WIDTH / 2, 195 + (1 - slide) * 22).setAlpha(Math.min(1, messageLife * 3, slide));
        this.bannerBack.fillStyle(0x1b2c39, .88).fillRoundedRect(WIDTH / 2 - w / 2, this.banner.y - 22, w, 44, 18)
          .lineStyle(2, 0xd1aa6a, .85).strokeRoundedRect(WIDTH / 2 - w / 2, this.banner.y - 22, w, 44, 18)
          .fillStyle(0x8aa466).fillTriangle(WIDTH / 2 - w / 2 + 12, this.banner.y, WIDTH / 2 - w / 2 + 31, this.banner.y - 8, WIDTH / 2 - w / 2 + 28, this.banner.y + 8)
          .fillTriangle(WIDTH / 2 + w / 2 - 12, this.banner.y, WIDTH / 2 + w / 2 - 31, this.banner.y - 8, WIDTH / 2 + w / 2 - 28, this.banner.y + 8);
        this.bannerBack.setAlpha(this.banner.alpha);
      }
      this.card.setVisible(runOver > 0);
      if (runOver > 0) {
        this.card.setY(HEIGHT / 2 + Math.max(0, 1 - (2 - runOver) * 5) * 35);
        (this.card.getData('result') as Phaser.GameObjects.Text).setText(`${run.distance} m with ${run.fireflies} fireflies`);
        (this.card.getData('best') as Phaser.GameObjects.Text).setText(`Best ${run.best} m`);
        (this.card.getData('next') as Phaser.GameObjects.Text).setText(`Next run in ${Math.ceil(runOver)} s`);
      }
    }
    applyHudSize() {
      const size = settings.hudSize === 'large' ? 34 : settings.hudSize === 'small' ? 22 : 27;
      for (const label of [this.hudCount, this.hudDistance]) label.setFontSize(size);
      const iconSize = settings.hudSize === 'large' ? 25 : settings.hudSize === 'small' ? 19 : 23;
      this.hudHearts.forEach(icon => icon.setDisplaySize(iconSize, iconSize).setY(19 + size * .68));
      this.hudFirefly.setDisplaySize(iconSize + 5, iconSize + 5).setPosition(38, 19 + size * .68);
    }
    hudBounds() { return [this.hudCount, this.hudDistance, this.hudFirefly, ...this.hudHearts.filter(icon => icon.visible)].map(label => { const { x, y, width, height } = label.getBounds(); return { x, y, width, height }; }); }
    gripError() { return this.fox.gripError(); }
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
  return { apply, removeMutation, snapshot, ready, resetFrameGap: () => { maxFrameGap = 0; lastFrameAt = 0; }, enableSound: () => { audio.enable(); audio.setRunState(runOver === 0, run.distance, run.speed, parameters.runSpeed); }, configure: value => { settings = value as StudioSettings; audio.configure(settings); scene?.applyHudSize(); },
    pause: () => { scene?.scene.pause(); audio.pause(); }, resume: () => { lastFrameAt = 0; scene?.scene.resume(); audio.resume(); }, captureFrame,
    destroy: () => { audio.destroy(); phaser.destroy(true); } };
}
