// Appalachian terrain: a ridge-and-valley heightfield (long NE–SW folded ridges
// grading into a dendritically dissected plateau), contour extraction, and a
// perspective ridgeline renderer.
import { clamp, fbm, noise3, lerp } from './core.js';

const RA = -0.62; // ridge axis angle (NE–SW)
const CA = Math.cos(RA), SA = Math.sin(RA);

/** Height in [0,1] at world coords (x,y). Units ≈ one "map tile". */
export function height(x, y) {
  const u = x * CA + y * SA;
  const v = -x * SA + y * CA;
  const warp = fbm(u * 0.5, v * 0.5, 4) * 3.4 + fbm(u * 2.1, v * 2.1, 2) * 0.5;
  const folds = 1 - Math.abs(Math.sin(v * 4.6 + warp));
  const ridge = Math.pow(folds, 2.2) * (0.65 + 0.35 * noise3(u * 0.9, v * 0.2, 3.1));
  const plateau = fbm(x * 1.7 + 11, y * 1.7 - 4, 5) * 0.5 + 0.5;
  // east/west gradient: folded ridges in the east, dissected plateau in the west
  const k = clamp(0.42 + 0.35 * Math.sin(x * 0.4 + 0.7) + 0.25 * noise3(x * 0.3, y * 0.3, 8));
  return clamp(lerp(plateau * 0.8, ridge * 0.85 + plateau * 0.25, k));
}

/** Sample the heightfield into a grid. */
export function sampleGrid(x0, y0, x1, y1, nx, ny, fn = height) {
  const g = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) g[j * nx + i] = fn(lerp(x0, x1, i / (nx - 1)), lerp(y0, y1, j / (ny - 1)));
  return { g, nx, ny, x0, y0, x1, y1 };
}

/** Marching squares: segments (in grid space 0..1) for one level. */
export function contourSegments(grid, level) {
  const { g, nx, ny } = grid;
  const segs = [];
  const fx = 1 / (nx - 1), fy = 1 / (ny - 1);
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = g[j * nx + i], b = g[j * nx + i + 1], c = g[(j + 1) * nx + i + 1], d = g[(j + 1) * nx + i];
      let idx = 0;
      if (a > level) idx |= 8;
      if (b > level) idx |= 4;
      if (c > level) idx |= 2;
      if (d > level) idx |= 1;
      if (idx === 0 || idx === 15) continue;
      const t = (p, q) => (level - p) / (q - p);
      const top = [(i + t(a, b)) * fx, j * fy];
      const right = [(i + 1) * fx, (j + t(b, c)) * fy];
      const bottom = [(i + t(d, c)) * fx, (j + 1) * fy];
      const left = [i * fx, (j + t(a, d)) * fy];
      const add = (p, q) => segs.push(p[0], p[1], q[0], q[1]);
      switch (idx) {
        case 1: case 14: add(left, bottom); break;
        case 2: case 13: add(bottom, right); break;
        case 3: case 12: add(left, right); break;
        case 4: case 11: add(top, right); break;
        case 5: add(left, top); add(bottom, right); break;
        case 6: case 9: add(top, bottom); break;
        case 7: case 8: add(left, top); break;
        case 10: add(top, right); add(left, bottom); break;
      }
    }
  }
  return new Float32Array(segs);
}

/** Precompute contour sets for several levels. */
export function contourSet(grid, levels) {
  return levels.map((lv) => ({ level: lv, segs: contourSegments(grid, lv) }));
}

/** Draw a contour set mapped into rect (x,y,w,h). */
export function drawContours(g, set, x, y, w, h, style) {
  for (let k = 0; k < set.length; k++) {
    const { level, segs } = set[k];
    const st = style(level, k);
    if (!st || st.alpha <= 0.003) continue;
    g.save();
    g.globalAlpha *= st.alpha;
    g.strokeStyle = st.color;
    g.lineWidth = st.width;
    g.beginPath();
    for (let i = 0; i < segs.length; i += 4) {
      g.moveTo(x + segs[i] * w, y + segs[i + 1] * h);
      g.lineTo(x + segs[i + 2] * w, y + segs[i + 3] * h);
    }
    g.stroke();
    g.restore();
  }
}

/**
 * Perspective ridgelines ("unknown pleasures" technique): rows of terrain from far to
 * near, each filled with ground colour to hide what is behind it.
 * cam: { x, z, h (eye height), pitch (horizon y), f (focal) }
 */
export function ridgelines(g, cam, opt) {
  const {
    rows = 70, dz = 0.05, near = 0.08, width = 3.2, samples = 180, amp = 0.55,
    ground = '#0a0908', line = '#efe6d2', lineWidth = 1.4, heightFn = height,
    alphaFn = null, W = 1920, H = 1080, onRow = null, xScale = 1, groundFn = null, lineFn = null,
  } = opt;
  const { x: cx, z: cz, h: eye, horizon = H * 0.38, f = 900 } = cam;
  const first = Math.floor((cz + near) / dz) + 1;
  for (let k = rows - 1; k >= 0; k--) {
    const wz = (first + k) * dz; // world z of this row
    const rz = wz - cz; // distance from camera
    if (rz <= near) continue;
    const pts = [];
    for (let s = 0; s <= samples; s++) {
      const wx = cx + (s / samples - 0.5) * width * (rz + 0.4) * xScale;
      const hgt = heightFn(wx, wz) * amp;
      const sx = W / 2 + ((wx - cx) * f) / rz;
      const sy = horizon + ((eye - hgt) * f) / rz;
      pts.push([sx, sy]);
    }
    const depthT = k / (rows - 1);
    const a = alphaFn ? alphaFn(depthT, rz, wz) : Math.min(1, (1 - depthT) * 1.6) * Math.min(1, (rz - near) * 6);
    // occlusion fill
    g.beginPath();
    g.moveTo(pts[0][0], H + 10);
    for (const p of pts) g.lineTo(p[0], p[1]);
    g.lineTo(pts[pts.length - 1][0], H + 10);
    g.closePath();
    g.fillStyle = groundFn ? groundFn(depthT, rz) : ground;
    g.fill();
    if (a > 0.004) {
      g.save();
      g.globalAlpha *= a;
      g.strokeStyle = lineFn ? lineFn(depthT, rz) : line;
      g.lineWidth = lineWidth * Math.min(2.2, 0.6 + 0.35 / rz);
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) g.lineTo(p[0], p[1]);
      g.stroke();
      g.restore();
    }
    if (onRow) onRow(pts, wz, rz, depthT, (wx) => ({
      x: W / 2 + ((wx - cx) * f) / rz,
      y: horizon + ((eye - heightFn(wx, wz) * amp) * f) / rz,
    }));
  }
}
