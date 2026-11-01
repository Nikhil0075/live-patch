import type { StudioSettings } from '../../../engine/studio/settings-defaults';

export const sounds = ['jump', 'land', 'firefly', 'acorn', 'hurt', 'fall', 'run-over', 'spring', 'power-up', 'round-start', 'vote-tick', 'patch-shipped', 'patch-failed', 'rollback'] as const;
export type SoundName = typeof sounds[number];
export const MUSIC_BPM = 90;
export const MUSIC_STEP = 60 / MUSIC_BPM / 2;
export const MUSIC_BAR = MUSIC_STEP * 8;
type Wave = OscillatorType;
type Voice = { wave: Wave | 'noise'; from: number; to: number; gain: number; at: number; length: number; filter?: number };
type Recipe = readonly Voice[];
const v = (wave: Voice['wave'], from: number, to: number, gain: number, at: number, length: number, filter?: number): Voice => ({ wave, from, to, gain, at, length, filter });
export const recipes: Record<SoundName, Recipe> = {
  jump: [v('sine', 300, 690, .22, 0, .19), v('triangle', 450, 770, .08, .03, .14)],
  land: [v('noise', 0, 0, .18, 0, .11, 450), v('sine', 125, 70, .21, 0, .16)],
  firefly: [v('sine', 900, 1300, .12, 0, .22), v('sine', 1350, 1700, .06, .045, .16)],
  acorn: [v('triangle', 470, 820, .2, 0, .13), v('sine', 940, 1150, .08, .05, .12)],
  hurt: [v('sawtooth', 210, 85, .12, 0, .28, 850), v('noise', 0, 0, .12, .01, .2, 650)],
  fall: [v('sine', 430, 95, .22, 0, .43), v('noise', 0, 0, .09, .15, .32, 900)],
  'run-over': [v('triangle', 300, 70, .2, 0, .55), v('sine', 440, 110, .14, .1, .47), v('noise', 0, 0, .12, .05, .36, 500)],
  spring: [v('sine', 280, 1050, .2, 0, .31), v('triangle', 380, 1360, .08, .065, .22)],
  'power-up': [v('sine', 490, 980, .14, 0, .4), v('sine', 735, 1470, .1, .09, .32), v('triangle', 980, 1960, .06, .17, .25)],
  'round-start': [v('sine', 392, 392, .12, 0, .38), v('sine', 523, 523, .1, .08, .36), v('sine', 784, 784, .09, .16, .35)],
  'vote-tick': [v('sine', 640, 850, .17, 0, .09), v('noise', 0, 0, .05, 0, .035, 2400)],
  'patch-shipped': [v('sine', 523, 523, .13, 0, .55), v('triangle', 659, 659, .1, .07, .5), v('sine', 1046, 1046, .09, .14, .45)],
  'patch-failed': [v('triangle', 310, 165, .15, 0, .38), v('noise', 0, 0, .09, .035, .29, 700)],
  rollback: [v('sine', 540, 180, .18, 0, .44), v('triangle', 360, 110, .09, .05, .4)]
};
export const soundLength = (name: SoundName): number => Math.max(...recipes[name].map(voice => voice.at + voice.length));
const chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]];
const melody = [440, 0, 523.25, 0, 587.33, 523.25, 0, 0, 392, 0, 440, 0, 523.25, 0, 440, 0];
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

export class LanternAudio {
  private context?: BaseAudioContext;
  private owned = false;
  private master?: GainNode;
  private music?: GainNode;
  private effects?: GainNode;
  private musicFilter?: BiquadFilterNode;
  private reverb?: ConvolverNode;
  private timer?: number;
  private nextBar = 0;
  private bar = 0;
  private running = false;
  private rhythm = false;
  private paused = false;
  private recent = new Map<SoundName, number[]>();
  constructor(private settings: StudioSettings, context?: BaseAudioContext) { if (context) this.build(context); }
  private build(context: BaseAudioContext): void {
    this.context = context;
    this.master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -17; compressor.knee.value = 12; compressor.ratio.value = 4;
    compressor.attack.value = .003; compressor.release.value = .2;
    this.master.connect(compressor); compressor.connect(context.destination);
    this.effects = context.createGain(); this.effects.connect(this.master);
    this.music = context.createGain(); this.musicFilter = context.createBiquadFilter();
    this.musicFilter.type = 'lowpass'; this.musicFilter.frequency.value = 3800;
    this.music.connect(this.musicFilter); this.musicFilter.connect(this.master);
    this.reverb = context.createConvolver();
    const rate = context.sampleRate, length = Math.floor(rate * .7);
    const impulse = context.createBuffer(1, length, rate), data = impulse.getChannelData(0);
    let seed = 19;
    for (let i = 0; i < length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; data[i] = ((seed / 0xffffffff) * 2 - 1) * Math.exp(-6 * i / length); }
    this.reverb.buffer = impulse;
    const wet = context.createGain(); wet.gain.value = .11;
    this.reverb.connect(wet); wet.connect(this.master);
    this.music.connect(this.reverb);
    this.configure(this.settings);
    this.nextBar = context.currentTime + .08;
  }
  enable(): void {
    if (!this.context) { this.owned = true; this.build(new AudioContext()); }
    if (!this.paused && this.context && 'resume' in this.context) void (this.context as AudioContext).resume();
    if (this.timer === undefined) this.timer = window.setInterval(() => this.tick(), 25);
  }
  configure(settings: StudioSettings): void {
    this.settings = settings;
    if (!this.context || !this.master || !this.music || !this.effects) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.masterVolume, now, .04);
    this.music.gain.setTargetAtTime(settings.muted ? 0 : Math.min(.5, settings.musicVolume), now, .08);
    this.effects.gain.setTargetAtTime(settings.muted ? 0 : settings.effectsVolume, now, .04);
  }
  setRunState(active: boolean, distance: number, speed: number, startingSpeed: number): void {
    if (!this.context || !this.musicFilter || !this.music) return;
    if (this.running === active && this.rhythm === (distance >= 200 || speed > startingSpeed * 1.18)) return;
    this.running = active; this.rhythm = distance >= 200 || speed > startingSpeed * 1.18;
    const now = this.context.currentTime;
    this.musicFilter.frequency.setTargetAtTime(active ? 3800 : 550, now, active ? .35 : .9);
    if (!active) this.music.gain.setTargetAtTime(0, now, .7);
    else this.configure(this.settings);
  }
  private tick(): void {
    if (!this.context || this.paused || this.settings.muted) return;
    const now = this.context.currentTime;
    if (this.nextBar < now - MUSIC_BAR) this.nextBar = now + .04;
    while (this.nextBar < now + .1) { this.scheduleMusic(this.nextBar, 1, { melody: this.running, rhythm: this.rhythm }); this.nextBar += MUSIC_BAR; this.bar++; }
  }
  scheduleMusic(start: number, bars = 8, layers: { melody: boolean; rhythm: boolean } = { melody: true, rhythm: true }): number[] {
    if (!this.context || !this.music) return [];
    const onsets: number[] = [];
    for (let bar = 0; bar < bars; bar++) {
      const at = start + bar * MUSIC_BAR, chord = chords[(this.bar + bar) % chords.length];
      for (const note of chord) this.osc('sine', note / 2, note / 2, at, MUSIC_BAR - .035, .026, this.music);
      for (let beat = 0; beat < 4; beat++) {
        const t = at + beat * 2 * MUSIC_STEP;
        this.osc('triangle', chord[0] / 2, chord[0] / 2, t, .42, .085, this.music); onsets.push(t);
      }
      if (layers.melody) for (let step = 0; step < 8; step++) {
        const note = melody[(bar % 2) * 8 + step]; if (!note) continue;
        const t = at + step * MUSIC_STEP;
        this.osc('sine', note, note, t, .22, .095, this.music); onsets.push(t);
      }
      if (layers.rhythm) for (let step = 0; step < 8; step++) {
        const t = at + step * MUSIC_STEP;
        this.noise(t, .035, step % 2 ? .015 : .025, 5000, this.music);
        if (step % 4 === 0) this.osc('sine', 85, 42, t, .13, .09, this.music);
        onsets.push(t);
      }
    }
    return onsets;
  }
  play(name: SoundName, x?: number): void {
    if (!this.context || !this.effects || this.settings.muted || this.paused) return;
    const now = performance.now(), times = (this.recent.get(name) ?? []).filter(time => now - time < 1000);
    if (times.length >= 5) return;
    times.push(now); this.recent.set(name, times);
    this.scheduleEffect(name, this.context.currentTime + .005, x, 1 + (Math.random() * 2 - 1) * .03);
    if (name === 'hurt' && this.music) {
      const t = this.context.currentTime, level = this.settings.musicVolume;
      this.music.gain.setTargetAtTime(level * .38, t, .02);
      this.music.gain.setTargetAtTime(level, t + .2, .2);
    }
  }
  scheduleEffect(name: SoundName, start: number, x?: number, pitch = 1): number {
    if (!this.context || !this.effects) return 0;
    let target: AudioNode = this.effects;
    if (x !== undefined && Number.isFinite(x)) {
      const pan = this.context.createStereoPanner(); pan.pan.value = clamp((x - 576) / 576, -1, 1);
      pan.connect(this.effects); target = pan;
    }
    for (const voice of recipes[name]) {
      const dest = voice.filter ? this.context.createBiquadFilter() : target;
      if (voice.filter && dest instanceof BiquadFilterNode) { dest.type = 'lowpass'; dest.frequency.value = voice.filter; dest.connect(target); }
      const at = start + voice.at;
      if (voice.wave === 'noise') this.noise(at, voice.length, voice.gain, voice.filter ?? 6000, dest);
      else this.osc(voice.wave, voice.from * pitch, voice.to * pitch, at, voice.length, voice.gain, dest);
    }
    return soundLength(name);
  }
  private osc(wave: Wave, from: number, to: number, at: number, length: number, volume: number, destination: AudioNode): void {
    if (!this.context) return;
    const oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(Math.max(30, from), at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, to), at + length);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.linearRampToValueAtTime(volume, at + Math.min(.018, length * .2));
    gain.gain.exponentialRampToValueAtTime(.0001, at + length);
    oscillator.connect(gain); gain.connect(destination); oscillator.start(at); oscillator.stop(at + length + .005);
  }
  private noise(at: number, length: number, volume: number, cutoff: number, destination: AudioNode): void {
    if (!this.context) return;
    const buffer = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * length), this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(.0001, at); gain.gain.linearRampToValueAtTime(volume, at + Math.min(.01, length * .2));
    gain.gain.exponentialRampToValueAtTime(.0001, at + length);
    source.connect(filter); filter.connect(gain); gain.connect(destination); source.start(at);
  }
  pause(): void { this.paused = true; if (this.owned && this.context) void (this.context as AudioContext).suspend(); }
  resume(): void { this.paused = false; if (this.owned && this.context) void (this.context as AudioContext).resume(); }
  destroy(): void { if (this.timer !== undefined) clearInterval(this.timer); if (this.owned && this.context) void (this.context as AudioContext).close(); }
}
