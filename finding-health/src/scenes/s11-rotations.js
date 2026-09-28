// SEQUENCE 11 — ROTATIONS
// Who is the person in front of me? An endless corridor. Each door we pass opens onto a
// different way of seeing: generations, systems, smaller scale, precise geometry,
// new life, conversation, organized intensity. Mentors' hands demonstrate; the student
// tries, gets it wrong, gets it right, and keeps walking.
import { W, H, TAU, clamp, lerp, seg, ease, env, pulse, beat, bez, spline, hash1, noise2 } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, stroke, strokePart, circle, glow, path, layer, wobble } from '../lib/draw.js';
import { corridor, doorQuad, project, FLOOR_Y } from '../lib/corridor.js';
import { backFigure, drawFigure, standPose, sitPose, walkPose, hand, limb } from '../lib/figure.js';
import { caps, font, reveal } from '../lib/type.js';
import { ecg, heart, kidney, lungOutline, cell } from '../lib/anatomy.js';

const SPEC = [
  { id: 'fm', label: 'FAMILY MEDICINE' },
  { id: 'im', label: 'INTERNAL MEDICINE' },
  { id: 'peds', label: 'PEDIATRICS' },
  { id: 'surg', label: 'SURGERY' },
  { id: 'wh', label: "WOMEN'S HEALTH" },
  { id: 'psych', label: 'PSYCHIATRY' },
  { id: 'em', label: 'EMERGENCY MEDICINE' },
];
const T0 = 0.9, STEP = 1.95, SHOW = 1.55, SPEED = 1.35;
export const B = { enter: [0, T0], ...Object.fromEntries(SPEC.map((s, i) => [s.id, T0 + i * STEP])) };

export const cues = [
  { t: 0, type: 'footsteps', dur: 15, gain: 0.35 },
  { t: 0, type: 'hallAmbience', dur: 15, gain: 0.5 },
  ...SPEC.map((s, i) => ({ t: T0 + i * STEP - 0.05, type: 'doorSwing', gain: 0.5 })),
  { t: B.fm + 0.3, type: 'voices', dur: 1.2, gain: 0.4 },
  ...Array.from({ length: 5 }, (_, i) => ({ t: B.im + 0.2 + i * 0.25, type: 'blip', pitch: 67 + i, gain: 0.3 })),
  { t: B.peds + 0.2, type: 'chime', dur: 1.2 },
  { t: B.surg + 0.1, type: 'instrument' }, { t: B.surg + 0.9, type: 'erase' },
  ...Array.from({ length: 4 }, (_, i) => ({ t: B.wh + 0.15 + i * 0.42, type: 'dopplerBeat' })),
  { t: B.psych + 0.2, type: 'voices', dur: 1.3, gain: 0.3 },
  ...Array.from({ length: 8 }, (_, i) => ({ t: B.em + 0.1 + i * 0.19, type: 'monitorBeep', gain: 0.35 })),
];

const doorZ = (i) => (T0 + i * STEP) * SPEED + 1.15;
const DOORS = [];
for (let i = 0; i < 7; i++) DOORS.push({ z: doorZ(i), side: i % 2 ? -1 : 1, label: SPEC[i].label });
for (let k = 0; k < 18; k++) DOORS.push({ z: 0.6 + k * 1.45 + 0.35, side: k % 2 ? 1 : -1, label: null, alpha: 0.9 });

function orderQuad(q) {
  const s = q.slice().sort((a, b) => a[1] - b[1]);
  const top = s.slice(0, 2).sort((a, b) => a[0] - b[0]), bot = s.slice(2).sort((a, b) => a[0] - b[0]);
  return [top[0], top[1], bot[1], bot[0]];
}

// ---------------------------------------------------------------- specialty worlds
function fm(g, lt) {
  fill(g, '#e9d9b8');
  glow(g, 1300, 300, 900, '#fff1d0', 0.6);
  const floor = 900;
  stroke(g, [[0, floor], [W, floor]], C.graphite, 1.5, 0.6);
  // three generations, one continuous line through them
  const s = seg(lt, 0, 0.8, ease.outCubic);
  drawFigure(g, standPose({ lean: 0.12, headTilt: 0.2 }), 700, floor, 600, { color: '#4b3f35', alpha: s });
  stroke(g, [[700 + 0.2 * 600, floor - 0.5 * 600], [700 + 0.26 * 600, floor]], '#4b3f35', 7, s); // cane
  drawFigure(g, standPose({ reach: 0.3, reachY: -0.52 }), 960, floor, 700, { color: '#3a3029', alpha: s, dir: -1 });
  drawFigure(g, standPose({ reach: 0.7, reachY: -0.6 }), 1150, floor, 390, { color: '#2e2621', alpha: s, dir: -1 });
  const line = spline([[80, 560], [500, 520], [760, 600], [960, 470], [1160, 620], [1500, 540], [1850, 560]], 12);
  strokePart(g, line, 0, seg(lt, 0.2, 1.2, ease.inOutSine), C.vermilion, 2.5, 0.9);
  ['1948', '1979', '2016'].forEach((y, i) => caps(g, y, [700, 960, 1150][i], 1000, { size: 16, color: C.graphite, tracking: 0.3, alpha: seg(lt, 0.4 + i * 0.1, 0.8 + i * 0.1) }));
}

function im(g, lt, t) {
  fill(g, '#1f2a2e');
  const nodes = [[640, 380], [960, 300], [1280, 380], [560, 660], [960, 720], [1360, 660], [800, 520], [1120, 520]];
  const rot = lt * 0.15;
  const P = nodes.map(([x, y]) => [960 + (x - 960) * Math.cos(rot) - (y - 540) * Math.sin(rot) * 0.4, 540 + (y - 540) + (x - 960) * Math.sin(rot) * 0.15]);
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if ((i * 7 + j * 3) % 3 !== 0) stroke(g, [P[i], P[j]], C.dust, 1, 0.35 * seg(lt, 0.1 + (i + j) * 0.03, 0.6 + (i + j) * 0.03));
  heart(g, ...P[1], 0.4, pulse(t, 80, 0) * 0.8, { line: C.lamp });
  kidney(g, ...P[3], 0.5, { line: C.bone, fill: '#6a3b33' });
  kidney(g, ...P[5], 0.5, { line: C.bone, fill: '#6a3b33' });
  g.save(); g.translate(...P[4]); g.scale(0.35, 0.35);
  for (const s of [-1, 1]) stroke(g, lungOutline(s, 1), C.lamp, 5, 1, true);
  g.restore();
  cell(g, ...P[0], 55, t, 3, { line: C.bone });
  cell(g, ...P[2], 55, t, 9, { line: C.bone });
  ['Cr 1.8', 'BNP 910', 'HbA1c 9.2', 'K+ 5.6', 'Hgb 9.1'].forEach((v, i) => {
    font(g, FONT.mono, 22); g.fillStyle = rgba(C.lamp, seg(lt, 0.3 + i * 0.12, 0.6 + i * 0.12) * 0.9);
    g.fillText(v, 150, 780 + i * 34);
  });
}

function peds(g, lt) {
  fill(g, '#f3e7da');
  // growth chart: percentile curves, the scale gets smaller and warmer
  const cols = ['#e8b4a0', '#e6c79a', '#9dc3b3', '#e6c79a', '#e8b4a0'];
  [5, 25, 50, 75, 95].forEach((p, i) => {
    const pts = [];
    for (let x = 0; x <= 1; x += 0.02) pts.push([300 + x * 1320, 880 - (Math.log(1 + x * 8) / Math.log(9)) * (420 + (i - 2) * 70) - x * 60]);
    strokePart(g, pts, 0, seg(lt, 0.05 + i * 0.05, 0.9 + i * 0.05, ease.inOutSine), cols[i], 5, 0.9);
    caps(g, `${p}TH`, 1640, pts[pts.length - 1][1], { size: 13, color: C.graphite, align: 'left', tracking: 0.2, alpha: seg(lt, 0.8, 1.1) });
  });
  for (let k = 0; k < 6; k++) circle(g, 300 + (k / 5) * 1100, 880 - (Math.log(1 + (k / 5) * 8) / Math.log(9)) * 430 - (k / 5) * 60 + 10, 9, { fill: C.vermilion, alpha: seg(lt, 0.4 + k * 0.1, 0.5 + k * 0.1) });
  // a child on the exam table, shoes swinging; a parent's hand on their back
  const floor = 900;
  g.fillStyle = '#d9cbb8'; g.fillRect(1250, floor - 260, 420, 40);
  g.fillStyle = '#c8b9a4'; g.fillRect(1280, floor - 220, 360, 220);
  const sw = Math.sin(lt * 5.5) * 0.9;
  const kid = sitPose({ lean: 0.02, headTilt: -0.1, hands: 'knees', seatH: 0.62, feet: 'dangle', swing: sw });
  drawFigure(g, kid, 1400, floor - 60, 340, { color: '#6d8f89', dir: 1 });
  drawFigure(g, standPose({ reach: 0.55, reachY: -0.62 }), 1230, floor, 640, { color: '#8a7563', dir: 1, alpha: 0.85 });
}

function surg(g, lt) {
  fill(g, '#1d3533');
  // precise grid, crosshair
  g.strokeStyle = rgba('#9fd0c4', 0.12); g.lineWidth = 1;
  for (let x = 0; x < W; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  stroke(g, [[960, 120], [960, 960]], rgba('#9fd0c4', 0.35), 1);
  stroke(g, [[240, 540], [1680, 540]], rgba('#9fd0c4', 0.35), 1);
  // instruments laid out, aligned
  const inst = (x, kind) => {
    g.save(); g.translate(x, 180); g.fillStyle = '#c9d6d2';
    if (kind === 0) { g.fillRect(-4, 0, 8, 160); g.beginPath(); g.moveTo(-4, 160); g.lineTo(6, 160); g.lineTo(0, 200); g.fill(); }
    if (kind === 1) { for (const s of [-1, 1]) { g.save(); g.rotate(s * 0.05); g.fillRect(-3 + s * 4, 0, 6, 200); g.restore(); } }
    if (kind === 2) { g.fillRect(-3, 40, 6, 160); circle(g, -10, 20, 14, { stroke: '#c9d6d2', width: 4 }); circle(g, 10, 20, 14, { stroke: '#c9d6d2', width: 4 }); }
    g.restore();
  };
  [0, 1, 2, 1].forEach((k, i) => inst(1380 + i * 70, k));
  // the incision and sutures: first try wobbles, is removed, then done cleanly
  stroke(g, [[560, 640], [1160, 640]], C.vermilion, 3, 0.9);
  const first = seg(lt, 0.1, 0.7), erase = seg(lt, 0.75, 0.95), second = seg(lt, 0.95, 1.5);
  for (let i = 0; i < 8; i++) {
    const x = 600 + i * 72;
    const pts1 = wobble([[x - 8, 612], [x + 14, 668]], 7, 0.5, i * 3.1);
    if (first > i / 8 && erase < 1) stroke(g, pts1, '#eae4d6', 2.5, 1 - erase);
    if (second > i / 8) stroke(g, [[x - 6, 614], [x + 6, 666]], '#eae4d6', 2.5, 1);
  }
  // mentor's hand guiding the student's hand
  const hx = lerp(620, 1150, lt < 0.95 ? seg(lt, 0.1, 0.7) : seg(lt, 0.95, 1.5)), hy = 640;
  hand(g, hx + 60, hy - 50, 175, -2.2, { curl: 0.3, spread: 0.15, fill: '#e3dccc', thumb: 0.5 });
  g.save(); g.globalAlpha = seg(lt, 0.9, 1.1) * 0.9;
  hand(g, hx + 130, hy - 130, 200, -2.1, { curl: 0.25, spread: 0.2, fill: '#86a8a0', thumb: 0.5 });
  g.restore();
  caps(g, lt < 0.95 ? 'AGAIN' : 'GOOD', 960, 900, { size: 16, color: '#9fd0c4', tracking: 0.6, alpha: env(lt, 0.7, 0.8, 0.9, 0.95) + env(lt, 1.35, 1.45, 1.6, 1.7) });
}

function wh(g, lt, t) {
  fill(g, '#3b2126');
  for (let k = 0; k < 7; k++) {
    const r = ((lt * 120 + k * 90) % 630);
    circle(g, 960, 520, r, { stroke: '#e6a3bb', width: 1.5, alpha: 0.4 * (1 - r / 630) });
  }
  // a curled form, respectfully abstract, with a fast bright heartbeat
  const spine = [];
  for (let i = 0; i <= 60; i++) { const a = -0.4 + (i / 60) * 4.4; spine.push([960 + Math.cos(a) * 130, 520 + Math.sin(a) * 150]); }
  stroke(g, spine, '#e6a3bb', 70, 0.18);
  stroke(g, spine, '#f2c6d3', 2, 0.9);
  circle(g, 960 + 150, 400, 70, { stroke: '#f2c6d3', width: 2 });
  circle(g, 990, 540, 12 + pulse(t, 140, 0, 10) * 8, { fill: C.vermilion });
  // fetal Doppler: ~140 bpm
  const pts = [];
  for (let x = 0; x < 900; x += 3) {
    const tt = t - (900 - x) / 500;
    const { ph } = beat(tt, 140, 0);
    pts.push([510 + x, 900 - Math.exp(-(((ph - 0.2) / 0.05) ** 2)) * 70 * (0.8 + 0.2 * Math.sin(tt * 40))]);
  }
  stroke(g, pts, '#f2c6d3', 2, 0.9);
  font(g, FONT.mono, 22); g.fillStyle = '#f2c6d3'; g.fillText('FHR 142', 1440, 905);
}

function psych(g, lt, t) {
  fill(g, '#2a2a38');
  glow(g, 960, 460, 700, '#6b6a8a', 0.35);
  const floor = 860;
  const a = sitPose({ lean: 0.06, headTilt: 0.1 + Math.sin(t * 0.8) * 0.05, hands: 'lap' });
  const b = sitPose({ lean: 0.04, headTilt: -0.05, hands: 'knees' });
  drawFigure(g, a, 700, floor, 520, { color: '#151421', dir: 1 });
  drawFigure(g, b, 1220, floor, 520, { color: '#151421', dir: -1, coat: 1, coatColor: '#c9c6d6' });
  // what is said, and what is heard: slow waves in the space between
  for (let k = 0; k < 4; k++) {
    const pts = [];
    for (let x = 820; x <= 1100; x += 4) pts.push([x, 520 + k * 22 + Math.sin(x * 0.03 + t * (1 + k * 0.3)) * (6 + k * 3) * Math.sin(((x - 820) / 280) * Math.PI)]);
    stroke(g, pts, '#b8b6d6', 1.5, 0.5 * seg(lt, 0.1 + k * 0.1, 0.6 + k * 0.1));
  }
  // thought, drifting: faint neural threads
  for (let k = 0; k < 9; k++) {
    const x0 = 520 + hash1(k) * 880, y0 = 180 + hash1(k + 9) * 180;
    const pts = [];
    for (let i = 0; i < 20; i++) pts.push([x0 + i * 14, y0 + noise2(i * 0.2 + k, t * 0.3) * 30]);
    stroke(g, pts, '#8a88b0', 1, 0.35);
    circle(g, x0, y0, 3, { fill: '#b8b6d6', alpha: 0.6 });
  }
}

function em(g, lt, t) {
  fill(g, '#0c0b0a');
  const flash = env(lt, 0, 0.05, 0.1, 0.3);
  if (flash > 0) { g.fillStyle = rgba('#c4462e', 0.25 * flash); g.fillRect(0, 0, W, H); }
  // the monitor: several traces, fast
  const rows = [['II', C.gold, (ph) => ecg(ph)], ['SpO2', '#7fd1c7', (ph) => Math.max(0, Math.sin(ph * Math.PI * 2 - 0.8)) ** 2], ['ART', C.vermilion, (ph) => Math.exp(-(((ph - 0.25) / 0.08) ** 2)) + 0.3 * Math.exp(-(((ph - 0.45) / 0.05) ** 2))]];
  rows.forEach(([name, col, fn], r) => {
    const y0 = 300 + r * 200, pts = [];
    for (let x = 0; x < 1300; x += 3) {
      const tt = t - (1300 - x) / 700;
      pts.push([180 + x, y0 - fn(beat(tt, 128, 0).ph) * 90]);
    }
    stroke(g, pts, col, 2.5, 0.95);
    font(g, FONT.mono, 22); g.fillStyle = col; g.fillText(name, 180, y0 - 110);
  });
  font(g, FONT.mono, 76); g.fillStyle = C.gold; g.textAlign = 'right';
  g.fillText('128', 1760, 330);
  g.fillStyle = '#7fd1c7'; g.fillText('91', 1760, 530);
  g.fillStyle = C.vermilion; g.font = `400 56px ${FONT.mono}`; g.fillText('88/54', 1760, 730);
  g.textAlign = 'left';
  // organized intensity: tasks checked off in rhythm
  ['airway', 'IV access x2', 'fluids', 'labs', 'ECG', 'reassess'].forEach((s, i) => {
    const p = seg(lt, 0.15 + i * 0.18, 0.25 + i * 0.18);
    font(g, FONT.mono, 20); g.fillStyle = rgba(C.bone, 0.3 + 0.6 * p);
    g.fillText(`${p >= 1 ? '[x]' : '[ ]'} ${s}`, 180 + i * 250, 960);
  });
}

const WORLDS = { fm, im, peds, surg, wh, psych, em };

export default {
  draw(g, t) {
    const cz = t * SPEED;
    fill(g, '#2a2520');
    corridor(g, cz, DOORS, { light: 1 });
    // the student walks ahead of us; mentors pass
    const sz = cz + 2.6;
    const [fx, fy] = project(0.15, FLOOR_Y, sz - cz);
    const hgt = (1.75 * 520) / (sz - cz);
    drawFigure(g, walkPose(t * 1.05), fx, fy, hgt, { color: '#151210', coat: 1, coatColor: '#efe9dd', dir: 1, alpha: 0 });
    backFigure(g, fx, fy + Math.abs(Math.sin(t * 6.6)) * -3, hgt, { color: '#151210', coat: 1, coatColor: '#efe9dd' });
    // each door floods the frame with its world
    SPEC.forEach((s, i) => {
      const t0 = T0 + i * STEP;
      const inP = seg(t, t0 - 0.05, t0 + 0.4, ease.inOutCubic);
      const outP = seg(t, t0 + SHOW - 0.3, t0 + SHOW, ease.inOutCubic);
      if (inP <= 0 || outP >= 1) return;
      const d = DOORS[i];
      const dq = orderQuad(doorQuad(d, cz));
      const full = [[0, 0], [W, 0], [W, H], [0, H]];
      const k = inP * (1 - outP);
      const clipQ = dq.map((p, j) => [lerp(p[0], full[j][0], k), lerp(p[1], full[j][1], k)]);
      const { c, g: lg } = layer('spec', g.canvas.width, g.canvas.height);
      lg.setTransform(g.getTransform());
      WORLDS[s.id](lg, t - t0, t);
      caps(lg, s.label, 960, 90, { size: 18, color: s.id === 'fm' || s.id === 'peds' ? C.graphite : C.bone, tracking: 0.6 });
      g.save();
      path(g, clipQ, true);
      g.clip();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(c, 0, 0);
      g.restore();
    });
    void TAU; void clamp; void bez; void limb; void reveal; void circle;
    return { dark: 0.5 };
  },
};
