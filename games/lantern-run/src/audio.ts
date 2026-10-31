import type { StudioSettings } from '../../../engine/studio/settings-defaults';

export const sounds = ['jump', 'land', 'firefly', 'acorn', 'hurt', 'fall', 'run-over', 'spring', 'power-up', 'round-start', 'vote-tick', 'patch-shipped', 'patch-failed', 'rollback'] as const;
export type SoundName = typeof sounds[number];
const tones: Record<SoundName, [number, number, number]> = {
  jump: [360, 670, .15], land: [170, 105, .08], firefly: [760, 1150, .17], acorn: [550, 880, .2],
  hurt: [250, 90, .22], fall: [400, 110, .35], 'run-over': [330, 130, .5], spring: [340, 900, .3],
  'power-up': [500, 1060, .35], 'round-start': [392, 784, .35], 'vote-tick': [620, 820, .08],
  'patch-shipped': [523, 1046, .55], 'patch-failed': [250, 150, .35], rollback: [500, 180, .4]
};

export class LanternAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private loop?: number;
  private beat = 0;
  private paused = false;
  private recent = new Map<string, number[]>();
  constructor(private settings: StudioSettings) {}
  enable() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain(); this.master.connect(this.context.destination);
      this.music = this.context.createGain(); this.music.connect(this.master);
      this.loop = window.setInterval(() => this.musicBeat(), 260);
    }
    if (!this.paused) void this.context.resume();
    this.configure(this.settings);
  }
  configure(settings: StudioSettings) {
    this.settings = settings;
    if (!this.context || !this.master || !this.music) return;
    const time = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.masterVolume, time, .08);
    this.music.gain.setTargetAtTime(settings.muted ? 0 : Math.min(.25, settings.musicVolume), time, .2);
  }
  play(name: SoundName) {
    if (!this.context || !this.master || this.settings.muted || this.paused) return;
    const now = performance.now(); const times = (this.recent.get(name) ?? []).filter(value => now - value < 1000);
    if (times.length >= 5) return; times.push(now); this.recent.set(name, times);
    const [start, end, duration] = tones[name];
    this.tone(start, end, duration, .14 * this.settings.effectsVolume, this.master);
  }
  pause() { this.paused = true; void this.context?.suspend(); }
  resume() { this.paused = false; void this.context?.resume(); }
  destroy() { if (this.loop) clearInterval(this.loop); void this.context?.close(); }
  private tone(start: number, end: number, duration: number, volume: number, destination: AudioNode) {
    if (!this.context) return;
    const time = this.context.currentTime;
    const oscillator = this.context.createOscillator(); const gain = this.context.createGain();
    oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(start, time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, end), time + duration);
    gain.gain.setValueAtTime(Math.max(.0001, volume), time);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain); gain.connect(destination); oscillator.start(time); oscillator.stop(time + duration + .01);
  }
  private musicBeat() {
    if (!this.context || !this.music || this.paused || this.settings.muted) return;
    const notes = [220, 0, 330, 0, 262, 0, 392, 0, 220, 0, 294, 0, 262, 0, 330, 0];
    const note = notes[this.beat++ % notes.length];
    if (note) this.tone(note, note, .2, .07, this.music);
  }
}
