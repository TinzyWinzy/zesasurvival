// Generative load-shedding groove: 16-step lookahead sequencer in A-minor
// at a 432 Hz base, zero assets. One tension value (0..1) blends layer
// gains, filter cutoff and tempo so the bed rises with the stakes instead
// of hard-cutting on wave boundaries.
// Routes through the sfx master bus, so mute covers music too.

import { sfx } from './sound';
import { hz } from './pitch';

type Phase = 'idle' | 'run' | 'pause' | 'victory' | 'over';
type LayerName = 'drone' | 'bass' | 'arp' | 'hats' | 'lead' | 'danger';

export interface Stakes {
  wave: number; // 1..5
  hpRatio: number; // 0..1
  enemyCount: number;
  telegraphCount: number;
  timeLeft: number; // seconds remaining; endless passes a huge value
  surge: number; // seconds of surge remaining
  freeze: number; // seconds of freeze remaining
}

const LAYERS: LayerName[] = ['drone', 'bass', 'arp', 'hats', 'lead', 'danger'];

// Am F C G, one bar each.
const ROOTS = [110, 87.31, 130.81, 98];
const PENTA = [220, 261.63, 293.66, 329.63, 392, 440];
const LEAD = [440, 523.25, 392, 329.63];
// Wave 5 leans Phrygian: the b2 is the dread note.
const LEAD_DREAD = [440, 466.16, 392, 329.63];

const PUMP_MS = 90;
const SMOOTH = 0.17; // ~0.5s time constant at a 90ms pump
const LOOKAHEAD = 0.25;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

export class Music {
  private timer: number | null = null;
  private fadeTimer: number | null = null;
  private step = 0;
  private nextT = 0;
  private wave = 1;
  private phase: Phase = 'idle';
  private tension = 0;
  private tensionTarget = 0;
  private danger = 0;
  private dangerTarget = 0;

  private ctx: AudioContext | null = null;
  private busGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private layers: Record<LayerName, GainNode> | null = null;
  private drone: OscillatorNode | null = null;

  setWave(w: number) {
    this.wave = Math.min(5, Math.max(1, w));
  }

  /** Drives the blend. Safe to call every frame; targets are smoothed. */
  setStakes(s: Stakes) {
    const waveNorm = clamp01((s.wave - 1) / 4);
    const hurt = 1 - clamp01(s.hpRatio);
    const pressure = clamp01((s.enemyCount + s.telegraphCount) / 40);
    const finalPush = s.timeLeft > 0 && s.timeLeft < 45 ? 1 - s.timeLeft / 45 : 0;
    let t = 0.35 * waveNorm + 0.25 * hurt + 0.2 * pressure + 0.2 * finalPush;
    // Player-power states read as relief, so the bed dips while you hold them.
    if (s.freeze > 0) t -= 0.1;
    if (s.surge > 0) t -= 0.05;
    this.tensionTarget = clamp01(t);
    this.dangerTarget =
      s.hpRatio < 0.4 ? Math.pow((0.4 - clamp01(s.hpRatio)) / 0.4, 2) : 0;
  }

  setPhase(p: Phase) {
    if (p === this.phase) return;
    this.phase = p;
    // Apply immediately: stop() may halt the pump before the next beat.
    this.applyTargets();
    if (p === 'victory') this.playResolution();
  }

  playing() {
    return this.timer !== null;
  }

  start() {
    // A previous run may still be fading — clear it fully before restarting.
    if (this.fadeTimer !== null) this.teardown();
    const bus = sfx.bus();
    if (!bus || this.timer !== null) return;
    const ctx = bus.ctx;
    this.ctx = ctx;

    this.busGain = ctx.createGain();
    this.busGain.gain.value = 0.55;
    this.busGain.connect(bus.master);

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 500;
    this.filter.Q.value = 0.8;
    this.filter.connect(this.busGain);

    const layers = {} as Record<LayerName, GainNode>;
    for (const name of LAYERS) {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(this.filter);
      layers[name] = g;
    }
    this.layers = layers;

    const drone = ctx.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = hz(ROOTS[0]);
    drone.connect(layers.drone);
    drone.start();
    this.drone = drone;

    this.step = 0;
    this.phase = 'run';
    this.tension = 0;
    this.danger = 0;
    this.applyTargets();
    this.nextT = ctx.currentTime + 0.06;
    this.timer = window.setInterval(() => this.pump(), PUMP_MS);
  }

  /** Graceful tail: stop sequencing now, fade the bus, then tear down. */
  stop(fadeSec = 1.2) {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const ctx = this.ctx;
    if (ctx && this.busGain) {
      const now = ctx.currentTime;
      this.busGain.gain.cancelScheduledValues(now);
      this.busGain.gain.setTargetAtTime(0, now, Math.max(0.05, fadeSec / 3));
    }
    if (this.drone) {
      try {
        this.drone.stop(ctx ? ctx.currentTime + fadeSec + 0.15 : 0);
      } catch { /* already stopped */ }
      this.drone = null;
    }
    if (this.fadeTimer !== null) window.clearTimeout(this.fadeTimer);
    this.fadeTimer = window.setTimeout(() => this.teardown(), fadeSec * 1000 + 80);
    this.phase = 'idle';
  }

  private teardown() {
    if (this.fadeTimer !== null) {
      window.clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    try {
      this.busGain?.disconnect();
    } catch { /* ignore */ }
    this.busGain = null;
    this.filter = null;
    this.layers = null;
    this.drone = null;
    this.ctx = null;
    this.step = 0;
    this.phase = 'idle';
    this.tension = 0;
    this.danger = 0;
  }

  /** Picardy third: the minor bed resolves to A major at dawn. */
  private playResolution() {
    const bus = sfx.bus();
    if (!bus || !this.layers) return;
    const at = bus.ctx.currentTime + 0.05;
    [hz(220), hz(277.18), hz(329.63), hz(440)].forEach((f, i) => {
      this.note(f, at + i * 0.07, 4.5, 'triangle', 0.16, 'lead');
    });
  }

  private note(
    freq: number,
    at: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    layer: LayerName
  ) {
    const bus = sfx.bus();
    if (!bus || !this.layers) return;
    const o = bus.ctx.createOscillator();
    const g = bus.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g);
    g.connect(this.layers[layer]);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  private applyTargets() {
    const L = this.layers;
    const f = this.filter;
    const ctx = this.ctx;
    if (!L || !f || !ctx) return;
    const now = ctx.currentTime;
    const tau = 0.4;
    const t = this.tension;
    const mul = this.phase === 'pause' ? 0.35 : 1;

    const g: Record<LayerName, number> =
      this.phase === 'victory'
        ? { drone: 0.14, bass: 0, arp: 0, hats: 0, lead: 0.55, danger: 0 }
        : this.phase === 'over'
          ? { drone: 0.1, bass: 0, arp: 0, hats: 0, lead: 0, danger: 0 }
          : {
              drone: 0.07 + 0.06 * t,
              bass: 0.8,
              arp: smoothstep(0.18, 0.45, t) * 0.9,
              hats: smoothstep(0.42, 0.68, t) * 0.8,
              lead: smoothstep(0.62, 0.88, t) * 0.9,
              danger: this.danger * 0.9
            };
    for (const name of LAYERS) {
      L[name].gain.setTargetAtTime(g[name] * mul, now, tau);
    }

    const cutoff =
      this.phase === 'victory'
        ? 8000
        : this.phase === 'over'
          ? 600
          : this.phase === 'pause'
            ? 420
            : 500 + 7000 * Math.pow(t, 1.25);
    f.frequency.setTargetAtTime(Math.min(12000, cutoff), now, tau);
  }

  private pump() {
    const bus = sfx.bus();
    if (!bus || !this.layers) return;
    const ctx = bus.ctx;
    // A background tab stalls the timer; resync instead of bursting notes.
    if (this.nextT < ctx.currentTime - 0.15) this.nextT = ctx.currentTime;

    this.tension += (this.tensionTarget - this.tension) * SMOOTH;
    this.danger += (this.dangerTarget - this.danger) * SMOOTH;
    this.applyTargets();

    // Tempo drifts with tension: 96 → 126 BPM.
    const bpm = 96 + 30 * this.tension;
    const step = 60 / bpm / 4;

    while (this.nextT < ctx.currentTime + LOOKAHEAD) {
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % 4;
      const root = hz(ROOTS[bar]);
      // Bass pulse, always on.
      if (s % 4 === 0) this.note(root, this.nextT, step * 3, 'square', 0.22, 'bass');
      // Arp: off-beat 16ths, octave up once the wave turns.
      if (s % 2 === 1) {
        const oct = this.wave >= 4 ? 2 : 1;
        this.note(
          hz(PENTA[(s + bar * 3) % PENTA.length] * oct),
          this.nextT,
          step * 1.5,
          'triangle',
          0.14,
          'arp'
        );
      }
      if (s % 2 === 0) this.note(hz(6200), this.nextT, 0.03, 'sine', 0.06, 'hats');
      // Lead: one long note per bar.
      if (s === 0) {
        const set = this.wave >= 5 ? LEAD_DREAD : LEAD;
        this.note(hz(set[bar]), this.nextT, step * 8, 'sawtooth', 0.1, 'lead');
      }
      // Danger heartbeat: a lub-dub that quickens as the bed speeds up.
      // The layer gain already scales with danger, so notes stay fixed.
      if (this.danger > 0.02) {
        if (s % 8 === 0) this.note(hz(55), this.nextT, 0.22, 'sine', 0.55, 'danger');
        if (s % 8 === 1) this.note(hz(55), this.nextT, 0.12, 'sine', 0.3, 'danger');
      }
      this.nextT += step;
      this.step++;
    }
  }
}

export const music = new Music();
