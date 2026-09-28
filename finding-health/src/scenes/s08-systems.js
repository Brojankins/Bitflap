// SEQUENCE 8 — YEAR TWO / CONNECTION
// What happens when health is disrupted? Knowledge stops being a list of objects.
// Lungs breathe; bronchi become branches; branches become vessels; signals move between
// glands like a network; the kidney is drawn as filtration architecture; the gut unfolds
// into a line; one cell becomes a life. Then everything intersects, and accelerates.
import { W, H, TAU, clamp, lerp, seg, ease, kf, env, rng, bez, spline, pulse, hash1, pointAt, arcLengths } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, stroke, strokePart, circle, glow, path } from '../lib/draw.js';
import { lungOutline, branchTree, drawTree, morphTrees, heart, cell, ecg, kidney } from '../lib/anatomy.js';
import { caps, font, typeOn, reveal } from '../lib/type.js';

export const B = {
  lungs: [0, 2.2],
  tree: [1.8, 3.4],
  vessel: [3.2, 4.6],
  endo: [4.4, 6.2],
  nephron: [6.0, 7.6],
  gut: [7.4, 8.8],
  dev: [8.6, 10.0],
  weave: [9.8, 12],
};

export const cues = [
  { t: 0.2, type: 'breath', dur: 2.0 },
  { t: 1.9, type: 'morphRise', dur: 1.2 },
  { t: 3.3, type: 'flow', dur: 1.2 },
  ...Array.from({ length: 6 }, (_, i) => ({ t: 4.6 + i * 0.25, type: 'blip', pitch: 60 + (i % 3) * 5 })),
  { t: 6.1, type: 'pencil', dur: 1.2 },
  { t: 7.5, type: 'unfurl', dur: 1.2 },
  { t: 8.7, type: 'cellSplit' }, { t: 9.1, type: 'cellSplit' },
  { t: 9.9, type: 'ultrasound', dur: 1.2 },
  { t: 10.4, type: 'riser', dur: 1.6 },
];

let BRONCHI, TREE, VESSEL;
function init() {
  const o = { spread: 0.55, shrink: 0.76, jitter: 0.35, curve: 0.3, widthRoot: 9 };
  BRONCHI = branchTree(71, 0, -240, Math.PI / 2, 120, 7, o);
  TREE = branchTree(71, 0, 380, -Math.PI / 2, 190, 7, { ...o, spread: 0.62, curve: 0.5, jitter: 0.5, widthRoot: 14 });
  VESSEL = branchTree(71, -520, 0, 0, 170, 7, { ...o, spread: 0.7, curve: 0.45, jitter: 0.6, widthRoot: 10 });
}

function lungsStage(g, t) {
  const a = 1 - seg(t, B.tree[0], B.tree[0] + 0.8);
  if (a <= 0) return;
  const br = 1 + 0.06 * Math.sin(t * 2.4 - 0.5);
  g.save();
  g.translate(960, 560);
  g.scale(1.25 * br, 1.25 * br);
  for (const s of [-1, 1]) {
    const o = lungOutline(s, 1.6);
    path(g, o, true); g.fillStyle = rgba(C.lamp, 0.06 * a); g.fill();
    stroke(g, o, C.lamp, 1.6, a, true);
  }
  g.restore();
}

function branching(g, t) {
  // one bronchial tree, turned: upright it is a tree on a ridge; sideways and red, it is vessels
  const grow = seg(t, 0.2, 1.8, ease.outCubic);
  const m1 = seg(t, B.tree[0], B.tree[1], ease.morph);
  const m2 = seg(t, B.vessel[0], B.vessel[1], ease.morph);
  const out = seg(t, B.endo[0], B.endo[0] + 0.8);
  if (out >= 1) return;
  const col = m2 > 0.5 ? C.vermilion : m1 > 0.5 ? C.sage : C.lamp;
  g.save();
  g.translate(960, 560);
  g.globalAlpha = 1 - out;
  const treeA = env(t, B.tree[0] + 0.6, B.tree[1], B.vessel[0], B.vessel[0] + 0.6);
  if (treeA > 0) {
    const ridge = spline([[-1000, 330], [-600, 300], [-200, 322], [200, 310], [600, 290], [1000, 320]], 12);
    stroke(g, ridge, C.sage, 1.5, treeA * 0.8);
  }
  // the root travels: trachea (top) → trunk on the ridge → out of the heart, pointing right
  const rot = m1 * Math.PI + m2 * Math.PI / 2;
  const sc = 1.25 * lerp(1, 1.35, m1) * lerp(1, 0.85, m2);
  const root = [lerp(lerp(0, 0, m1), -420, m2), lerp(lerp(-300, 310, m1), 0, m2)];
  g.translate(root[0], root[1]);
  g.rotate(rot);
  g.scale(sc, sc);
  g.translate(0, 240); // tree coords: root at (0,-240)
  drawTree(g, BRONCHI, grow, col, { widthScale: 0.55, minW: 0.7 });
  if (m2 > 0.4) {
    g.save();
    g.setLineDash([8, 16]);
    g.lineDashOffset = -t * 100;
    g.globalAlpha *= seg(t, B.vessel[0] + 0.6, B.vessel[1]);
    for (const s2 of BRONCHI) if (s2.d < 4) stroke(g, [s2.a, s2.b], C.lamp, 1.2, 0.7);
    g.restore();
  }
  g.restore();
  if (m2 > 0.3) heart(g, 960 - 420 - 70, 560, 0.55, pulse(t, 84, 3.4) * 0.8, { alpha: seg(t, B.vessel[0] + 0.4, B.vessel[1]) * (1 - out), line: C.lamp });
}

const GLANDS = [
  ['pituitary', 960, 210], ['thyroid', 960, 360], ['heart', 900, 470], ['adrenal', 870, 600], ['adrenal', 1050, 600],
  ['pancreas', 1010, 650], ['gonad', 960, 820],
];
function endocrine(g, t) {
  const a = env(t, B.endo[0], B.endo[0] + 0.6, B.endo[1] - 0.3, B.endo[1] + 0.3);
  if (a <= 0) return;
  g.save();
  g.globalAlpha = a;
  // a faint figure, frontal, for orientation
  const fig = bez([960, 120, 1030, 120, 1040, 230, 1000, 280, 1110, 300, 1150, 360, 1150, 520, 1120, 700, 1080, 820, 1020, 1000, 960, 1000, 900, 1000, 840, 820, 800, 700, 770, 520, 770, 360, 810, 300, 920, 280, 880, 230, 890, 120, 960, 120], 10);
  stroke(g, fig, C.dust, 1, 0.35, true);
  // network links carrying signals
  const L = [[0, 1], [0, 3], [0, 4], [0, 6], [1, 2], [5, 2], [3, 5], [4, 5], [0, 5], [1, 6]];
  L.forEach(([i, j], k) => {
    const [, x1, y1] = GLANDS[i], [, x2, y2] = GLANDS[j];
    const mx = (x1 + x2) / 2 + (k % 2 ? 1 : -1) * (80 + k * 12), my = (y1 + y2) / 2;
    const arc = bez([x1, y1, mx, my - 40, mx, my + 40, x2, y2], 24);
    strokePart(g, arc, 0, seg(t, B.endo[0] + k * 0.06, B.endo[0] + 0.6 + k * 0.06), C.ochre, 2, 0.85);
    const u = ((t * 0.8 + k * 0.137) % 1);
    const p = pointAt(arc, u);
    glow(g, p.x, p.y, 22, C.gold, 1);
  });
  GLANDS.forEach(([n, x, y], i) => {
    circle(g, x, y, 7 + pulse(t, 60, i * 0.13, 6) * 4, { fill: C.lamp });
    if (i !== 4) caps(g, n.toUpperCase(), x + (i === 3 ? -24 : 24), y, { size: 16, color: C.bone, align: i === 3 ? 'right' : 'left', tracking: 0.3, alpha: 0.85 });
  });
  g.restore();
}

function nephron(g, t) {
  const a = env(t, B.nephron[0], B.nephron[0] + 0.4, B.nephron[1] - 0.3, B.nephron[1] + 0.3);
  if (a <= 0) return;
  const p = seg(t, B.nephron[0] + 0.1, B.nephron[1] - 0.3, ease.inOutSine);
  g.save();
  g.globalAlpha = a;
  // blueprint grid
  g.strokeStyle = rgba(C.bone, 0.08); g.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  // glomerulus inside Bowman's capsule
  const gl = [];
  for (let i = 0; i < 90; i++) { const a2 = i * 0.55; gl.push([560 + Math.cos(a2) * (40 + 18 * Math.sin(i * 0.9)), 340 + Math.sin(a2) * (40 + 18 * Math.cos(i * 0.7))]); }
  strokePart(g, gl, 0, p * 1.5, C.vermilion, 2, 0.9);
  strokePart(g, bez([500, 260, 440, 300, 440, 390, 520, 430, 600, 460, 660, 400, 650, 330], 20), 0, p * 1.4, C.bone, 2.5, 1);
  // PCT → loop of Henle → DCT → collecting duct
  const tube = spline([[650, 330], [760, 300], [820, 360], [760, 420], [860, 460], [900, 420], [940, 480], [960, 700], [980, 900], [1010, 920], [1040, 900], [1060, 700], [1080, 500], [1150, 450], [1220, 500], [1180, 560], [1260, 560], [1330, 520], [1400, 300], [1420, 980]], 10);
  strokePart(g, tube, 0, p, C.bone, 2.5, 1);
  strokePart(g, tube.map(([x, y]) => [x + 9, y + 3]), 0, p, C.bone, 1, 0.5);
  const lbl = [['GLOMERULUS', 560, 230], ['PROXIMAL TUBULE', 800, 250], ['LOOP OF HENLE', 1000, 960], ['DISTAL TUBULE', 1200, 420], ['COLLECTING DUCT', 1440, 640]];
  lbl.forEach(([n, x, y], i) => caps(g, n, x, y, { size: 13, color: C.lamp, tracking: 0.35, align: 'left', alpha: seg(p, 0.15 + i * 0.16, 0.3 + i * 0.16) }));
  kidney(g, 300, 740, 0.9, { alpha: seg(t, B.nephron[0], B.nephron[0] + 0.4) * 0.8, line: C.bone, fill: '#6a3b33' });
  // filtrate: particles moving down the tube
  const L = arcLengths(tube);
  for (let k = 0; k < 14; k++) {
    const u = (t * 0.25 + k / 14) % 1;
    if (u < p) { const q = pointAt(tube, u, L); circle(g, q.x, q.y, 3, { fill: C.gold, alpha: 0.9 }); }
  }
  g.restore();
}

function gut(g, t) {
  const a = env(t, B.gut[0], B.gut[0] + 0.3, B.gut[1] - 0.3, B.gut[1] + 0.2);
  if (a <= 0) return;
  const u = seg(t, B.gut[0] + 0.2, B.gut[1] - 0.2, ease.inOutCubic);
  // coiled bowel, uncoiling into a straight line: the path of digestion as a timeline
  const N = 260;
  const coil = [], line = [];
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1);
    const ang = k * 26;
    const r = 60 + k * 240;
    coil.push([960 + Math.cos(ang) * r * 0.9, 540 + Math.sin(ang) * r * 0.55 + Math.sin(k * 60) * 12]);
    line.push([lerp(120, 1800, k), 540 + Math.sin(k * 40 + t * 3) * 6 * (1 - u)]);
  }
  const pts = coil.map((p, i) => [lerp(p[0], line[i][0], u), lerp(p[1], line[i][1], u)]);
  g.save();
  g.globalAlpha = a;
  stroke(g, pts, '#8a5a4a', 22, 0.8);
  stroke(g, pts, '#c98a74', 14, 0.9);
  stroke(g, pts.map(([x, y]) => [x, y - 3]), rgba('#fff', 0.3), 3, 1);
  const marks = ['ESOPHAGUS', 'STOMACH', 'DUODENUM', 'JEJUNUM', 'ILEUM', 'COLON'];
  marks.forEach((m, i) => {
    const k = (i + 0.5) / marks.length;
    const q = pts[Math.floor(k * (N - 1))];
    caps(g, m, q[0], q[1] + 50, { size: 13, color: C.bone, tracking: 0.3, alpha: seg(u, 0.6 + i * 0.05, 0.8 + i * 0.05) });
  });
  g.restore();
}

function development(g, t) {
  const a = env(t, B.dev[0], B.dev[0] + 0.3, B.dev[1] - 0.2, B.dev[1] + 0.4);
  if (a <= 0) return;
  const k = seg(t, B.dev[0], B.dev[1], ease.linear);
  g.save();
  g.globalAlpha = a;
  g.translate(960, 540); g.scale(1.6, 1.6); g.translate(-960, -540);
  const n = k < 0.25 ? 1 : k < 0.45 ? 2 : k < 0.6 ? 4 : 8;
  const emb = seg(k, 0.6, 1, ease.inOutSine);
  if (emb < 1) {
    circle(g, 960, 540, 150, { stroke: C.bone, width: 1.5, alpha: 0.6 * (1 - emb) });
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + 0.4;
      const d = n === 1 ? 0 : 60;
      cell(g, 960 + Math.cos(ang) * d * (1 - emb), 540 + Math.sin(ang) * d * (1 - emb), (n === 1 ? 110 : 110 / Math.sqrt(n)) * (1 - emb * 0.7), t, i + 1, { line: C.bone, alpha: 1 - emb, nucleus: n < 8 });
    }
  }
  if (emb > 0) {
    // a curled embryonic form: C-shaped, somites along its back, growing
    const s = lerp(0.4, 1, emb);
    const spine = [];
    for (let i = 0; i <= 60; i++) { const a2 = -0.6 + (i / 60) * 4.2; spine.push([960 + Math.cos(a2) * 150 * s, 540 + Math.sin(a2) * 170 * s]); }
    stroke(g, spine, C.lamp, 60 * s, 0.25 * emb);
    stroke(g, spine, C.lamp, 2, emb);
    for (let i = 4; i < 56; i += 3) {
      const p = spine[i], q = spine[i + 1];
      const nx = -(q[1] - p[1]), ny = q[0] - p[0], L = Math.hypot(nx, ny) || 1;
      circle(g, p[0] + (nx / L) * 18 * s, p[1] + (ny / L) * 18 * s, 5 * s, { fill: C.lamp, alpha: emb * 0.8 });
    }
    circle(g, 960 + Math.cos(-0.6) * 150 * s + 30 * s, 540 + Math.sin(-0.6) * 170 * s - 20 * s, 70 * s, { stroke: C.lamp, width: 2, alpha: emb });
    // heartbeat, very early and very fast
    circle(g, 960 + 40 * s, 560 * 1 + 10 * s, (10 + pulse(t, 150, 0, 9) * 6) * s, { fill: C.vermilion, alpha: emb });
  }
  g.restore();
}

const VIGNETTES = [
  '58 y/o · dyspnea on exertion · bilateral pitting edema',
  '7 y/o · polyuria · polydipsia · weight loss',
  '34 y/o G2P1 · 28 weeks · headache · BP 152/98',
  '71 y/o · new confusion · Na+ 124',
  '22 y/o · low back pain · morning stiffness',
];
function weave(g, t) {
  const a = seg(t, B.weave[0], B.weave[0] + 0.5);
  if (a <= 0) return;
  const k = seg(t, B.weave[0], B.weave[1], ease.inQuad);
  g.save();
  g.globalAlpha = a;
  // earlier motifs, now intersecting
  const rot = k * k * 2.5;
  const items = [
    (x, y) => heart(g, x, y, 0.35, pulse(t, 96, 0) * 0.8, { line: C.lamp }),
    (x, y) => { g.save(); g.translate(x, y); g.scale(0.35, 0.35); drawTree(g, BRONCHI, 1, C.lamp, { widthScale: 0.6 }); g.restore(); },
    (x, y) => kidney(g, x, y, 0.45, { line: C.bone, fill: '#6a3b33' }),
    (x, y) => { const pts = []; for (let i = 0; i < 120; i++) pts.push([x - 120 + i * 2, y - ecg((i / 60 + t * 1.6) % 1) * 50]); stroke(g, pts, C.vermilion, 2); },
    (x, y) => cell(g, x, y, 50, t, 7, { line: C.bone }),
    (x, y) => { for (let i = 0; i < 6; i++) circle(g, x, y, 12 + i * 12, { stroke: C.sage, width: 1, alpha: 0.6 }); },
  ];
  const pos = items.map((_, i) => {
    const ang = (i / items.length) * TAU + rot;
    const r = lerp(360, 300, k);
    return [960 + Math.cos(ang) * r * 1.3, 540 + Math.sin(ang) * r * 0.75];
  });
  // links between everything
  g.save();
  g.globalAlpha *= 0.5;
  for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) stroke(g, [pos[i], pos[j]], C.dust, 0.8, seg(t, B.weave[0] + (i + j) * 0.05, B.weave[0] + 0.6 + (i + j) * 0.05));
  g.restore();
  items.forEach((f, i) => f(...pos[i]));
  // clinical questions, arriving faster
  VIGNETTES.forEach((v, i) => {
    const t0 = B.weave[0] + 0.2 + i * lerp(0.42, 0.25, i / 5);
    const p = seg(t, t0, t0 + 0.45);
    typeOn(g, v, 960, 930 + (i - 2) * 34, p, { size: 21, color: C.light, align: 'center', alpha: (1 - seg(t, t0 + 0.9, t0 + 1.3)) * 0.95 });
  });
  g.restore();
}

export default {
  init,
  draw(g, t) {
    fill(g, C.slate);
    // a quiet grid of the whole semester underneath everything
    lungsStage(g, t);
    branching(g, t);
    endocrine(g, t);
    nephron(g, t);
    gut(g, t);
    development(g, t);
    weave(g, t);
    // ultrasound passes across it all
    const us = seg(t, B.weave[0] + 0.1, B.weave[0] + 1.2, ease.inOutSine);
    if (us > 0 && us < 1) {
      const x = lerp(-300, W + 300, us);
      const gr = g.createLinearGradient(x - 200, 0, x + 40, 0);
      gr.addColorStop(0, rgba('#ffffff', 0)); gr.addColorStop(0.9, rgba('#ffffff', 0.12)); gr.addColorStop(1, rgba('#ffffff', 0));
      g.fillStyle = gr; g.fillRect(x - 200, 0, 240, H);
    }
    const end = seg(t, 11.4, 12, ease.inCubic);
    if (end > 0) { g.fillStyle = rgba(C.night, end); g.fillRect(0, 0, W, H); }
    void hash1; void rng; void reveal; void font; void kf; void clamp;
    return { dark: 1 };
  },
};
