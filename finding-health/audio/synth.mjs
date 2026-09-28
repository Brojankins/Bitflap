// Deterministic audio toolkit: buffers, oscillators, noise, filters, reverb, WAV.
export const SR = 48000;

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Bus {
  constructor(seconds) {
    this.n = Math.ceil(seconds * SR);
    this.L = new Float32Array(this.n);
    this.R = new Float32Array(this.n);
  }
  add(i, l, r) {
    if (i >= 0 && i < this.n) { this.L[i] += l; this.R[i] += r; }
  }
  mixInto(dst, gain = 1) {
    for (let i = 0; i < this.n; i++) { dst.L[i] += this.L[i] * gain; dst.R[i] += this.R[i] * gain; }
  }
}

const panLR = (p) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)];

// ---------------------------------------------------------------- wavetables
function table(partials) {
  const N = 4096, t = new Float32Array(N);
  let mx = 0;
  for (let i = 0; i < N; i++) {
    let v = 0;
    for (const [h, a] of partials) v += a * Math.sin((2 * Math.PI * h * i) / N);
    t[i] = v; mx = Math.max(mx, Math.abs(v));
  }
  for (let i = 0; i < N; i++) t[i] /= mx;
  return t;
}
export const TABLES = {
  warm: table([[1, 1], [2, 0.35], [3, 0.18], [4, 0.08], [5, 0.04]]),
  air: table([[1, 1], [2, 0.12], [3, 0.3], [5, 0.08], [7, 0.03]]),
  sine: table([[1, 1]]),
};

/** Sustained pad voice: wavetable, detuned pair, slow envelope, gentle vibrato. */
export function pad(bus, midi, t0, dur, { gain = 0.1, attack = 1.5, release = 2, tab = 'warm', pan = 0, detune = 0.004, bright = 1 } = {}) {
  const f = mtof(midi);
  const T = TABLES[tab];
  const N = T.length;
  const i0 = Math.floor(t0 * SR), len = Math.floor((dur + release) * SR);
  const [pl, pr] = panLR(pan);
  let ph1 = 0, ph2 = 0.37, lp = 0;
  const k = Math.min(1, 0.02 + bright * 0.12);
  for (let j = 0; j < len; j++) {
    const t = j / SR;
    const env = Math.min(1, t / attack) * (t > dur ? Math.max(0, 1 - (t - dur) / release) : 1);
    if (env <= 0 && t > dur) break;
    const vib = 1 + 0.0015 * Math.sin(2 * Math.PI * 4.6 * t);
    ph1 += (f * (1 + detune) * vib * N) / SR; ph2 += (f * (1 - detune) * vib * N) / SR;
    const v = (T[Math.floor(ph1) % N] + T[Math.floor(ph2) % N]) * 0.5;
    lp += (v - lp) * k; // one-pole low-pass for softness
    const s = lp * env * gain;
    bus.add(i0 + j, s * pl, s * pr);
  }
}

/** Karplus–Strong plucked string: dulcimer / banjo-adjacent colour. */
export function pluck(bus, midi, t0, { gain = 0.2, decay = 0.996, pan = 0, bright = 0.5, seed = 1, dur = 3 } = {}) {
  const f = mtof(midi);
  const P = Math.max(2, Math.round(SR / f));
  const buf = new Float32Array(P);
  const r = mulberry(seed * 7919 + midi);
  for (let i = 0; i < P; i++) buf[i] = r() * 2 - 1;
  // soften the excitation
  for (let k = 0; k < 2 - Math.round(bright * 2); k++) for (let i = 1; i < P; i++) buf[i] = 0.5 * (buf[i] + buf[i - 1]);
  const [pl, pr] = panLR(pan);
  const i0 = Math.floor(t0 * SR), len = Math.floor(dur * SR);
  let idx = 0;
  for (let j = 0; j < len; j++) {
    const a = buf[idx], b = buf[(idx + 1) % P];
    const v = decay * 0.5 * (a + b);
    buf[idx] = v;
    idx = (idx + 1) % P;
    const s = a * gain * Math.min(1, j / 40);
    bus.add(i0 + j, s * pl, s * pr);
  }
}

/** Soft piano-ish tone: a few inharmonic-ish partials with individual decays. */
export function piano(bus, midi, t0, { gain = 0.2, dur = 4, pan = 0 } = {}) {
  const f = mtof(midi);
  const parts = [[1, 1, 1.2], [2.001, 0.45, 0.8], [3.004, 0.22, 0.6], [4.01, 0.1, 0.4], [5.02, 0.05, 0.3]];
  const [pl, pr] = panLR(pan);
  const i0 = Math.floor(t0 * SR), len = Math.floor(dur * SR);
  for (let j = 0; j < len; j++) {
    const t = j / SR;
    let v = 0;
    for (const [h, a, d] of parts) v += a * Math.exp(-t / (d * (dur / 4))) * Math.sin(2 * Math.PI * f * h * t);
    const s = v * gain * Math.min(1, j / 60) * Math.min(1, (len - j) / 2400) * 0.5;
    bus.add(i0 + j, s * pl, s * pr);
  }
}

/** Generic synthesized event: fn(t, j) → [l, r] sample for t in [0, dur). */
export function render(bus, t0, dur, fn) {
  const i0 = Math.floor(t0 * SR), len = Math.floor(dur * SR);
  for (let j = 0; j < len; j++) {
    const [l, r] = fn(j / SR, j);
    bus.add(i0 + j, l, r);
  }
}

// ---------------------------------------------------------------- filters (stateful, per event)
export function onePole(cut) {
  let y = 0;
  const a = 1 - Math.exp((-2 * Math.PI * cut) / SR);
  const f = (x) => (y += a * (x - y));
  f.set = (c) => { const aa = 1 - Math.exp((-2 * Math.PI * c) / SR); return (x) => (y += aa * (x - y)); };
  return f;
}
/** RBJ band-pass biquad with settable centre. */
export function bandpass(freq, q = 1) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0, b1, b2, a1, a2;
  const set = (fr) => {
    const w = (2 * Math.PI * Math.min(fr, SR * 0.45)) / SR, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    b0 = al / a0; b1 = 0; b2 = -al / a0; a1 = (-2 * Math.cos(w)) / a0; a2 = (1 - al) / a0;
  };
  set(freq);
  const f = (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
  f.set = set;
  return f;
}

// ---------------------------------------------------------------- reverb (Freeverb-style)
export function reverb(bus, { room = 0.84, damp = 0.35, wet = 1 } = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => Math.round((d * SR) / 44100));
  const aps = [556, 441, 341, 225].map((d) => Math.round((d * SR) / 44100));
  const out = new Bus(bus.n / SR);
  for (const [src, dst, spread] of [[bus.L, out.L, 0], [bus.R, out.R, 23]]) {
    const cb = combs.map((d) => ({ b: new Float32Array(d + spread), i: 0, f: 0 }));
    const ab = aps.map((d) => ({ b: new Float32Array(d + spread), i: 0 }));
    for (let n = 0; n < bus.n; n++) {
      const x = src[n] * 0.015;
      let s = 0;
      for (const c of cb) {
        const y = c.b[c.i];
        c.f = y * (1 - damp) + c.f * damp;
        c.b[c.i] = x + c.f * room;
        c.i = (c.i + 1) % c.b.length;
        s += y;
      }
      for (const a of ab) {
        const y = a.b[a.i];
        a.b[a.i] = s + y * 0.5;
        a.i = (a.i + 1) % a.b.length;
        s = y - s;
      }
      dst[n] = s * wet;
    }
  }
  return out;
}

// ---------------------------------------------------------------- output
export function writeWav(path, fs, bus, peakDb = -1) {
  let mx = 1e-9;
  for (let i = 0; i < bus.n; i++) mx = Math.max(mx, Math.abs(bus.L[i]), Math.abs(bus.R[i]));
  const target = Math.pow(10, peakDb / 20);
  // gentle saturation first, then normalise
  const g = 1.6 / mx;
  const sat = (x) => Math.tanh(x * g) / Math.tanh(1.6);
  let mx2 = 1e-9;
  const L = new Float32Array(bus.n), R = new Float32Array(bus.n);
  for (let i = 0; i < bus.n; i++) { L[i] = sat(bus.L[i]); R[i] = sat(bus.R[i]); mx2 = Math.max(mx2, Math.abs(L[i]), Math.abs(R[i])); }
  const k = target / mx2;
  const data = Buffer.alloc(bus.n * 4);
  for (let i = 0; i < bus.n; i++) {
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * k * 32767))), i * 4);
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * k * 32767))), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path, Buffer.concat([h, data]));
}
