// SEQUENCE 15 — RETURN TO LEWISBURG
// Paths from across the state and beyond converge, and we follow them home to the same
// facade and the same door from Day One. The person walking up to it is not the same:
// inside their silhouette, briefly, everything they carried — bone, heart, hands, roads,
// corridors, mountains, a patient, an ECG — like memory, not montage.
import { W, H, TAU, clamp, lerp, seg, ease, kf, env, bez, hash1, noise2, spline } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, stroke, strokePart, circle, glow, path, withCam, layer } from '../lib/draw.js';
import { US_OUTLINE, WV_OUTLINE, US_PLACES, WV_TOWNS, projector, LEWISBURG } from '../lib/geo.js';
import { campus, DOOR, GROUND } from '../lib/campus.js';
import { backFigure, BACK_OUTLINE, hand, drawFigure, sitPose } from '../lib/figure.js';
import { ecg, heart, longBone, lungOutline } from '../lib/anatomy.js';
import { ridgelines, height } from '../lib/terrain.js';

export const B = { converge: [0, 3.2], dive: [2.4, 4.4], campus: [3.8, 5.0], walk: [4.6, 9] };

export const cues = [
  { t: 0.0, type: 'swell', dur: 3.0, gain: 0.7 },
  { t: 3.2, type: 'whoosh', gain: 0.5 },
  { t: 4.6, type: 'footsteps', dur: 4.2, gain: 0.5 },
  { t: 5.5, type: 'memory', dur: 3.2 },
];

function converge(g, t, a) {
  if (a <= 0) return;
  const k = seg(t, B.dive[0], B.dive[1], ease.inExpo);
  const scale = lerp(52, 9000, k);
  const lon0 = lerp(-96, LEWISBURG[0], seg(t, 0.3, B.dive[0] + 0.4, ease.inOutCubic));
  const lat0 = lerp(38.6, LEWISBURG[1], seg(t, 0.3, B.dive[0] + 0.4, ease.inOutCubic));
  const P = projector(lon0, lat0, scale);
  g.save();
  g.globalAlpha = a;
  stroke(g, US_OUTLINE.map(P), C.bone, 1.2, 0.45 * (1 - k), true);
  stroke(g, WV_OUTLINE.map(P), C.bone, 1.4, 0.8, true);
  const L = P(LEWISBURG);
  const srcs = [...US_PLACES, ...WV_TOWNS.filter((x) => !x.home), { ll: [-100, 44] }, { ll: [-73, 41] }, { ll: [-90, 35] }];
  srcs.forEach((d, i) => {
    const q = P(d.ll);
    const p = seg(t, 0.1 + (i % 9) * 0.1, 1.6 + (i % 9) * 0.1, ease.inOutSine);
    const mx = (L[0] + q[0]) / 2, my = (L[1] + q[1]) / 2 - Math.hypot(q[0] - L[0], q[1] - L[1]) * 0.22;
    const arc = bez([q[0], q[1], mx, my, mx, my, L[0], L[1]], 30);
    strokePart(g, arc, Math.max(0, p - 0.35), p, C.gold, 2, 0.8);
    circle(g, q[0], q[1], 2.5, { fill: C.bone, alpha: 0.7 * (1 - p) });
  });
  glow(g, L[0], L[1], 60 + seg(t, 1.2, 3) * 80, C.gold, 0.8);
  g.restore();
}

// memories inside the silhouette: drawn in screen space, drifting upward
function memories(g, t, box) {
  const [x0, y0, w, h] = box;
  const d = (t - B.walk[0]) * 18;
  fill(g, '#2a211b');
  const cx = x0 + w / 2;
  // mountains and contours
  const rows = [];
  for (let r = 0; r < 14; r++) {
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push([x0 + (i / 40) * w, y0 + h * 0.2 + r * h * 0.035 - Math.abs(noise2(i * 0.15, r * 0.4)) * h * 0.06 - d * 0.2]);
    rows.push(pts);
  }
  rows.forEach((p, r) => stroke(g, p, C.bone, 1, 0.25 + r * 0.02));
  // an ECG across the chest
  const ecgPts = [];
  for (let i = 0; i <= 120; i++) ecgPts.push([x0 + (i / 120) * w, y0 + h * 0.45 - ecg((i / 60 + t * 1.1) % 1) * h * 0.05]);
  stroke(g, ecgPts, C.vermilion, 2, 0.8);
  // heart, bone, lungs, a hand, a corridor, a road, the state
  heart(g, cx + w * 0.12, y0 + h * 0.36 - d * 0.3, w / 900, 0, { alpha: 0.55, line: C.lamp });
  g.save(); g.globalAlpha = 0.5;
  longBone(g, [x0 + w * 0.1, y0 + h * 0.62 - d * 0.2], [x0 + w * 0.5, y0 + h * 0.7 - d * 0.2], w * 0.06, 1.6, { fillC: '#d8cbb3', ink: '#3a2e25' });
  g.restore();
  g.save(); g.translate(cx - w * 0.15, y0 + h * 0.3 - d * 0.25); g.scale(w / 1600, w / 1600);
  for (const s of [-1, 1]) stroke(g, lungOutline(s, 1), C.bone, 4, 0.5, true);
  g.restore();
  hand(g, x0 + w * 0.7, y0 + h * 0.66 - d * 0.35, w * 0.28, -2.4, { fill: rgba(C.lamp, 0.35), curl: 0.2 });
  const vp = [cx, y0 + h * 0.8 - d * 0.1];
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) stroke(g, [vp, [vp[0] + dx * w * 0.6, vp[1] + dy * h * 0.15]], C.dust, 1, 0.4);
  const P = projector(-80.2, 38.85, w * 0.12, cx, y0 + h * 0.16 - d * 0.4);
  stroke(g, WV_OUTLINE.map(P), C.lamp, 1.5, 0.6, true);
  drawFigure(g, sitPose({ hands: 'knees' }), x0 + w * 0.25, y0 + h * 0.95 - d * 0.15, h * 0.18, { color: rgba(C.bone, 0.4) });
}

export default {
  draw(g, t) {
    fill(g, C.night);
    converge(g, t, 1 - seg(t, B.campus[0], B.campus[0] + 0.6));
    // the campus at dusk, the same door
    const ca = seg(t, B.campus[0], B.campus[1]);
    if (ca > 0) {
      const z = kf(t, [[B.campus[0], 0.4], [B.campus[1] + 0.4, 1.02, ease.house], [9, 1.12, ease.linear]]);
      g.save();
      g.globalAlpha = ca;
      withCam(g, { x: 960, y: 560, z }, () => {
        campus(g, { draw: 1, glow: 0.6, door: 0, line: C.bone, lightColor: '#f3e3c2' });
        const wp = seg(t, B.walk[0], B.walk[1] - 0.4, ease.linear);
        const y = lerp(1250, GROUND + 6, ease.outQuad(wp));
        const h = lerp(760, 205, ease.outQuad(wp));
        const bob = Math.abs(Math.sin(wp * 9 * Math.PI)) * 5 * (1 - wp);
        backFigure(g, 960, y - bob, h, { color: '#060505' });
        // memory, inside the silhouette, most visible mid-walk
        const mA = env(wp, 0.04, 0.16, 0.6, 0.8);
        if (mA > 0) {
          const { c, g: lg } = layer('mem', g.canvas.width, g.canvas.height);
          lg.setTransform(g.getTransform());
          memories(lg, t, [960 - h * 0.17, y - bob - h, h * 0.34, h]);
          g.save();
          g.translate(960, y - bob); g.scale(h, h);
          path(g, BACK_OUTLINE, true);
          g.restore();
          g.save();
          g.clip();
          g.globalAlpha = mA;
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.drawImage(c, 0, 0);
          g.restore();
        }
      });
      g.restore();
    }
    void TAU; void clamp; void hash1; void spline; void ridgelines; void height; void DOOR; void FONT;
    return { dark: 1 };
  },
};
