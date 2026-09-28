// SEQUENCE 10 — STATEWIDE CAMPUS
// Start on the campus in Lewisburg and pull rapidly up: West Virginia as a relief map.
// Communities light up; routes grow out of Lewisburg like nerves — myelinated, with
// impulses leaping node to node. Then we travel them: ridges, small towns, clinics,
// morning light. Medical education is no longer one building.
import { W, H, TAU, clamp, lerp, seg, ease, kf, env, hash1, bez, pointAt, arcLengths, fbm } from '../lib/core.js';
import { C, FONT, rgba, mixHex } from '../config/design.js';
import { fill, withCam, stroke, strokePart, circle, glow, path, makeCanvas } from '../lib/draw.js';
import { height, ridgelines, sampleGrid, contourSet, drawContours } from '../lib/terrain.js';
import { WV_OUTLINE, WV_TOWNS, projector } from '../lib/geo.js';
import { campus } from '../lib/campus.js';
import { caps, font } from '../lib/type.js';

export const B = {
  pullup: [0, 1.6],
  towns: [1.2, 2.6],
  routes: [1.8, 4.2],
  fly: [4.2, 8.8],
  network: [8.6, 10.6],
  dive: [10.6, 12],
};

export const cues = [
  { t: 0.0, type: 'whoosh', gain: 0.8 },
  ...WV_TOWNS.slice(1).map((_, i) => ({ t: 1.3 + i * 0.09, type: 'blip', pitch: 64 + (i % 5) * 2, gain: 0.3 })),
  { t: 1.9, type: 'nerveSpark', dur: 2.2 },
  { t: 4.1, type: 'road', dur: 4.8 },
  { t: 8.6, type: 'riser', dur: 2.0 },
  { t: 10.8, type: 'whoosh', gain: 0.6 },
];

const P = projector(-80.2, 38.85, 250);
const OUT = WV_OUTLINE.map(P);
const LEW = P([-80.45, 37.8]);
let RELIEF, ROUTES;

function init() {
  // relief map: the same terrain as the opening, now wearing the state's outline
  const S = 0.5;
  const w = Math.round(W * S), h = Math.round(H * S);
  RELIEF = makeCanvas(w, h);
  const g = RELIEF.getContext('2d');
  const img = g.createImageData(w, h);
  const scaled = OUT.map(([x, y]) => [x * S, y * S]);
  g.save();
  const mask = makeCanvas(w, h).getContext('2d');
  path(mask, scaled, true); mask.fillStyle = '#fff'; mask.fill();
  const mdata = mask.getImageData(0, 0, w, h).data;
  const toT = (x, y) => [(x / w) * 4.8, (y / h) * 2.7];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (mdata[i + 3] < 10) continue;
      const [tx, ty] = toT(x, y);
      const e = 0.004;
      const h0 = height(tx, ty), hx = height(tx + e, ty), hy = height(tx, ty + e);
      const nx = (h0 - hx) / e * 0.02, ny = (h0 - hy) / e * 0.02;
      const shade = clamp(0.62 + nx * 0.9 + ny * 0.6, 0, 1);
      const base = [lerp(214, 176, h0), lerp(208, 170, h0), lerp(190, 142, h0)];
      const k = lerp(0.72, 1.12, shade);
      img.data[i] = Math.min(255, base[0] * k); img.data[i + 1] = Math.min(255, base[1] * k); img.data[i + 2] = Math.min(255, base[2] * k); img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  const grid = sampleGrid(0, 0, 4.8, 2.7, 240, 135);
  const levels = []; for (let l = 0.1; l < 0.95; l += 0.05) levels.push(l);
  drawContours(g, contourSet(grid, levels), 0, 0, w, h, (lv, k) => ({ color: '#6b5d4c', width: 0.5, alpha: k % 4 === 0 ? 0.45 : 0.2 }));
  g.restore();
  // routes out of Lewisburg
  ROUTES = WV_TOWNS.filter((t) => !t.home).map((town, i) => {
    const q = P(town.ll);
    const mx = (LEW[0] + q[0]) / 2, my = (LEW[1] + q[1]) / 2;
    const dx = q[0] - LEW[0], dy = q[1] - LEW[1], L = Math.hypot(dx, dy);
    const off = (hash1(i * 13) - 0.5) * 0.5 * L;
    const pts = bez([LEW[0], LEW[1], mx - (dy / L) * off, my + (dx / L) * off, mx - (dy / L) * off * 0.3, my + (dx / L) * off * 0.3, q[0], q[1]], 40);
    return { town, q, pts, L: arcLengths(pts), t0: B.routes[0] + (L / 900) * 0.8 + i * 0.05 };
  });
}

/** The state relief map (also used by the finale's pull-back). */
export function reliefMap(g, a) { relief(g, 0, a); }
export const LEWISBURG_XY = LEW;

function relief(g, t, a) {
  if (a <= 0) return;
  g.save();
  g.globalAlpha = a;
  g.shadowColor = rgba('#3a2a1a', 0.3); g.shadowBlur = 30; g.shadowOffsetY = 12;
  g.drawImage(RELIEF, 0, 0, W, H);
  g.shadowColor = 'transparent';
  stroke(g, OUT, C.graphite, 1.4, 0.9, true);
  g.restore();
}

function routes(g, t, a, allLit = 0) {
  if (a <= 0) return;
  g.save();
  g.globalAlpha = a;
  for (const r of ROUTES) {
    const p = seg(t, r.t0, r.t0 + 1.1, ease.inOutSine);
    if (p <= 0) continue;
    // myelin: sheathed segments with nodes between them
    g.save();
    g.setLineDash([20, 7]);
    strokePart(g, r.pts, 0, p, C.ochre, 6, 0.75, r.L);
    g.restore();
    strokePart(g, r.pts, 0, p, '#6b4a1c', 1.2, 0.8, r.L);
    // saltatory conduction: an impulse leaps node to node
    const total = r.L[r.L.length - 1];
    const nodes = Math.floor(total / 27);
    const step = Math.floor(t * 14 + hash1(r.town.name.length) * 20) % Math.max(1, nodes);
    const u = (step * 27) / total;
    if (u < p) {
      const q = pointAt(r.pts, u, r.L);
      glow(g, q.x, q.y, 22, C.gold, 0.9 + allLit * 0.1);
    }
  }
  g.restore();
}

function towns(g, t, a) {
  if (a <= 0) return;
  for (const [i, town] of WV_TOWNS.entries()) {
    const q = P(town.ll);
    const p = seg(t, B.towns[0] + i * 0.09, B.towns[0] + 0.4 + i * 0.09, ease.outBack);
    if (p <= 0) continue;
    circle(g, q[0], q[1], (town.home ? 9 : 6) * p, { fill: town.home ? C.vermilion : C.ink, alpha: a });
    circle(g, q[0], q[1], 16 + ((t * 0.7 + i * 0.1) % 1) * 22, { stroke: town.home ? C.vermilion : C.ink, width: 1, alpha: a * (1 - ((t * 0.7 + i * 0.1) % 1)) * 0.6 });
    caps(g, town.name.toUpperCase(), q[0] + 14, q[1] - 14, { size: 13, color: C.ink, align: 'left', tracking: 0.25, alpha: a * seg(p, 0.5, 1) * 0.85 });
  }
}

// ---- the flyover
const roadX = (z) => 0.36 * Math.sin(z * 0.9) + 0.14 * Math.sin(z * 2.3 + 1);
const valley = (x, z) => {
  const d = Math.abs(x - roadX(z));
  const k = clamp(d / 0.5);
  return height(x * 0.9 + 7, z * 0.9 + 3) * (0.1 + 0.9 * k * k * (3 - 2 * k));
};
const TOWNZ = [2.2, 3.6, 5.0, 6.6];
const TOWNNAMES = ['RAINELLE', 'SUMMERSVILLE', 'SUTTON', 'BUCKHANNON'];

function building(g, x, y, s, kind, lit) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = '#3c3a34';
  if (kind === 0) { g.beginPath(); g.moveTo(-10, 0); g.lineTo(-10, -12); g.lineTo(0, -20); g.lineTo(10, -12); g.lineTo(10, 0); g.closePath(); g.fill(); }
  else if (kind === 1) { g.fillRect(-6, -34, 12, 34); g.beginPath(); g.moveTo(-6, -34); g.lineTo(0, -48); g.lineTo(6, -34); g.fill(); g.fillRect(-14, -16, 28, 16); } // church
  else if (kind === 2) { g.fillRect(-2, -40, 4, 40); g.fillRect(8, -40, 3, 40); g.beginPath(); g.ellipse(3, -44, 12, 8, 0, 0, TAU); g.fill(); } // water tower
  else { g.fillRect(-26, -24, 52, 24); g.fillRect(-10, -32, 20, 8); } // clinic
  g.fillStyle = rgba(C.lamp, lit);
  if (kind === 0) g.fillRect(-4, -8, 4, 4);
  if (kind === 3) for (let i = 0; i < 5; i++) g.fillRect(-22 + i * 10, -16, 5, 5);
  g.restore();
}

function flyover(g, t, a) {
  if (a <= 0) return;
  const lt = t - B.fly[0];
  const z = 0.4 + lt * 0.55 + lt * lt * 0.02;
  const cam = { x: roadX(z + 0.6), z, h: 0.62, horizon: 360, f: 900 };
  g.save();
  g.globalAlpha = a;
  const sky = g.createLinearGradient(0, 0, 0, 420);
  sky.addColorStop(0, '#e7dccb'); sky.addColorStop(1, '#f5e7cc');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  glow(g, 1400, 330, 380, '#fff4d8', 0.7);
  let prev = null;
  ridgelines(g, cam, {
    rows: 70, dz: 0.06, width: 3.6, samples: 150, amp: 0.55, heightFn: valley, lineWidth: 1,
    groundFn: (d) => mixHex('#56624f', '#d8d3c1', Math.pow(d, 0.7)),
    lineFn: (d) => mixHex('#2f3a2e', '#b7b2a0', Math.pow(d, 0.7)),
    alphaFn: (d, rz) => Math.min(1, (rz - 0.06) * 6) * 0.8,
    onRow: (pts, wz, rz, d, proj) => {
      const p = proj(roadX(wz));
      if (prev) {
        g.save();
        g.strokeStyle = mixHex('#c9953f', '#e6d6b4', Math.pow(d, 0.7));
        g.lineWidth = Math.min(10, 0.8 + 1.6 / rz);
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(p.x, p.y); g.stroke();
        g.restore();
      }
      prev = p;
      TOWNZ.forEach((tz, i) => {
        if (Math.abs(wz - tz) < 0.03) {
          const s = Math.min(4, 1.1 / rz);
          for (let k = 0; k < 6; k++) {
            const side = k % 2 ? 1 : -1;
            const q = proj(roadX(wz) + side * (0.05 + k * 0.03));
            building(g, q.x, q.y + 2 * s, s, k === 1 ? 1 : k === 4 ? 2 : k === 2 ? 3 : 0, 0.8);
          }
          caps(g, TOWNNAMES[i], p.x, p.y - 70 * s, { size: Math.min(18, 11 * s + 6), color: '#2f3a2e', tracking: 0.35, alpha: Math.min(1, (rz - 0.1) * 3) * (1 - d) });
        }
      });
    },
  });
  // a car, ahead of us, the student
  const cz = z + 0.5;
  const rz = cz - z;
  const cx = W / 2 + ((roadX(cz) - cam.x) * cam.f) / rz;
  const cy = cam.horizon + ((cam.h - valley(roadX(cz), cz) * 0.55) * cam.f) / rz;
  glow(g, cx, cy - 4, 36, '#fff1c8', 0.9);
  circle(g, cx, cy - 4, 4, { fill: '#fff7e0' });
  g.restore();
}

export default {
  init,
  draw(g, t) {
    fill(g, C.paper);
    // 1. pull rapidly up from the campus
    const up = seg(t, B.pullup[0], B.pullup[1], ease.inOutExpo);
    const mapA = 1 - seg(t, B.fly[0] - 0.3, B.fly[0] + 0.3) + seg(t, B.network[0], B.network[0] + 0.5);
    const z = kf(t, [[0, 30], [B.pullup[1], 1.0, ease.inOutExpo], [B.fly[0], 1.3, ease.inOutSine], [B.network[0], 1.3], [B.network[0] + 0.8, 1.0, ease.house], [B.dive[0], 1.05], [B.dive[1], 9, ease.inCubic]]);
    const CHS = P([-81.63, 38.35]);
    const focus = t < B.dive[0] ? LEW : [lerp(LEW[0], CHS[0], seg(t, B.dive[0], B.dive[0] + 0.5, ease.inOutSine)), lerp(LEW[1], CHS[1], seg(t, B.dive[0], B.dive[0] + 0.5, ease.inOutSine))];
    const fx = lerp(focus[0], 960, seg(t, 0.4, B.pullup[1], ease.inOutSine) * (t < B.dive[0] ? 1 : 1 - seg(t, B.dive[0], B.dive[0] + 0.5)));
    const fy = lerp(focus[1], 540, seg(t, 0.4, B.pullup[1], ease.inOutSine) * (t < B.dive[0] ? 1 : 1 - seg(t, B.dive[0], B.dive[0] + 0.5)));
    withCam(g, { x: fx, y: fy, z }, () => {
      relief(g, t, clamp(mapA) * seg(t, 0.3, 1.0));
      // the campus, at the point where Lewisburg is
      const ca = 1 - seg(t, 0.5, 1.1);
      if (ca > 0) {
        g.save();
        g.translate(LEW[0], LEW[1]);
        g.scale(1 / 30, 1 / 30);
        g.translate(-960, -600);
        g.globalAlpha = ca;
        g.fillStyle = C.paper; g.fillRect(-4000, -4000, 10000, 10000);
        campus(g, { draw: 1, line: C.graphite, ground: C.paper });
        g.restore();
      }
      routes(g, t, clamp(mapA), seg(t, B.network[0], B.network[1]));
      towns(g, t, clamp(mapA));
    });
    // 2. travel the routes
    const flyA = env(t, B.fly[0] - 0.3, B.fly[0] + 0.4, B.fly[1] - 0.2, B.network[0] + 0.4);
    flyover(g, t, flyA);
    // 3. into a hospital: its light becomes the corridor
    const dv = seg(t, B.dive[0] + 0.3, B.dive[1] - 0.1, ease.inOutSine);
    if (dv > 0) { g.fillStyle = rgba('#e9e3d6', dv); g.fillRect(0, 0, W, H); }
    caps(g, 'STATEWIDE CAMPUS', 960, 1010, { size: 16, color: C.graphite, tracking: 0.7, alpha: env(t, 2.4, 3.0, 4.0, 4.4) });
    void fbm; void font; void TAU;
    return { dark: 0 };
  },
};
