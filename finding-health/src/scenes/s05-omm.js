// SEQUENCE 5 — OSTEOPATHIC MEDICINE
// A hand on a back. At contact the body opens: bone, muscle, fascia, motion.
// The back becomes a landscape — its tension mapped as contour lines — and as the hands
// listen and move, the contours relax and settle. Palpation, structure, function.
// One contour lifts away and becomes the tubing of a stethoscope.
import { W, H, TAU, clamp, lerp, seg, ease, kf, env, bez, noise3, spline } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, path, stroke, strokePart, glow, taper } from '../lib/draw.js';
import { sampleGrid, contourSegments } from '../lib/terrain.js';
import { hand, limb } from '../lib/figure.js';
import { caps, font, reveal } from '../lib/type.js';

export const B = {
  back: [0.0, 1.2],
  contact: 1.5,
  reveal: [1.7, 3.4],
  contours: [3.8, 5.6],
  second: 4.0,
  settle: [5.0, 8.6],
  words: [5.8, 8.8],
  tube: [8.6, 11],
};

export const cues = [
  { t: 0.2, type: 'roomTone', dur: 10.5 },
  { t: 1.1, type: 'cloth', dur: 0.8, gain: 0.5 },
  { t: B.contact, type: 'touch' },
  { t: 1.8, type: 'shimmer', dur: 1.4 },
  { t: B.second, type: 'touch', gain: 0.7 },
  { t: 5.2, type: 'breath', dur: 3.2 },
  { t: 9.0, type: 'tubeSweep', dur: 1.6 },
];

const P = [1105, 470]; // point of contact (right upper trapezius / supraspinous region)
const P2 = [800, 560];

function backOutline() {
  const half = bez([
    0, 290,
    40, 292, 58, 300, 70, 330, // neck
    110, 380, 260, 400, 380, 430, // trapezius slope
    450, 450, 480, 500, 478, 560, // shoulder cap
    472, 700, 455, 900, 440, 1100, // flank
  ], 14);
  const right = half.map(([x, y]) => [960 + x, y]);
  const left = half.slice().reverse().map(([x, y]) => [960 - x, y]);
  return [...right, ...left];
}
const BACK = backOutline();

const gauss2 = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2));

function field(t) {
  const tension = 1 - seg(t, B.settle[0], B.settle[1], ease.inOutSine) * 0.85;
  const sway = Math.sin(seg(t, B.settle[0], B.settle[1]) * Math.PI) * 18;
  return (x, y) => {
    let h = -(((x - 960) / 520) ** 2) * 1.0 - (((y - 760) / 700) ** 2) * 0.35;
    h -= 0.22 * gauss2(x, y, 960, 700, 34, 900); // spinal groove
    h += 0.3 * gauss2(x, y, 960 + 185, 590, 110, 150) + 0.3 * gauss2(x, y, 960 - 185, 590, 110, 150); // scapulae
    h += 0.16 * gauss2(x, y, 960 + 70, 700, 50, 380) + 0.16 * gauss2(x, y, 960 - 70, 700, 50, 380); // paraspinals
    // restrictions: asymmetric, uneven — they relax as the hands work
    h += tension * (0.55 * gauss2(x, y, P[0] + sway, P[1] + 20, 75, 55) + 0.35 * gauss2(x, y, 1010, 640, 40, 90) + 0.3 * gauss2(x, y, P2[0], P2[1] + 30, 60, 70));
    h += tension * 0.05 * noise3(x / 60, y / 60, 2);
    return h;
  };
}

function drawBack(g, t, alpha) {
  g.save();
  g.globalAlpha = alpha;
  // plaster-toned sculptural form: not a portrait, a surface
  path(g, BACK, true);
  const gr = g.createLinearGradient(480, 300, 1440, 1000);
  gr.addColorStop(0, '#d8cdbd');
  gr.addColorStop(0.55, '#b9ab98');
  gr.addColorStop(1, '#7d6f60');
  g.fillStyle = gr;
  g.fill();
  g.save();
  path(g, BACK, true);
  g.clip();
  // soft form shading: spine groove, scapular shadows
  const shade = (x, y, rx, ry, a) => {
    const r = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    r.addColorStop(0, rgba('#3b2f26', a));
    r.addColorStop(1, rgba('#3b2f26', 0));
    g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y);
    g.fillStyle = r; g.fillRect(x - 2 * Math.max(rx, ry), y - 2 * Math.max(rx, ry), 4 * Math.max(rx, ry), 4 * Math.max(rx, ry));
    g.restore();
  };
  shade(960, 760, 40, 520, 0.28);
  shade(960 + 250, 700, 70, 170, 0.18);
  shade(960 - 250, 700, 70, 170, 0.18);
  shade(960, 1100, 600, 260, 0.35);
  g.restore();
  g.restore();
}

function interior(g, t) {
  const r = seg(t, B.reveal[0], B.reveal[1], ease.house) * 250 * (1 - seg(t, 4.2, 5.2, ease.inOutCubic));
  if (r <= 1) return;
  g.save();
  g.beginPath();
  g.arc(P[0] - 60, P[1] + 90, r, 0, TAU);
  g.clip();
  g.fillStyle = rgba('#241b16', 0.78);
  g.fillRect(0, 0, W, H);
  // posterior thorax: spinous processes, ribs, right scapula
  for (let i = 0; i < 12; i++) {
    const y = 360 + i * 44;
    stroke(g, [[948, y], [972, y]], C.bone, 9, 0.9);
    const rib = bez([975, y + 8, 1080, y - 10, 1200, y + 10, 1320, y + 70], 16);
    stroke(g, rib, C.bone, 5, 0.55);
  }
  const scap = bez([1040, 430, 1150, 400, 1260, 410, 1270, 430, 1250, 560, 1200, 700, 1160, 760, 1120, 640, 1060, 520, 1040, 430], 10);
  path(g, scap, true); g.fillStyle = rgba(C.bone, 0.25); g.fill();
  stroke(g, scap, C.bone, 2.2, 0.9, true);
  stroke(g, bez([1050, 470, 1120, 455, 1200, 450, 1285, 430], 10), C.bone, 5, 0.9); // spine of scapula
  // trapezius fibres, then fascia: layered
  const mp = seg(t, B.reveal[0] + 0.4, B.reveal[1] + 0.3);
  for (let k = 0; k < 26; k++) {
    const y0 = 300 + k * 18;
    strokePart(g, bez([965, y0, 1030, y0 + 10, 1160, 430 + k * 2, 1290, 440 + k * 1.5], 12), 0, mp, C.muscle, 2.2, 0.75);
  }
  const fp = seg(t, B.reveal[0] + 0.9, B.reveal[1] + 0.8);
  g.globalAlpha = fp * 0.6;
  for (let k = -12; k < 12; k++) {
    g.beginPath();
    for (let y = 250; y < 900; y += 14) {
      const x = P[0] - 60 + k * 26 + Math.sin(y * 0.02 + k) * 10 + Math.sin(y * 0.05 + t) * 3;
      if (y === 250) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.strokeStyle = C.fascia; g.lineWidth = 0.9; g.stroke();
  }
  g.restore();
  // ring + layer labels
  g.save();
  g.strokeStyle = rgba(C.lamp, 0.6); g.lineWidth = 1.2;
  g.beginPath(); g.arc(P[0] - 60, P[1] + 90, r, 0, TAU); g.stroke();
  g.restore();
  ['BONE', 'MUSCLE', 'FASCIA', 'MOTION'].forEach((w, i) => {
    const a = env(t, 2.1 + i * 0.4, 2.5 + i * 0.4, 4.0, 4.6);
    const ang = -0.9 + i * 0.32;
    caps(g, w, P[0] - 60 + Math.cos(ang) * (r + 40), P[1] + 90 + Math.sin(ang) * (r + 40), { size: 14, color: C.lamp, tracking: 0.4, align: 'left', alpha: a });
  });
}

function contourLayer(g, t) {
  const cp = seg(t, B.contours[0], B.contours[1], ease.inOutSine);
  if (cp <= 0) return;
  const f = field(t);
  const grid = sampleGrid(480, 250, 1440, 1100, 110, 98, f);
  let lo = Infinity, hi = -Infinity;
  for (const v of grid.g) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  g.save();
  path(g, BACK, true);
  g.clip();
  g.beginPath();
  g.arc(P[0] - 60, P[1] + 90, cp * 1100, 0, TAU);
  g.clip();
  const n = 26;
  for (let k = 1; k < n; k++) {
    const lv = lerp(-1.1, 0.75, k / n);
    const segs = contourSegments(grid, lv);
    g.strokeStyle = k % 5 === 0 ? '#2a1e17' : rgba('#3a2b22', 0.85);
    g.lineWidth = k % 5 === 0 ? 2.2 : 1.3;
    g.beginPath();
    for (let i = 0; i < segs.length; i += 4) {
      g.moveTo(480 + segs[i] * 960, 250 + segs[i + 1] * 850);
      g.lineTo(480 + segs[i + 2] * 960, 250 + segs[i + 3] * 850);
    }
    g.stroke();
  }
  g.restore();
  void lo; void hi;
}

function practitionerHand(g, wrist, ang, s, alpha, mirror = false) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  const forearm = [wrist[0] - Math.cos(ang) * 520, wrist[1] - Math.sin(ang) * 520];
  g.shadowColor = rgba('#000000', 0.45); g.shadowBlur = 40; g.shadowOffsetY = 18;
  // the forearm emerges from shadow rather than from the frame edge
  const fg = g.createLinearGradient(wrist[0], wrist[1], forearm[0], forearm[1]);
  fg.addColorStop(0, '#211a16'); fg.addColorStop(0.55, rgba('#211a16', 0.85)); fg.addColorStop(1, rgba('#211a16', 0));
  g.fillStyle = fg;
  limb(g, forearm, wrist, s * 1.05, s * 0.66);
  hand(g, wrist[0], wrist[1], s, ang, { curl: 0.12, spread: 0.3, fill: '#211a16', mirror, thumb: 0.25 });
  g.restore();
  g.save();
  g.globalAlpha = alpha * 0.55;
  g.strokeStyle = C.lamp; g.lineWidth = 1.2;
  g.beginPath(); g.moveTo(forearm[0], forearm[1] - s * 0.45); g.lineTo(wrist[0], wrist[1] - s * 0.35); g.stroke();
  g.restore();
}

// the tubing: a contour that lifts away
const TUBE = spline([[1110, 520], [1230, 560], [1400, 700], [1700, 760], [2100, 700], [2600, 560]], 14);

export default {
  draw(g, t) {
    fill(g, C.umber);
    const pan = seg(t, B.tube[0] + 0.3, B.tube[1], ease.inOutCubic);
    g.save();
    g.translate(-pan * 900, 0);
    const backA = seg(t, B.back[0], B.back[1]) * (1 - pan * 0.8);
    // warm key light from upper left
    const key = g.createRadialGradient(700, 300, 50, 700, 300, 1200);
    key.addColorStop(0, rgba('#5a4636', 0.9));
    key.addColorStop(1, rgba(C.umber, 0));
    g.fillStyle = key;
    g.fillRect(-500, -200, 3000, 1500);
    // subtle sidebend as motion is tested
    const sb = Math.sin(seg(t, B.settle[0], B.settle[1]) * TAU) * 0.012;
    const close = kf(t, [[0, 1.42], [11, 1.3, ease.linear]]);
    g.translate(960, 1100); g.rotate(sb); g.scale(close, close); g.translate(-960, -1100 + 40);
    drawBack(g, t, backA);
    contourLayer(g, t);
    interior(g, t);
    // hands: one arrives, listens; the second joins; they move with the tissue
    const h1 = seg(t, B.contact - 0.8, B.contact, ease.outCubic);
    const slide = seg(t, B.settle[0], B.settle[1], ease.inOutSine);
    const w1 = [lerp(1420, 1250, h1) + slide * -25, lerp(760, 560, h1) + slide * 60];
    practitionerHand(g, w1, -2.25, 165, h1 * (1 - pan));
    const h2 = seg(t, B.second - 0.8, B.second, ease.outCubic);
    const w2 = [lerp(520, 700, h2) + slide * 18, lerp(900, 700, h2) + slide * 40];
    practitionerHand(g, w2, -0.95, 165, h2 * (1 - pan), true);
    // contact bloom
    glow(g, P[0], P[1], 140, C.lamp, env(t, B.contact - 0.05, B.contact + 0.2, B.contact + 0.3, B.contact + 1.4) * 0.5);
    // the contour lifts away, thickening into tubing
    const tp = seg(t, B.tube[0], B.tube[0] + 1.5, ease.inOutSine);
    if (tp > 0) {
      const thick = seg(t, B.tube[0] + 0.5, B.tube[0] + 1.6);
      const end = strokePart(g, TUBE, 0, tp, '#1c1512', 2 + thick * 20, 1);
      if (thick > 0) strokePart(g, TUBE.map(([x, y]) => [x - 3, y - 5]), 0, tp, rgba('#ffffff', 0.16), 4 * thick, 1);
      void end;
    }
    g.restore();
    // the first tenet, set small
    const wa = seg(t, B.words[0], B.words[0] + 1.2);
    const wq = seg(t, B.words[1] - 0.5, B.words[1]);
    reveal(g, 'The body is a unit.', 170, 980, { size: 58, family: FONT.serif, italic: true, color: C.bone, align: 'left', p: wa, q: wq, stagger: 0.3, tracking: 0.01 });
    caps(g, 'STRUCTURE  ·  FUNCTION', 175, 1030, { size: 13, color: C.dust, tracking: 0.5, align: 'left', alpha: seg(t, B.words[0] + 0.8, B.words[0] + 1.6) * (1 - wq) });
    void kf; void taper; void font;
    return { dark: 1 };
  },
};
