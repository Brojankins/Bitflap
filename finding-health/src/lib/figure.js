// Human representation: silhouettes, partial figures, hands. Never faces.
// A figure is a set of joints (unit height = 1, feet at y=0, up = -y) skinned with
// tapered capsules. Scenes pose the rig; this module draws it.
import { TAU, lerp, bez, clamp } from './core.js';
import { C } from '../config/design.js';
import { path } from './draw.js';

// ---------------------------------------------------------------- primitives
export function limb(g, a, b, w0, w1) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1e-6;
  const nx = -dy / L, ny = dx / L;
  g.beginPath();
  g.moveTo(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2);
  g.lineTo(b[0] + nx * w1 / 2, b[1] + ny * w1 / 2);
  g.arc(b[0], b[1], w1 / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
  g.lineTo(a[0] - nx * w0 / 2, a[1] - ny * w0 / 2);
  g.arc(a[0], a[1], w0 / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true);
  g.closePath();
  g.fill();
}

const add = (p, a, l) => [p[0] + Math.cos(a) * l, p[1] + Math.sin(a) * l];

// ---------------------------------------------------------------- poses (side view, facing +x)
/** Walking pose. phase in cycles; lean forward; bounce. */
export function walkPose(phase, { stride = 1, lean = 0.04, armSwing = 1 } = {}) {
  const s = Math.sin(phase * TAU), c = Math.cos(phase * TAU);
  const bob = Math.abs(Math.cos(phase * TAU)) * 0.012;
  const hip = [0, -0.5 + bob];
  const chest = [hip[0] + lean * 0.3, hip[1] - 0.29];
  const neck = [chest[0] + 0.012, chest[1] - 0.04];
  const head = [neck[0] + 0.012, neck[1] - 0.07];
  const leg = (sgn) => {
    const th = 0.42 * stride * s * sgn; // thigh swing from vertical (+ = forward)
    const knee = add(hip, Math.PI / 2 - th, 0.25);
    const bend = 0.08 + Math.max(0, c * sgn) * 0.6 * stride; // knee flexes while the leg swings through
    const shinA = Math.PI / 2 - th + bend;
    const ankle = add(knee, shinA, 0.24);
    const toe = add(ankle, shinA - Math.PI / 2 + 0.08, 0.07);
    return { knee, ankle, toe };
  };
  const arm = (sgn) => {
    const sw = -0.38 * s * sgn * armSwing;
    const elbow = add(chest, Math.PI / 2 - sw, 0.16);
    const wrist = add(elbow, Math.PI / 2 - sw - 0.25 - Math.max(0, sw) * 0.4, 0.15);
    return { elbow, wrist };
  };
  return { head, neck, chest, hip, near: { ...leg(1), ...arm(1) }, far: { ...leg(-1), ...arm(-1) } };
}

/** Seated pose. lean, headTilt (+down), hands: 'lap' | 'notebook' | 'knees'. */
export function sitPose({ lean = 0.05, headTilt = 0, hands = 'lap', seatH = 0.27, handLift = 0, feet = null, swing = 0 } = {}) {
  const hip = [0, -seatH - 0.02];
  const chest = [hip[0] + lean, hip[1] - 0.29];
  const neck = [chest[0] + 0.012 + headTilt * 0.02, chest[1] - 0.04];
  const head = [neck[0] + 0.015 + headTilt * 0.035, neck[1] - 0.068 + headTilt * 0.012];
  const knee = [hip[0] + 0.24, hip[1] - 0.005];
  // feet on the floor, or dangling from a high seat (exam table), optionally swinging
  const ankle = feet === null ? [knee[0] + 0.02, -0.03] : [knee[0] + 0.02 + Math.sin(swing) * 0.05, knee[1] + 0.23];
  const toe = [ankle[0] + 0.07, ankle[1] + 0.02];
  const handAt = hands === 'notebook' ? [hip[0] + 0.2, hip[1] - 0.1 - handLift] : hands === 'knees' ? [knee[0] - 0.02, knee[1] - 0.03] : [hip[0] + 0.14, hip[1] - 0.05];
  const elbow = [chest[0] + 0.03, chest[1] + 0.17];
  const mk = (dx) => ({ knee: [knee[0] + dx, knee[1]], ankle: [ankle[0] + dx, ankle[1]], toe: [toe[0] + dx, toe[1]], elbow: [elbow[0] + dx, elbow[1]], wrist: [handAt[0] + dx, handAt[1]] });
  return { head, neck, chest, hip, near: mk(0.01), far: mk(-0.02) };
}

/** Standing (side) pose, arms relaxed or reaching. reach: 0..1 extends near arm forward. */
export function standPose({ reach = 0, reachY = -0.5, lean = 0, headTilt = 0 } = {}) {
  const hip = [0, -0.5];
  const chest = [lean * 0.4, -0.79];
  const neck = [chest[0] + 0.012 + headTilt * 0.02, chest[1] - 0.04];
  const head = [neck[0] + 0.012 + headTilt * 0.03, neck[1] - 0.07 + headTilt * 0.01];
  const leg = (dx) => ({ knee: [dx + 0.005, -0.255], ankle: [dx, -0.035], toe: [dx + 0.07, -0.005] });
  const relaxed = { elbow: [chest[0] + 0.01, chest[1] + 0.16], wrist: [chest[0] + 0.02, chest[1] + 0.31] };
  const reached = { elbow: [chest[0] + 0.14, chest[1] + 0.13], wrist: [chest[0] + 0.28, reachY] };
  const nearArm = {
    elbow: [lerp(relaxed.elbow[0], reached.elbow[0], reach), lerp(relaxed.elbow[1], reached.elbow[1], reach)],
    wrist: [lerp(relaxed.wrist[0], reached.wrist[0], reach), lerp(relaxed.wrist[1], reached.wrist[1], reach)],
  };
  return { head, neck, chest, hip, near: { ...leg(0.02), ...nearArm }, far: { ...leg(-0.02), ...relaxed } };
}

/**
 * Draw a posed side-view figure. Units: height 1 → h pixels; (x,y) = floor point.
 * opt: color, farColor, coat (0..1 white coat), coatColor, dir (+1 right / -1 left)
 */
export function drawFigure(g, pose, x, y, h, opt = {}) {
  const { color = C.ink, farColor = null, coat = 0, coatColor = C.light, dir = 1, alpha = 1, bag = 0, gown = 0 } = opt;
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  g.scale(h * dir, h);
  const P = pose;
  const drawLeg = (L, col) => {
    g.fillStyle = col;
    limb(g, P.hip, L.knee, 0.1, 0.07);
    limb(g, L.knee, L.ankle, 0.066, 0.042);
    limb(g, L.ankle, L.toe, 0.04, 0.032);
  };
  const drawArm = (A, col) => {
    g.fillStyle = col;
    limb(g, [P.chest[0], P.chest[1] + 0.02], A.elbow, 0.07, 0.056);
    limb(g, A.elbow, A.wrist, 0.054, 0.04);
    g.beginPath();
    g.ellipse(A.wrist[0] + (A.wrist[0] - A.elbow[0]) * 0.25, A.wrist[1] + (A.wrist[1] - A.elbow[1]) * 0.25, 0.028, 0.034, Math.atan2(A.wrist[1] - A.elbow[1], A.wrist[0] - A.elbow[0]), 0, TAU);
    g.fill();
  };
  const fc = farColor || color;
  drawArm(P.far, fc);
  drawLeg(P.far, fc);
  // torso
  g.fillStyle = color;
  limb(g, P.hip, P.chest, 0.13, 0.15);
  limb(g, P.chest, P.neck, 0.06, 0.05);
  // head: silhouette with a quiet profile (brow, nose, lips, chin) — never a face
  g.save();
  g.translate(P.head[0], P.head[1]);
  g.rotate(Math.atan2(P.head[0] - P.neck[0], P.neck[1] - P.head[1]) * 0.6);
  g.beginPath();
  g.ellipse(-0.006, -0.004, 0.056, 0.064, 0.1, 0, TAU);
  g.fill();
  g.beginPath();
  g.moveTo(0.04, -0.03);
  g.quadraticCurveTo(0.058, -0.012, 0.056, 0.0); // brow to nose bridge
  g.lineTo(0.07, 0.016); // nose
  g.lineTo(0.056, 0.024);
  g.quadraticCurveTo(0.06, 0.032, 0.054, 0.04); // lips
  g.quadraticCurveTo(0.056, 0.058, 0.035, 0.064); // chin
  g.lineTo(0.0, 0.06);
  g.closePath();
  g.fill();
  g.restore();
  if (bag > 0) {
    g.globalAlpha *= bag;
    g.beginPath();
    g.roundRect(P.chest[0] - 0.14, P.chest[1] - 0.005, 0.08, 0.2, 0.025);
    g.fill();
    g.globalAlpha /= bag;
  }
  drawLeg(P.near, color);
  // coat / gown over torso and upper legs
  const layerCoat = (amt, col, hem) => {
    if (amt <= 0) return;
    g.save();
    g.globalAlpha *= amt;
    g.fillStyle = col;
    const kx = (P.near.knee[0] + P.far.knee[0]) / 2;
    const sh = [P.chest[0], P.chest[1] - 0.02];
    path(g, [
      [sh[0] - 0.07, sh[1]], [sh[0] + 0.07, sh[1] + 0.005],
      [P.hip[0] + 0.085, P.hip[1]], [kx + 0.11, hem], [kx - 0.13, hem + 0.01], [P.hip[0] - 0.085, P.hip[1]],
    ], true);
    g.fill();
    g.restore();
  };
  layerCoat(coat, coatColor, -0.27);
  layerCoat(gown, C.night, -0.1);
  drawArm(P.near, color);
  if (coat > 0) {
    g.save();
    g.globalAlpha *= coat;
    g.fillStyle = coatColor;
    limb(g, [P.chest[0], P.chest[1] + 0.02], P.near.elbow, 0.078, 0.064);
    limb(g, P.near.elbow, [lerp(P.near.elbow[0], P.near.wrist[0], 0.85), lerp(P.near.elbow[1], P.near.wrist[1], 0.85)], 0.062, 0.054);
    g.restore();
  }
  g.restore();
}

// ---------------------------------------------------------------- back view (standing, facing away)
function backSide() {
  // right half, from crown to crotch, unit height
  return bez([
    0, -1.0,
    0.034, -1.0, 0.056, -0.98, 0.058, -0.93,
    0.06, -0.89, 0.048, -0.868, 0.04, -0.855,
    0.045, -0.83, 0.09, -0.82, 0.13, -0.8,
    0.155, -0.79, 0.16, -0.74, 0.158, -0.66,
    0.157, -0.58, 0.152, -0.5, 0.146, -0.44,
    0.14, -0.415, 0.118, -0.415, 0.114, -0.44,
    0.112, -0.52, 0.106, -0.6, 0.104, -0.66,
    0.1, -0.6, 0.095, -0.56, 0.1, -0.5,
    0.104, -0.44, 0.09, -0.3, 0.075, -0.1,
    0.072, -0.04, 0.08, 0, 0.06, 0.0,
    0.035, 0.0, 0.028, -0.01, 0.026, -0.05,
    0.02, -0.2, 0.018, -0.35, 0.006, -0.46,
    0.003, -0.47, 0.001, -0.47, 0, -0.47,
  ], 10);
}
const BACK = backSide();
export const BACK_OUTLINE = [...BACK, ...BACK.slice().reverse().map(([x, y]) => [-x, y])];

/**
 * Back-view figure. layers: coat (0..1), gown (0..1), hood (0..1), bag (0..1).
 * shoulders: lift (−) / settle (+) of the shoulder line for posture.
 */
export function backFigure(g, x, y, h, opt = {}) {
  const { color = C.ink, alpha = 1, coat = 0, gown = 0, hood = 0, bag = 0, coatColor = C.light, shoulders = 0, rim = null } = opt;
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  g.scale(h, h);
  const out = BACK_OUTLINE.map(([px, py]) => [px, py + (py < -0.78 && Math.abs(px) > 0.05 ? shoulders * 0.015 : 0)]);
  if (rim) {
    g.save();
    g.translate(0.004, -0.003);
    g.fillStyle = rim;
    path(g, out, true);
    g.fill();
    g.restore();
  }
  g.fillStyle = color;
  path(g, out, true);
  g.fill();
  if (bag > 0) {
    g.save();
    g.globalAlpha *= bag;
    g.fillStyle = C.ink2;
    g.beginPath();
    g.roundRect(-0.095, -0.79, 0.19, 0.25, 0.04);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = 0.004;
    g.beginPath();
    g.moveTo(-0.07, -0.69); g.lineTo(0.07, -0.69);
    g.stroke();
    g.restore();
  }
  if (coat > 0) coatShape(g, coat, coatColor, shoulders);
  if (gown > 0) gownShape(g, gown, shoulders);
  if (hood > 0) hoodShape(g, hood, shoulders);
  g.restore();
}

export function coatOutline(sh = 0) {
  const s = sh * 0.015;
  const half = bez([
    0.0, -0.848 + s,
    0.03, -0.848 + s, 0.05, -0.838 + s, 0.066, -0.83 + s,
    0.1, -0.815 + s, 0.14, -0.81 + s, 0.162, -0.785 + s,
    0.172, -0.74, 0.17, -0.6, 0.168, -0.44, // sleeve outer to cuff
    0.15, -0.43, 0.132, -0.43, 0.122, -0.44, // cuff
    0.12, -0.55, 0.118, -0.62, 0.116, -0.66,
    0.118, -0.5, 0.125, -0.4, 0.13, -0.27, // skirt to hem
    0.08, -0.262, 0.03, -0.262, 0.0, -0.262,
  ], 10);
  return [...half, ...half.slice().reverse().map(([x, y]) => [-x, y])];
}

function coatShape(g, amt, col, sh) {
  g.save();
  g.globalAlpha *= amt;
  const out = coatOutline(sh);
  const gr = g.createLinearGradient(-0.17, 0, 0.17, 0);
  gr.addColorStop(0, '#cfc8bb');
  gr.addColorStop(0.35, col);
  gr.addColorStop(0.7, col);
  gr.addColorStop(1, '#bdb5a7');
  g.fillStyle = gr;
  path(g, out, true);
  g.fill();
  // seams: centre-back vent, sleeve seams, back belt
  g.strokeStyle = 'rgba(40,30,20,0.28)';
  g.lineWidth = 0.0025;
  g.beginPath();
  g.moveTo(0, -0.47); g.lineTo(0, -0.265);
  g.moveTo(0.112, -0.79); g.quadraticCurveTo(0.12, -0.7, 0.118, -0.64);
  g.moveTo(-0.112, -0.79); g.quadraticCurveTo(-0.12, -0.7, -0.118, -0.64);
  g.moveTo(-0.07, -0.56); g.lineTo(0.07, -0.56);
  g.moveTo(-0.07, -0.545); g.lineTo(0.07, -0.545);
  g.stroke();
  // collar
  g.fillStyle = 'rgba(40,30,20,0.12)';
  g.beginPath();
  g.moveTo(-0.06, -0.835 + sh * 0.015);
  g.quadraticCurveTo(0, -0.8, 0.06, -0.835 + sh * 0.015);
  g.quadraticCurveTo(0, -0.82, -0.06, -0.835 + sh * 0.015);
  g.fill();
  g.restore();
}

function gownShape(g, amt, sh) {
  g.save();
  g.globalAlpha *= amt;
  const s = sh * 0.015;
  const half = bez([
    0, -0.85 + s,
    0.05, -0.85 + s, 0.12, -0.83 + s, 0.16, -0.79 + s,
    0.2, -0.7, 0.22, -0.56, 0.23, -0.47, // bell sleeve
    0.19, -0.45, 0.15, -0.45, 0.13, -0.47,
    0.14, -0.35, 0.15, -0.2, 0.16, -0.1,
    0.1, -0.095, 0.05, -0.095, 0, -0.095,
  ], 10);
  const out = [...half, ...half.slice().reverse().map(([x, y]) => [-x, y])];
  g.fillStyle = '#0d0c0b';
  path(g, out, true);
  g.fill();
  g.strokeStyle = 'rgba(255,240,220,0.10)';
  g.lineWidth = 0.003;
  for (const k of [-0.09, -0.03, 0.04, 0.1]) {
    g.beginPath();
    g.moveTo(k * 0.8, -0.8);
    g.quadraticCurveTo(k * 1.1, -0.5, k * 1.4, -0.1);
    g.stroke();
  }
  g.restore();
}

/** Doctoral hood: velvet (kelly green for medicine) framing a satin lining. */
export function hoodShape(g, amt, sh = 0) {
  const s = sh * 0.015;
  const drop = lerp(-0.8, -0.5, clamp(amt));
  g.save();
  g.globalAlpha *= clamp(amt * 3);
  // outer velvet V
  g.fillStyle = C.kelly;
  g.beginPath();
  g.moveTo(-0.075, -0.845 + s);
  g.quadraticCurveTo(-0.11, -0.72, 0, drop);
  g.quadraticCurveTo(0.11, -0.72, 0.075, -0.845 + s);
  g.quadraticCurveTo(0, -0.82, -0.075, -0.845 + s);
  g.fill();
  // lining (neutral satin; institution colours intentionally not assumed)
  g.fillStyle = '#d9d2c4';
  g.beginPath();
  g.moveTo(-0.05, -0.83 + s);
  g.quadraticCurveTo(-0.075, -0.72, 0, drop + 0.05);
  g.quadraticCurveTo(0.075, -0.72, 0.05, -0.83 + s);
  g.quadraticCurveTo(0, -0.815, -0.05, -0.83 + s);
  g.fill();
  g.fillStyle = '#8f8778';
  g.beginPath();
  g.moveTo(-0.03, -0.8);
  g.lineTo(0, drop + 0.09);
  g.lineTo(0.03, -0.8);
  g.quadraticCurveTo(0, -0.75, -0.03, -0.8);
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------- hands
/**
 * A hand seen from the back (dorsal), wrist at (x,y), pointing along angle a.
 * curl 0..1 bends fingers (grip), spread fans them. Drawn as fill + optional outline.
 */
export function hand(g, x, y, s, a, { curl = 0.1, spread = 0.2, fill = C.ink, stroke = null, width = 1.5, alpha = 1, mirror = false, thumb = 0.4 } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  g.rotate(a);
  g.scale(s, s * (mirror ? -1 : 1));
  const parts = [];
  // palm (wrist at origin, fingers toward +x)
  parts.push(() => {
    g.beginPath();
    g.moveTo(-0.1, -0.2);
    g.bezierCurveTo(0.2, -0.28, 0.5, -0.3, 0.62, -0.25);
    g.lineTo(0.64, 0.25);
    g.bezierCurveTo(0.5, 0.3, 0.2, 0.3, -0.1, 0.2);
    g.closePath();
  });
  const fingers = [
    [-0.19, 0.46, 0.085], [-0.065, 0.52, 0.09], [0.06, 0.49, 0.087], [0.18, 0.38, 0.078],
  ];
  const draw = (col, strokeOnly) => {
    for (const p of parts) {
      p();
      if (strokeOnly) g.stroke(); else g.fill();
    }
    fingers.forEach(([oy, len, w], i) => {
      const fa = (i - 1.5) * spread * 0.18;
      const base = [0.6, oy];
      const segs = [len * 0.45, len * 0.32, len * 0.23];
      let p = base, ang = fa;
      const pts = [p];
      for (let k = 0; k < 3; k++) {
        ang += curl * (0.5 + k * 0.25);
        p = [p[0] + Math.cos(ang) * segs[k], p[1] + Math.sin(ang) * segs[k] * (i < 2 ? 1 : 1)];
        pts.push(p);
      }
      for (let k = 0; k < 3; k++) {
        if (strokeOnly) {
          g.beginPath();
          g.moveTo(pts[k][0], pts[k][1]);
          g.lineTo(pts[k + 1][0], pts[k + 1][1]);
          g.stroke();
        } else limb(g, pts[k], pts[k + 1], w * (1 - k * 0.1) * 1.9, w * (1 - (k + 1) * 0.1) * 1.9);
      }
    });
    // thumb
    const tb = [0.12, -0.22];
    const ta = -0.9 + thumb * 0.6;
    const t1 = [tb[0] + Math.cos(ta) * 0.24, tb[1] + Math.sin(ta) * 0.24];
    const t2 = [t1[0] + Math.cos(ta + 0.5) * 0.18, t1[1] + Math.sin(ta + 0.5) * 0.18];
    if (!strokeOnly) {
      limb(g, tb, t1, 0.2, 0.17);
      limb(g, t1, t2, 0.17, 0.14);
    }
  };
  g.fillStyle = fill;
  draw(fill, false);
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = width / s;
    g.beginPath();
    parts[0]();
    g.stroke();
  }
  g.restore();
}
