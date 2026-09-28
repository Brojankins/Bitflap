// SEQUENCE 13 — FOURTH YEAR / CHOICE
// What kind of physician am I going to become? The road's vanishing point becomes the
// corridor's. Most doors quietly disappear; a few remain. Applications, interviews, names
// of places. The map widens from West Virginia to the country — possibility, not an exit.
// Everything collapses into one clean page, which folds into an envelope.
import { W, H, TAU, clamp, lerp, seg, ease, kf, env, rng, bez, hash1 } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, stroke, strokePart, circle, glow, path, withCam } from '../lib/draw.js';
import { corridor, project, FLOOR_Y } from '../lib/corridor.js';
import { backFigure, drawFigure, standPose } from '../lib/figure.js';
import { WV_OUTLINE, US_OUTLINE, US_PLACES, WV_TOWNS, projector, LEWISBURG } from '../lib/geo.js';
import { caps, font, reveal } from '../lib/type.js';

export const B = {
  road: [0, 0.8],
  doors: [0.8, 3.0],
  fragments: [2.4, 5.2],
  map: [4.4, 6.8],
  collapse: [6.6, 7.6],
  fold: [7.8, 9],
};

export const cues = [
  { t: 0.2, type: 'hallAmbience', dur: 3, gain: 0.4 },
  ...Array.from({ length: 5 }, (_, i) => ({ t: 1.0 + i * 0.35, type: 'fadeTone', pitch: 72 - i * 2 })),
  { t: 2.6, type: 'keyboard', dur: 1.4 },
  { t: 3.4, type: 'paper', gain: 0.5 }, { t: 4.0, type: 'paper', gain: 0.4 },
  { t: 4.6, type: 'riser', dur: 2.0, gain: 0.6 },
  { t: 6.7, type: 'collapse' },
  { t: 7.9, type: 'paperFold' }, { t: 8.4, type: 'paperFold' },
];

const LABELS = ['FAMILY MEDICINE', 'INTERNAL MEDICINE', 'PEDIATRICS', 'SURGERY', "WOMEN'S HEALTH", 'PSYCHIATRY', 'EMERGENCY MEDICINE', 'NEUROLOGY', 'ANESTHESIOLOGY', 'RADIOLOGY', 'ORTHOPEDICS', 'PM&R'];
const KEEP = [1, 4, 8]; // doors that remain (deliberately unlabeled: the choice is theirs)
const DOORS = LABELS.map((l, i) => ({ z: 2.2 + Math.floor(i / 2) * 1.35 + (i % 2) * 0.6, side: i % 2 ? -1 : 1, label: null, i }));

const PLACES = ['Charleston', 'Morgantown', 'Huntington', 'Lewisburg', 'Pittsburgh', 'Columbus', 'Richmond', 'Philadelphia', 'Nashville', 'Denver', 'Seattle', 'Beckley', 'Roanoke', 'Chicago'];

function corridorPart(g, t, a) {
  if (a <= 0) return;
  g.save();
  g.globalAlpha = a;
  const cz = 0.2 + seg(t, 0, 3.4, ease.outCubic) * 0.9;
  const doors = DOORS.map((d) => {
    const fade = KEEP.includes(d.i) ? 1 : 1 - seg(t, B.doors[0] + (d.i % 7) * 0.28, B.doors[0] + 0.5 + (d.i % 7) * 0.28);
    return { ...d, alpha: fade, glow: KEEP.includes(d.i) ? '#ffe7b0' : '#f5e9cf' };
  });
  corridor(g, cz, doors, { wall: '#a79d8e', far: '#efe6d4', light: 0.9 });
  const sz = cz + 2.0;
  const [fx, fy] = project(0, FLOOR_Y, sz - cz);
  const hgt = (1.75 * 520) / (sz - cz);
  backFigure(g, fx, fy, hgt, { color: '#151210', coat: 1, coatColor: '#efe9dd' });
  g.restore();
}

function fragments(g, t, a) {
  if (a <= 0) return;
  const r = rng(1313);
  g.save();
  g.globalAlpha = a;
  // application pages and interview windows drift around the student
  for (let i = 0; i < 12; i++) {
    const t0 = B.fragments[0] + i * 0.14;
    const p = seg(t, t0, t0 + 0.7, ease.outCubic);
    if (p <= 0) { r.next(); r.next(); r.next(); continue; }
    const ang = r.range(0, TAU), rad = r.range(420, 760), kind = r.next() < 0.6 ? 'page' : 'window';
    const x = 960 + Math.cos(ang) * rad * 1.1 + Math.sin(t * 0.5 + i) * 10, y = 520 + Math.sin(ang) * rad * 0.55;
    g.save();
    g.translate(x, y + (1 - p) * 60);
    g.rotate(Math.sin(i * 7) * 0.12);
    g.globalAlpha *= p * 0.92;
    if (kind === 'page') {
      g.fillStyle = C.light; g.fillRect(-80, -104, 160, 208);
      for (let k = 0; k < 9; k++) { g.fillStyle = rgba(C.graphite, 0.35); g.fillRect(-60, -80 + k * 18, 120 * (0.5 + hash1(i * 20 + k) * 0.5), 3); }
    } else {
      g.fillStyle = '#26282a'; g.fillRect(-120, -72, 240, 144);
      g.fillStyle = '#3b3f43'; g.fillRect(-116, -68, 232, 136);
      g.save();
      g.beginPath(); g.rect(-116, -68, 232, 136); g.clip();
      backFigure(g, 0, 330, 440, { color: '#171717' }); // head and shoulders, on a call
      g.restore();
    }
    g.restore();
  }
  // names of places
  PLACES.forEach((n, i) => {
    const t0 = B.fragments[0] + 0.3 + i * 0.12;
    const p = env(t, t0, t0 + 0.4, B.collapse[0], B.collapse[0] + 0.3);
    const x = 200 + hash1(i * 5) * 1520, y = 120 + hash1(i * 9) * 840;
    font(g, FONT.serif, 30 + hash1(i * 3) * 30, 400, true);
    g.fillStyle = rgba(C.ink, 0.8 * p);
    g.fillText(n, x, y);
  });
  g.restore();
}

function mapPart(g, t, a) {
  if (a <= 0) return;
  const k = seg(t, B.map[0], B.map[1], ease.inOutCubic);
  // widen from the state to the country: interpolate projection scale
  const scale = lerp(250, 52, k);
  const lon0 = lerp(-80.2, -96, k), lat0 = lerp(38.85, 38.6, k);
  const P = projector(lon0, lat0, scale);
  g.save();
  g.globalAlpha = a;
  stroke(g, US_OUTLINE.map(P), C.graphite, 1.4, seg(k, 0.2, 0.6), true);
  path(g, WV_OUTLINE.map(P), true);
  g.fillStyle = rgba(C.ochre, 0.25); g.fill();
  stroke(g, WV_OUTLINE.map(P), C.graphite, 1.6, 1, true);
  const L = P(LEWISBURG);
  circle(g, L[0], L[1], 6, { fill: C.vermilion });
  // possibility: arcs to places near and far — including home
  const dests = [...WV_TOWNS.filter((x) => !x.home).slice(0, 6), ...US_PLACES];
  dests.forEach((d, i) => {
    const q = P(d.ll);
    const p = seg(t, B.map[0] + 0.3 + i * 0.05, B.map[0] + 1.0 + i * 0.05, ease.inOutSine);
    if (p <= 0) return;
    const mx = (L[0] + q[0]) / 2, my = (L[1] + q[1]) / 2 - Math.hypot(q[0] - L[0], q[1] - L[1]) * 0.25;
    strokePart(g, bez([L[0], L[1], mx, my, mx, my, q[0], q[1]], 20), 0, p, C.vermilion, 1.2, 0.6);
    circle(g, q[0], q[1], 3.5, { fill: C.ink, alpha: p });
  });
  g.restore();
}

function page(g, t) {
  const cp = seg(t, B.collapse[0], B.collapse[1], ease.outExpo);
  if (cp <= 0) return;
  const f1 = seg(t, B.fold[0], B.fold[0] + 0.45, ease.inOutCubic);
  const f2 = seg(t, B.fold[0] + 0.5, B.fold[0] + 0.95, ease.inOutCubic);
  const w = 520 * lerp(0.2, 1, cp), h = 680 * lerp(0.2, 1, cp);
  g.save();
  g.translate(960, 540);
  // fold 1: bottom third up; fold 2: top down — then it is an envelope
  const vis = h * (1 - f1 * 0.66 - f2 * 0.0);
  g.shadowColor = rgba('#000', 0.35); g.shadowBlur = 40; g.shadowOffsetY = 16;
  g.fillStyle = C.light;
  g.fillRect(-w / 2, -h / 2, w, vis * (1 - f2 * 0.3));
  g.shadowColor = 'transparent';
  if (f1 < 0.5) {
    reveal(g, 'RANK ORDER LIST', 0, -h / 2 + 90, { size: 32, family: FONT.sans, weight: 500, color: C.ink, tracking: 0.12, p: seg(t, B.collapse[0] + 0.2, B.collapse[0] + 0.8), stagger: 0.3 });
    for (let i = 0; i < 8; i++) {
      font(g, FONT.mono, 20); g.fillStyle = rgba(C.graphite, cp);
      g.fillText(`${i + 1}.`, -w / 2 + 60, -h / 2 + 170 + i * 56);
      g.fillStyle = rgba(C.graphite, 0.18 * cp);
      g.fillRect(-w / 2 + 110, -h / 2 + 162 + i * 56, (w - 180) * (0.45 + hash1(i * 4) * 0.5), 12);
    }
  }
  if (f1 > 0) {
    // the folding flap, foreshortened
    const fh = (h / 3) * Math.cos(f1 * Math.PI);
    g.fillStyle = f1 > 0.5 ? '#e7dfcf' : C.light;
    g.fillRect(-w / 2, -h / 2 + vis - Math.max(0, -fh), w, Math.abs(fh));
  }
  if (f2 > 0) {
    // envelope flap
    g.fillStyle = '#e2d8c5';
    g.beginPath();
    g.moveTo(-w / 2, -h / 2);
    g.lineTo(0, -h / 2 + (vis * 0.55) * f2);
    g.lineTo(w / 2, -h / 2);
    g.closePath(); g.fill();
    g.strokeStyle = rgba(C.graphite, 0.4); g.lineWidth = 1.5; g.stroke();
  }
  g.restore();
}

export default {
  draw(g, t) {
    fill(g, '#1a1714');
    // the road becomes the corridor: same vanishing point
    const roadA = 1 - seg(t, B.road[0], B.road[1]);
    corridorPart(g, t, (1 - seg(t, B.map[0], B.map[0] + 0.6)));
    if (roadA > 0) { g.fillStyle = rgba('#0c0f12', roadA); g.fillRect(0, 0, W, H); }
    const bgA = seg(t, B.map[0] - 0.2, B.map[0] + 0.5);
    if (bgA > 0) { g.fillStyle = rgba(C.paper, bgA); g.fillRect(0, 0, W, H); }
    fragments(g, t, 1 - seg(t, B.map[0] + 0.4, B.map[0] + 1.2));
    mapPart(g, t, seg(t, B.map[0], B.map[0] + 0.4) * (1 - seg(t, B.collapse[0], B.collapse[0] + 0.4)));
    const dk = seg(t, B.collapse[0], B.fold[1], ease.inOutSine);
    if (dk > 0) { g.fillStyle = rgba('#141110', dk * 0.95); g.fillRect(0, 0, W, H); }
    page(g, t);
    void kf; void withCam; void glow; void clamp;
    return { dark: t > B.collapse[0] ? 1 : 0 };
  },
};
