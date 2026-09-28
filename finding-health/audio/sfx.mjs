// Sound design: every cue type used by the scenes, synthesized. Restraint over literalism:
// most sounds are felt more than heard, and they are designed to hand off to each other
// (heartbeat → bass pulse, page → whoosh, beep → type pulse, door latch → percussion).
import { SR, render, pluck, piano, pad, mtof, mulberry, onePole, bandpass } from './synth.mjs';

const TAU = Math.PI * 2;
const noiseGen = (seed) => { const r = mulberry(seed); return () => r() * 2 - 1; };
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

function thump(bus, t0, { f0 = 60, f1 = 38, dur = 0.35, gain = 0.8, noise = 0.25, lp = 400, pan = 0, seed = 1 } = {}) {
  const n = noiseGen(seed), filt = onePole(lp);
  render(bus, t0, dur, (t) => {
    const f = f1 + (f0 - f1) * Math.exp(-t * 18);
    const ph = TAU * (f1 * t + ((f0 - f1) / 18) * (1 - Math.exp(-t * 18)));
    const s = (Math.sin(ph) * env(t, 0.004, dur * 0.28) + filt(n()) * noise * env(t, 0.002, 0.03)) * gain;
    void f;
    return [s * (1 - pan * 0.3), s * (1 + pan * 0.3)];
  });
}

function noiseBurst(bus, t0, dur, { gain = 0.2, f = 2000, q = 1.2, f2 = null, attack = 0.01, shape = null, pan = 0, seed = 3 } = {}) {
  const n = noiseGen(seed), bp = bandpass(f, q);
  render(bus, t0, dur, (t) => {
    if (f2) bp.set(f + (f2 - f) * (t / dur));
    const e = shape ? shape(t / dur, t) : Math.min(1, t / attack) * Math.pow(1 - t / dur, 2);
    const s = bp(n()) * e * gain;
    return [s * (1 - pan * 0.5), s * (1 + pan * 0.5)];
  });
}

function tone(bus, t0, dur, freq, { gain = 0.1, attack = 0.005, decay = null, pan = 0, glide = 0 } = {}) {
  let ph = 0;
  render(bus, t0, dur, (t) => {
    ph += (TAU * (freq + glide * (t / dur))) / SR;
    const e = Math.min(1, t / attack) * (decay ? Math.exp(-t / decay) * Math.min(1, (dur - t) / 0.03) : Math.max(0, 1 - t / dur));
    const s = Math.sin(ph) * e * gain;
    return [s * (1 - pan * 0.4), s * (1 + pan * 0.4)];
  });
}

let SEED = 100;
const S = () => SEED++;

export const SFX = {
  heartbeat(b, t, c) {
    const g = (c.gain ?? 0.7) * 0.8, lp = c.muffled ? 180 : 420;
    thump(b, t, { gain: g, lp, seed: S() });
    thump(b, t + 0.27, { f0: 52, f1: 36, gain: g * 0.7, lp, seed: S() });
  },
  bigBeat(b, t) {
    thump(b, t, { f0: 70, f1: 30, dur: 1.4, gain: 1.4, noise: 0.5, seed: S() });
    noiseBurst(b, t, 1.2, { gain: 0.25, f: 180, q: 0.7, attack: 0.005, seed: S() });
  },
  cellSplit(b, t) { tone(b, t, 0.35, 420, { gain: 0.05, glide: 320, decay: 0.12, pan: (SEED % 3) - 1 }); S(); },
  swell(b, t, c) { noiseBurst(b, t, c.dur || 2, { gain: (c.gain ?? 1) * 0.08, f: 300, f2: 1400, q: 0.6, shape: (u) => Math.sin(u * Math.PI) ** 2, seed: S() }); },
  road(b, t, c) {
    const d = c.dur || 2, n = noiseGen(S()), lp = onePole(140);
    render(b, t, d, (tt) => { const e = Math.min(1, tt / 0.6) * Math.min(1, (d - tt) / 0.6); const s = lp(n()) * e * 0.35 * (c.gain ?? 1) * (1 + 0.2 * Math.sin(tt * 3)); return [s, s]; });
  },
  pencil(b, t, c) {
    const d = c.dur || 1, r = mulberry(S());
    let amp = 0;
    noiseBurst(b, t, d, { gain: 0.07, f: 3800, q: 2.5, seed: S(), shape: (u, tt) => { if (Math.floor(tt * 30) !== Math.floor((tt - 1 / SR) * 30)) amp = 0.3 + r() * 0.7; return amp * Math.min(1, u * 20) * Math.min(1, (1 - u) * 10); } });
  },
  footsteps(b, t, c) {
    const d = c.dur || 2, g = c.gain ?? 0.6;
    for (let k = 0; k * 0.52 < d; k++) { thump(b, t + k * 0.52, { f0: 110, f1: 70, dur: 0.12, gain: 0.18 * g, noise: 0.8, lp: 900, pan: k % 2 ? 0.15 : -0.15, seed: S() }); }
  },
  doorLatch(b, t) { noiseBurst(b, t, 0.03, { gain: 0.4, f: 4000, q: 1, seed: S() }); tone(b, t + 0.005, 0.15, 1850, { gain: 0.05, decay: 0.05 }); thump(b, t + 0.04, { f0: 140, f1: 90, dur: 0.12, gain: 0.25, seed: S() }); },
  handle(b, t) { noiseBurst(b, t, 0.04, { gain: 0.3, f: 3200, q: 2, seed: S() }); tone(b, t, 0.2, 2400, { gain: 0.03, decay: 0.06 }); },
  doorOpen(b, t, c) { noiseBurst(b, t, 1.1, { gain: 0.14 * (c.gain ?? 1), f: 250, f2: 900, q: 0.5, shape: (u) => Math.sin(u * Math.PI) ** 1.5, seed: S() }); },
  doorClose(b, t) { noiseBurst(b, t - 0.3, 0.35, { gain: 0.1, f: 400, f2: 200, q: 0.6, shape: (u) => u * u, seed: S() }); thump(b, t + 0.05, { f0: 90, f1: 55, dur: 0.3, gain: 0.5, seed: S() }); SFX.doorLatch(b, t + 0.1); },
  doorSwing(b, t, c) { noiseBurst(b, t, 0.5, { gain: 0.06 * (c.gain ?? 1), f: 500, f2: 1500, q: 0.7, shape: (u) => Math.sin(u * Math.PI), seed: S() }); },
  titleHit(b, t, c) {
    const g = c.gain ?? 1;
    thump(b, t, { f0: 55, f1: 41, dur: 2.2, gain: 0.55 * g, noise: 0.05, seed: S() });
    for (const [m, a] of [[74, 0.05], [81, 0.035], [86, 0.02]]) tone(b, t, 3, mtof(m), { gain: a * g, decay: 1.2 });
  },
  titleSoft(b, t) { for (const [m, a] of [[78, 0.03], [85, 0.02]]) tone(b, t, 2.5, mtof(m), { gain: a, attack: 0.3, decay: 1.0 }); },
  paper(b, t, c) { noiseBurst(b, t, 0.14, { gain: 0.1 * (c.gain ?? 1), f: 2600, q: 0.9, seed: S(), pan: ((SEED * 37) % 10) / 10 - 0.5 }); },
  pageTurn(b, t, c) { noiseBurst(b, t, 0.32, { gain: 0.12 * (c.gain ?? 1), f: 900, f2: 4000, q: 0.8, shape: (u) => Math.sin(u * Math.PI) ** 2, seed: S() }); },
  paperFall(b, t, c) { noiseBurst(b, t, c.dur || 1, { gain: 0.05, f: 700, f2: 300, q: 0.6, shape: (u) => Math.sin(u * Math.PI), seed: S() }); },
  paperFold(b, t) { noiseBurst(b, t, 0.18, { gain: 0.1, f: 1800, q: 1, seed: S() }); thump(b, t + 0.12, { f0: 150, f1: 100, dur: 0.1, gain: 0.12, seed: S() }); },
  tick(b, t, c) {
    const d = c.dur || 2;
    let tt = 0, k = 0;
    while (tt < d) { noiseBurst(b, t + tt, 0.012, { gain: 0.12, f: 5200, q: 3, attack: 0.001, seed: S() }); k++; tt += c.accel ? Math.max(0.07, 0.5 / (1 + k * 0.25)) : 0.5; }
  },
  clockTick(b, t, c) { SFX.tick(b, t, { dur: c.dur || 1.5, accel: false }); },
  stemHit(b, t) { thump(b, t, { f0: 80, f1: 42, dur: 1.2, gain: 0.8, noise: 0.4, seed: S() }); for (const m of [50, 57, 62, 65]) tone(b, t, 1.2, mtof(m), { gain: 0.05, decay: 0.45 }); },
  freeze() {},
  silence() {},
  cloth(b, t, c) {
    const d = c.dur || 2;
    noiseBurst(b, t, d, { gain: 0.07 * (c.gain ?? 1), f: 600, q: 0.5, seed: S(), shape: (u, tt) => Math.sin(u * Math.PI) * (0.6 + 0.4 * Math.sin(tt * 38) * Math.sin(tt * 5)) });
  },
  settle(b, t) { thump(b, t, { f0: 90, f1: 60, dur: 0.4, gain: 0.2, noise: 0.3, lp: 600, seed: S() }); noiseBurst(b, t, 0.6, { gain: 0.04, f: 900, q: 0.5, seed: S() }); },
  boneClick(b, t, c) { noiseBurst(b, t, 0.03, { gain: 0.25 * (c.gain ?? 1), f: 1600, q: 3, attack: 0.001, seed: S() }); tone(b, t, 0.05, 900 + (SEED % 5) * 90, { gain: 0.04, decay: 0.015 }); },
  fibre(b, t, c) { noiseBurst(b, t, c.dur || 2, { gain: 0.04, f: 400, f2: 1600, q: 3, shape: (u) => Math.sin(u * Math.PI), seed: S() }); },
  shimmer(b, t, c) { for (const [m, k] of [[88, 0], [91, 0.15], [95, 0.3]]) tone(b, t + k, c.dur || 1.4, mtof(m), { gain: 0.012, attack: 0.3 }); },
  nerveSpark(b, t, c) { const r = mulberry(S()); for (let k = 0; k < 26; k++) noiseBurst(b, t + r() * (c.dur || 1.5), 0.01, { gain: 0.08 * r(), f: 6000, q: 2, attack: 0.001, seed: S(), pan: r() * 2 - 1 }); },
  flow(b, t, c) { noiseBurst(b, t, c.dur || 1.5, { gain: 0.06, f: 220, q: 0.8, seed: S(), shape: (u, tt) => Math.sin(u * Math.PI) * (0.5 + 0.5 * Math.sin(tt * TAU * 1.2)) }); },
  zoomRise(b, t, c) { const d = c.dur || 2; tone(b, t, d, 180, { gain: 0.04, attack: d * 0.8, glide: 900 }); noiseBurst(b, t, d, { gain: 0.06, f: 300, f2: 5000, q: 0.7, shape: (u) => u * u, seed: S() }); },
  wind(b, t, c) { noiseBurst(b, t, c.dur || 3, { gain: 0.05, f: 500, f2: 800, q: 0.4, shape: (u, tt) => Math.sin(u * Math.PI) * (0.7 + 0.3 * Math.sin(tt * 0.9)), seed: S() }); },
  roomTone(b, t, c) { noiseBurst(b, t, c.dur || 5, { gain: 0.025 * (c.gain ?? 1), f: 220, q: 0.3, shape: (u) => Math.min(1, u * 8) * Math.min(1, (1 - u) * 8), seed: S() }); },
  hallAmbience(b, t, c) {
    const d = c.dur || 5, g = c.gain ?? 1;
    tone(b, t, d, 60, { gain: 0.012 * g, attack: 0.5 }); tone(b, t, d, 120, { gain: 0.006 * g, attack: 0.5 });
    SFX.roomTone(b, t, { dur: d, gain: 1.2 * g });
  },
  touch(b, t, c) { thump(b, t, { f0: 80, f1: 60, dur: 0.3, gain: 0.18 * (c.gain ?? 1), noise: 0.6, lp: 700, seed: S() }); noiseBurst(b, t, 0.5, { gain: 0.03, f: 1200, q: 0.8, seed: S() }); },
  breath(b, t, c) {
    const d = c.dur || 2;
    noiseBurst(b, t, d, { gain: 0.05, f: 900, q: 0.7, seed: S(), shape: (u) => Math.pow(Math.sin(u * Math.PI * 2 % Math.PI), 2) * (u < 0.5 ? 0.8 : 1) });
  },
  exhale(b, t) { noiseBurst(b, t, 1.2, { gain: 0.07, f: 800, f2: 500, q: 0.6, shape: (u) => Math.min(1, u * 10) * (1 - u) ** 1.5, seed: S() }); },
  tubeSweep(b, t, c) { noiseBurst(b, t, c.dur || 1.5, { gain: 0.05 * (c.gain ?? 1), f: 300, f2: 1100, q: 0.9, shape: (u) => Math.sin(u * Math.PI), seed: S() }); },
  stethLand(b, t) { thump(b, t, { f0: 100, f1: 70, dur: 0.25, gain: 0.3, noise: 0.4, lp: 1200, seed: S() }); },
  monitorBeep(b, t, c) { tone(b, t, 0.11, 960, { gain: 0.05 * (c.gain ?? 1), attack: 0.003 }); },
  blip(b, t, c) { tone(b, t, 0.18, mtof(c.pitch || 72), { gain: 0.035 * (c.gain ?? 1) / 0.3 * 0.3, decay: 0.06 }); },
  fadeTone(b, t, c) { tone(b, t, 1.2, mtof(c.pitch || 72), { gain: 0.02, attack: 0.02, decay: 0.4 }); },
  cuffPump(b, t, c) { for (let k = 0; k * 0.22 < (c.dur || 1); k++) noiseBurst(b, t + k * 0.22, 0.12, { gain: 0.08, f: 700, q: 0.8, seed: S() }); },
  whoosh(b, t, c) { noiseBurst(b, t, 0.7, { gain: 0.12 * (c.gain ?? 1), f: 400, f2: 3000, q: 0.7, shape: (u) => Math.sin(u * Math.PI) ** 2, seed: S() }); },
  ultrasound(b, t, c) {
    const d = c.dur || 2;
    for (let k = 0; k * 0.5 < d; k++) { tone(b, t + k * 0.5, 0.35, 2200, { gain: 0.008, glide: 2600, attack: 0.02 }); noiseBurst(b, t + k * 0.5, 0.4, { gain: 0.025, f: 3000, f2: 7000, q: 1.5, shape: (u) => Math.sin(u * Math.PI), seed: S() }); }
  },
  voices(b, t, c) {
    const d = c.dur || 1.5, r = mulberry(S());
    let a = 0, nxt = 0;
    const bp1 = bandpass(500, 3), bp2 = bandpass(1500, 4), n = noiseGen(S());
    render(b, t, d, (tt) => {
      if (tt >= nxt) { a = r() < 0.2 ? 0 : 0.4 + r() * 0.6; nxt = tt + 0.08 + r() * 0.18; bp1.set(350 + r() * 400); bp2.set(1100 + r() * 900); }
      const x = n();
      const s = (bp1(x) + 0.5 * bp2(x)) * a * 0.1 * (c.gain ?? 1) * Math.min(1, tt / 0.2) * Math.min(1, (d - tt) / 0.2);
      return [s, s];
    });
  },
  notebookClose(b, t) { noiseBurst(b, t, 0.09, { gain: 0.14, f: 1000, q: 0.7, attack: 0.002, seed: S() }); thump(b, t, { f0: 160, f1: 110, dur: 0.08, gain: 0.08, seed: S() }); },
  pianoNote(b, t, c) { piano(b, c.note || 60, t, { gain: 0.22, dur: 5 }); },
  morphRise(b, t, c) { tone(b, t, c.dur || 1, 330, { gain: 0.02, attack: 0.5, glide: 110 }); },
  unfurl(b, t, c) { noiseBurst(b, t, c.dur || 1, { gain: 0.05, f: 300, f2: 900, q: 0.6, shape: (u) => Math.sin(u * Math.PI), seed: S() }); },
  riser(b, t, c) { const d = c.dur || 2, g = c.gain ?? 1; noiseBurst(b, t, d, { gain: 0.07 * g, f: 400, f2: 6000, q: 0.8, shape: (u) => u ** 2.2, seed: S() }); tone(b, t, d, 220, { gain: 0.02 * g, attack: d, glide: 440 }); },
  orbitRise(b, t, c) {
    const d = c.dur || 4, n = noiseGen(S()), bp = bandpass(600, 1.2);
    render(b, t, d, (tt) => {
      const rate = 1 + tt * tt * 2.2;
      bp.set(500 + tt * 900);
      const am = 0.5 + 0.5 * Math.sin(TAU * (tt + (tt * tt * tt * 2.2) / 3) * 1.2);
      const s = bp(n()) * am * (tt / d) ** 1.5 * 0.2;
      void rate;
      return [s * (1 + Math.sin(tt * 7) * 0.4), s * (1 - Math.sin(tt * 7) * 0.4)];
    });
    tone(b, t, d, 110, { gain: 0.03, attack: d, glide: 330 });
  },
  keyboard(b, t, c) { const r = mulberry(S()); for (let k = 0; k < (c.dur || 1) * 9; k++) noiseBurst(b, t + k / 9 + r() * 0.04, 0.02, { gain: 0.08, f: 3000, q: 1.5, attack: 0.001, seed: S() }); },
  click(b, t) { noiseBurst(b, t, 0.01, { gain: 0.5, f: 4500, q: 2, attack: 0.0005, seed: S() }); noiseBurst(b, t + 0.07, 0.01, { gain: 0.3, f: 3800, q: 2, attack: 0.0005, seed: S() }); },
  flashTone(b, t) { for (const m of [74, 78, 81, 86]) tone(b, t, 2.2, mtof(m), { gain: 0.03, attack: 0.02, decay: 0.8 }); noiseBurst(b, t, 1.2, { gain: 0.05, f: 5000, q: 0.5, seed: S() }); },
  airOpen(b, t, c) { noiseBurst(b, t, c.dur || 1, { gain: 0.06, f: 2500, f2: 6000, q: 0.4, shape: (u) => Math.sin(u * Math.PI), seed: S() }); },
  chime(b, t) { [79, 83, 86, 91].forEach((m, k) => tone(b, t + k * 0.12, 1.4, mtof(m), { gain: 0.025, decay: 0.5 })); },
  instrument(b, t) { tone(b, t, 0.6, 3100, { gain: 0.03, decay: 0.15 }); tone(b, t, 0.6, 4700, { gain: 0.015, decay: 0.1 }); },
  erase(b, t) { noiseBurst(b, t, 0.25, { gain: 0.06, f: 1800, q: 1.5, seed: S(), shape: (u, tt) => 0.5 + 0.5 * Math.sin(tt * 90) }); },
  dopplerBeat(b, t) { noiseBurst(b, t, 0.16, { gain: 0.08, f: 350, f2: 700, q: 1.2, shape: (u) => Math.sin(u * Math.PI), seed: S() }); noiseBurst(b, t + 0.2, 0.14, { gain: 0.06, f: 700, f2: 350, q: 1.2, shape: (u) => Math.sin(u * Math.PI), seed: S() }); },
  collapse(b, t) { noiseBurst(b, t - 0.6, 0.6, { gain: 0.08, f: 300, f2: 2400, q: 0.7, shape: (u) => u ** 3, seed: S() }); thump(b, t, { f0: 70, f1: 45, dur: 0.8, gain: 0.4, seed: S() }); },
  envelopeTear(b, t) { const r = mulberry(S()); noiseBurst(b, t, 0.45, { gain: 0.12, f: 2500, q: 1, seed: S(), shape: () => (r() < 0.3 ? 1 : 0.3) }); },
  launch(b, t, c) { const d = c.dur || 1.5; noiseBurst(b, t, d, { gain: 0.07, f: 600, f2: 4000, q: 0.7, shape: (u) => Math.sin(u * Math.PI), seed: S() }); tone(b, t, d, mtof(69), { gain: 0.025, attack: 0.2, glide: mtof(81) - mtof(69) }); },
  memory(b, t, c) { const d = c.dur || 3; [74, 76, 81, 83].forEach((m, k) => tone(b, t + k * 0.6, 1.8, mtof(m), { gain: 0.012, attack: 0.9, decay: 0.8, pan: k % 2 ? 0.5 : -0.5 })); void d; },
  applause(b, t, c) {
    const d = c.dur || 3, r = mulberry(S());
    const count = Math.floor(d * 140);
    for (let k = 0; k < count; k++) {
      const tt = r() * d;
      const e = Math.min(1, tt / 0.5) * Math.min(1, (d - tt) / 1.0);
      noiseBurst(b, t + tt, 0.018, { gain: 0.06 * e * (0.4 + r() * 0.6), f: 1200 + r() * 1600, q: 1.2, attack: 0.001, seed: S(), pan: r() * 1.6 - 0.8 });
    }
  },
  rise(b, t, c) { noiseBurst(b, t, c.dur || 3, { gain: 0.05, f: 300, f2: 1500, q: 0.5, shape: (u) => Math.sin(u * Math.PI), seed: S() }); },
  resolve() {},
};

export function playCue(bus, t, cue) {
  const f = SFX[cue.type];
  if (!f) { console.warn('no sfx for', cue.type); return; }
  f(bus, t, cue);
}
void pad; void pluck;
