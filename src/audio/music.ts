// Generative load-shedding groove: 16-step lookahead sequencer, A-minor,
// zero assets. Layers unlock per wave (bass → arp → hats → lead).
// Routes through the sfx master bus, so mute covers music too.

import { sfx } from './sound';

const BPM = 112;
const STEP = 60 / BPM / 4; // 16th note
const ROOTS = [110, 87.31, 130.81, 98]; // Am F C G, one per bar
const PENTA = [220, 261.63, 293.66, 329.63, 392, 440];
const LEAD = [440, 523.25, 392, 329.63];

export class Music {
  private timer: number | null = null;
  private step = 0;
  private nextT = 0;
  private wave = 1;
  private busGain: GainNode | null = null;

  setWave(w: number) {
    this.wave = Math.min(5, Math.max(1, w));
  }

  playing() {
    return this.timer !== null;
  }

  start() {
    const bus = sfx.bus();
    if (!bus || this.timer !== null) return;
    this.busGain = bus.ctx.createGain();
    this.busGain.gain.value = 0.55;
    this.busGain.connect(bus.master);
    this.step = 0;
    this.nextT = bus.ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.pump(), 90);
  }

  stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    try {
      this.busGain?.disconnect();
    } catch { /* ignore */ }
    this.busGain = null;
  }

  private note(freq: number, at: number, dur: number, type: OscillatorType, vol: number) {
    const bus = sfx.bus();
    if (!bus || !this.busGain) return;
    const o = bus.ctx.createOscillator();
    const g = bus.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g);
    g.connect(this.busGain);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  private pump() {
    const bus = sfx.bus();
    if (!bus) return;
    while (this.nextT < bus.ctx.currentTime + 0.25) {
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % 4;
      const root = ROOTS[bar];
      // Bass pulse: steps 0/4/8/12, always on.
      if (s % 4 === 0) this.note(root, this.nextT, STEP * 3, 'square', 0.22);
      // Arp: wave 2+, off-beat 16ths.
      if (this.wave >= 2 && s % 2 === 1) {
        const n = PENTA[(s + bar * 3) % PENTA.length] * (this.wave >= 4 ? 2 : 1);
        this.note(n, this.nextT, STEP * 1.5, 'triangle', 0.14);
      }
      // Hats: wave 3+, every other 16th.
      if (this.wave >= 3 && s % 2 === 0) this.note(6200, this.nextT, 0.03, 'sine', 0.06);
      // Lead: wave 5, sparse long notes.
      if (this.wave >= 5 && s === 0) this.note(LEAD[bar], this.nextT, STEP * 8, 'sawtooth', 0.1);
      this.nextT += STEP;
      this.step++;
    }
  }
}

export const music = new Music();
