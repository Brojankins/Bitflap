// Drawing primitives shared by every scene.
import { W, H, TAU, clamp, arcLengths, lerp, noise2 } from './core.js';
import { C, FONT, rgba } from '../config/design.js';

// ---------------------------------------------------------------- canvases
const pool = new Map();
/** Cached offscreen canvas by key (re-used every frame, cleared by caller). */
export function layer(key, w = W, h = H) {
  let c = pool.get(key);
  if (!c || c.width !== w || c.height !== h) {
    c = document.createElement('canvas');
    c.width = w; c.height = h;
    pool.set(key, c);
  }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  return { c, g };
}
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ---------------------------------------------------------------- camera
/**
 * Run fn with a 2D camera: world point (x,y) lands at screen (sx,sy) with zoom z and rotation r.
 */
export function withCam(g, cam, fn) {
  const { x = W / 2, y = H / 2, z = 1, r = 0, sx = W / 2, sy = H / 2 } = cam;
  g.save();
  g.translate(sx, sy);
  g.rotate(r);
  g.scale(z, z);
  g.translate(-x, -y);
  fn();
  g.restore();
}

export function fill(g, color) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = color;
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.restore();
}

// ---------------------------------------------------------------- paths
export function path(g, pts, closed = false) {
  g.beginPath();
  if (!pts.length) return;
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (closed) g.closePath();
}
export function stroke(g, pts, color, width = 1, alpha = 1, closed = false) {
  if (alpha <= 0.002 || pts.length < 2) return;
  g.save();
  g.globalAlpha *= alpha;
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  path(g, pts, closed);
  g.stroke();
  g.restore();
}
/** Stroke only the [u0,u1] fraction of a polyline — the "drawing itself" primitive. */
export function strokePart(g, pts, u0, u1, color, width = 1, alpha = 1, L) {
  if (u1 <= u0 || alpha <= 0.002 || pts.length < 2) return;
  L = L || arcLengths(pts);
  const total = L[L.length - 1];
  const d0 = clamp(u0) * total, d1 = clamp(u1) * total;
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = L[i - 1], b = L[i];
    if (b < d0) continue;
    if (a > d1) break;
    const p = pts[i - 1], q = pts[i];
    const t0 = clamp((d0 - a) / (b - a || 1)), t1 = clamp((d1 - a) / (b - a || 1));
    if (!out.length) out.push([lerp(p[0], q[0], t0), lerp(p[1], q[1], t0)]);
    out.push([lerp(p[0], q[0], t1), lerp(p[1], q[1], t1)]);
  }
  stroke(g, out, color, width, alpha);
  return out[out.length - 1];
}
/** Tapered stroke: width varies along the path (for fibres, tubing, nerves). */
export function taper(g, pts, w0, w1, color, alpha = 1) {
  if (pts.length < 2 || alpha <= 0) return;
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
    const w = lerp(w0, w1, i / (pts.length - 1)) / 2;
    left.push([pts[i][0] + Math.cos(ang) * w, pts[i][1] + Math.sin(ang) * w]);
    right.push([pts[i][0] - Math.cos(ang) * w, pts[i][1] - Math.sin(ang) * w]);
  }
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = color;
  path(g, [...left, ...right.reverse()], true);
  g.fill();
  g.restore();
}
/** A line with subtle hand tremor — pencil feel. */
export function wobble(pts, amp = 1.2, freq = 0.02, seed = 0) {
  return pts.map(([x, y], i) => [x + noise2(i * freq * 7 + seed, seed * 1.7) * amp, y + noise2(seed * 3.1, i * freq * 7 + seed) * amp]);
}

export function circle(g, x, y, r, { fill: f, stroke: s, width = 1, alpha = 1 } = {}) {
  if (alpha <= 0 || r <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  if (f) { g.fillStyle = f; g.fill(); }
  if (s) { g.strokeStyle = s; g.lineWidth = width; g.stroke(); }
  g.restore();
}

export function glow(g, x, y, r, color, alpha = 1) {
  if (alpha <= 0 || r <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  // color must be a #hex value
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(color, 1));
  gr.addColorStop(0.25, rgba(color, 0.35));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  g.restore();
}

/** Parallel hatching clipped to the current path set by clipFn. */
export function hatch(g, clipFn, { angle = -0.8, gap = 7, color = C.ink, width = 0.8, alpha = 0.5, box = [0, 0, W, H] } = {}) {
  g.save();
  clipFn();
  g.clip();
  g.globalAlpha *= alpha;
  g.strokeStyle = color;
  g.lineWidth = width;
  const [x0, y0, x1, y1] = box;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  g.beginPath();
  for (let d = -R; d <= R; d += gap) {
    const px = cx - sa * d, py = cy + ca * d;
    g.moveTo(px - ca * R, py - sa * R);
    g.lineTo(px + ca * R, py + sa * R);
  }
  g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- atlas callouts
/** Anatomical-atlas leader line with a small mono label; p animates it in. */
export function callout(g, x, y, tx, ty, text, p = 1, { color = C.ink, size = 16, align } = {}) {
  if (p <= 0) return;
  const lp = clamp(p * 1.6);
  const ex = lerp(x, tx, lp), ey = lerp(y, ty, lp);
  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = 1;
  g.globalAlpha *= 0.85;
  g.beginPath();
  g.arc(x, y, 2.6, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(ex, ey);
  const right = align ? align === 'left' : tx >= x;
  const tailLen = 26 * clamp(p * 2 - 0.4);
  g.lineTo(ex + (right ? tailLen : -tailLen), ey);
  g.stroke();
  const tp = clamp(p * 2 - 1);
  if (tp > 0) {
    g.font = `400 ${size}px ${FONT.mono}`;
    g.letterSpacing = '0.06em';
    g.textBaseline = 'middle';
    g.textAlign = right ? 'left' : 'right';
    const n = Math.ceil(text.length * tp);
    g.globalAlpha *= tp;
    g.fillText(text.slice(0, n), ex + (right ? tailLen + 8 : -tailLen - 8), ey + 1);
  }
  g.restore();
}

/** Registration crop marks — print vocabulary used to frame "plates". */
export function cropMarks(g, x, y, w, h, color = C.ink, alpha = 0.5, len = 18) {
  g.save();
  g.globalAlpha *= alpha;
  g.strokeStyle = color;
  g.lineWidth = 1;
  g.beginPath();
  for (const [cx, cy, dx, dy] of [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]]) {
    g.moveTo(cx + dx * 6, cy); g.lineTo(cx + dx * (6 + len), cy);
    g.moveTo(cx, cy + dy * 6); g.lineTo(cx, cy + dy * (6 + len));
  }
  g.stroke();
  g.restore();
}

/** Draw a closed polygon with fill and/or stroke. */
export function shape(g, pts, { fill: f, stroke: s, width = 1, alpha = 1 } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  path(g, pts, true);
  if (f) { g.fillStyle = f; g.fill(); }
  if (s) { g.strokeStyle = s; g.lineWidth = width; g.lineJoin = 'round'; g.stroke(); }
  g.restore();
}

export function linGrad(g, x0, y0, x1, y1, stops) {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}
