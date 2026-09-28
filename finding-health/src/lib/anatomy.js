// Anatomical-atlas vocabulary. Line art first, translucency second, never gore.
import { TAU, clamp, lerp, rng, bez, noise2, noise3, fbm, mulberry32, ease } from './core.js';
import { C, rgba } from '../config/design.js';
import { path, stroke, strokePart, makeCanvas } from './draw.js';

// ---------------------------------------------------------------- ECG
const gauss = (x, m, w) => Math.exp(-((x - m) * (x - m)) / (2 * w * w));
/** One cardiac cycle, ph in [0,1): PQRST morphology, baseline 0, R ≈ 1. */
export function ecg(ph) {
  return 0.12 * gauss(ph, 0.1, 0.022) - 0.1 * gauss(ph, 0.2, 0.008) + 1.0 * gauss(ph, 0.225, 0.009)
    - 0.24 * gauss(ph, 0.25, 0.01) + 0.3 * gauss(ph, 0.46, 0.04);
}
/** Phonocardiogram "lub-dub" envelope. */
export function pcg(ph, t) {
  const s1 = gauss(ph, 0.23, 0.018), s2 = gauss(ph, 0.5, 0.014) * 0.7;
  return (s1 + s2) * Math.sin(t * 380) ;
}

// ---------------------------------------------------------------- branching structures
/**
 * Deterministic branching tree. Same (seed, depth) → same segment count & order,
 * so trees can morph into one another (bronchi → branches → vessels → rivers → roads).
 * Returns [{a,b,d (depth), t0,t1 (growth window 0..1), w}]
 */
export function branchTree(seed, x, y, angle, len, depth, o = {}) {
  const { spread = 0.5, shrink = 0.72, jitter = 0.25, curve = 0.15, forks = 2, gravity = 0, widthRoot = 6 } = o;
  const r = rng(seed);
  const segs = [];
  const maxD = depth;
  const grow = (px, py, a, l, d, t0) => {
    const n = 3; // sub-steps for organic curvature
    const bend = (r.next() - 0.5) * curve;
    let cx = px, cy = py, ca = a;
    const dt = 1 / (maxD + 1);
    for (let i = 0; i < n; i++) {
      ca += bend + gravity * 0.1;
      const nx = cx + Math.cos(ca) * (l / n), ny = cy + Math.sin(ca) * (l / n);
      segs.push({ a: [cx, cy], b: [nx, ny], d: maxD - d, t0: t0 + (dt * i) / n, t1: t0 + (dt * (i + 1)) / n, w: widthRoot * Math.pow(shrink, maxD - d) });
      cx = nx; cy = ny;
    }
    if (d <= 0) return;
    for (let k = 0; k < forks; k++) {
      const off = forks === 1 ? 0 : (k / (forks - 1) - 0.5) * 2 * spread;
      grow(cx, cy, ca + off + (r.next() - 0.5) * jitter, l * (shrink + (r.next() - 0.5) * 0.1), d - 1, t0 + dt);
    }
  };
  grow(x, y, angle, len, depth, 0);
  return segs;
}
/** Draw a tree up to growth g (0..1); width by depth. */
export function drawTree(gx, segs, grow, color, { alpha = 1, widthScale = 1, minW = 0.6 } = {}) {
  gx.save();
  gx.globalAlpha *= alpha;
  gx.strokeStyle = color;
  gx.lineCap = 'round';
  for (const s of segs) {
    if (grow <= s.t0) continue;
    const k = clamp((grow - s.t0) / (s.t1 - s.t0));
    gx.lineWidth = Math.max(minW, s.w * widthScale);
    gx.beginPath();
    gx.moveTo(s.a[0], s.a[1]);
    gx.lineTo(lerp(s.a[0], s.b[0], k), lerp(s.a[1], s.b[1], k));
    gx.stroke();
  }
  gx.restore();
}
export function morphTrees(A, B, t) {
  const n = Math.min(A.length, B.length);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = A[i], b = B[i];
    out.push({ a: [lerp(a.a[0], b.a[0], t), lerp(a.a[1], b.a[1], t)], b: [lerp(a.b[0], b.b[0], t), lerp(a.b[1], b.b[1], t)], d: a.d, t0: a.t0, t1: a.t1, w: lerp(a.w, b.w, t) });
  }
  return out;
}

// ---------------------------------------------------------------- bones
/** Outline-by-overdraw: stroke fat in ink, then fill in bone. Unions read clean. */
function inked(g, build, { fillC = C.bone, ink = C.ink, lw = 2.2, alpha = 1 } = {}) {
  g.save();
  g.globalAlpha *= alpha;
  build();
  g.lineWidth = lw * 2;
  g.strokeStyle = ink;
  g.lineJoin = 'round';
  g.stroke();
  build();
  g.fillStyle = fillC;
  g.fill();
  g.restore();
}

export function longBone(g, a, b, w, knob = 1.5, opt = {}) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  inked(g, () => {
    g.beginPath();
    g.save();
    g.translate(a[0], a[1]);
    g.rotate(ang);
    const hw = w / 2;
    g.moveTo(w * 0.6, -hw * 0.9);
    g.bezierCurveTo(L * 0.35, -hw * 0.62, L * 0.65, -hw * 0.62, L - w * 0.6, -hw * 0.9);
    g.ellipse(L - w * 0.25, -hw * 0.42, w * 0.5 * knob * 0.62, w * 0.5 * knob * 0.62, 0, -Math.PI * 0.7, Math.PI * 0.2);
    g.ellipse(L - w * 0.25, hw * 0.42, w * 0.5 * knob * 0.62, w * 0.5 * knob * 0.62, 0, -Math.PI * 0.2, Math.PI * 0.7);
    g.lineTo(L - w * 0.6, hw * 0.9);
    g.bezierCurveTo(L * 0.65, hw * 0.62, L * 0.35, hw * 0.62, w * 0.6, hw * 0.9);
    g.ellipse(w * 0.25, hw * 0.42, w * 0.5 * knob * 0.62, w * 0.5 * knob * 0.62, 0, Math.PI * 0.3, Math.PI * 1.2);
    g.ellipse(w * 0.25, -hw * 0.42, w * 0.5 * knob * 0.62, w * 0.5 * knob * 0.62, 0, Math.PI * 0.8, Math.PI * 1.7);
    g.closePath();
    g.restore();
  }, opt);
  // medullary line
  g.save();
  g.globalAlpha *= (opt.alpha ?? 1) * 0.35;
  g.strokeStyle = opt.ink || C.ink;
  g.lineWidth = 0.9;
  g.beginPath();
  const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
  g.moveTo(a[0] + ux * L * 0.22 + nx * w * 0.12, a[1] + uy * L * 0.22 + ny * w * 0.12);
  g.lineTo(a[0] + ux * L * 0.78 + nx * w * 0.12, a[1] + uy * L * 0.78 + ny * w * 0.12);
  g.stroke();
  g.restore();
}

/**
 * Upper-body skeleton parts in a local frame (sternum at 0,0; ~1100px tall at scale 1).
 * Each part: { id, draw(g, alpha), cx, cy } — scenes place/animate parts individually.
 */
export function skeletonParts() {
  const parts = [];
  const bone = C.bone;
  // skull
  parts.push({ id: 'skull', cx: 0, cy: -470, z: 2, draw: (g, al) => {
    inked(g, () => {
      g.beginPath();
      g.ellipse(0, -500, 92, 108, 0, Math.PI * 0.93, Math.PI * 2.07);
      g.bezierCurveTo(88, -440, 80, -410, 62, -395);
      g.lineTo(-62, -395);
      g.bezierCurveTo(-80, -410, -88, -440, -90, -466);
      g.closePath();
    }, { alpha: al });
    g.save();
    g.globalAlpha *= al;
    g.fillStyle = rgba(C.graphite, 0.42);
    g.strokeStyle = C.ink; g.lineWidth = 1.4;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.moveTo(sx * 12, -478);
      g.bezierCurveTo(sx * 14, -496, sx * 52, -498, sx * 58, -480);
      g.bezierCurveTo(sx * 62, -462, sx * 44, -450, sx * 30, -452);
      g.bezierCurveTo(sx * 16, -454, sx * 11, -466, sx * 12, -478);
      g.fill(); g.stroke();
    }
    g.beginPath();
    g.moveTo(0, -448); g.bezierCurveTo(-12, -438, -13, -424, -6, -418); g.lineTo(6, -418); g.bezierCurveTo(13, -424, 12, -438, 0, -448);
    g.fill(); g.stroke();
    g.strokeStyle = C.ink; g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-70, -520); g.quadraticCurveTo(0, -585, 70, -520); // coronal hint
    g.stroke();
    g.restore();
  } });
  parts.push({ id: 'mandible', cx: 0, cy: -375, z: 2, draw: (g, al) => {
    inked(g, () => {
      g.beginPath();
      g.moveTo(-64, -405);
      g.bezierCurveTo(-66, -370, -50, -340, 0, -334);
      g.bezierCurveTo(50, -340, 66, -370, 64, -405);
      g.lineTo(50, -402);
      g.bezierCurveTo(48, -372, 30, -352, 0, -350);
      g.bezierCurveTo(-30, -352, -48, -372, -50, -402);
      g.closePath();
    }, { alpha: al });
    g.save();
    g.globalAlpha *= al * 0.8;
    g.strokeStyle = C.ink; g.lineWidth = 1;
    for (let i = -5; i <= 5; i++) { g.beginPath(); g.moveTo(i * 8, -398); g.lineTo(i * 8, -386); g.stroke(); }
    g.beginPath(); g.moveTo(-46, -398); g.lineTo(46, -398); g.stroke();
    g.restore();
  } });
  // vertebral column
  for (let i = 0; i < 24; i++) {
    const y = -330 + i * (i < 7 ? 17 : i < 19 ? 22 : 27);
    const yy = i < 7 ? -330 + i * 17 : i < 19 ? -330 + 7 * 17 + (i - 7) * 22 : -330 + 7 * 17 + 12 * 22 + (i - 19) * 27;
    const w = i < 7 ? 16 : i < 19 ? 19 + (i - 7) * 0.6 : 26 + (i - 19) * 1.5;
    parts.push({ id: 'v' + i, cx: 0, cy: yy, z: 0, draw: (g, al) => {
      inked(g, () => { g.beginPath(); g.roundRect(-w, yy - 6, w * 2, i < 7 ? 12 : i < 19 ? 15 : 20, 4); }, { alpha: al, lw: 1.6 });
      inked(g, () => { g.beginPath(); g.moveTo(-w - 10, yy); g.lineTo(w + 10, yy); g.lineTo(w + 6, yy + 5); g.lineTo(-w - 6, yy + 5); g.closePath(); }, { alpha: al * 0.9, lw: 1.2 });
    } });
    void y;
  }
  // pelvis + sacrum
  parts.push({ id: 'pelvis', cx: 0, cy: 330, z: 1, draw: (g, al) => {
    inked(g, () => {
      g.beginPath();
      g.moveTo(-30, 250);
      g.bezierCurveTo(-120, 215, -215, 225, -225, 290);
      g.bezierCurveTo(-230, 340, -180, 380, -150, 420);
      g.bezierCurveTo(-130, 450, -95, 470, -40, 450);
      g.lineTo(-40, 420);
      g.bezierCurveTo(-80, 410, -110, 370, -100, 330);
      g.bezierCurveTo(-90, 300, -50, 300, -30, 300);
      g.closePath();
      g.moveTo(30, 250);
      g.bezierCurveTo(120, 215, 215, 225, 225, 290);
      g.bezierCurveTo(230, 340, 180, 380, 150, 420);
      g.bezierCurveTo(130, 450, 95, 470, 40, 450);
      g.lineTo(40, 420);
      g.bezierCurveTo(80, 410, 110, 370, 100, 330);
      g.bezierCurveTo(90, 300, 50, 300, 30, 300);
      g.closePath();
    }, { alpha: al });
    inked(g, () => {
      g.beginPath();
      g.moveTo(-32, 250); g.lineTo(32, 250); g.bezierCurveTo(30, 320, 18, 360, 0, 380); g.bezierCurveTo(-18, 360, -30, 320, -32, 250);
    }, { alpha: al, lw: 1.6 });
    g.save(); g.globalAlpha *= al * 0.9; g.fillStyle = rgba(C.graphite, 0.3); g.strokeStyle = C.ink; g.lineWidth = 1.3;
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 118, 405, 20, 28, s * 0.4, 0, TAU); g.fill(); g.stroke(); }
    g.restore();
  } });
  // ribs (12 pairs) + costal cartilage
  for (let i = 0; i < 12; i++) {
    const y0 = -205 + i * 22;
    const wx = 70 + Math.sin(Math.min(1, (i + 1) / 7) * Math.PI * 0.5) * 150 - Math.max(0, i - 7) * 8;
    const front = i < 7 ? [26, -170 + i * 30] : i < 10 ? [40 + (i - 7) * 32, 90 + (i - 7) * 26] : null;
    for (const s of [-1, 1]) {
      const pts = i < 10
        ? bez([s * 18, y0, s * wx * 0.7, y0 - 34, s * wx * 1.08, y0 + 10 + i * 3, s * wx * 0.92, y0 + 70 + i * 5], 20)
        : bez([s * 22, y0, s * wx * 0.6, y0 - 10, s * wx * 0.9, y0 + 20, s * wx * 0.95, y0 + 45], 14);
      parts.push({ id: `rib${i}${s}`, cx: s * wx * 0.7, cy: y0 + 20, z: 1, draw: (g, al) => {
        stroke(g, pts, C.ink, 9 - i * 0.25, al);
        stroke(g, pts, bone, 5.5 - i * 0.2, al);
        if (front) {
          const end = pts[pts.length - 1];
          stroke(g, bez([end[0], end[1], end[0] - s * 30, end[1] + 16, s * front[0] * 1.6, front[1] + 10, s * front[0], front[1]], 10), C.ink, 1.2, al * 0.55);
        }
      } });
    }
  }
  parts.push({ id: 'sternum', cx: 0, cy: -80, z: 3, draw: (g, al) => inked(g, () => {
    g.beginPath();
    g.moveTo(-30, -190); g.lineTo(30, -190); g.lineTo(24, -140); g.lineTo(20, 20); g.lineTo(8, 50); g.lineTo(-8, 50); g.lineTo(-20, 20); g.lineTo(-24, -140); g.closePath();
  }, { alpha: al, lw: 1.8 }) });
  for (const s of [-1, 1]) {
    parts.push({ id: 'clav' + s, cx: s * 110, cy: -215, z: 3, draw: (g, al) => {
      const pts = bez([s * 24, -196, s * 80, -218, s * 140, -200, s * 205, -232], 16);
      stroke(g, pts, C.ink, 14, al); stroke(g, pts, bone, 9.5, al);
    } });
    parts.push({ id: 'scap' + s, cx: s * 180, cy: -150, z: -1, draw: (g, al) => {
      inked(g, () => { g.beginPath(); g.moveTo(s * 120, -200); g.lineTo(s * 225, -215); g.lineTo(s * 200, -70); g.closePath(); }, { alpha: al * 0.55, lw: 1.4, fillC: C.paper2 });
    } });
    parts.push({ id: 'hum' + s, cx: s * 240, cy: -80, z: 2, draw: (g, al) => longBone(g, [s * 222, -228], [s * 262, 70], 34, 1.9, { alpha: al }) });
    parts.push({ id: 'rad' + s, cx: s * 285, cy: 180, z: 2, draw: (g, al) => {
      longBone(g, [s * 258, 78], [s * 300, 300], 20, 1.5, { alpha: al });
      longBone(g, [s * 272, 70], [s * 322, 292], 18, 1.4, { alpha: al });
    } });
    parts.push({ id: 'fem' + s, cx: s * 150, cy: 470, z: 2, draw: (g, al) => longBone(g, [s * 185, 360], [s * 128, 640], 40, 1.9, { alpha: al }) });
  }
  return parts;
}

// ---------------------------------------------------------------- muscle
/** Fan / strap muscle between an origin line and an insertion point, with fibres. */
export function muscle(g, o1, o2, ins, belly, p = 1, { col = C.muscle, alpha = 0.55, fibres = 16, ink = C.blood } = {}) {
  if (p <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  const mid1 = [lerp(o1[0], ins[0], 0.5) + belly[0], lerp(o1[1], ins[1], 0.5) + belly[1]];
  const mid2 = [lerp(o2[0], ins[0], 0.5) - belly[0], lerp(o2[1], ins[1], 0.5) - belly[1]];
  g.beginPath();
  g.moveTo(o1[0], o1[1]);
  g.quadraticCurveTo(mid1[0], mid1[1], ins[0], ins[1]);
  g.quadraticCurveTo(mid2[0], mid2[1], o2[0], o2[1]);
  g.closePath();
  g.fillStyle = col;
  g.globalAlpha *= p;
  g.fill();
  g.globalAlpha /= p;
  g.strokeStyle = ink;
  g.lineWidth = 0.8;
  for (let i = 0; i <= fibres; i++) {
    const u = i / fibres;
    const o = [lerp(o1[0], o2[0], u), lerp(o1[1], o2[1], u)];
    const m = [lerp(mid1[0], mid2[0], u), lerp(mid1[1], mid2[1], u)];
    const pts = bez([o[0], o[1], m[0], m[1], m[0], m[1], ins[0], ins[1]], 12);
    strokePart(g, pts, 0, ease.outCubic(clamp(p * 1.3 - u * 0.3)), ink, 0.8, 0.7);
  }
  g.restore();
}

// ---------------------------------------------------------------- heart
/** Anatomical heart (anterior view), centred ~ (0,0), ~240px tall at s=1. */
export function heart(g, x, y, s, beatK = 0, opt = {}) {
  const { alpha = 1, line = C.ink, fillA = C.vermilion, fillB = C.blood, vessels = true, lw = 2 } = opt;
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  const sq = 1 - beatK * 0.07;
  g.scale(s * (1 + beatK * 0.03), s * sq);
  if (vessels) {
    // aorta arch, pulmonary trunk, SVC
    g.lineCap = 'round';
    const tube = (pts, w, col) => { stroke(g, pts, line, w + lw * 2, 1); stroke(g, pts, col, w, 1); };
    tube(bez([-10, -70, -12, -130, -8, -175, 40, -178, 85, -178, 95, -140, 92, -95], 12), 34, fillB);
    tube([[-6, -150], [-30, -210]], 12, fillB);
    tube([[20, -170], [22, -222]], 11, fillB);
    tube([[50, -176], [62, -220]], 11, fillB);
    tube(bez([-58, -70, -60, -120, -58, -160, -56, -205], 8), 28, '#6b3a4a');
    tube(bez([22, -72, 30, -110, 40, -125, 58, -130], 8), 30, '#7b4a5a');
  }
  const outline = bez([
    -55, -78,
    -85, -60, -100, -20, -98, 20,
    -96, 60, -70, 85, -30, 105,
    10, 122, 55, 128, 78, 112,
    100, 92, 104, 50, 92, 10,
    82, -25, 70, -48, 62, -62,
    74, -72, 72, -90, 52, -92,
    30, -94, 10, -84, -10, -80,
    -30, -80, -45, -82, -55, -78,
  ], 12);
  g.save();
  path(g, outline, true);
  const gr = g.createLinearGradient(-100, -90, 100, 120);
  gr.addColorStop(0, fillA);
  gr.addColorStop(1, fillB);
  g.fillStyle = gr;
  g.fill();
  g.clip();
  // anatomical shading hatch along the right border
  g.strokeStyle = rgba(C.ink, 0.35);
  g.lineWidth = 1;
  for (let k = -120; k < 140; k += 7) {
    g.beginPath();
    g.moveTo(-110, k);
    g.quadraticCurveTo(-70, k + 20, -40, k + 60);
    g.stroke();
  }
  g.restore();
  stroke(g, outline, line, lw, 1, true);
  // coronary vessels + grooves
  stroke(g, bez([18, -60, 30, -10, 38, 50, 50, 112], 16), '#f0c9a0', 3, 0.85);
  stroke(g, bez([18, -60, 0, -10, -30, 30, -40, 60], 10), '#f0c9a0', 1.6, 0.6);
  stroke(g, bez([30, -20, 60, 0, 72, 30, 78, 60], 10), '#f0c9a0', 1.6, 0.6);
  stroke(g, bez([-55, -70, -80, -30, -80, 30, -40, 90], 16), '#f0c9a0', 2.2, 0.7);
  g.restore();
}

// ---------------------------------------------------------------- lungs
export function lungOutline(side, s = 1) {
  const k = side; // -1 right lung (viewer's left), +1 left lung
  const pts = bez([
    k * 22, -170,
    k * 60, -175, k * 105, -120, k * 128, -30,
    k * 145, 40, k * 150, 110, k * 135, 150,
    k * 100, 158, k * 60, 145, k * 30, 120,
    k * (k > 0 ? 55 : 28), 60, k * 25, 0, k * 22, -60,
    k * 20, -110, k * 18, -150, k * 22, -170,
  ], 14);
  return pts.map(([x, y]) => [x * s, y * s]);
}

// ---------------------------------------------------------------- kidney
export function kidney(g, x, y, s, { alpha = 1, line = C.ink, fill: f = '#b56b5e', p = 1 } = {}) {
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  g.scale(s, s);
  const out = bez([0, -100, 55, -105, 80, -40, 70, 20, 60, 90, 20, 110, -10, 95, -40, 80, -30, 40, -18, 20, -35, 5, -40, -20, -25, -40, -40, -95, 0, -100], 14);
  path(g, out, true);
  g.fillStyle = f; g.globalAlpha *= 0.85; g.fill(); g.globalAlpha /= 0.85;
  stroke(g, out, line, 2, 1, true);
  // medullary pyramids
  for (let i = 0; i < 6; i++) {
    const a = -1.2 + i * 0.48;
    const cx = 5 + Math.cos(a) * 48, cy = Math.sin(a) * 62;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(-10 + Math.cos(a) * 10, Math.sin(a) * 18);
    g.strokeStyle = rgba(line, 0.5);
    g.lineWidth = 12 * p;
    g.lineCap = 'round';
    g.stroke();
  }
  stroke(g, bez([-12, 0, -40, 0, -60, 20, -70, 140], 10), '#e6d3a8', 5, 0.9);
  g.restore();
}

// ---------------------------------------------------------------- cells
/** A living cell: wobbling membrane, nucleus, a few organelles. */
export function cell(g, x, y, r, t, seed = 1, { alpha = 1, line = C.light, fillC = null, nucleus = true, lw = 1.3 } = {}) {
  if (alpha <= 0 || r <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  const pts = [];
  const n = 64;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + 0.06 * noise3(Math.cos(a) * 1.5 + seed, Math.sin(a) * 1.5, t * 0.35));
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  if (fillC) { path(g, pts, true); g.fillStyle = fillC; g.fill(); }
  stroke(g, pts, line, lw, 1, true);
  if (nucleus) {
    const nr = r * 0.34;
    const nx = x + r * 0.08 * Math.sin(seed), ny = y - r * 0.06 * Math.cos(seed);
    const np = [];
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU;
      const rr = nr * (1 + 0.08 * noise3(Math.cos(a) + seed * 3, Math.sin(a), t * 0.2));
      np.push([nx + Math.cos(a) * rr, ny + Math.sin(a) * rr]);
    }
    stroke(g, np, line, lw * 0.9, 0.9, true);
    g.fillStyle = line;
    g.globalAlpha *= 0.6;
    g.beginPath(); g.arc(nx + nr * 0.25, ny - nr * 0.1, nr * 0.22, 0, TAU); g.fill();
    g.globalAlpha /= 0.6;
    // ER / organelles
    const r2 = mulberry32(seed * 31 + 7);
    for (let k = 0; k < 7; k++) {
      const a = r2() * TAU, d = nr * 1.3 + r2() * r * 0.4;
      const ox = x + Math.cos(a) * d, oy = y + Math.sin(a) * d;
      g.globalAlpha *= 0.55;
      g.beginPath();
      g.ellipse(ox, oy, r * 0.07, r * 0.035, a + 1.2, 0, TAU);
      g.strokeStyle = line; g.lineWidth = lw * 0.7; g.stroke();
      g.globalAlpha /= 0.55;
    }
  }
  g.restore();
}

// ---------------------------------------------------------------- histology (H&E) texture
let HISTO = null;
/** Precomputed H&E-like tissue: eosin cytoplasm, hematoxylin nuclei, voronoi membranes. */
export function histology() {
  if (HISTO) return HISTO;
  const S = 1024;
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const n = 28;
  const cellSize = S / n; // must tile exactly
  const r = mulberry32(4242);
  const seeds = [];
  // skeletal muscle in transverse section: polygonal fibres, nuclei pushed to the periphery
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    seeds.push([(i + 0.2 + r() * 0.6) * cellSize, (j + 0.2 + r() * 0.6) * cellSize, r(), Math.cos(a), Math.sin(a)]);
  }
  const eos = [230, 163, 187], eosD = [201, 123, 154], hem = [91, 63, 134], bg = [240, 214, 224];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const ci = Math.floor(x / cellSize), cj = Math.floor(y / cellSize);
      let d1 = 1e9, d2 = 1e9, best = null;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = (ci + di + n) % n, jj = (cj + dj + n) % n;
        const s = seeds[jj * n + ii];
        let sx = s[0] + (ci + di < 0 ? -S : ci + di >= n ? S : 0), sy = s[1] + (cj + dj < 0 ? -S : cj + dj >= n ? S : 0);
        const d = (x - sx) ** 2 + (y - sy) ** 2;
        if (d < d1) { d2 = d1; d1 = d; best = s; } else if (d < d2) d2 = d;
      }
      const edge = Math.sqrt(d2) - Math.sqrt(d1);
      const bx = x - (best[0] + best[3] * cellSize * 0.34), by = y - (best[1] + best[4] * cellSize * 0.34);
      const nuc = edge > 1.5 && (bx * bx) / 20 + (by * by) / 7 < 1 + best[2] * 0.6;
      const lumen = fbm(x / 160, y / 160, 3) > 0.36; // sparse clearings
      let col;
      if (lumen) col = bg;
      else if (nuc) col = hem;
      else {
        const k = clamp(0.5 + noise2(x / 14, y / 14) * 0.5);
        col = [lerp(eos[0], eosD[0], k), lerp(eos[1], eosD[1], k), lerp(eos[2], eosD[2], k)];
      }
      const m = edge < 2.2 && !lumen ? 0.72 : 1;
      const i = (y * S + x) * 4;
      img.data[i] = col[0] * m; img.data[i + 1] = col[1] * m; img.data[i + 2] = col[2] * m; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // soften: the raw voronoi is aliased, which reads as pixels under magnification
  const soft = makeCanvas(S, S);
  const sg = soft.getContext('2d');
  sg.filter = 'blur(1.4px)';
  for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) sg.drawImage(c, dx, dy);
  HISTO = soft;
  return soft;
}
