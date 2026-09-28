// SEQUENCE 12 — MEDICINE BECOMES HUMAN
// Diagrams are left behind. One slow lateral pass across fragments: an elderly hand held;
// a child's shoes; a family waiting; teaching at the bedside; 2:14 a.m.; the drive home
// through the mountains. Imperfect, tired, human — not despairing.
import { W, H, TAU, clamp, lerp, seg, ease, kf, env, hash1, noise2, spline } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, stroke, circle, glow, withCam, path } from '../lib/draw.js';
import { hand, drawFigure, sitPose, standPose, limb } from '../lib/figure.js';
import { paperGround } from '../lib/texture.js';
import { caps, font } from '../lib/type.js';

export const cues = [
  { t: 0.0, type: 'roomTone', dur: 6.5, gain: 0.6 },
  { t: 0.3, type: 'pianoNote', note: 60 },
  { t: 2.2, type: 'pianoNote', note: 64 },
  { t: 3.6, type: 'voices', dur: 1.2, gain: 0.25 },
  { t: 4.6, type: 'pianoNote', note: 62 },
  { t: 5.8, type: 'clockTick', dur: 1.4 },
  { t: 7.0, type: 'road', dur: 2.0, gain: 0.7 },
];

const PW = 1150; // panel width
const N = 6;
const INK = '#2b2622', GR = '#6f665b';

function panelFrame(g, x, tone) {
  g.fillStyle = tone;
  g.fillRect(x, 0, PW, H);
}

function p1(g, x, t) {
  // an elderly hand, held
  panelFrame(g, x, '#d8cfc1');
  glow(g, x + 700, 300, 700, '#fff3dc', 0.5);
  g.save();
  hand(g, x + 360, 700, 330, -0.35, { curl: 0.25, spread: 0.15, fill: '#5c5046', thumb: 0.5, mirror: true });
  hand(g, x + 300, 560, 300, 0.25, { curl: 0.1, spread: 0.22, fill: '#b9ab98', thumb: 0.3 });
  // a vein across the back of the older hand
  g.strokeStyle = rgba('#6e6a86', 0.3); g.lineWidth = 3;
  g.beginPath(); g.moveTo(x + 250, 560); g.bezierCurveTo(x + 330, 545, x + 380, 585, x + 470, 565); g.stroke();
  g.restore();
}

function p2(g, x, t) {
  // a child's shoes, dangling from the exam table
  panelFrame(g, x, '#e0d6c6');
  g.fillStyle = '#efe9de'; g.fillRect(x, 330, PW, 34); // paper sheet
  g.fillStyle = '#8c8174'; g.fillRect(x, 364, PW, 70);
  const sw = Math.sin(t * 4.2);
  for (const [dx, ph] of [[420, 0], [560, 1.3]]) {
    g.save();
    g.translate(x + dx, 434);
    g.rotate(Math.sin(t * 4.2 + ph) * 0.28);
    g.fillStyle = '#4d5a66'; g.fillRect(-18, 0, 36, 190);
    g.fillStyle = '#f1ece2'; g.fillRect(-19, 190, 38, 20);
    g.fillStyle = '#c4462e'; g.beginPath(); g.roundRect(-24, 206, 88, 44, 20); g.fill();
    g.fillStyle = '#f1ece2'; g.fillRect(-10, 212, 50, 5);
    g.restore();
  }
  void sw;
}

function p3(g, x, t) {
  // a family, waiting
  panelFrame(g, x, '#cfc6b8');
  const floor = 860;
  g.fillStyle = '#b9ae9e'; g.fillRect(x, floor, PW, H - floor);
  for (let i = 0; i < 4; i++) { g.fillStyle = '#6f665b'; g.fillRect(x + 180 + i * 210, floor - 250, 170, 14); g.fillRect(x + 260 + i * 210, floor - 236, 10, 236); }
  drawFigure(g, sitPose({ lean: 0.14, headTilt: 0.4, hands: 'knees' }), x + 270, floor, 560, { color: INK });
  drawFigure(g, sitPose({ lean: 0.02, headTilt: -0.1, hands: 'lap' }), x + 480, floor, 560, { color: '#3d3630' });
  drawFigure(g, sitPose({ lean: 0.1, headTilt: 0.5, hands: 'lap', seatH: 0.42, feet: 'dangle', swing: Math.sin(t * 3) }), x + 690, floor - 20, 330, { color: '#4a423a' });
  // the clock on the wall that does not move
  circle(g, x + 900, 230, 60, { fill: '#e9e3d8', stroke: INK, width: 3 });
  stroke(g, [[x + 900, 230], [x + 900 + 30, 230 + 20]], INK, 4);
  stroke(g, [[x + 900, 230], [x + 900 - 8, 230 - 46]], INK, 2);
}

function p4(g, x, t) {
  // teaching at the bedside
  panelFrame(g, x, '#d3cabb');
  const floor = 880;
  g.fillStyle = '#8c8174'; g.fillRect(x + 150, floor - 330, 560, 26);
  g.fillStyle = '#efe9de'; g.beginPath(); g.roundRect(x + 160, floor - 400, 540, 80, 30); g.fill(); // blanket
  circle(g, x + 210, floor - 402, 40, { fill: '#5a5047' }); // patient's head on the pillow
  g.fillStyle = '#6f665b'; g.fillRect(x + 170, floor - 304, 12, 304); g.fillRect(x + 680, floor - 304, 12, 304);
  const att = standPose({ reach: 0.7, reachY: -0.62, headTilt: 0.2 });
  drawFigure(g, att, x + 820, floor, 660, { color: INK, dir: -1, coat: 1, coatColor: '#ece6da' });
  const stu = standPose({ reach: 0.2, headTilt: 0.35 + Math.sin(t * 1.2) * 0.05 });
  drawFigure(g, stu, x + 980, floor, 640, { color: '#3d3630', dir: -1, coat: 1, coatColor: '#f4efe5' });
}

function p5(g, x, t) {
  // 2:14 a.m. — a lamp, a book, a question not yet answered
  panelFrame(g, x, '#1d1a17');
  glow(g, x + 520, 420, 520, '#f2d6a0', 0.55);
  const floor = 880;
  g.fillStyle = '#0e0c0b'; g.fillRect(x + 150, floor - 320, 800, 20);
  const pose = sitPose({ lean: 0.2, headTilt: 0.9, hands: 'notebook', seatH: 0.3 });
  drawFigure(g, pose, x + 330, floor, 600, { color: '#0e0c0b', dir: 1 });
  // lamp
  stroke(g, [[x + 820, floor - 320], [x + 780, floor - 520], [x + 700, floor - 560]], '#0e0c0b', 8);
  g.fillStyle = '#0e0c0b'; g.beginPath(); g.moveTo(x + 660, floor - 590); g.lineTo(x + 760, floor - 560); g.lineTo(x + 700, floor - 520); g.closePath(); g.fill();
  // open book in the light
  g.fillStyle = '#efe6d2'; g.beginPath(); g.moveTo(x + 520, floor - 326); g.lineTo(x + 610, floor - 344); g.lineTo(x + 700, floor - 326); g.lineTo(x + 610, floor - 322); g.closePath(); g.fill();
  font(g, FONT.mono, 44); g.fillStyle = rgba('#c4462e', 0.85);
  g.fillText('2:14', x + 850, 250);
  caps(g, 'AM', x + 960, 238, { size: 16, color: '#c4462e', align: 'left', tracking: 0.3, alpha: 0.85 });
}

function p6(g, x, t) {
  // the drive home, through the mountains, at night
  panelFrame(g, x, '#11151a');
  circle(g, x + 850, 190, 26, { fill: '#e9e4d6', alpha: 0.9 });
  glow(g, x + 850, 190, 160, '#e9e4d6', 0.15);
  const ridge = (y0, amp, col, k) => {
    const pts = [[x, H]];
    for (let i = 0; i <= 60; i++) pts.push([x + (i / 60) * PW, y0 - Math.abs(noise2(i * 0.12 + k, k)) * amp - Math.sin(i * 0.15 + k) * amp * 0.3]);
    pts.push([x + PW, H]);
    path(g, pts, true); g.fillStyle = col; g.fill();
  };
  ridge(560, 180, '#1d242b', 2); ridge(640, 140, '#161c22', 5);
  // road to the vanishing point; the same vanishing point as the corridor ahead
  const vx = x + 575, vy = 500;
  g.fillStyle = '#0c0f12';
  g.beginPath(); g.moveTo(vx - 6, vy); g.lineTo(vx + 6, vy); g.lineTo(x + PW, H); g.lineTo(x - 200, H); g.closePath(); g.fill();
  for (let k = 0; k < 12; k++) {
    const u = ((k + t * 2.2) % 12) / 12;
    const z = 1 / (0.05 + u * 0.95);
    const y = vy + (H - vy) / z, y2 = vy + (H - vy) / (z * 0.9);
    const xm = vx + ((x + 200) - vx) * ((y - vy) / (H - vy)) * 0.9;
    stroke(g, [[xm, y], [vx + ((x + 200) - vx) * ((y2 - vy) / (H - vy)) * 0.9, y2]], '#e9d9a8', 2 + 6 / z, 0.8);
  }
  glow(g, vx, vy + 10, 120, '#e9d9a8', 0.25);
}

const PANELS = [p1, p2, p3, p4, p5, p6];

export default {
  draw(g, t, { dur }) {
    fill(g, '#1a1714');
    const span = PW * (N - 1) + (960 - 480) * 0; // finish centred on the road's vanishing point
    const endX = PW * 5 + 575; // world x of the road's vanishing point
    const cx = kf(t, [[0, PW * 0.5], [dur - 0.8, endX, ease.inOutSine], [dur, endX]]);
    // settle onto the road; its vanishing point becomes the corridor's (960, 500)
    const z = kf(t, [[dur - 2.0, 1], [dur - 0.3, 1.85, ease.inOutCubic], [dur, 1.85]]);
    withCam(g, { x: cx, y: 500, sy: 500, z }, () => {
      PANELS.forEach((f, i) => {
        const x = i * PW;
        if (Math.abs(x + PW / 2 - cx) > PW + W / 2) return;
        g.save();
        g.beginPath(); g.rect(x, 0, PW, H); g.clip();
        f(g, x, t);
        g.restore();
        // a sliver of light between fragments
        g.fillStyle = rgba('#f4ead6', 0.8);
        g.fillRect(x + PW - 3, 0, 6, H);
      });
    });
    const inA = 1 - seg(t, 0, 0.5);
    if (inA > 0) { g.fillStyle = rgba('#e9e1d2', inA); g.fillRect(0, 0, W, H); }
    void span; void limb; void hash1; void spline; void TAU; void clamp; void lerp; void env; void paperGround;
    return { dark: 0.6 };
  },
};
