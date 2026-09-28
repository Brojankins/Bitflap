// SEQUENCE 14 — MATCH DAY
// Everything stops. An envelope, two hands, a heartbeat that will not slow down. It
// opens. We never see what it says — only what it does to a body: shoulders drop, breath
// leaves. Then a line leaves the envelope and lands somewhere. The future has a direction.
import { W, H, TAU, clamp, lerp, seg, ease, kf, env, pulse, bez } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, stroke, strokePart, circle, glow, path } from '../lib/draw.js';
import { hand, limb, backFigure } from '../lib/figure.js';
import { caps, reveal } from '../lib/type.js';
import { US_OUTLINE, WV_OUTLINE, projector, LEWISBURG } from '../lib/geo.js';

export const B = { title: [0.2, 2.2], tension: [0.6, 3.8], open: [3.9, 4.6], relief: [4.6, 5.6], launch: [5.4, 7.2] };

export const cues = [
  { t: 0.0, type: 'silence' },
  ...Array.from({ length: 9 }, (_, i) => ({ t: 0.6 + i * lerp(0.62, 0.36, i / 8), type: 'heartbeat', gain: 0.5 + i * 0.05 })),
  { t: B.open[0] + 0.05, type: 'envelopeTear' },
  { t: B.relief[0] + 0.1, type: 'exhale' },
  { t: B.launch[0], type: 'launch', dur: 1.6 },
  { t: B.launch[0] + 0.1, type: 'swell', dur: 2.6 },
];

const ENV = { x: 960, y: 600, w: 540, h: 320 };

export default {
  draw(g, t) {
    fill(g, '#100d0b');
    const hb = pulse(t, lerp(96, 140, seg(t, 0.6, 3.8)), 0.6, 8);
    glow(g, 960, 560, 900, '#5a4331', 0.55 + 0.08 * hb * (t < B.open[0] ? 1 : 0));
    const rel = seg(t, B.relief[0], B.relief[1], ease.inOutSine);
    // the student, behind the hands, soft: shoulders drop at the relief
    backFigure(g, 960, 1500, 1350, { color: '#070605', alpha: 0.9, shoulders: lerp(-1.2, 0.8, rel) });
    const launchK = seg(t, B.launch[0], B.launch[1], ease.inOutCubic);
    const tremble = t < B.open[0] ? Math.sin(t * 47) * 1.6 * seg(t, 1, 3.8) : 0;
    const lower = rel * 40 + launchK * 30;
    // the envelope
    const op = seg(t, B.open[0], B.open[1], ease.inOutCubic);
    g.save();
    g.translate(ENV.x + tremble, ENV.y + lower);
    g.shadowColor = rgba('#000', 0.5); g.shadowBlur = 40; g.shadowOffsetY = 20;
    g.fillStyle = '#e9e0cf';
    g.fillRect(-ENV.w / 2, -ENV.h / 2, ENV.w, ENV.h);
    g.shadowColor = 'transparent';
    // the letter's edge rising, catching light — never readable
    if (op > 0) {
      g.fillStyle = '#f8f4ea';
      g.fillRect(-ENV.w / 2 + 24, -ENV.h / 2 - 90 * op, ENV.w - 48, 90 * op + 10);
      glow(g, 0, -ENV.h / 2 - 60 * op, 260, '#fff1c8', op * 0.7);
    }
    // the flap: closed → rotating open
    const fy = lerp(ENV.h * 0.55, -ENV.h * 0.5, op);
    g.fillStyle = op > 0.5 ? '#d9cfbc' : '#e2d8c5';
    g.beginPath(); g.moveTo(-ENV.w / 2, -ENV.h / 2); g.lineTo(0, -ENV.h / 2 + fy); g.lineTo(ENV.w / 2, -ENV.h / 2); g.closePath(); g.fill();
    g.strokeStyle = rgba(C.graphite, 0.35); g.lineWidth = 1.5; g.stroke();
    g.beginPath(); g.moveTo(-ENV.w / 2, ENV.h / 2); g.lineTo(-40, 10); g.moveTo(ENV.w / 2, ENV.h / 2); g.lineTo(40, 10); g.stroke();
    g.restore();
    // two hands holding its sides
    for (const s of [-1, 1]) {
      const wx = ENV.x + s * (ENV.w / 2 + 40) + tremble, wy = ENV.y + 120 + lower;
      g.save();
      g.fillStyle = '#1d1714';
      limb(g, [wx + s * 160, wy + 520], [wx, wy], 140, 110);
      hand(g, wx, wy, 185, -Math.PI / 2 - s * 0.55, { curl: lerp(0.55, 0.3, rel), spread: 0.1, fill: '#1d1714', mirror: s < 0, thumb: 0.8 });
      g.restore();
    }
    caps(g, 'MATCH DAY', 960, 150, { size: 20, color: C.bone, tracking: 0.8, alpha: env(t, B.title[0], B.title[0] + 0.8, B.title[1], B.title[1] + 0.8) });
    // a line launches from the envelope onto the map: direction, not a destination
    if (launchK > 0) {
      const P = projector(-96, 38.6, 52);
      const mapA = seg(t, B.launch[0] + 0.3, B.launch[1]);
      stroke(g, US_OUTLINE.map(P), C.bone, 1.2, mapA * 0.5, true);
      stroke(g, WV_OUTLINE.map(P), C.bone, 1.4, mapA * 0.8, true);
      const start = [ENV.x, ENV.y - ENV.h / 2 - 60];
      const end = [1250, 330]; // deliberately unlabeled
      const arc = bez([start[0], start[1], start[0] + 80, 60, end[0] - 60, 40, end[0], end[1]], 40);
      strokePart(g, arc, 0, launchK, C.gold, 3, 1);
      if (launchK > 0.98) {
        const k = seg(t, B.launch[1] - 0.05, B.launch[1] + 0.8);
        circle(g, end[0], end[1], 8, { fill: C.gold });
        circle(g, end[0], end[1], 10 + k * 60, { stroke: C.gold, width: 2, alpha: 1 - k });
        glow(g, end[0], end[1], 90, C.gold, 0.6);
      }
      void LEWISBURG;
    }
    void reveal; void path; void kf; void TAU; void clamp;
    return { dark: 1 };
  },
};
