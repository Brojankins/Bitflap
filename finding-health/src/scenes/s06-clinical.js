// SEQUENCE 6 — CLINICAL SKILLS
// Follow the tubing to the chest piece. Land. Dive through it: the heartbeat becomes a
// sound wave, the sound wave becomes an ECG, the ECG writes a word. A cuff inflates; its
// gauge opens like an aperture onto ultrasound. Then a standardized-patient room, where
// medicine becomes a conversation — and everything slows.
import { W, H, TAU, clamp, lerp, seg, ease, kf, env, spline, pulse, beat, mulberry32, noise3 } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, withCam, stroke, strokePart, circle, glow, layer, makeCanvas, path } from '../lib/draw.js';
import { ecg } from '../lib/anatomy.js';
import { drawFigure, sitPose } from '../lib/figure.js';
import { reveal, caps, font } from '../lib/type.js';

export const B = {
  follow: [0, 1.6],
  land: 1.55,
  dive: [1.8, 2.7],
  pcg: [2.4, 3.7],
  ecg: [3.4, 5.4],
  word: [4.0, 5.4],
  cuff: [5.2, 6.6],
  wipe: [6.4, 7.1],
  pocus: [6.8, 8.8],
  sp: [8.6, 11],
  slow: 9.6,
  close: [10.3, 11],
};

export const cues = [
  { t: 0.0, type: 'tubeSweep', dur: 1.5, gain: 0.6 },
  { t: B.land, type: 'stethLand' },
  ...Array.from({ length: 3 }, (_, i) => ({ t: 1.9 + i * 0.83, type: 'heartbeat', gain: 0.8, muffled: true })),
  ...Array.from({ length: 3 }, (_, i) => ({ t: 3.6 + i * 0.83, type: 'monitorBeep' })),
  { t: B.cuff[0], type: 'cuffPump', dur: 1.2 },
  { t: B.wipe[0], type: 'whoosh' },
  { t: B.pocus[0], type: 'ultrasound', dur: 2.0 },
  { t: B.sp[0], type: 'voices', dur: 1.8 },
  { t: B.close[0] + 0.4, type: 'doorClose' },
];

const BPM = 72;
let SPECKLE;
function init() {
  SPECKLE = makeCanvas(512, 512);
  const g = SPECKLE.getContext('2d');
  const img = g.createImageData(512, 512);
  const r = mulberry32(606);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.pow(r(), 2.2) * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

// tubing in world coords, ending at the chest piece
const CHEST = [2700, 560];
const TUBE = spline([[-200, 700], [300, 760], [900, 640], [1500, 720], [2100, 520], [2480, 520], [CHEST[0] - 110, CHEST[1]]], 16);

function chestPiece(g, x, y, s, a = 1) {
  g.save();
  g.globalAlpha = a;
  g.shadowColor = rgba('#000', 0.5); g.shadowBlur = 50; g.shadowOffsetY = 20;
  const gr = g.createLinearGradient(x - s, y - s, x + s, y + s);
  gr.addColorStop(0, '#e9e7e1'); gr.addColorStop(0.5, '#a7a59e'); gr.addColorStop(1, '#6d6b66');
  circle(g, x, y, s, { fill: gr });
  g.shadowColor = 'transparent';
  circle(g, x, y, s * 0.86, { fill: '#dcd9d0' });
  for (let k = 1; k < 7; k++) circle(g, x, y, s * 0.86 * (k / 7), { stroke: rgba('#8a877f', 0.5), width: 1 });
  circle(g, x, y, s * 0.12, { fill: '#8a877f' });
  // stem
  g.fillStyle = '#9d9b94';
  g.fillRect(x - s - 70, y - 14, 80, 28);
  g.restore();
}

function ecgPaper(g, t, alpha) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = '#f6ece6';
  g.fillRect(0, 0, W, H);
  const off = (t * 250) % 50;
  g.lineWidth = 1;
  for (let x = -off; x < W; x += 10) {
    g.strokeStyle = Math.round((x + off) / 10) % 5 === 0 ? rgba(C.vermilion, 0.42) : rgba(C.ecgGrid, 0.5);
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
  }
  for (let y = 0; y < H; y += 10) {
    g.strokeStyle = (y / 10) % 5 === 0 ? rgba(C.vermilion, 0.42) : rgba(C.ecgGrid, 0.5);
    g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
  }
  g.restore();
}

function trace(g, t, y0, amp, color, width, alpha, fn, pxPerSec = 250) {
  // scrolling strip chart: newest sample at the "pen" (right side)
  const pen = W * 0.78;
  const pts = [];
  for (let x = 0; x <= pen; x += 2) {
    const tt = t - (pen - x) / pxPerSec;
    pts.push([x, y0 - fn(tt) * amp]);
  }
  stroke(g, pts, color, width, alpha);
  glow(g, pen, pts[pts.length - 1][1], 30, C.lamp, alpha * 0.8);
  return pts;
}

function cuffScene(g, t, alpha) {
  if (alpha <= 0) return;
  const inflate = seg(t, B.cuff[0] + 0.2, B.cuff[1] - 0.1, ease.inOutSine);
  g.save();
  g.globalAlpha = alpha;
  fill(g, '#efe7da');
  // an upper arm, resting
  const armY = 700;
  const ag = g.createLinearGradient(0, armY - 130, 0, armY + 130);
  ag.addColorStop(0, '#d9cfbf'); ag.addColorStop(1, '#a9998a');
  g.fillStyle = ag;
  g.beginPath(); g.roundRect(-100, armY - 120, 1500, 240, 120); g.fill();
  // cuff band thickens as it fills
  const th = 150 + inflate * 40;
  g.fillStyle = '#2c3b41';
  g.beginPath(); g.roundRect(380, armY - th, 440, th * 2, 26); g.fill();
  g.strokeStyle = rgba('#ffffff', 0.12); g.lineWidth = 2;
  for (let k = 0; k < 9; k++) { g.beginPath(); g.moveTo(400 + k * 48, armY - th + 14); g.lineTo(400 + k * 48, armY + th - 14); g.stroke(); }
  stroke(g, spline([[800, armY - 60], [980, armY - 260], [1200, armY - 330], [1330, armY - 330]], 10), '#1c1c1c', 10, 1);
  g.restore();
}

function gauge(g, t, x, y, R, alpha) {
  if (alpha <= 0) return;
  const inflate = seg(t, B.cuff[0] + 0.2, B.cuff[1] - 0.1, ease.inOutSine);
  const mmHg = inflate * 180 - seg(t, B.cuff[1] - 0.1, B.wipe[1]) * 60;
  g.save();
  g.globalAlpha = alpha;
  circle(g, x, y, R, { fill: '#f7f3ea', stroke: C.ink, width: R * 0.04 });
  for (let v = 0; v <= 300; v += 10) {
    const a = -Math.PI * 1.25 + (v / 300) * Math.PI * 1.5 + Math.PI / 2 - Math.PI / 2;
    const r0 = R * (v % 50 === 0 ? 0.74 : 0.82);
    stroke(g, [[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * R * 0.9, y + Math.sin(a) * R * 0.9]], C.ink, v % 50 === 0 ? R * 0.018 : R * 0.008);
    if (v % 50 === 0) {
      font(g, FONT.mono, R * 0.09); g.fillStyle = C.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(v), x + Math.cos(a) * R * 0.6, y + Math.sin(a) * R * 0.6);
    }
  }
  const na = -Math.PI * 1.25 + (mmHg / 300) * Math.PI * 1.5;
  stroke(g, [[x, y], [x + Math.cos(na) * R * 0.78, y + Math.sin(na) * R * 0.78]], C.vermilion, R * 0.025);
  circle(g, x, y, R * 0.05, { fill: C.ink });
  font(g, FONT.mono, R * 0.06); g.fillStyle = C.graphite; g.textAlign = 'center';
  g.fillText('mmHg', x, y + R * 0.35);
  g.restore();
}

function pocus(g, t) {
  fill(g, '#0a0b0b');
  const apex = [960, 90], R = 900, half = 0.72;
  const sweep = seg(t, B.pocus[0], B.pocus[0] + 1.1, ease.inOutSine);
  const a0 = -Math.PI / 2 - half + Math.PI; // sector pointing down
  // sector clip, revealed by the sweep
  g.save();
  g.beginPath();
  g.moveTo(apex[0], apex[1]);
  g.arc(apex[0], apex[1], R, Math.PI / 2 + half, Math.PI / 2 + half - sweep * half * 2, true);
  g.closePath();
  g.clip();
  // speckle, modulated by a four-chamber heart
  const pat = g.createPattern(SPECKLE, 'repeat');
  pat.setTransform(new DOMMatrix().translateSelf(Math.sin(t * 3) * 3, 0).scaleSelf(1.6, 0.9));
  g.fillStyle = pat;
  g.globalAlpha = 0.85;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  const bk = pulse(t, BPM, 0, 5) * 0.08;
  const ch = (x, y, rx, ry, rot) => { g.beginPath(); g.ellipse(x, y, rx * (1 - bk), ry * (1 - bk), rot, 0, TAU); g.fill(); };
  g.fillStyle = rgba('#050505', 0.88);
  g.filter = 'blur(10px)';
  ch(880, 560, 95, 150, 0.25); ch(1060, 540, 80, 140, -0.2); ch(880, 800, 90, 95, 0.1); ch(1060, 790, 80, 90, -0.1);
  g.filter = 'none';
  // depth fall-off
  const fo = g.createRadialGradient(apex[0], apex[1], 100, apex[0], apex[1], R);
  fo.addColorStop(0, rgba('#000', 0)); fo.addColorStop(0.7, rgba('#000', 0.1)); fo.addColorStop(1, rgba('#000', 0.75));
  g.fillStyle = fo; g.fillRect(0, 0, W, H);
  // travelling wavefronts
  for (let k = 0; k < 4; k++) {
    const r = ((t * 900 + k * 225) % 900);
    g.strokeStyle = rgba('#ffffff', 0.08 * (1 - r / 900)); g.lineWidth = 3;
    g.beginPath(); g.arc(apex[0], apex[1], r, Math.PI / 2 - half, Math.PI / 2 + half); g.stroke();
  }
  g.restore();
  // sector edges and depth ticks
  g.save();
  g.strokeStyle = rgba('#d9d9d0', 0.5); g.lineWidth = 1.2;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(apex[0], apex[1]); g.lineTo(apex[0] + Math.cos(Math.PI / 2 + s * half) * R, apex[1] + Math.sin(Math.PI / 2 + s * half) * R); g.stroke(); }
  for (let d = 1; d <= 16; d++) {
    const r = (d / 16) * R, a = Math.PI / 2 + half;
    stroke(g, [[apex[0] + Math.cos(a) * r, apex[1] + Math.sin(a) * r], [apex[0] + Math.cos(a) * r - 10, apex[1] + Math.sin(a) * r]], '#d9d9d0', 1, 0.5);
  }
  font(g, FONT.mono, 18); g.fillStyle = rgba('#d9d9d0', 0.7);
  g.fillText('POCUS', 120, 110);
  g.fillText('PHASED ARRAY  ·  CARDIAC', 120, 140);
  g.fillText('DEPTH 16 cm', 120, 170);
  g.fillText(`HR ${BPM}`, 1680, 110);
  g.restore();
  // an anatomical line drawing floats up from beneath the image as it resolves
  const an = env(t, B.pocus[0] + 1.0, B.pocus[0] + 1.5, B.pocus[1] - 0.3, B.pocus[1]);
  if (an > 0) {
    g.save();
    g.globalAlpha = an * 0.8;
    g.strokeStyle = C.lamp; g.lineWidth = 2;
    for (const [x, y, rx, ry, r] of [[880, 560, 110, 165, 0.25], [1060, 540, 95, 155, -0.2], [880, 800, 105, 110, 0.1], [1060, 790, 95, 105, -0.1]]) {
      g.beginPath(); g.ellipse(x, y, rx, ry, r, 0, TAU); g.stroke();
    }
    caps(g, 'LV', 1060, 540, { size: 16, color: C.lamp, tracking: 0.3 });
    caps(g, 'RV', 880, 560, { size: 16, color: C.lamp, tracking: 0.3 });
    caps(g, 'LA', 1060, 790, { size: 16, color: C.lamp, tracking: 0.3 });
    caps(g, 'RA', 880, 800, { size: 16, color: C.lamp, tracking: 0.3 });
    g.restore();
  }
}

function spRoom(g, t) {
  // time slows inside the room
  const tt = t < B.slow ? t : B.slow + (t - B.slow) * 0.35;
  fill(g, '#e6ddcf');
  const floor = 860;
  g.fillStyle = '#d6cbb9'; g.fillRect(0, floor, W, H - floor);
  // window light on the back wall
  const wl = g.createLinearGradient(1180, 200, 1500, 700);
  wl.addColorStop(0, rgba('#fff8e8', 0.9)); wl.addColorStop(1, rgba('#fff8e8', 0.2));
  g.fillStyle = wl; g.fillRect(1180, 200, 300, 420);
  stroke(g, [[1330, 200], [1330, 620]], '#d6cbb9', 6);
  // corner camera: this is a practice room
  circle(g, 1820, 120, 22, { fill: '#2a2a2a' });
  circle(g, 1820, 128, 9, { fill: '#555' });
  caps(g, 'STANDARDIZED PATIENT  ·  ROOM 3', 150, 110, { size: 14, color: C.graphite, tracking: 0.4, align: 'left' });
  // chairs
  for (const [x, dir] of [[760, 1], [1160, -1]]) {
    g.fillStyle = '#5b5148';
    g.fillRect(x - 70 * dir - 10, floor - 330, 14, 330);
    g.fillRect(x - 80, floor - 260, 160, 16);
  }
  const pat = sitPose({ lean: 0.03, headTilt: -0.1 + Math.sin(tt * 1.3) * 0.08, hands: 'lap' });
  drawFigure(g, pat, 760, floor, 560, { color: '#3d342c', dir: 1 });
  const stu = sitPose({ lean: 0.08, headTilt: 0.05 + Math.sin(tt * 0.9 + 1) * 0.05, hands: 'notebook' });
  drawFigure(g, stu, 1160, floor, 560, { color: C.ink, dir: -1, coat: 1, coatColor: '#f4f0e6' });
  // speech as sound: arcs travel from one to the other
  const sp = seg(t, B.sp[0] + 0.3, B.sp[0] + 0.8);
  for (let k = 0; k < 5; k++) {
    const u = (tt * 0.6 + k / 5) % 1;
    const from = k % 2 ? [800, 430] : [1120, 430];
    const dir = k % 2 ? 1 : -1;
    g.save();
    g.globalAlpha = sp * Math.sin(u * Math.PI) * 0.5;
    g.strokeStyle = k % 2 ? C.graphite : C.ochre; g.lineWidth = 2;
    g.beginPath();
    g.arc(from[0] + dir * u * 260, from[1], 20 + u * 60, dir > 0 ? -0.7 : Math.PI - 0.7, dir > 0 ? 0.7 : Math.PI + 0.7);
    g.stroke();
    g.restore();
  }
}

export default {
  init,
  draw(g, t) {
    // ---- 1. follow the tubing to the chest
    if (t < B.dive[1] + 0.1) {
      fill(g, C.umber);
      const camX = lerp(960 - 900, CHEST[0], seg(t, 0, B.follow[1], ease.inOutCubic));
      const dz = seg(t, B.dive[0], B.dive[1], ease.inExpo);
      withCam(g, { x: camX, y: lerp(620, CHEST[1], seg(t, 0.6, B.follow[1])), z: lerp(1, 30, dz) }, () => {
        // the patient's chest: a soft surface waiting beneath
        const cs = seg(t, 0.7, 1.4);
        const cg = g.createRadialGradient(CHEST[0], CHEST[1] + 200, 50, CHEST[0], CHEST[1] + 200, 1100);
        cg.addColorStop(0, '#cdbfae'); cg.addColorStop(1, '#6f6054');
        g.globalAlpha = cs;
        g.fillStyle = cg;
        g.beginPath(); g.ellipse(CHEST[0] + 40, CHEST[1] + 380, 980, 720, 0, 0, TAU); g.fill();
        stroke(g, spline([[CHEST[0] - 900, CHEST[1] - 120], [CHEST[0] - 500, CHEST[1] - 380], [CHEST[0] - 100, CHEST[1] - 520]], 10), rgba(C.sage, 0.8), 30, cs);
        g.globalAlpha = 1;
        stroke(g, TUBE, '#1c1512', 22, 1);
        stroke(g, TUBE.map(([x, y]) => [x - 3, y - 5]), rgba('#ffffff', 0.16), 4, 1);
        const land = seg(t, B.land - 0.5, B.land, ease.outCubic);
        chestPiece(g, CHEST[0], CHEST[1] - (1 - land) * 60, 110);
      });
      if (dz > 0.4) { g.fillStyle = rgba('#050404', (dz - 0.4) / 0.6); g.fillRect(0, 0, W, H); }
      return { dark: 1 };
    }
    // ---- 2. sound → waveform → ECG → word
    if (t < B.cuff[0] + 0.2) {
      fill(g, '#070606');
      const ep = seg(t, B.ecg[0], B.ecg[0] + 0.7, ease.inOutSine);
      ecgPaper(g, t, ep);
      const morph = seg(t, B.ecg[0], B.ecg[0] + 0.9, ease.inOutSine);
      const fn = (tt) => {
        const { ph } = beat(tt, BPM, 0);
        const snd = (Math.exp(-(((ph - 0.23) / 0.02) ** 2)) + 0.7 * Math.exp(-(((ph - 0.5) / 0.016) ** 2))) * Math.sin(tt * 260);
        return lerp(snd * 0.8, ecg(ph), morph);
      };
      const col = ep > 0.5 ? C.ink : C.lamp;
      trace(g, t, 600, lerp(170, 240, morph), col, lerp(2.4, 3, morph), seg(t, B.pcg[0], B.pcg[0] + 0.3) * (1 - seg(t, B.word[0] + 0.6, B.word[0] + 1.2) * 0.7), fn);
      // the trace writes the word
      const wp = seg(t, B.word[0], B.word[0] + 1.0, ease.inOutSine);
      if (wp > 0) {
        g.save();
        font(g, FONT.serif, 260);
        g.textAlign = 'center';
        g.letterSpacing = '0.04em';
        g.lineWidth = 3;
        g.strokeStyle = C.ink;
        g.setLineDash([2200 * wp, 2200]);
        g.strokeText('LISTEN.', 960, 450);
        g.setLineDash([]);
        g.fillStyle = rgba(C.ink, seg(t, B.word[0] + 0.7, B.word[0] + 1.2));
        g.fillText('LISTEN.', 960, 450);
        g.restore();
      }
      const out = seg(t, B.cuff[0] - 0.2, B.cuff[0] + 0.2);
      if (out > 0) { g.fillStyle = rgba('#efe7da', out); g.fillRect(0, 0, W, H); }
      return { dark: ep > 0.5 ? 0 : 1 };
    }
    // ---- 3. cuff → gauge aperture → POCUS
    if (t < B.sp[0]) {
      const wp = seg(t, B.wipe[0], B.wipe[1], ease.inExpo);
      const gx = lerp(1500, 960, seg(t, B.cuff[1] - 0.3, B.wipe[0] + 0.2, ease.inOutCubic));
      const gy = lerp(370, 540, seg(t, B.cuff[1] - 0.3, B.wipe[0] + 0.2, ease.inOutCubic));
      const R = lerp(170, 260, seg(t, B.cuff[1] - 0.3, B.wipe[0] + 0.2)) + wp * 1400;
      cuffScene(g, t, 1);
      gauge(g, t, gx, gy, R, 1 - wp);
      reveal(g, 'EXAMINE.', 150, 990, { size: 58, italic: true, color: C.ink, align: 'left', p: seg(t, B.cuff[0] + 0.3, B.cuff[0] + 1.0), q: seg(t, B.wipe[0], B.wipe[0] + 0.3), stagger: 0.3 });
      if (wp > 0) {
        const { c, g: lg } = layer('pocus', g.canvas.width, g.canvas.height);
        lg.setTransform(g.getTransform());
        pocus(lg, t);
        g.save();
        g.beginPath(); g.arc(gx, gy, Math.max(0, R * 0.95 * ease.inCubic(wp)), 0, TAU); g.clip();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(c, 0, 0);
        g.restore();
      }
      if (t > B.wipe[1]) pocus(g, t);
      const out = seg(t, B.sp[0] - 0.3, B.sp[0]);
      if (out > 0) { g.fillStyle = rgba('#e6ddcf', out); g.fillRect(0, 0, W, H); }
      return { dark: t > B.wipe[0] + 0.3 ? 1 : 0 };
    }
    // ---- 4. the standardized patient — medicine as conversation; time slows
    spRoom(g, t);
    reveal(g, 'COMMUNICATE.', 150, 990, { size: 58, italic: true, color: C.ink, align: 'left', p: seg(t, B.sp[0] + 0.3, B.sp[0] + 1.1), q: seg(t, B.close[0] - 0.4, B.close[0]), stagger: 0.3 });
    // a door closes on the practice room
    const cl = seg(t, B.close[0], B.close[1], ease.inOutCubic);
    if (cl > 0) {
      const x = lerp(W + 40, 0, cl);
      g.fillStyle = '#5a4c40';
      g.fillRect(x, 0, W, H);
      g.fillStyle = rgba('#000', 0.35 * (1 - cl));
      g.fillRect(x - 60, 0, 60, H);
    }
    void noise3; void path; void strokePart; void kf; void TAU; void clamp;
    return { dark: 0 };
  },
};
