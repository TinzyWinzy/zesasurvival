// Zero-asset Web Audio synth SFX at the game's 432 Hz base pitch. Lazy
// AudioContext (created on first user gesture), master gain kept low for
// phone speakers, mute persisted. Every frequency goes through hz() so SFX
// stay in tune with the music bed.
import { hz } from './pitch';
type Osc = OscillatorType;

const MUTE_KEY = 'zesa.v1.muted';

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private lastHurt = 0;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch { /* ignore */ }
  }

  isMuted() {
    return this.muted;
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch { /* ignore */ }
    if (this.master) this.master.gain.value = m ? 0 : 0.16;
  }

  /** Shared bus for the music engine. Null until unlock(). */
  bus(): { ctx: AudioContext; master: GainNode } | null {
    if (!this.ctx || !this.master) return null;
    return { ctx: this.ctx, master: this.master };
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.16;
      this.master.connect(this.ctx.destination);
    } catch { /* no audio support */ }
  }

  private tone(freq: number, dur: number, type: Osc, vol = 1, slideTo?: number, delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  drop() {
    this.tone(hz(520), 0.09, 'square', 0.35, hz(260));
  }

  charged() {
    this.tone(hz(220), 0.25, 'sawtooth', 0.5, hz(880));
    this.tone(hz(440), 0.2, 'square', 0.3, hz(1760), 0.05);
  }

  /** Pitch rises with combo. */
  merge(combo: number) {
    const base = hz(340 + Math.min(combo, 8) * 60);
    this.tone(base, 0.12, 'triangle', 0.6, base * 1.6);
    this.tone(base * 2, 0.1, 'sine', 0.35, base * 2.4, 0.03);
  }

  pickup() {
    this.tone(hz(880), 0.07, 'sine', 0.35, hz(1320));
  }

  level() {
    this.tone(hz(523), 0.1, 'square', 0.35);
    this.tone(hz(659), 0.1, 'square', 0.35, undefined, 0.09);
    this.tone(hz(784), 0.16, 'square', 0.4, undefined, 0.18);
  }

  wave() {
    this.tone(hz(196), 0.3, 'sawtooth', 0.4, hz(147));
    this.tone(hz(147), 0.35, 'sawtooth', 0.35, hz(98), 0.22);
  }

  hurt() {
    const now = performance.now();
    if (now - this.lastHurt < 600) return;
    this.lastHurt = now;
    this.tone(hz(140), 0.18, 'sawtooth', 0.55, hz(60));
  }

  relay() {
    this.tone(hz(660), 0.12, 'triangle', 0.35, hz(330));
    this.tone(hz(1320), 0.08, 'sine', 0.2, hz(880), 0.04);
  }

  /** Copper cut: descending theft sting when a cable thief first shows. */
  thief() {
    this.tone(hz(600), 0.14, 'sawtooth', 0.3, hz(180));
    this.tone(hz(900), 0.1, 'square', 0.15, hz(300), 0.05);
  }

  /** Night-shift braam: low furnace swell for the boss entrance. */
  boss() {
    this.tone(hz(110), 0.5, 'sawtooth', 0.4, hz(55));
    this.tone(hz(165), 0.4, 'square', 0.2, hz(82), 0.1);
  }

  /** A major arpeggio — the Picardy third that resolves the minor bed. */
  victory() {
    [440, 554.37, 659.25, 880].forEach((f, i) =>
      this.tone(hz(f), 0.22, 'triangle', 0.5, undefined, i * 0.13)
    );
  }

  over() {
    [392, 311, 233, 155].forEach((f, i) => this.tone(hz(f), 0.25, 'sawtooth', 0.4, undefined, i * 0.15));
  }
}

export const sfx = new Sfx();
