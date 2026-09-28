// SEQUENCE 17 — FINAL REVEAL
// Out through the door into daylight, and the camera keeps rising: campus, Lewisburg,
// West Virginia, Appalachia at night — the contour field from the first seconds. One
// contour moves. It is a heartbeat. FINDING HEALTH. Then the institution, last.
import { W, H, TAU, clamp, lerp, seg, ease, kf, env, beat, pulse } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, withCam, stroke, glow, circle } from '../lib/draw.js';
import { campus, DOOR, GROUND } from '../lib/campus.js';
import { backFigure } from '../lib/figure.js';
import { reliefMap, LEWISBURG_XY } from './s10-statewide.js';
import { ridgelines, sampleGrid, contourSet, drawContours } from '../lib/terrain.js';
import { ecg } from '../lib/anatomy.js';
import { reveal, caps, font } from '../lib/type.js';

export const B = {
  day: [0, 1.4],
  rise: [1.0, 3.8],
  night: [3.4, 5.2],
  ridges: [4.8, 7.2],
  beat: [6.8, 8.2],
  title: [8.0, 10.2],
  lines: [9.6, 12.4],
  logo: [12.6, 15],
};

export const cues = [
  { t: 0.0, type: 'airOpen', dur: 1.2, gain: 0.5 },
  { t: 1.0, type: 'rise', dur: 3.0 },
  { t: 4.8, type: 'swell', dur: 2.5, gain: 0.6 },
  { t: 7.25, type: 'heartbeat', gain: 1.0 },
  { t: 7.3, type: 'monitorBeep', gain: 0.5 },
  { t: 8.1, type: 'titleHit', gain: 0.7 },
  { t: 12.6, type: 'resolve', dur: 2.4 },
];

let CONT, LOGO = null;
async function init() {
  const grid = sampleGrid(0, 0, 4.8, 2.7, 260, 146);
  const levels = []; for (let l = 0.08; l < 0.95; l += 0.035) levels.push(l);
  CONT = contourSet(grid, levels);
  // Official logo: only if an approved file has been placed in assets/brand/. Never redrawn.
  for (const f of ['assets/brand/wvsom-logo.svg', 'assets/brand/wvsom-logo.png']) {
    try {
      const r = await fetch(f, { method: 'HEAD' });
      if (!r.ok) continue;
      const img = new Image();
      img.src = f;
      await img.decode();
      LOGO = img;
      break;
    } catch { /* not present */ }
  }
}

function dayCampus(g, t, a) {
  if (a <= 0) return;
  g.save();
  g.globalAlpha = a;
  fill(g, C.paper);
  campus(g, { draw: 1, line: C.graphite, ground: C.paper, door: 1, outward: true, lightColor: '#fff3dc' });
  // the graduate, now small, stepping out and away
  const wp = seg(t, 0, 1.6, ease.outSine);
  backFigure(g, 960, lerp(GROUND + 6, GROUND + 40, wp), lerp(200, 230, wp), { color: '#0d0b0a', gown: 1, hood: 1 });
  g.restore();
}

function nightContours(g, t, a) {
  if (a <= 0) return;
  g.save();
  g.globalAlpha = a;
  drawContours(g, CONT, 0, 0, W, H, (lv, k) => ({ color: k % 5 === 0 ? C.bone : C.dust, width: k % 5 === 0 ? 1.3 : 0.8, alpha: k % 5 === 0 ? 0.55 : 0.28 }));
  g.restore();
}

function nightRidges(g, t, a, calm) {
  if (a <= 0) return;
  g.save();
  g.globalAlpha = a;
  const z = 0.3 + (t - B.ridges[0]) * 0.12;
  ridgelines(g, { x: 0.1, z, h: 0.78, horizon: 330, f: 980 }, {
    rows: 70, dz: 0.05, width: 3.4, samples: 160, amp: 0.62, ground: C.night, line: C.bone, lineWidth: 1.1,
    alphaFn: (d, rz) => Math.min(1, (1 - d) * 1.5) * Math.min(1, (rz - 0.08) * 5) * 0.9 * (1 - calm * 0.75),
  });
  g.restore();
}

function heartLine(g, t, a) {
  if (a <= 0) return;
  // one contour line across the valley: flat, then a single beat travels it
  const y0 = 700;
  const k = seg(t, B.beat[0] + 0.3, B.beat[1], ease.inOutSine);
  const center = lerp(-200, W + 200, k);
  const pts = [];
  for (let x = 0; x <= W; x += 3) {
    const u = (x - center) / 420 + 0.225;
    const v = u > 0 && u < 1 ? ecg(u) : 0;
    pts.push([x, y0 - v * 180 * seg(t, B.beat[0], B.beat[0] + 0.4)]);
  }
  stroke(g, pts, C.lamp, 2.4, a);
  glow(g, center, y0 - 20, 160, C.vermilion, a * 0.25 * env(k, 0.1, 0.3, 0.7, 0.9));
}

function logoCard(g, t) {
  const a = seg(t, B.logo[0], B.logo[0] + 0.9, ease.inOutSine);
  if (a <= 0) return;
  g.save();
  g.globalAlpha = a;
  fill(g, C.night);
  const box = { w: 560, h: 300 };
  if (LOGO) {
    const s = Math.min(box.w / LOGO.naturalWidth, box.h / LOGO.naturalHeight);
    const w = LOGO.naturalWidth * s, h = LOGO.naturalHeight * s;
    g.drawImage(LOGO, 960 - w / 2, 540 - h / 2, w, h);
  } else {
    // PLACEHOLDER — replace by adding the approved file to assets/brand/ (see README).
    g.setLineDash([10, 8]);
    g.strokeStyle = rgba(C.dust, 0.8); g.lineWidth = 1.5;
    g.strokeRect(960 - box.w / 2, 540 - box.h / 2, box.w, box.h);
    g.setLineDash([]);
    caps(g, 'WVSOM OFFICIAL LOGO', 960, 525, { size: 20, color: C.bone, tracking: 0.4 });
    caps(g, 'PLACEHOLDER  ·  assets/brand/wvsom-logo.svg', 960, 565, { size: 13, color: C.dust, tracking: 0.2, family: FONT.mono, weight: 400 });
  }
  g.restore();
}

export default {
  init,
  draw(g, t) {
    fill(g, C.night);
    // 1. daylight → rising → the state
    const rise = seg(t, B.rise[0], B.rise[1], ease.inOutCubic);
    const L = LEWISBURG_XY;
    if (t < B.night[1]) {
      g.save();
      const nightK = seg(t, B.night[0], B.night[1], ease.inOutSine);
      // relief map with the campus sitting at Lewisburg, pulling back
      const z = lerp(30, 1, ease.inOutExpo(rise));
      withCam(g, { x: lerp(L[0], 960, rise), y: lerp(L[1], 540, rise), z }, () => {
        fill(g, C.paper);
        reliefMap(g, seg(t, B.rise[0], B.rise[0] + 0.8));
        g.save();
        g.translate(L[0], L[1]);
        g.scale(1 / 30, 1 / 30);
        g.translate(-960, -600);
        dayCampus(g, t, 1 - seg(t, B.rise[0] + 0.3, B.rise[0] + 0.9));
        g.restore();
      });
      if (nightK > 0) { g.fillStyle = rgba(C.night, nightK); g.fillRect(0, 0, W, H); }
      g.restore();
      const flash = 1 - seg(t, 0, 0.8);
      if (flash > 0) { g.fillStyle = rgba('#fff3dc', flash); g.fillRect(0, 0, W, H); }
    }
    // 2. Appalachia at night: contours, then ridges — the first image of the film
    nightContours(g, t, env(t, B.night[0] + 0.6, B.night[1], B.ridges[0], B.ridges[0] + 0.8));
    const calm = seg(t, B.beat[0], B.beat[0] + 0.8);
    nightRidges(g, t, seg(t, B.ridges[0], B.ridges[0] + 0.8) * (1 - seg(t, B.logo[0] - 0.4, B.logo[0] + 0.4)), calm);
    // 3. one line moves: a heartbeat
    heartLine(g, t, seg(t, B.beat[0], B.beat[0] + 0.4) * (1 - seg(t, B.logo[0] - 0.4, B.logo[0] + 0.3)));
    // 4. words
    const tq = seg(t, B.logo[0] - 0.6, B.logo[0]);
    reveal(g, 'FINDING HEALTH', 960, 470, { size: 168, color: C.light, tracking: 0.1, p: seg(t, B.title[0], B.title[0] + 1.4), q: tq, stagger: 0.45 });
    ['IN OURSELVES.', 'IN OUR PATIENTS.', 'IN THE COMMUNITIES WE SERVE.'].forEach((s, i) => {
      const t0 = B.lines[0] + i * 0.75;
      caps(g, s, 960, 565 + i * 52, { size: 26, color: C.bone, tracking: 0.4, alpha: seg(t, t0, t0 + 0.7) * (1 - tq), weight: 400 });
    });
    // 5. the institution
    logoCard(g, t);
    void TAU; void clamp; void kf; void beat; void pulse; void circle; void font; void DOOR;
    return { dark: t > 1 ? 1 : 0 };
  },
};
