// SEQUENCE 2 — THE FIRST WEEKS
// Overhead, a desk. Calm: one notebook, one label. Then the semester arrives —
// pages, terms, schedules, clocks that run too fast, coffee that keeps vanishing —
// until one enormous exam stem takes the room and everything freezes. Then it falls
// away, leaving one white page floating in the dark.
import { W, H, TAU, clamp, lerp, seg, ease, kf, rng, hash1, noise2 } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, withCam, stroke, strokePart, circle, callout } from '../lib/draw.js';
import { paperGround } from '../lib/texture.js';
import { reveal, caps, font } from '../lib/type.js';
import { longBone, cell, heart, branchTree, drawTree, ecg } from '../lib/anatomy.js';

export const B = {
  dayOneOut: [0.5, 1.4],
  calm: [1.0, 2.6],
  flood: [2.4, 7.2],
  stem: 7.25,
  freeze: 8.05,
  fall: [8.3, 9.6],
};

export const cues = [
  { t: 1.3, type: 'pencil', dur: 1.2 },
  ...Array.from({ length: 26 }, (_, i) => ({ t: 2.4 + 4.8 * Math.sqrt(i / 26), type: i % 3 ? 'paper' : 'pageTurn', gain: 0.35 + i * 0.012 })),
  { t: 3.2, type: 'tick', dur: 4.0, accel: true },
  { t: B.stem, type: 'stemHit' },
  { t: B.freeze, type: 'freeze' },
  { t: 8.4, type: 'paperFall', dur: 1.2 },
];

const TERMS = [
  'brachial plexus', 'Krebs cycle', 'sternocleidomastoid', 'Na+/K+-ATPase', 'glycolysis', 'foramen magnum',
  'Frank-Starling', 'somatic dysfunction', 'HPI  ROS  PMH', 'anatomical snuffbox', 'cranial nerves I-XII',
  'pH = pKa + log [A-]/[HA]', 'CO = HR x SV', 'rotator cuff', 'OPP lab  1:00', 'anatomy lab  8:00',
  'clinical skills  2:30', 'dermatomes', "Fick's law", 'Starling forces', 'carpal bones', 'resting potential -70 mV',
  'tenets of osteopathy', 'SOAP note', 'inguinal canal', 'Circle of Willis', 'Michaelis-Menten', 'erythropoiesis',
];

let ITEMS;
function init() {
  const r = rng(202);
  const N = 74;
  ITEMS = [];
  const kinds = ['page', 'term', 'page', 'term', 'clock', 'term', 'page', 'sched', 'term', 'coffee', 'page', 'term'];
  for (let i = 0; i < N; i++) {
    const kind = i === 3 ? 'coffee' : i === 6 ? 'clock' : kinds[i % kinds.length];
    const u = i / N;
    const t0 = B.flood[0] + (B.flood[1] - B.flood[0]) * Math.sqrt(u);
    // spiral outward so early items sit near the notebook, later ones fill the edges
    const ang = i * 2.39996 + r.range(-0.3, 0.3);
    const rad = 250 + Math.sqrt(u) * 720 + r.range(-60, 60);
    const x = 960 + Math.cos(ang) * rad * 1.35;
    const y = 540 + Math.sin(ang) * rad * 0.8;
    const from = r.range(0, TAU);
    ITEMS.push({
      i, kind, t0, x, y, rot: r.range(-0.35, 0.35), from, z: r.range(0, 1),
      term: TERMS[i % TERMS.length], draw: r.int(0, 4), seed: r.int(1, 999), s: kind === 'page' ? r.range(0.8, 1.1) : 1,
    });
  }
}

function shadowed(g, x, y, rot, s, lift, fn) {
  g.save();
  g.translate(x + lift * 16, y + lift * 22);
  g.rotate(rot);
  g.scale(s, s);
  g.fillStyle = rgba('#3a2a1a', 0.16 - lift * 0.06);
  g.filter = `blur(${6 + lift * 14}px)`;
  fn(true);
  g.filter = 'none';
  g.restore();
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s * (1 + lift * 0.12), s * (1 + lift * 0.12));
  fn(false);
  g.restore();
}

function page(g, it, sh, clockT) {
  const w = 300, h = 390;
  if (sh) { g.fillRect(-w / 2, -h / 2, w, h); return; }
  g.fillStyle = C.light;
  g.fillRect(-w / 2, -h / 2, w, h);
  g.strokeStyle = rgba(C.pencil, 0.35);
  g.lineWidth = 1;
  for (let k = 0; k < 16; k++) { g.beginPath(); g.moveTo(-w / 2 + 22, -h / 2 + 50 + k * 21); g.lineTo(w / 2 - 18, -h / 2 + 50 + k * 21); g.stroke(); }
  g.strokeStyle = rgba(C.vermilion, 0.45);
  g.beginPath(); g.moveTo(-w / 2 + 40, -h / 2); g.lineTo(-w / 2 + 40, h / 2); g.stroke();
  font(g, FONT.mono, 13);
  g.fillStyle = C.graphite;
  g.fillText(it.term.toUpperCase(), -w / 2 + 50, -h / 2 + 32);
  g.save();
  g.translate(10, 30);
  switch (it.draw) {
    case 0: longBone(g, [-90, -80], [80, 90], 26, 1.7); break;
    case 1: cell(g, 0, 0, 90, clockT, it.seed, { line: C.ink, lw: 1.2 }); break;
    case 2: heart(g, 0, 20, 0.55, 0, { lw: 2.5 }); break;
    case 3: {
      const tr = branchTree(it.seed, 0, 120, -Math.PI / 2, 60, 5, { spread: 0.55, widthRoot: 3 });
      drawTree(g, tr, 1, C.ink, { widthScale: 0.6 });
      break;
    }
    default: {
      // cycle diagram with arrows
      g.strokeStyle = C.ink; g.lineWidth = 1.4;
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * TAU + 0.08, a1 = ((k + 1) / 8) * TAU - 0.08;
        g.beginPath(); g.arc(0, 0, 90, a0, a1); g.stroke();
        const ax = Math.cos(a1) * 90, ay = Math.sin(a1) * 90;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax - Math.cos(a1 - 1.2) * 9, ay - Math.sin(a1 - 1.2) * 9); g.stroke();
        circle(g, Math.cos(a0) * 90, Math.sin(a0) * 90, 4, { fill: C.ink });
      }
    }
  }
  g.restore();
}

function term(g, it, sh) {
  font(g, FONT.mono, 22);
  const tw = g.measureText(it.term).width;
  const w = tw + 40, h = 50;
  if (sh) { g.fillRect(-w / 2, -h / 2, w, h); return; }
  g.fillStyle = it.i % 5 === 0 ? '#efd9a7' : C.light;
  g.fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle = C.ink;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(it.term, 0, 1);
}

function clock(g, it, sh, t) {
  const R = 78;
  if (sh) { g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); return; }
  circle(g, 0, 0, R, { fill: C.light, stroke: C.ink, width: 3 });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    stroke(g, [[Math.cos(a) * (R - 8), Math.sin(a) * (R - 8)], [Math.cos(a) * (R - 18), Math.sin(a) * (R - 18)]], C.ink, k % 3 ? 1.5 : 3);
  }
  // clocks run faster the longer the semester goes
  const k = Math.max(0, t - it.t0);
  const turns = k * 0.3 + k * k * k * 0.12;
  const hA = turns * TAU / 12 - Math.PI / 2 + it.seed, mA = turns * TAU - Math.PI / 2;
  stroke(g, [[0, 0], [Math.cos(hA) * 40, Math.sin(hA) * 40]], C.ink, 5);
  stroke(g, [[0, 0], [Math.cos(mA) * 62, Math.sin(mA) * 62]], C.ink, 3);
  circle(g, 0, 0, 5, { fill: C.vermilion });
}

function coffee(g, it, sh, t) {
  if (sh) { g.beginPath(); g.arc(0, 0, 105, 0, TAU); g.fill(); return; }
  circle(g, 0, 0, 105, { fill: '#f4efe4', stroke: rgba(C.ink, 0.5), width: 1.5 }); // saucer
  circle(g, 0, 0, 72, { fill: C.light, stroke: C.ink, width: 2.5 });
  // handle
  g.save(); g.strokeStyle = C.ink; g.lineWidth = 11; g.beginPath(); g.moveTo(68, -10); g.quadraticCurveTo(108, 0, 68, 18); g.stroke();
  g.strokeStyle = C.light; g.lineWidth = 6; g.stroke(); g.restore();
  // level: drains, snaps back full, drains faster (the cup is never empty for long)
  const k = Math.max(0, t - it.t0);
  const period = Math.max(0.35, 1.6 - k * 0.3);
  const ph = ((k % period) / period);
  const level = 1 - ease.inQuad(ph);
  const rr = 62 * (0.25 + 0.75 * level);
  circle(g, 0, 0, rr, { fill: '#4a2d1c' });
  circle(g, -rr * 0.3, -rr * 0.3, rr * 0.35, { fill: rgba('#ffffff', 0.12) });
  if (level < 0.35) circle(g, 0, 0, 58 * 0.25, { fill: '#3a2416' });
}

function sched(g, it, sh) {
  const w = 330, h = 250;
  if (sh) { g.fillRect(-w / 2, -h / 2, w, h); return; }
  g.fillStyle = C.light; g.fillRect(-w / 2, -h / 2, w, h);
  g.strokeStyle = rgba(C.ink, 0.35); g.lineWidth = 1;
  const cols = 5, rows = 9, cw = (w - 30) / cols, rh = (h - 44) / rows;
  font(g, FONT.mono, 11); g.fillStyle = C.graphite;
  ['MON', 'TUE', 'WED', 'THU', 'FRI'].forEach((d, i) => g.fillText(d, -w / 2 + 20 + i * cw, -h / 2 + 22));
  for (let c = 0; c <= cols; c++) { g.beginPath(); g.moveTo(-w / 2 + 15 + c * cw, -h / 2 + 32); g.lineTo(-w / 2 + 15 + c * cw, h / 2 - 12); g.stroke(); }
  const cols2 = [C.ochre, C.muscle, C.sage, C.slate2, C.vermilion];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const hsh = hash1(it.seed * 50 + c * 9 + r);
    if (hsh < 0.72) { g.fillStyle = rgba(cols2[Math.floor(hsh * 7) % 5], 0.75); g.fillRect(-w / 2 + 17 + c * cw, -h / 2 + 34 + r * rh, cw - 4, rh - 3); }
  }
}

function drawItem(g, it, t, frozenT) {
  const tt = Math.min(t, frozenT);
  const p = seg(tt, it.t0, it.t0 + 0.55, ease.outExpo);
  if (p <= 0) return;
  // fall away after the freeze
  const f = seg(t, B.fall[0] + it.z * 0.5, B.fall[0] + 0.9 + it.z * 0.5, ease.inCubic);
  const d = 1300 * (1 - p);
  const x = it.x + Math.cos(it.from) * d;
  const y = it.y + Math.sin(it.from) * d + f * (900 + it.z * 500);
  const rot = it.rot + (1 - p) * 1.2 + f * (it.z - 0.5) * 1.5;
  const lift = (1 - p) * 0.9 + f * 0.4;
  if (f >= 1) return;
  g.save();
  g.globalAlpha = 1 - f * f;
  shadowed(g, x, y, rot, it.s, lift, (sh) => {
    if (it.kind === 'page') page(g, it, sh, tt);
    else if (it.kind === 'term') term(g, it, sh);
    else if (it.kind === 'clock') clock(g, it, sh, tt);
    else if (it.kind === 'coffee') coffee(g, it, sh, tt);
    else sched(g, it, sh);
  });
  g.restore();
}

function pencil(g, x, y, a) {
  const L = 420, w = 16;
  // shadow
  g.save();
  g.translate(x + 26, y + 30); g.rotate(a);
  g.fillStyle = rgba('#3a2a1a', 0.18); g.filter = 'blur(8px)';
  g.fillRect(0, -w / 2, L, w); g.filter = 'none';
  g.restore();
  g.save();
  g.translate(x, y); g.rotate(a);
  g.fillStyle = '#e8c9a0'; g.beginPath(); g.moveTo(0, 0); g.lineTo(46, -w / 2); g.lineTo(46, w / 2); g.closePath(); g.fill();
  g.fillStyle = C.graphite; g.beginPath(); g.moveTo(0, 0); g.lineTo(13, -w * 0.16); g.lineTo(13, w * 0.16); g.closePath(); g.fill();
  g.fillStyle = C.ochre; g.fillRect(46, -w / 2, L - 110, w);
  g.fillStyle = rgba('#ffffff', 0.25); g.fillRect(46, -w / 2 + 2, L - 110, 4);
  g.fillStyle = rgba('#000000', 0.12); g.fillRect(46, w / 2 - 4, L - 110, 4);
  g.fillStyle = '#9a9a92'; g.fillRect(L - 64, -w / 2 - 1, 26, w + 2);
  g.fillStyle = '#c98a84'; g.beginPath(); g.roundRect(L - 38, -w / 2, 38, w, [0, 6, 6, 0]); g.fill();
  g.restore();
}

function notebook(g, t, frozenT) {
  const tt = Math.min(t, frozenT);
  const f = seg(t, B.fall[0] + 0.1, B.fall[0] + 1.1, ease.inCubic);
  g.save();
  g.translate(0, f * 1100);
  g.globalAlpha = 1 - f;
  // open notebook
  shadowed(g, 960, 560, -0.03, 1, 0, (sh) => {
    if (sh) { g.fillRect(-400, -260, 800, 520); return; }
    g.fillStyle = C.light; g.fillRect(-400, -260, 800, 520);
    g.strokeStyle = rgba(C.pencil, 0.25); g.lineWidth = 1;
    for (let k = 0; k < 20; k++) { g.beginPath(); g.moveTo(-380, -220 + k * 24); g.lineTo(-20, -220 + k * 24); g.moveTo(20, -220 + k * 24); g.lineTo(380, -220 + k * 24); g.stroke(); }
    stroke(g, [[0, -260], [0, 260]], rgba(C.ink, 0.25), 2);
    // the first thing learned: a clavicle, and its name
    const dp = seg(tt, 1.2, 2.2, ease.inOutSine);
    const cl = [[-320, -40], [-260, -70], [-180, -60], [-90, -95]];
    strokePart(g, cl, 0, dp, C.ink, 2.2);
    callout(g, -200, -62, -150, 40, 'clavicle', seg(tt, 1.9, 2.6), { size: 18 });
    font(g, FONT.mono, 14); g.fillStyle = C.graphite; g.globalAlpha *= seg(tt, 1.0, 1.4);
    g.fillText('WEEK 1', 40, -200);
  });
  // the pencil: an unseen hand writing the first thing learned
  const hp = seg(tt, 0.9, 1.3);
  if (hp > 0) {
    const w = tt > 1.2 && tt < 2.2 ? (tt - 1.2) : tt >= 2.2 ? 1 : 0;
    const tipX = 960 - 320 + 230 * w + Math.sin(tt * 23) * 4 * (w > 0 && w < 1 ? 1 : 0);
    const tipY = 560 - 40 - 50 * w + Math.cos(tt * 17) * 3 * (w > 0 && w < 1 ? 1 : 0);
    const exit = seg(tt, 2.6, 3.3, ease.inCubic);
    pencil(g, tipX + exit * 700 + (1 - hp) * 300, tipY + exit * 500 + (1 - hp) * 200, 0.62);
  }
  g.restore();
}

export default {
  init,
  draw(g, t) {
    const frozenT = t < B.freeze ? t : B.freeze;
    const fall = seg(t, B.fall[0], B.fall[1] + 0.3);
    paperGround(g, C.paper);
    // camera: slow pull back as the semester accumulates; jolt at the stem; stillness at freeze
    const z = kf(frozenT, [[1.0, 1.2], [7.2, 0.78, ease.inOutSine], [7.4, 0.74, ease.outCubic]]);
    const rot = kf(frozenT, [[1.0, 0.0], [7.2, -0.05]]);
    const jolt = t > B.stem && t < B.stem + 0.4 ? Math.sin((t - B.stem) * 60) * (1 - (t - B.stem) / 0.4) * 6 : 0;
    withCam(g, { x: 960 + jolt, y: 560, z, r: rot }, () => {
      notebook(g, t, frozenT);
      for (const it of ITEMS) drawItem(g, it, t, frozenT);
    });
    // arriving from the doorway light
    const warm = 1 - seg(t, 0.3, 1.4, ease.inOutSine);
    if (warm > 0) { g.fillStyle = rgba('#f3e3c2', warm); g.fillRect(0, 0, W, H); }
    // DAY ONE lingers, then lifts away
    reveal(g, 'DAY ONE', 960, 600, { size: 200, color: C.ink, tracking: 0.06, p: 1, q: seg(t, B.dayOneOut[0], B.dayOneOut[1]), stagger: 0.45 });
    // the stem
    const sp = seg(t, B.stem, B.stem + 0.3, ease.outExpo);
    if (sp > 0 && t < B.fall[1] + 0.4) {
      const out = seg(t, B.fall[0], B.fall[0] + 0.6, ease.inCubic);
      g.save();
      g.globalAlpha = (1 - out);
      g.fillStyle = rgba(C.paper, 0.82 * sp);
      g.fillRect(0, 300, W, 480);
      const s = lerp(3.2, 1, sp);
      g.translate(960, 560);
      g.scale(s, s);
      font(g, FONT.serif, 176);
      g.fillStyle = C.ink;
      g.textAlign = 'center';
      g.letterSpacing = '0.01em';
      g.fillText('WHICH OF THE FOLLOWING...', 0, 0);
      g.restore();
      const op = seg(t, B.stem + 0.25, B.freeze) * (1 - out);
      g.save();
      g.globalAlpha = op;
      font(g, FONT.mono, 20);
      g.fillStyle = C.graphite;
      ['(A)', '(B)', '(C)', '(D)', '(E)'].forEach((a, i) => {
        const x = 520 + i * 200;
        g.fillText(a, x, 668);
        g.strokeStyle = C.ink; g.lineWidth = 1.5;
        g.beginPath(); g.arc(x + 70, 661, 12, 0, TAU); g.stroke();
      });
      g.restore();
    }
    // after the freeze, the room goes dark; one page stays
    const dark = seg(t, B.fall[0] + 0.2, B.fall[1] + 0.2, ease.inOutSine);
    if (dark > 0) { g.fillStyle = rgba(C.night, dark); g.fillRect(0, 0, W, H); }
    const lp = seg(t, B.fall[0] + 0.4, B.fall[1]);
    if (lp > 0) {
      // the last page: it will become fabric
      const k = seg(t, B.fall[0], 10, ease.outSine);
      const x = 960 + noise2(t * 0.6, 3) * 40;
      const y = lerp(600, 520, k) + Math.sin(t * 2.2) * 8;
      g.save();
      g.globalAlpha = lp;
      g.translate(x, y);
      g.rotate(-0.25 + Math.sin(t * 1.7) * 0.08);
      g.transform(1, 0, Math.sin(t * 2.1) * 0.15, 1, 0, 0);
      g.fillStyle = C.light;
      g.shadowColor = rgba(C.lamp, 0.25); g.shadowBlur = 40;
      g.fillRect(-120, -160, 240, 320);
      g.restore();
    }
    void fall; void caps; void TAU; void clamp; void ecg;
    return { dark: dark > 0.5 ? 1 : 0 };
  },
};
