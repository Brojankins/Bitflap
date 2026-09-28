// The clinical corridor: one-point perspective, doors on alternating walls, light panels.
// Used for rotations (endless) and for fourth-year choice (doors vanishing).
import { clamp, lerp } from './core.js';
import { C, FONT, rgba, mixHex } from '../config/design.js';
import { path } from './draw.js';
import { font } from './type.js';

export const VP = { x: 960, y: 500, f: 520 };
const WX = 1.25, FLOOR = 0.95, CEIL = -1.05;

export function project(X, Y, rz) {
  return [VP.x + (X * VP.f) / rz, VP.y + (Y * VP.f) / rz];
}

/**
 * doors: [{ z, side (-1|1), label, alpha, tint }]
 * o: { cz (camera z), wall, floor, ceil, light, far }
 */
export function corridor(g, cz, doors, o = {}) {
  const { wall = '#b9b0a2', floor = '#8d8274', ceil = '#d8d2c6', far = '#f1ebdf', depth = 40, light = 1, doorColor = '#6b5d50' } = o;
  const near = 0.35, farZ = depth;
  const q = (X, Y, z) => project(X, Y, z - cz);
  const zN = cz + near, zF = cz + farZ;
  const quad = (pts, fillStyle) => { path(g, pts, true); g.fillStyle = fillStyle; g.fill(); };
  // far wall (light at the end)
  const f0 = q(-WX, CEIL, zF), f1 = q(WX, FLOOR, zF);
  // walls, floor, ceiling with depth fog
  const wallG = (side) => {
    const a = q(side * WX, 0, zN), b = q(side * WX, 0, zF);
    const gr = g.createLinearGradient(a[0], 0, b[0], 0);
    gr.addColorStop(0, mixHex(wall, '#3a332c', 0.35)); gr.addColorStop(0.55, wall); gr.addColorStop(1, far);
    return gr;
  };
  quad([q(-WX, CEIL, zN), q(-WX, CEIL, zF), q(-WX, FLOOR, zF), q(-WX, FLOOR, zN)], wallG(-1));
  quad([q(WX, CEIL, zN), q(WX, CEIL, zF), q(WX, FLOOR, zF), q(WX, FLOOR, zN)], wallG(1));
  const fl = g.createLinearGradient(0, q(0, FLOOR, zN)[1], 0, q(0, FLOOR, zF)[1]);
  fl.addColorStop(0, mixHex(floor, '#2e2822', 0.35)); fl.addColorStop(0.6, floor); fl.addColorStop(1, far);
  quad([q(-WX, FLOOR, zN), q(WX, FLOOR, zN), q(WX, FLOOR, zF), q(-WX, FLOOR, zF)], fl);
  const ce = g.createLinearGradient(0, q(0, CEIL, zN)[1], 0, q(0, CEIL, zF)[1]);
  ce.addColorStop(0, mixHex(ceil, '#5a5249', 0.35)); ce.addColorStop(0.6, ceil); ce.addColorStop(1, far);
  quad([q(-WX, CEIL, zN), q(WX, CEIL, zN), q(WX, CEIL, zF), q(-WX, CEIL, zF)], ce);
  g.fillStyle = far;
  g.fillRect(f0[0], f0[1], f1[0] - f0[0], f1[1] - f0[1]);
  // ceiling light panels + their reflections on the floor
  const step = 2.2;
  for (let k = Math.floor(cz / step) + 1; k < Math.floor(zF / step); k++) {
    const z = k * step;
    if (z - cz < near) continue;
    const fog = clamp(1 - (z - cz) / farZ);
    const a = q(-0.35, CEIL, z), b = q(0.35, CEIL, z + 0.9);
    g.fillStyle = rgba('#fffaf0', 0.85 * fog * light);
    path(g, [q(-0.35, CEIL, z), q(0.35, CEIL, z), q(0.35, CEIL, z + 0.9), q(-0.35, CEIL, z + 0.9)], true); g.fill();
    g.fillStyle = rgba('#fffaf0', 0.16 * fog * light);
    path(g, [q(-0.3, FLOOR, z), q(0.3, FLOOR, z), q(0.3, FLOOR, z + 0.9), q(-0.3, FLOOR, z + 0.9)], true); g.fill();
    void a; void b;
  }
  // doors, far to near
  const sorted = doors.filter((d) => d.z - cz > near && d.z < zF).sort((a, b) => b.z - a.z);
  for (const d of sorted) {
    const al = (d.alpha ?? 1) * clamp((zF - d.z) / 6);
    if (al <= 0.01) continue;
    const s = d.side, X = s * WX * 0.999, w = 0.75;
    const pts = [q(X, -0.55, d.z), q(X, -0.55, d.z + w), q(X, FLOOR, d.z + w), q(X, FLOOR, d.z)];
    g.save();
    g.globalAlpha *= al;
    path(g, pts, true);
    g.fillStyle = d.tint || doorColor; g.fill();
    g.strokeStyle = rgba('#000', 0.25); g.lineWidth = 2; g.stroke();
    // lit vision panel
    path(g, [q(X, -0.4, d.z + w * 0.62), q(X, -0.4, d.z + w * 0.78), q(X, 0.05, d.z + w * 0.78), q(X, 0.05, d.z + w * 0.62)], true);
    g.fillStyle = rgba(d.glow || '#f5e9cf', 0.85); g.fill();
    // plaque with the service name
    if (d.label) {
      const p = q(X, -0.72, d.z + w * 0.5);
      const rz = d.z + w * 0.5 - cz;
      const sz = clamp((VP.f / rz) * 0.07, 3, 44);
      if (sz > 5) {
        g.save();
        g.translate(p[0], p[1]);
        g.transform(1, (s * -0.0) , 0, 1, 0, 0);
        font(g, FONT.sans, sz, 500);
        g.letterSpacing = `${sz * 0.25}px`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const tw = g.measureText(d.label).width;
        g.fillStyle = rgba('#2b2622', 0.9);
        g.fillRect(-tw / 2 - sz * 0.8, -sz * 0.9, tw + sz * 1.6, sz * 1.8);
        g.fillStyle = '#e9e3d6';
        g.fillText(d.label, sz * 0.12, 0);
        g.restore();
      }
    }
    g.restore();
  }
  return { q };
}

/** Screen-space quad of a door (for mask wipes). */
export function doorQuad(d, cz) {
  const s = d.side, X = s * WX * 0.999, w = 0.75;
  return [project(X, -0.55, d.z - cz), project(X, -0.55, d.z + w - cz), project(X, FLOOR, d.z + w - cz), project(X, FLOOR, d.z - cz)];
}

export const FLOOR_Y = FLOOR;
void lerp;
