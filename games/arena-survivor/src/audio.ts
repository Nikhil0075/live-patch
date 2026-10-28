import type { StudioSettings } from '../../../engine/studio/settings';

export const soundEvents = ['coin', 'hit', 'death', 'hurt', 'round-start', 'vote-tick', 'patch-shipped', 'patch-failed', 'rollback'] as const;
export type SoundEvent = typeof soundEvents[number];
const tones: Record<SoundEvent, [number, number, number]> = {
  coin: [880, 1320, .16], hit: [260, 130, .1], death: [330, 110, .22], hurt: [180, 70, .25],
  'round-start': [392, 784, .35], 'vote-tick': [620, 820, .08], 'patch-shipped': [523, 1046, .55],
  'patch-failed': [250, 150, .35], rollback: [500, 180, .4]
};

export class ArenaAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private music?: GainNode;
  private loop?: number;
  private beat = 0;
  private times = new Map<string, number[]>();
  constructor(private settings: StudioSettings) {}
  enable() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain(); this.master.connect(this.context.destination);
      this.music = this.context.createGain(); this.music.connect(this.master);
      this.music.gain.value = 0;
      this.loop = window.setInterval(() => this.musicBeat(), 240);
    }
    void this.context.resume(); this.configure(this.settings);
  }
  configure(settings: StudioSettings) {
    this.settings = settings;
    if (!this.context || !this.master || !this.music) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(settings.muted ? 0 : settings.masterVolume, now, .08);
    this.music.gain.setTargetAtTime(settings.muted ? 0 : Math.min(.3, settings.musicVolume), now, .3);
  }
  play(name: SoundEvent) {
    if (!this.context || !this.master || this.settings.muted || !Object.hasOwn(tones, name)) return;
    const nowMs = performance.now(); const recent = (this.times.get(name) ?? []).filter(time => nowMs - time < 1000);
    if (recent.length >= 5) return; recent.push(nowMs); this.times.set(name, recent);
    const [start, end, duration] = tones[name];
    this.tone(start, end, duration, .16 * this.settings.effectsVolume, this.master);
    if ((name === 'patch-shipped' || name === 'round-start') && this.music) {
      const now = this.context.currentTime; const target = this.settings.muted ? 0 : Math.min(.3, this.settings.musicVolume);
      this.music.gain.setTargetAtTime(target * .2, now, .03);
      this.music.gain.setTargetAtTime(target, now + duration + .1, .3);
    }
  }
  destroy() { if (this.loop) clearInterval(this.loop); void this.context?.close(); }
  private tone(start: number, end: number, duration: number, volume: number, destination: AudioNode) {
    if (!this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator(); const gain = this.context.createGain();
    oscillator.type = 'triangle'; oscillator.frequency.setValueAtTime(start, now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, end), now + duration);
    gain.gain.setValueAtTime(Math.max(.0001, volume), now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain); gain.connect(destination); oscillator.start(now); oscillator.stop(now + duration + .01);
  }
  private musicBeat() {
    if (!this.context || !this.music || this.settings.muted) return;
    const notes = [220, 0, 330, 0, 262, 0, 392, 0, 220, 0, 294, 0, 262, 0, 330, 0];
    const note = notes[this.beat++ % notes.length];
    if (note) this.tone(note, note, .2, .09, this.music);
  }
}
