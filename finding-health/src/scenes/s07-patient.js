// SEQUENCE 7 — THE FIRST PATIENT
// Almost no music. A corridor wall, a door, a number. A hand reaches for the handle and
// stops for one heartbeat. Inside: no anatomy, no spectacle — two people. The student
// sits, closes the notebook, looks up, and listens. We hold longer than is comfortable.
import { W, H, TAU, clamp, lerp, seg, ease, kf, env, noise2, hash1 } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, withCam, stroke, glow, path } from '../lib/draw.js';
import { backFigure, drawFigure, sitPose, hand, limb } from '../lib/figure.js';
import { caps, font } from '../lib/type.js';
import { lungOutline } from '../lib/anatomy.js';

export const B = {
  pull: [0, 1.6],
  plaque: [1.2, 2.2],
  reach: [3.0, 4.6],
  beat: 4.25,
  open: [4.9, 5.9],
  inside: 5.7,
  sit: [5.9, 6.8],
  close: [7.2, 7.8],
  look: [7.9, 8.6],
  breathe: [10.4, 12],
};

export const cues = [
  { t: 0.0, type: 'hallAmbience', dur: 5.5 },
  { t: 0.6, type: 'footsteps', dur: 1.0, gain: 0.5 },
  { t: B.beat, type: 'heartbeat', gain: 1.0 },
  { t: 4.65, type: 'handle' },
  { t: B.open[0] + 0.1, type: 'doorOpen', gain: 0.7 },
  { t: B.inside, type: 'roomTone', dur: 5.3 },
  { t: B.close[0] + 0.3, type: 'notebookClose' },
  { t: 8.2, type: 'pianoNote', note: 57 },
  { t: 10.4, type: 'breath', dur: 1.6 },
];

const DOORC = '#5a4c40';
const D = { x: 1040, y: 250, w: 360, h: 700 }; // the door, frontal

function corridor(g, t) {
  // wall
  const wg = g.createLinearGradient(0, 0, 0, H);
  wg.addColorStop(0, '#bdb3a4'); wg.addColorStop(0.82, '#a89d8d'); wg.addColorStop(0.82, '#7d7266'); wg.addColorStop(1, '#6b6157');
  g.fillStyle = wg;
  g.fillRect(-400, -200, W + 800, H + 400);
  // handrail, baseboard
  g.fillStyle = '#8f8476'; g.fillRect(-400, 610, W + 800, 18);
  g.fillStyle = rgba('#fff', 0.18); g.fillRect(-400, 610, W + 800, 3);
  g.fillStyle = '#5a5047'; g.fillRect(-400, 880, W + 800, 16);
  // overhead fluorescent spill
  const lg = g.createRadialGradient(760, -80, 20, 760, -80, 900);
  lg.addColorStop(0, rgba('#f4f1e8', 0.55)); lg.addColorStop(1, rgba('#f4f1e8', 0));
  g.fillStyle = lg; g.fillRect(-400, -200, W + 800, 1200);
  // door frame + door
  g.fillStyle = '#6f6356'; g.fillRect(D.x - 22, D.y - 22, D.w + 44, D.h + 22);
  g.fillStyle = DOORC; g.fillRect(D.x, D.y, D.w, D.h);
  g.strokeStyle = rgba('#000', 0.18); g.lineWidth = 2;
  g.strokeRect(D.x + 40, D.y + 60, D.w - 80, 220);
  // narrow vision panel: light from the room behind
  g.fillStyle = rgba('#f2e3c4', 0.8); g.fillRect(D.x + D.w - 90, D.y + 90, 36, 200);
  // lever handle
  g.fillStyle = '#b9b5ab';
  g.beginPath(); g.roundRect(D.x + 30, D.y + 380, 90, 16, 8); g.fill();
  g.beginPath(); g.arc(D.x + 40, D.y + 388, 16, 0, TAU); g.fill();
  // the plaque
  g.fillStyle = '#2b2622'; g.fillRect(D.x + D.w + 60, D.y + 250, 150, 84);
  font(g, FONT.sans, 15, 500); g.letterSpacing = '0.3em'; g.fillStyle = '#d8d2c4';
  g.fillText('ROOM', D.x + D.w + 82, D.y + 280);
  font(g, FONT.sans, 34, 400); g.letterSpacing = '0.12em';
  g.fillText('204', D.x + D.w + 80, D.y + 318);
  g.letterSpacing = '0px';
}

function exterior(g, t) {
  const z = kf(t, [[0, 9], [B.pull[1], 1.0, ease.house], [B.reach[0], 1.08, ease.linear], [B.reach[0] + 0.6, 2.6, ease.inOutCubic]]);
  const fx = kf(t, [[0, D.x + D.w / 2], [B.pull[1], 960, ease.house], [B.reach[0], 980], [B.reach[0] + 0.6, D.x + 90, ease.inOutCubic]]);
  const fy = kf(t, [[0, D.y + D.h / 2], [B.pull[1], 560, ease.house], [B.reach[0], 560], [B.reach[0] + 0.6, D.y + 380, ease.inOutCubic]]);
  withCam(g, { x: fx, y: fy, z }, () => {
    corridor(g, t);
    // the student, facing the door, very still
    const breath = Math.sin(t * 1.6) * 0.004;
    backFigure(g, 820, 1010, 900 * (1 + breath), { color: '#1a1714', coat: 1, coatColor: '#ece7dc', shoulders: 0.3, alpha: 1 - seg(t, B.reach[0], B.reach[0] + 0.4) });
    // the reaching hand (close-up)
    const rp = seg(t, B.reach[0] + 0.3, B.beat - 0.05, ease.outCubic);
    const grip = seg(t, B.beat + 0.3, B.beat + 0.6, ease.inOutSine);
    if (rp > 0) {
      const hx = lerp(820, D.x + 12, rp) + grip * 12;
      const hy = lerp(760, D.y + 400, rp);
      g.save();
      g.fillStyle = '#ece7dc';
      limb(g, [hx - 360, hy + 150], [hx - 60, hy + 18], 96, 80); // white coat sleeve
      g.restore();
      hand(g, hx - 60, hy + 18, 88, -0.12, { curl: lerp(0.15, 0.85, grip), spread: 0.1, fill: '#2a231e', thumb: 0.5 });
    }
  });
}

function interior(g, t) {
  const lt = t - B.inside;
  // a quiet room, afternoon light
  fill(g, '#d9cfbf');
  const floor = 880;
  g.fillStyle = '#c6baa7'; g.fillRect(0, floor, W, H - floor);
  const wl = g.createLinearGradient(260, 140, 700, 800);
  wl.addColorStop(0, rgba('#fff6e2', 0.95)); wl.addColorStop(1, rgba('#fff6e2', 0.25));
  g.fillStyle = wl; g.fillRect(250, 150, 360, 520);
  g.fillStyle = '#c9bca9'; g.fillRect(425, 150, 10, 520); g.fillRect(250, 405, 360, 10);
  // light falling across the floor
  g.fillStyle = rgba('#fff6e2', 0.25);
  g.beginPath(); g.moveTo(250, floor); g.lineTo(610, floor); g.lineTo(980, H); g.lineTo(420, H); g.closePath(); g.fill();
  // dust in the light
  for (let i = 0; i < 40; i++) {
    const x = 300 + hash1(i * 3) * 500 + noise2(i, lt * 0.2) * 40;
    const y = 200 + ((hash1(i * 7) * 700 + lt * 12) % 700);
    g.fillStyle = rgba('#fff6e2', 0.35 * hash1(i * 11));
    g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill();
  }
  // exam table with its paper sheet
  g.fillStyle = '#6e645a'; g.fillRect(640, floor - 330, 520, 60);
  g.fillStyle = '#f2ede3'; g.fillRect(640, floor - 344, 520, 16);
  g.fillStyle = '#4c443d'; g.fillRect(680, floor - 270, 440, 270);
  // stool
  g.fillStyle = '#4c443d'; g.fillRect(1440, floor - 250, 170, 20); g.fillRect(1515, floor - 230, 18, 230);
  // the patient, sitting on the edge of the table
  const pb = Math.sin(lt * 1.3) * 0.006;
  const pat = sitPose({ lean: 0.02, headTilt: -0.05, hands: 'knees', seatH: 0.48, feet: 'dangle', swing: 0 });
  drawFigure(g, pat, 930, floor - 90 - 0, 720 * (1 + pb), { color: '#4b4038', dir: 1 });
  // the student sits, closes the notebook, looks up
  const sitK = seg(t, B.sit[0], B.sit[1], ease.inOutSine);
  const look = seg(t, B.look[0], B.look[1], ease.inOutSine);
  const stu = sitPose({ lean: lerp(0.12, 0.04, look), headTilt: lerp(0.9, -0.12, look), hands: 'notebook', seatH: lerp(0.5, 0.33, sitK), handLift: 0 });
  const sx = 1520, sy = floor;
  drawFigure(g, stu, sx, sy, 720, { color: C.ink, dir: -1, coat: 1, coatColor: '#f1ece2' });
  // notebook on the lap: open, then closed
  const cl = seg(t, B.close[0], B.close[1], ease.inOutCubic);
  const nx = sx - (stu.near.wrist[0]) * 720, ny = sy + stu.near.wrist[1] * 720;
  g.save();
  g.translate(nx - 10, ny - 18);
  g.rotate(-0.12);
  const w = lerp(150, 78, cl);
  g.fillStyle = '#f6f2ea'; g.fillRect(-w, -8, w * 2 * (1 - cl * 0.5), 10);
  g.fillStyle = '#28303a'; g.fillRect(-w, 2, w * 2 * (1 - cl * 0.5), 5 + cl * 5);
  g.restore();
  // breath: the lungs, faintly, as the camera leans in (into the next sequence)
  const bp = seg(t, B.breathe[0], B.breathe[1], ease.inOutSine);
  if (bp > 0) {
    const chest = [930 + pat.chest[0] * 720 + 10, floor - 90 + (pat.chest[1] + 0.08) * 720];
    g.save();
    g.globalAlpha = bp * 0.8;
    g.translate(chest[0], chest[1]);
    const sc = 0.32 * (1 + Math.sin(lt * 1.3) * 0.03);
    g.scale(sc, sc);
    for (const s of [-1, 1]) {
      const o = lungOutline(s, 1);
      stroke(g, o, C.lamp, 3 / sc * 0.6, 1, true);
    }
    g.restore();
  }
}

export default {
  draw(g, t) {
    if (t < B.inside) {
      exterior(g, t);
      // heartbeat: the frame tightens for a moment
      const hb = env(t, B.beat - 0.02, B.beat + 0.05, B.beat + 0.1, B.beat + 0.5);
      if (hb > 0) { g.fillStyle = rgba('#000', 0.12 * hb); g.fillRect(0, 0, W, H); }
      // the door opens toward the light
      const op = seg(t, B.open[0], B.open[1], ease.inCubic);
      if (op > 0) { g.globalCompositeOperation = 'screen'; g.fillStyle = rgba('#f2e3c4', op); g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
      return { dark: 0.4 };
    }
    const z = kf(t, [[B.inside, 1.06], [B.breathe[0], 1.0, ease.linear], [B.breathe[1], 3.4, ease.inCubic]]);
    const fx = kf(t, [[B.breathe[0], 1000], [B.breathe[1], 945, ease.inOutCubic]]);
    const fy = kf(t, [[B.breathe[0], 560], [B.breathe[1], 290, ease.inOutCubic]]);
    withCam(g, { x: fx, y: fy, z }, () => interior(g, t));
    const inA = 1 - seg(t, B.inside, B.inside + 0.6);
    if (inA > 0) { g.fillStyle = rgba('#f2e3c4', inA); g.fillRect(0, 0, W, H); }
    // towards the next sequence: the room darkens around the breath
    const dk = seg(t, B.breathe[0] + 0.6, B.breathe[1], ease.inCubic);
    if (dk > 0) { g.fillStyle = rgba(C.slate, dk); g.fillRect(0, 0, W, H); }
    void caps; void glow; void path; void clamp;
    return { dark: dk > 0.5 ? 1 : 0 };
  },
};
