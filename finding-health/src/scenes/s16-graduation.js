// SEQUENCE 16 — GRADUATION
// The white-coat composition, echoed exactly: same dark, same warm pool, same framing,
// same unseen hands at the shoulders — now placing a doctoral hood (kelly green, the
// velvet of medicine) after four years. STUDENT DOCTOR returns; one word leaves.
// A walk across a stage. Then the Day One door, from the inside, opening outward.
import { W, H, TAU, clamp, lerp, seg, ease, kf, env } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, withCam, glow, stroke, circle } from '../lib/draw.js';
import { backFigure, hand, limb, drawFigure, walkPose } from '../lib/figure.js';
import { reveal, caps } from '../lib/type.js';
import { ridgelines, height } from '../lib/terrain.js';

export const B = {
  hood: [0.5, 3.4],
  words: [2.6, 4.6],
  stage: [4.4, 7.2],
  diploma: 6.0,
  door: [7.0, 10],
};

export const cues = [
  { t: 0.3, type: 'cloth', dur: 1.6, gain: 0.6 },
  { t: 2.0, type: 'settle' },
  { t: 2.8, type: 'titleSoft' },
  { t: 4.4, type: 'applause', dur: 3.2 },
  { t: B.diploma, type: 'paper', gain: 0.6 },
  { t: 7.6, type: 'footsteps', dur: 1.6, gain: 0.5 },
  { t: 8.2, type: 'doorOpen', gain: 0.8 },
  { t: 8.4, type: 'airOpen', dur: 1.6 },
];

const FIG = { x: 700, y: 1330, h: 1100 }; // identical to the white-coat framing

function placingHands(g, t) {
  const inP = seg(t, B.hood[0], B.hood[0] + 1.0, ease.outCubic);
  const outP = seg(t, B.hood[1] - 0.8, B.hood[1], ease.inCubic);
  if (inP <= 0 || outP >= 1) return;
  for (const s of [-1, 1]) {
    const sx = FIG.x + s * 0.125 * FIG.h, sy = FIG.y - 0.8 * FIG.h;
    const away = (1 - inP) + outP;
    const wx = sx + s * 60 + s * away * 260, wy = sy + 170 + away * 520;
    g.save();
    g.globalAlpha = Math.min(1, inP * 1.5) * (1 - outP);
    g.filter = 'blur(3.5px)';
    g.fillStyle = '#16120f';
    limb(g, [wx + s * 170, wy + 700], [wx, wy], 150, 112);
    hand(g, wx, wy, 150, -Math.PI / 2 - s * 0.35, { curl: 0.25, spread: 0.35, fill: '#16120f', mirror: s < 0, thumb: 0.5 });
    g.filter = 'none';
    g.restore();
  }
}

function hooding(g, t) {
  fill(g, C.night);
  const gr = g.createRadialGradient(FIG.x, 520, 40, FIG.x, 520, 760);
  gr.addColorStop(0, '#3a3128'); gr.addColorStop(1, rgba(C.night, 0));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const hood = seg(t, B.hood[0] + 0.6, B.hood[0] + 2.0, ease.inOutCubic);
  backFigure(g, FIG.x, FIG.y, FIG.h, { color: '#070605', gown: 1, hood, shoulders: 0.5 * seg(t, 1.8, 3.0, ease.outCubic) });
  placingHands(g, t);
  // STUDENT DOCTOR, where it stood four years ago; one word leaves
  const wp = seg(t, B.words[0], B.words[0] + 0.8);
  const out = seg(t, B.words[0] + 1.0, B.words[0] + 1.7);
  reveal(g, 'STUDENT', 1350, 520, { size: 112, color: C.light, tracking: 0.12, p: wp, q: out, stagger: 0.35 });
  const up = seg(t, B.words[0] + 1.4, B.words[1], ease.inOutCubic);
  reveal(g, 'DOCTOR', 1350, lerp(640, 590, up), { size: 112, color: C.light, tracking: 0.12, p: wp, q: seg(t, B.words[1] - 0.2, B.words[1] + 0.3), stagger: 0.35 });
}

function stage(g, t) {
  fill(g, '#0f0c0a');
  const floor = 780;
  // stage edge and footlights
  g.fillStyle = '#1b1612'; g.fillRect(0, floor, W, H - floor);
  for (let i = 0; i < 16; i++) glow(g, 60 + i * 120, floor + 6, 70, '#f2d6a0', 0.35);
  glow(g, 1100, 360, 700, '#6b563f', 0.5);
  const lt = t - B.stage[0];
  const x = lerp(260, 1120, seg(t, B.stage[0], B.diploma, ease.linear)) + seg(t, B.diploma + 0.3, B.stage[1], ease.inQuad) * 600;
  const walking = t < B.diploma - 0.1 || t > B.diploma + 0.3;
  const pose = walkPose(walking ? lt * 1.0 : 0.25, { stride: walking ? 0.85 : 0.2, armSwing: 0.5 });
  if (t > B.diploma - 0.3 && t < B.diploma + 0.5) { pose.near.elbow = [0.16, -0.64]; pose.near.wrist = [0.3, -0.58]; }
  drawFigure(g, pose, x, floor, 560, { color: '#050404', gown: 1 });
  // the hood's velvet catching light down the back
  stroke(g, [[x - 0.05 * 560, floor - 0.82 * 560], [x - 0.07 * 560, floor - 0.6 * 560]], C.kelly, 9, 0.9);
  // a hand offers the diploma cover
  const off = env(t, B.diploma - 0.8, B.diploma - 0.3, B.diploma + 0.1, B.diploma + 0.3);
  if (off > 0) {
    hand(g, 1330, floor - 330, 120, Math.PI, { fill: '#1c1714', curl: 0.4, alpha: off });
    g.fillStyle = rgba('#1c2a3a', off); g.fillRect(1230, floor - 360, 70, 52);
  }
  if (t > B.diploma) { g.fillStyle = '#1c2a3a'; g.fillRect(x + 0.24 * 560, floor - 0.62 * 560, 60, 44); }
}

function doorOut(g, t) {
  // from inside: the same doors, opening outward, into the world
  const op = seg(t, B.door[0] + 1.2, B.door[0] + 2.4, ease.inOutCubic);
  const z = kf(t, [[B.door[0], 1.0], [B.door[1], 1.6, ease.inCubic]]);
  fill(g, '#0b0908');
  withCam(g, { x: 960, y: 560, z }, () => {
    // beyond the door: the world in morning light (the mountains)
    const dx = 700, dy = 200, dw = 520, dh = 760;
    g.save();
    g.beginPath(); g.rect(dx, dy, dw, dh); g.clip();
    const sky = g.createLinearGradient(0, dy, 0, dy + dh);
    sky.addColorStop(0, '#f6ead3'); sky.addColorStop(1, '#fff7e6');
    g.fillStyle = sky; g.fillRect(dx, dy, dw, dh);
    g.translate(dx, dy); g.scale(dw / W, dh / H * 1.1);
    ridgelines(g, { x: 0.3, z: t * 0.05, h: 0.7, horizon: 420, f: 900 }, {
      rows: 40, dz: 0.08, width: 3.4, samples: 90, amp: 0.55, ground: '#cfd3c0', line: '#9aa28f', lineWidth: 1.2,
      alphaFn: (d) => 1 - d * 0.7,
    });
    g.restore();
    // frame and transom
    g.strokeStyle = '#2a221c'; g.lineWidth = 26;
    g.strokeRect(dx - 13, dy - 13, dw + 26, dh + 26);
    g.beginPath(); g.moveTo(dx - 20, dy - 20); g.lineTo(960, dy - 150); g.lineTo(dx + dw + 20, dy - 20); g.stroke();
    // leaves swing away from us (outward)
    for (const s of [-1, 1]) {
      const hingeX = s < 0 ? dx : dx + dw;
      const vis = (dw / 2) * Math.cos(op * Math.PI * 0.45);
      const x1 = hingeX - s * vis;
      g.fillStyle = '#1d1814';
      g.beginPath();
      g.moveTo(hingeX, dy); g.lineTo(x1, dy + 30 * op); g.lineTo(x1, dy + dh - 30 * op); g.lineTo(hingeX, dy + dh);
      g.closePath(); g.fill();
      g.strokeStyle = rgba('#f6ead3', 0.2 * op); g.lineWidth = 2; g.stroke();
    }
    // light spilling in across the floor toward us
    const sp = g.createLinearGradient(0, dy + dh, 0, H + 200);
    sp.addColorStop(0, rgba('#fff3dc', 0.55 * op)); sp.addColorStop(1, rgba('#fff3dc', 0));
    g.fillStyle = sp;
    g.beginPath(); g.moveTo(dx, dy + dh); g.lineTo(dx + dw, dy + dh); g.lineTo(dx + dw + 500, H + 200); g.lineTo(dx - 500, H + 200); g.closePath(); g.fill();
    // the graduate walks away from us, into it
    const wp = seg(t, B.door[0] + 0.3, B.door[1], ease.inOutSine);
    const y = lerp(1300, dy + dh + 10, wp), h = lerp(900, 520, wp);
    backFigure(g, 960, y, h, { color: '#060505', gown: 1, hood: 1, alpha: 1 - seg(t, B.door[1] - 0.6, B.door[1]) });
  });
  const fl = seg(t, B.door[1] - 1.0, B.door[1], ease.inCubic);
  if (fl > 0) { g.globalCompositeOperation = 'screen'; g.fillStyle = rgba('#fff3dc', fl); g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
}

export default {
  draw(g, t) {
    if (t < B.stage[0]) {
      hooding(g, t);
      const inA = 1 - seg(t, 0, 0.5);
      if (inA > 0) { g.fillStyle = rgba(C.night, inA); g.fillRect(0, 0, W, H); }
      return { dark: 1 };
    }
    if (t < B.door[0]) {
      stage(g, t);
      const inA = 1 - seg(t, B.stage[0], B.stage[0] + 0.4);
      if (inA > 0) { g.fillStyle = rgba('#0f0c0a', inA); g.fillRect(0, 0, W, H); }
      return { dark: 1 };
    }
    doorOut(g, t);
    void caps; void circle; void height; void TAU; void clamp; void FONT;
    return { dark: t > B.door[1] - 0.6 ? 0 : 1 };
  },
};
