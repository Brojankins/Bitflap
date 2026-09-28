// SEQUENCE 1 — ORIGIN
// Black. A heartbeat. A point of light becomes a cell, divides, grows dendrites;
// the dendrites are a drainage basin; the basin is the Appalachian plateau. One
// contour becomes a road, the road finds West Virginia, then Lewisburg, then a door.
import { W, H, TAU, clamp, lerp, seg, ease, env, kf, pulse, rng, fbm } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, glow, withCam, strokePart, stroke, path } from '../lib/draw.js';
import { cell, branchTree, drawTree } from '../lib/anatomy.js';
import { sampleGrid, contourSet, drawContours, ridgelines, height } from '../lib/terrain.js';
import { WV_OUTLINE, projector, LEWISBURG } from '../lib/geo.js';
import { campus, DOOR, GROUND } from '../lib/campus.js';
import { backFigure } from '../lib/figure.js';
import { reveal, caps } from '../lib/type.js';

// ---- beats (seconds, local)
export const B = {
  firstBeat: 1.0, bpm: 60,
  cellIn: [1.4, 3.6],
  divide: [3.6, 6.4],
  dendrites: [5.4, 8.2],
  pullback: [6.6, 10.0],
  tilt: [9.2, 10.4],
  road: [10.0, 11.8],
  map: [11.4, 13.0],
  campus: [12.5, 14.4],
  walk: [13.2, 15.2],
  doors: [14.4, 15.4],
  dayOne: [15.15, 16],
};

export const cues = [
  ...Array.from({ length: 11 }, (_, i) => ({ t: B.firstBeat + i, type: 'heartbeat', gain: i < 2 ? 0.8 : 0.55 - i * 0.03 })),
  { t: 3.6, type: 'cellSplit' }, { t: 4.3, type: 'cellSplit' }, { t: 5.0, type: 'cellSplit' },
  { t: 9.3, type: 'swell' }, { t: 10.0, type: 'road' },
  { t: 12.8, type: 'pencil', dur: 1.8 }, { t: 13.3, type: 'footsteps', dur: 2 },
  { t: 14.45, type: 'doorLatch' }, { t: 14.7, type: 'doorOpen' }, { t: 14.8, type: 'titleHit' },
];

let GRID, CONTOURS, CELLS;
const MAP_REGION = [0, 0, 4.8, 2.7]; // world units covered by the contour map
const HOME = [2.38, 1.3]; // where the cell cluster sits in the map (a ridge saddle)

export function init() {
  GRID = sampleGrid(...MAP_REGION, 260, 146);
  const levels = [];
  for (let l = 0.08; l < 0.95; l += 0.035) levels.push(l);
  CONTOURS = contourSet(GRID, levels);
  // cell division tree: 16 leaves, positions by generation
  const r = rng(5);
  CELLS = [{ gen: 0, a: r.range(0, TAU) }];
  let prev = CELLS.slice();
  for (let gen = 1; gen <= 4; gen++) {
    const next = [];
    prev.forEach((p) => {
      const d = 120 * Math.pow(0.8, gen - 1);
      for (const s of [-1, 1]) next.push({ gen, parent: p, a: p.a + (gen % 2 ? 0 : Math.PI / 2) + r.range(-0.3, 0.3), s, d });
    });
    CELLS.push(...next);
    prev = next;
  }
}

function cellPos(c, level) {
  if (c.gen === 0) return [0, 0];
  const pp = cellPos(c.parent, level);
  const k = ease.inOutCubic(clamp(level - (c.gen - 1)));
  return [pp[0] + Math.cos(c.a) * c.s * c.d * k * 0.5, pp[1] + Math.sin(c.a) * c.s * c.d * k * 0.5];
}

// map world (terrain units) → screen at camera zoom around HOME
function mapToScreen(z) {
  const px = 400 * z; // pixels per world unit
  return { x: W / 2 - HOME[0] * px, y: H / 2 - HOME[1] * px, px };
}

function drawMicro(g, t) {
  const lp = pulse(t, B.bpm, B.firstBeat, 5);
  // pull-back zoom factor (1 → tiny)
  const zb = kf(t, [[B.pullback[0], 1], [B.pullback[1], 0.02, ease.inOutQuint]]);
  const microA = 1 - seg(t, 7.6, 9.2);
  if (microA <= 0) return;
  g.save();
  g.globalAlpha = microA;
  g.translate(W / 2, H / 2);
  g.scale(zb, zb);
  // first light
  const lightA = seg(t, B.firstBeat - 0.05, B.firstBeat + 0.25);
  const cr = kf(t, [[B.cellIn[0], 2], [B.cellIn[1], 150, ease.outCubic]]);
  glow(g, 0, 0, 60 + lp * 50 + cr * 0.8, C.lamp, lightA * (0.5 + lp * 0.5) * (1 - seg(t, 4, 6) * 0.6));
  if (t < B.cellIn[0] + 0.1) {
    g.fillStyle = C.light;
    g.beginPath(); g.arc(0, 0, 2.5 + lp * 2.5, 0, TAU); g.fill();
  }
  // cells
  const level = kf(t, [[B.divide[0], 0], [B.divide[1], 4, ease.linear]]);
  const shown = CELLS.filter((c) => c.gen === Math.min(4, Math.floor(level + 1e-6)) || (level >= 4 && c.gen === 4));
  const gen = Math.min(4, Math.floor(level));
  const frac = level - gen;
  const list = level >= 4 ? CELLS.filter((c) => c.gen === 4) : CELLS.filter((c) => c.gen === gen + 1);
  void shown;
  const rad = cr * Math.pow(0.74, level);
  list.forEach((c, i) => {
    const p = cellPos(c, level);
    const pinch = level < 4 ? Math.sin(frac * Math.PI) * 0.12 : 0;
    cell(g, p[0], p[1], rad * (1 - pinch), t + i, i + 3, { line: C.bone, lw: 1.4 / Math.max(zb, 0.2), alpha: seg(t, B.cellIn[0], B.cellIn[0] + 0.6) });
    // dendrites
    const dg = seg(t, B.dendrites[0] + (i % 5) * 0.12, B.dendrites[1]);
    if (dg > 0) {
      const tree = c.tree || (c.tree = branchTree(100 + i, 0, 0, Math.atan2(p[1], p[0]) + 0.3, 70, 4, { spread: 0.7, shrink: 0.7, jitter: 0.7, curve: 0.5, widthRoot: 2.2 }));
      g.save();
      g.translate(p[0], p[1]);
      drawTree(g, tree, dg, C.bone, { alpha: 0.85, widthScale: 1 / Math.max(zb, 0.25) * 0.8, minW: 0.8 });
      g.restore();
    }
  });
  g.restore();
}

function drawContourWorld(g, t, zoom, alpha) {
  if (alpha <= 0) return;
  const m = mapToScreen(zoom);
  const w = (MAP_REGION[2] - MAP_REGION[0]) * m.px, h = (MAP_REGION[3] - MAP_REGION[1]) * m.px;
  const beatR = ((t - B.firstBeat) % 1) * 1300; // heartbeat ring radius in px
  g.save();
  g.globalAlpha = alpha;
  drawContours(g, CONTOURS, m.x, m.y, w, h, (lv, k) => ({
    color: k % 5 === 0 ? C.bone : C.dust,
    width: k % 5 === 0 ? 1.3 : 0.8,
    alpha: (k % 5 === 0 ? 0.55 : 0.28),
  }));
  // pulse ring: brighten contours inside an expanding annulus
  g.save();
  g.beginPath();
  g.arc(W / 2, H / 2, beatR + 60, 0, TAU);
  g.arc(W / 2, H / 2, Math.max(0, beatR - 40), 0, TAU, true);
  g.clip();
  drawContours(g, CONTOURS, m.x, m.y, w, h, (lv, k) => ({ color: C.lamp, width: 1.6, alpha: 0.7 * (1 - beatR / 1300) }));
  g.restore();
  g.restore();
}

// road through the ridges (world x as a function of world z)
const roadX = (z) => 0.32 * Math.sin(z * 1.1) + 0.12 * Math.sin(z * 2.7 + 1);
// the road runs in a valley it carved: flatten terrain near it
const valley = (x, z) => {
  const d = Math.abs(x - roadX(z));
  const k = clamp(d / 0.45);
  return height(x, z) * (0.12 + 0.88 * k * k * (3 - 2 * k));
};

function drawRidges(g, t, alpha) {
  if (alpha <= 0) return;
  // accelerating forward motion
  const z = 0.5 * seg(t, B.tilt[0], B.road[1], ease.inQuad) * 5 + 0.3;
  const cam = { x: roadX(z + 0.5), z, h: 0.78 - seg(t, 11, 12) * 0.0, horizon: 330, f: 980 };
  let prev = null;
  const rp = seg(t, B.road[0] - 0.3, B.road[0] + 0.6);
  g.save();
  g.globalAlpha = alpha;
  ridgelines(g, cam, {
    rows: 72, dz: 0.05, width: 3.4, samples: 160, amp: 0.62, ground: C.night, line: C.bone, lineWidth: 1.15, heightFn: valley,
    alphaFn: (d, rz) => Math.min(1, (1 - d) * 1.5) * Math.min(1, (rz - 0.08) * 5) * 0.9,
    onRow: (pts, wz, rz, d, proj) => {
      const p = proj(roadX(wz));
      if (prev && rp > 0) {
        g.save();
        g.strokeStyle = C.ochre;
        g.globalAlpha *= rp * Math.min(1, (1 - d) * 2);
        g.lineWidth = Math.min(9, 1.2 + 1.4 / rz);
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(prev.x, prev.y); g.lineTo(p.x, p.y); g.stroke();
        g.restore();
      }
      prev = p;
    },
  });
  g.restore();
}

function drawMap(g, t, alpha) {
  if (alpha <= 0) return;
  const zoomIn = seg(t, 12.3, 13.3, ease.inCubic);
  const proj0 = projector(-80.2, 38.85, 250);
  const L = proj0(LEWISBURG);
  const zz = 1 + zoomIn * 14;
  const outline = WV_OUTLINE.map(proj0);
  g.save();
  g.globalAlpha = alpha;
  withCam(g, { x: lerp(960, L[0], zoomIn), y: lerp(540, L[1], zoomIn), z: zz }, () => {
    // terrain texture inside the state
    g.save();
    path(g, outline, true);
    g.clip();
    drawContours(g, CONTOURS, 300, 60, 1300, 980, (lv, k) => ({ color: C.dust, width: 0.7 / zz, alpha: 0.28 }));
    g.restore();
    strokePart(g, outline, 0, seg(t, B.map[0], B.map[0] + 1.0, ease.inOutCubic), C.bone, 1.6 / zz, 1);
    // the road continues from the bottom of frame to Lewisburg
    const road = [[L[0] + 120, 1100], [L[0] + 90, 980], [L[0] + 30, 880], [L[0] + 15, L[1] + 40], L];
    strokePart(g, road, 0, seg(t, B.map[0], B.map[0] + 0.8), C.ochre, 3 / zz, 1);
    const lp = pulse(t, B.bpm, B.firstBeat, 4);
    g.fillStyle = C.lamp;
    g.globalAlpha = alpha * seg(t, 12.0, 12.3);
    g.beginPath(); g.arc(L[0], L[1], (4 + lp * 3) / zz, 0, TAU); g.fill();
    g.strokeStyle = C.lamp; g.lineWidth = 1 / zz;
    g.beginPath(); g.arc(L[0], L[1], (10 + ((t % 1) * 30)) / zz, 0, TAU);
    g.globalAlpha *= 1 - (t % 1); g.stroke();
  });
  g.restore();
  const ta = env(t, 11.9, 12.3, 12.6, 12.9);
  caps(g, 'WEST VIRGINIA', 960, 120, { size: 20, color: C.bone, alpha: ta * alpha, tracking: 0.6 });
  caps(g, 'LEWISBURG', L[0] + 26, L[1] - 2, { size: 14, color: C.lamp, alpha: ta * alpha, align: 'left', tracking: 0.3 });
}

function drawCampus(g, t, alpha) {
  if (alpha <= 0) return;
  const dp = seg(t, B.campus[0], 13.9, ease.outSine);
  const push = seg(t, 14.85, 15.45, ease.inOutSine);
  const z = kf(t, [[B.campus[0], 0.08], [13.6, 1.0, ease.outQuint], [14.4, 1.04], [15.3, 9, ease.inQuint], [16, 11, ease.outCubic]]);
  const doorCx = DOOR.x + DOOR.w / 2, doorCy = DOOR.y + DOOR.h * 0.55;
  g.save();
  g.globalAlpha = alpha;
  withCam(g, { x: lerp(960, doorCx, seg(t, 14.2, 15.3, ease.inOutSine)), y: lerp(560, doorCy, seg(t, 14.2, 15.3, ease.inOutSine)), z }, () => {
    campus(g, { draw: dp, glow: seg(t, 13.6, 14.6) * 0.5, door: seg(t, B.doors[0], B.doors[1]), light: 1, lightColor: '#f3e3c2' });
    // student walks up from camera toward the door (back view)
    const wp = seg(t, B.walk[0], B.walk[1], ease.linear);
    if (wp > 0) {
      const y = lerp(1180, GROUND + 6, ease.outQuad(wp));
      const h = lerp(640, 205, ease.outQuad(wp));
      const bob = Math.abs(Math.sin(wp * 9 * Math.PI)) * 5 * (1 - wp);
      backFigure(g, 960 + Math.sin(wp * 9 * Math.PI) * 3, y - bob, h, { color: '#060505', bag: 1, rim: rgba(C.lamp, 0.35 * seg(t, 14.5, 15)) });
    }
  });
  // the doorway's light becomes the page of the next scene
  if (push > 0) {
    g.globalCompositeOperation = 'screen';
    g.fillStyle = rgba('#f3e3c2', push);
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
  // DAY ONE — set in ink on the arriving light
  const dayP = seg(t, B.dayOne[0], B.dayOne[0] + 1.0);
  reveal(g, 'DAY ONE', 960, 600, { size: 200, color: C.ink, tracking: 0.06, p: dayP, stagger: 0.45 });
}

export default {
  init,
  draw(g, t) {
    fill(g, C.night);
    const contourA = seg(t, 6.8, 8.4) * (1 - seg(t, B.tilt[0], B.tilt[1]));
    const zoom = kf(t, [[6.6, 5.5], [10.4, 0.8, ease.outCubic]]);
    // top-down contours tilt away as the ridgelines rise
    if (contourA > 0) {
      g.save();
      const tl = seg(t, B.tilt[0], B.tilt[1], ease.inCubic);
      g.translate(W / 2, H / 2);
      g.scale(1, 1 - tl * 0.6);
      g.translate(-W / 2, -H / 2 - tl * 200);
      drawContourWorld(g, t, zoom, contourA);
      g.restore();
    }
    drawMicro(g, t);
    const ridgeA = seg(t, B.tilt[0] + 0.2, B.tilt[1] + 0.3) * (1 - seg(t, 11.5, 12.0));
    drawRidges(g, t, ridgeA);
    drawMap(g, t, seg(t, 11.4, 11.9) * (1 - seg(t, 12.8, 13.3)));
    drawCampus(g, t, seg(t, 12.6, 13.0));
    return { dark: t > 15.2 ? 0.2 : 1 };
  },
};

void fbm; void height; void stroke; void FONT; void lerp;
