// Core math, timing and deterministic randomness.
// Everything in the film is a pure function of time: no Math.random, no Date.

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const TAU = Math.PI * 2;

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
// degenerate or reversed ranges (b <= a) behave as a step at a
export const invlerp = (a, b, x) => (b - a <= 1e-9 ? (x < a ? 0 : 1) : clamp((x - a) / (b - a)));
export const remap = (x, a, b, c, d, e = ease.linear) => lerp(c, d, e(invlerp(a, b, x)));
export const fract = (x) => x - Math.floor(x);
export const mix2 = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

// ---------------------------------------------------------------- easing
export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuint: (t) => t ** 5,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outBack: (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2),
  // The house curve: a long, confident deceleration used for most camera moves.
  house: (t) => 1 - Math.pow(1 - t, 3.4),
  // Weighted in-out used for morphs between conceptual states.
  morph: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2),
};

/** Normalised progress of t through [a,b] with easing. */
export const seg = (t, a, b, e = ease.linear) => e(invlerp(a, b, t));
/** Rise over [a,b], hold, fall over [c,d]. */
export const env = (t, a, b, c, d, e = ease.inOutSine) =>
  t < b ? e(invlerp(a, b, t)) : t < c ? 1 : 1 - e(invlerp(c, d, t));

/**
 * Keyframes: kf(t, [[time, value, easeIntoThisKey?], ...]).
 * Values may be numbers or arrays of numbers.
 */
export function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, e] = keys[i];
    if (t <= t1) {
      const [t0, v0] = keys[i - 1];
      const p = (e || ease.inOutCubic)((t - t0) / (t1 - t0 || 1));
      if (Array.isArray(v0)) return v0.map((v, j) => lerp(v, v1[j], p));
      return lerp(v0, v1, p);
    }
  }
  return keys[keys.length - 1][1];
}

// ---------------------------------------------------------------- randomness
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rng(seed = 1) {
  const r = mulberry32(seed);
  const api = {
    next: r,
    range: (a, b) => a + (b - a) * r(),
    int: (a, b) => Math.floor(a + (b - a + 1) * r()),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    sign: () => (r() < 0.5 ? -1 : 1),
    gauss: () => {
      let u = 0, v = 0;
      while (u === 0) u = r();
      while (v === 0) v = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    },
  };
  return api;
}

export function hash1(n) {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
export const hash2 = (x, y, s = 0) => hash1((x | 0) * 73856093 ^ (y | 0) * 19349663 ^ s * 83492791);

// ---------------------------------------------------------------- noise (seeded gradient noise)
function buildPerm(seed) {
  const r = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}
const PERM = buildPerm(20240);
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
function grad3(h, x, y, z) {
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
/** Improved Perlin noise, range roughly [-1,1]. */
export function noise3(x, y, z = 0) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const P = PERM;
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z;
  const B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  return lerp(
    lerp(lerp(grad3(P[AA] & 15, x, y, z), grad3(P[BA] & 15, x - 1, y, z), u),
      lerp(grad3(P[AB] & 15, x, y - 1, z), grad3(P[BB] & 15, x - 1, y - 1, z), u), v),
    lerp(lerp(grad3(P[AA + 1] & 15, x, y, z - 1), grad3(P[BA + 1] & 15, x - 1, y, z - 1), u),
      lerp(grad3(P[AB + 1] & 15, x, y - 1, z - 1), grad3(P[BB + 1] & 15, x - 1, y - 1, z - 1), u), v),
    w,
  );
}
export const noise2 = (x, y) => noise3(x, y, 0.5);
export function fbm(x, y, oct = 4, z = 0) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x * f, y * f, z + i * 17.3);
    f *= 2.03; a *= 0.5;
  }
  return s;
}

// ---------------------------------------------------------------- geometry helpers
/** Cumulative arc length of a polyline [[x,y],...]. */
export function arcLengths(pts) {
  const L = [0];
  for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return L;
}
/** Point + tangent angle at fraction u along a polyline. */
export function pointAt(pts, u, L = arcLengths(pts)) {
  const total = L[L.length - 1];
  const d = clamp(u) * total;
  let i = 1;
  while (i < L.length - 1 && L[i] < d) i++;
  const t = (d - L[i - 1]) / (L[i] - L[i - 1] || 1);
  const a = pts[i - 1], b = pts[i];
  return { x: lerp(a[0], b[0], t), y: lerp(a[1], b[1], t), a: Math.atan2(b[1] - a[1], b[0] - a[0]) };
}
/** Resample a polyline to n evenly spaced points (used for morphing shapes). */
export function resample(pts, n, closed = false) {
  const src = closed ? [...pts, pts[0]] : pts;
  const L = arcLengths(src);
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pointAt(src, closed ? i / n : i / (n - 1), L);
    out.push([p.x, p.y]);
  }
  return out;
}
export const morphPts = (A, B, t) => A.map((p, i) => mix2(p, B[i], t));

/** Sample a cubic bezier chain given as [x0,y0, c1x,c1y,c2x,c2y,x1,y1, ...] into a polyline. */
export function bez(chain, steps = 16) {
  const pts = [[chain[0], chain[1]]];
  for (let i = 2; i + 5 < chain.length; i += 6) {
    const x0 = pts[pts.length - 1][0], y0 = pts[pts.length - 1][1];
    const [c1x, c1y, c2x, c2y, x1, y1] = chain.slice(i, i + 6);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, m = 1 - t;
      pts.push([
        m * m * m * x0 + 3 * m * m * t * c1x + 3 * m * t * t * c2x + t * t * t * x1,
        m * m * m * y0 + 3 * m * m * t * c1y + 3 * m * t * t * c2y + t * t * t * y1,
      ]);
    }
  }
  return pts;
}

/** Catmull-Rom smoothing through points. */
export function spline(pts, steps = 8, closed = false) {
  const out = [];
  const n = pts.length;
  const get = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/** Heart rhythm helper: phase (0..1) within a beat and index for a given bpm. */
export function beat(t, bpm, offset = 0) {
  const p = ((t - offset) * bpm) / 60;
  return { i: Math.floor(p), ph: fract(p) };
}
/** Sharp decaying pulse at the start of each beat (0..1). */
export function pulse(t, bpm, offset = 0, decay = 7) {
  if (t < offset) return 0;
  const { ph } = beat(t, bpm, offset);
  const sec = (ph * 60) / bpm;
  return Math.exp(-sec * decay) + 0.55 * Math.exp(-Math.max(0, sec - 0.28) * decay * 1.4) * (sec > 0.28 ? 1 : 0);
}
