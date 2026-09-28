// SEQUENCE 3 — WHITE COAT
// Silence. The last page softens into fabric, drifts through the dark, and settles
// as a white coat — placed on the student's shoulders by someone else's hands.
// Not an achievement: a responsibility beginning. Then the coat becomes the page
// of the anatomical atlas.
import { W, H, TAU, clamp, lerp, seg, ease, kf, noise2, noise3 } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, withCam, layer } from '../lib/draw.js';
import { backFigure, coatOutline, hand, limb } from '../lib/figure.js';
import { reveal, caps } from '../lib/type.js';

export const B = {
  unfurl: [0.0, 2.4],
  wrap: [2.0, 4.4],
  hands: [3.2, 5.6],
  figure: [1.6, 3.2],
  words: [4.6, 7.3],
  push: [7.0, 9.0],
};

export const cues = [
  { t: 0.2, type: 'cloth', dur: 2.6 },
  { t: 2.6, type: 'cloth', dur: 1.8, gain: 0.7 },
  { t: 4.3, type: 'settle' },
  { t: 4.7, type: 'titleSoft' },
];

// figure placement: feet off-frame, coat centred-left; words live on the right
const FIG = { x: 700, y: 1330, h: 1100 };
const NU = 26, NV = 34;

// half-width profile of the coat as a function of unit y
let PROFILE = null;
function profile() {
  if (PROFILE) return PROFILE;
  const out = coatOutline(0);
  const ys = [];
  for (let i = 0; i <= 64; i++) {
    const y = lerp(-0.845, -0.265, i / 64);
    let m = 0.02;
    for (let k = 1; k < out.length; k++) {
      const [x0, y0] = out[k - 1], [x1, y1] = out[k];
      if ((y0 - y) * (y1 - y) <= 0 && y0 !== y1) {
        const x = x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
        m = Math.max(m, Math.abs(x));
      }
    }
    ys.push(m);
  }
  PROFILE = (v) => ys[Math.round(clamp(v) * 64)];
  return PROFILE;
}

// the page from the previous scene at its final frame (kept in sync by formula)
const PAGE = (() => {
  const t = 10;
  return { x: 960 + noise2(t * 0.6, 3) * 40, y: 520 + Math.sin(t * 2.2) * 8, r: -0.25 + Math.sin(t * 1.7) * 0.08 };
})();

function clothVertex(u, v, t) {
  const un = seg(t, B.unfurl[0], B.unfurl[1], ease.inOutSine);
  const wr = seg(t, B.wrap[0], B.wrap[1], ease.morph);
  // floating sheet
  const w = lerp(240, 720, un), h = lerp(320, 900, un);
  const cx = lerp(PAGE.x, 900, un) + Math.sin(t * 0.7) * 30 * un;
  const cy = lerp(PAGE.y, 520, un) + Math.cos(t * 0.5) * 20 * un;
  const rot = lerp(PAGE.r, -0.12 + Math.sin(t * 0.4) * 0.1, un);
  const amp = un * (1 - wr) * 70 + 4 * (1 - wr);
  const z = amp * (0.45 * Math.sin(u * 4.1 + t * 1.6) + 0.3 * Math.sin(v * 3.3 - t * 1.2 + u * 2) + 0.35 * noise3(u * 2, v * 2, t * 0.4) + 0.22 * Math.sin(u * 13 + v * 2 + t * 0.9) * (1 - v * 0.5));
  const lx = (u - 0.5) * w + z * 0.25, ly = (v - 0.5) * h + z * 0.6;
  const fx = cx + lx * Math.cos(rot) - ly * Math.sin(rot);
  const fy = cy + lx * Math.sin(rot) + ly * Math.cos(rot);
  // coat target
  const P = profile();
  const hw = P(v);
  const yUnit = lerp(-0.845, -0.265, v);
  const tx = FIG.x + (u - 0.5) * 2 * hw * FIG.h;
  const ty = FIG.y + yUnit * FIG.h + z * 0.15;
  return [lerp(fx, tx, wr), lerp(fy, ty, wr), z * (1 - wr * 0.8)];
}

function drawCloth(g, t, alpha) {
  if (alpha <= 0) return;
  const V = [];
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) V.push(clothVertex(i / NU, j / NV, t));
  const at = (i, j) => V[j * (NU + 1) + i];
  const { c: cv, g: cg } = layer('cloth', g.canvas.width, g.canvas.height);
  cg.setTransform(g.getTransform());
  const outer = g;
  g = cg;
  g.save();
  g.lineJoin = 'round';
  for (let j = 0; j < NV; j++) {
    for (let i = 0; i < NU; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      // shade from the surface slope toward an upper-left key light
      const dzx = (b[2] - a[2] + c[2] - d[2]) * 0.5, dzy = (d[2] - a[2] + c[2] - b[2]) * 0.5;
      const lit = clamp(0.82 - dzx * 0.045 - dzy * 0.03 + (j / NV) * -0.08, 0.25, 1);
      const r = Math.round(lerp(40, 247, lit)), gg = Math.round(lerp(36, 242, lit)), bb = Math.round(lerp(32, 232, lit));
      const col = `rgb(${r},${gg},${bb})`;
      g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]);
      g.closePath();
      g.fill(); g.stroke();
    }
  }
  g.restore();
  outer.save();
  outer.setTransform(1, 0, 0, 1, 0, 0);
  outer.globalAlpha = alpha;
  outer.filter = `blur(${0.9 * outer.canvas.width / W}px)`;
  outer.drawImage(cv, 0, 0);
  outer.restore();
}

/** Someone else's hands — the viewer's — settling the coat onto the student's shoulders. */
function placingHands(g, t) {
  const inP = seg(t, B.hands[0], B.hands[0] + 1.1, ease.outCubic);
  const outP = seg(t, B.hands[1] - 0.8, B.hands[1], ease.inCubic);
  if (inP <= 0 || outP >= 1) return;
  for (const s of [-1, 1]) {
    const sx = FIG.x + s * 0.125 * FIG.h, sy = FIG.y - 0.8 * FIG.h;
    const away = (1 - inP) * 1 + outP;
    const wx = sx + s * 60 + s * away * 260, wy = sy + 170 + away * 520;
    g.save();
    g.globalAlpha = Math.min(1, inP * 1.5) * (1 - outP);
    g.filter = 'blur(3.5px)'; // foreground, out of focus
    g.fillStyle = '#16120f';
    limb(g, [wx + s * 170, wy + 700], [wx, wy], 150, 112);
    hand(g, wx, wy, 150, -Math.PI / 2 - s * 0.35, { curl: 0.25, spread: 0.35, fill: '#16120f', mirror: s < 0, thumb: 0.5 });
    g.filter = 'none';
    g.restore();
  }
}

export default {
  draw(g, t) {
    fill(g, C.night);
    const figA = seg(t, B.figure[0], B.figure[1]);
    const push = seg(t, B.push[0], B.push[1], ease.inQuint);
    const z = lerp(1, 14, push);
    const focus = [lerp(960, FIG.x, seg(t, B.push[0], B.push[0] + 1, ease.inOutSine)), lerp(540, FIG.y - 0.7 * FIG.h, seg(t, B.push[0], B.push[0] + 1, ease.inOutSine))];
    withCam(g, { x: focus[0], y: focus[1], z }, () => {
      // backdrop light: a soft warm pool behind the student
      if (figA > 0) {
        const gr = g.createRadialGradient(FIG.x, 520, 40, FIG.x, 520, 760);
        gr.addColorStop(0, rgba('#3a3128', figA));
        gr.addColorStop(1, rgba(C.night, 0));
        g.fillStyle = gr;
        g.fillRect(-2000, -2000, 6000, 6000);
      }
      backFigure(g, FIG.x, FIG.y, FIG.h, { color: '#070605', alpha: figA });
      const settled = seg(t, B.wrap[1] - 0.25, B.wrap[1] + 0.35);
      if (settled > 0) backFigure(g, FIG.x, FIG.y, FIG.h, { color: '#070605', coat: 1, shoulders: 0.5 * seg(t, 4.2, 5.4, ease.outCubic) });
      drawCloth(g, t, 1 - settled);
      placingHands(g, t);
    });
    // the words
    const wp = seg(t, B.words[0], B.words[0] + 1.2);
    const wq = seg(t, B.words[1] - 0.6, B.words[1]);
    reveal(g, 'STUDENT', 1350, 520, { size: 112, color: C.light, tracking: 0.12, p: wp, q: wq, stagger: 0.35 });
    reveal(g, 'DOCTOR', 1350, 640, { size: 112, color: C.light, tracking: 0.12, p: seg(t, B.words[0] + 0.35, B.words[0] + 1.55), q: wq, stagger: 0.35 });
    // become the page
    const pg = seg(t, 8.2, 9.0, ease.inOutSine);
    if (pg > 0) { g.fillStyle = rgba(C.paper, pg); g.fillRect(0, 0, W, H); }
    void TAU; void FONT; void kf; void caps;
    return { dark: pg > 0.5 ? 0 : 1 };
  },
};
