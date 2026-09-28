// Campus architecture: a collegiate facade drawn as elevation line work, and THE door —
// the film's recurring threshold. The same geometry opens inward on Day One and outward
// at graduation.
import { clamp, lerp, ease, invlerp } from './core.js';
import { C, rgba } from '../config/design.js';
import { strokePart, stroke } from './draw.js';

export const GROUND = 860;
export const DOOR = { x: 902, y: 690, w: 116, h: 170 }; // double door, centre x = 960

// Elevation line work, in drawing order. Each entry: points + relative start (0..1).
function lines() {
  const L = [];
  const add = (pts, s, w = 1.4) => L.push({ pts, s, w });
  add([[240, GROUND], [1680, GROUND]], 0.0, 1.6);
  // wings
  add([[470, GROUND], [470, 450], [800, 450]], 0.08);
  add([[1450, GROUND], [1450, 450], [1120, 450]], 0.08);
  add([[455, 450], [815, 450]], 0.2); add([[1105, 450], [1465, 450]], 0.2);
  add([[455, 438], [815, 438]], 0.22); add([[1105, 438], [1465, 438]], 0.22);
  // hipped wing roofs
  add([[455, 438], [500, 392], [815, 392]], 0.26); add([[1465, 438], [1420, 392], [1105, 392]], 0.26);
  // central pavilion
  add([[800, GROUND], [800, 330], [1120, 330], [1120, GROUND]], 0.14, 1.6);
  add([[785, 330], [1135, 330]], 0.3, 1.6);
  add([[785, 318], [960, 238], [1135, 318], [785, 318]], 0.34, 1.6); // pediment
  add([[840, 306], [960, 252], [1080, 306], [840, 306]], 0.42, 1);
  // pilasters
  for (const x of [818, 872, 1048, 1102]) add([[x, GROUND], [x, 342]], 0.36, 1.1);
  // cupola
  add([[930, 238], [930, 196], [990, 196], [990, 238]], 0.46);
  add([[922, 196], [960, 160], [998, 196]], 0.5);
  add([[960, 160], [960, 132]], 0.54, 1);
  // string course + water table
  add([[470, 640], [800, 640]], 0.4, 0.9); add([[1120, 640], [1450, 640]], 0.4, 0.9);
  add([[470, 835], [1450, 835]], 0.44, 0.9);
  // steps
  for (let i = 0; i < 3; i++) add([[880 - i * 14, GROUND + 4 + i * 9], [1040 + i * 14, GROUND + 4 + i * 9]], 0.5 + i * 0.02, 1);
  // door frame + transom
  add([[DOOR.x - 12, GROUND], [DOOR.x - 12, DOOR.y - 12], [DOOR.x + DOOR.w + 12, DOOR.y - 12], [DOOR.x + DOOR.w + 12, GROUND]], 0.46, 1.5);
  add([[DOOR.x - 12, DOOR.y - 12], [960, DOOR.y - 58], [DOOR.x + DOOR.w + 12, DOOR.y - 12]], 0.5, 1.1);
  return L;
}
const LINES = lines();

// window grid
const WINDOWS = [];
for (const [x0, x1] of [[500, 780], [1140, 1420]]) {
  for (const [y0, y1] of [[486, 600], [676, 800]]) {
    const n = 5, gap = 16, w = (x1 - x0 - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) WINDOWS.push({ x: x0 + i * (w + gap), y: y0, w, h: y1 - y0 });
  }
}
for (const [x0, y0] of [[892, 380], [990, 380], [838, 480], [1040, 480], [838, 580], [1040, 580], [892, 480], [990, 480], [892, 580], [990, 580]]) WINDOWS.push({ x: x0, y: y0, w: 40, h: 74 });

/**
 * Draw campus. o.draw: 0..1 line-work progress. o.glow: window lamplight 0..1.
 * o.door: 0..1 opening. o.outward: door swings toward camera. o.light: interior light strength.
 */
export function campus(g, o = {}) {
  const { draw = 1, glow = 0, door = 0, outward = false, light = 1, line = C.bone, alpha = 1, lightColor = C.lamp, ground = C.night } = o;
  g.save();
  g.globalAlpha *= alpha;
  // windows
  WINDOWS.forEach((w, i) => {
    const p = clamp((draw - 0.55 - (i % 10) * 0.012) / 0.25);
    if (p <= 0) return;
    const gl = clamp(glow * 1.4 - ((i * 7) % 11) / 22);
    if (gl > 0) {
      g.fillStyle = rgba(lightColor, 0.75 * gl);
      g.fillRect(w.x, w.y, w.w, w.h);
    }
    g.strokeStyle = line;
    g.lineWidth = 1;
    g.globalAlpha *= p;
    g.strokeRect(w.x, w.y, w.w, w.h);
    g.beginPath();
    g.moveTo(w.x + w.w / 2, w.y); g.lineTo(w.x + w.w / 2, w.y + w.h);
    g.moveTo(w.x, w.y + w.h * 0.45); g.lineTo(w.x + w.w, w.y + w.h * 0.45);
    g.stroke();
    g.globalAlpha /= p;
  });
  for (const l of LINES) {
    const p = ease.outCubic(clamp((draw - l.s) / 0.35));
    if (p > 0) strokePart(g, l.pts, 0, p, line, l.w, 1);
  }
  // door + light
  const dp = clamp((draw - 0.5) / 0.3);
  if (dp > 0) doorway(g, door, { outward, light, line, alpha: dp, lightColor, ground });
  g.restore();
}

/** The door itself: two leaves, light spilling as it opens. */
export function doorway(g, open, { outward = false, light = 1, line = C.bone, alpha = 1, lightColor = C.lamp, ground = C.night } = {}) {
  const { x, y, w, h } = DOOR;
  const o = ease.inOutCubic(clamp(open));
  g.save();
  g.globalAlpha *= alpha;
  // interior light
  if (o > 0) {
    g.fillStyle = rgba(lightColor, 0.95 * light);
    g.fillRect(x, y, w, h);
    // spill on ground (trapezoid widening toward viewer)
    const gr = g.createLinearGradient(0, GROUND, 0, GROUND + 220);
    gr.addColorStop(0, rgba(lightColor, 0.55 * o * light));
    gr.addColorStop(1, rgba(lightColor, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x, GROUND); g.lineTo(x + w, GROUND);
    g.lineTo(x + w + 260 * o, GROUND + 220); g.lineTo(x - 260 * o, GROUND + 220);
    g.closePath();
    g.fill();
    // bloom
    const b = g.createRadialGradient(960, y + h * 0.6, 0, 960, y + h * 0.6, 320);
    b.addColorStop(0, rgba(lightColor, 0.35 * o * light));
    b.addColorStop(1, rgba(lightColor, 0));
    g.fillStyle = b;
    g.fillRect(960 - 320, y + h * 0.6 - 320, 640, 640);
  }
  // leaves: each hinges at its outer edge; perspective foreshortening as it swings
  const leafW = w / 2;
  for (const side of [-1, 1]) {
    const hingeX = side < 0 ? x : x + w;
    const vis = leafW * Math.cos(o * Math.PI * 0.48);
    const dir = outward ? -1 : 1; // inward: leaf narrows toward the hinge; outward: grows past frame
    const x0 = hingeX, x1 = hingeX - side * vis * (outward ? 1 : 1);
    const skew = (outward ? 26 : -10) * o;
    g.beginPath();
    g.moveTo(x0, y); g.lineTo(x1, y - skew * dir * 0.2 - (outward ? 18 * o : 0));
    g.lineTo(x1, y + h + (outward ? 18 * o : 0)); g.lineTo(x0, y + h);
    g.closePath();
    g.fillStyle = ground;
    g.fill();
    g.strokeStyle = line;
    g.lineWidth = 1.3;
    g.stroke();
    // panels
    const px0 = lerp(x0, x1, 0.2), px1 = lerp(x0, x1, 0.8);
    g.globalAlpha *= 0.6;
    g.strokeRect(Math.min(px0, px1), y + 18, Math.abs(px1 - px0), h * 0.36);
    g.strokeRect(Math.min(px0, px1), y + 30 + h * 0.4, Math.abs(px1 - px0), h * 0.4);
    g.globalAlpha /= 0.6;
  }
  g.restore();
  void invlerp; void stroke;
}
