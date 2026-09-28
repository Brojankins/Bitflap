// SEQUENCE 9 — COMLEX / THRESHOLD
// Everything learned orbits the student — terms, cases, drugs, diagrams, OMM — faster
// and faster until it smears into light. Then silence. A screen. A click. White. A door
// opens, and beyond it is not another classroom: it is the state.
import { W, H, TAU, clamp, lerp, seg, ease, kf, env, rng, pulse } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { fill, stroke, circle, glow, withCam } from '../lib/draw.js';
import { drawFigure, sitPose, hand } from '../lib/figure.js';
import { reveal, caps, font } from '../lib/type.js';
import { heart, ecg } from '../lib/anatomy.js';
import { campus } from '../lib/campus.js';

export const B = {
  orbit: [0, 4.6],
  stop: 4.7,
  screen: [5.0, 6.2],
  click: 6.35,
  flash: [6.4, 6.9],
  door: [6.8, 8],
};

export const cues = [
  { t: 0.0, type: 'orbitRise', dur: 4.6 },
  { t: 0.0, type: 'tick', dur: 4.6, accel: true },
  { t: B.stop, type: 'silence' },
  { t: 5.2, type: 'keyboard', dur: 0.6 },
  { t: B.click, type: 'click' },
  { t: 6.45, type: 'flashTone' },
  { t: 7.0, type: 'doorOpen', gain: 0.6 },
  { t: 7.2, type: 'airOpen', dur: 1.0 },
];

const WORDS = [
  'brachial plexus', 'Frank-Starling', 'metoprolol', 'COPD', 'Na+ 124', 'OMT', 'counterstrain', 'muscle energy', 'HVLA',
  'nephrotic', 'ACE inhibitor', 'Kussmaul', 'Virchow triad', 'S3 gallop', 'BRCA1', 'cranial nerve VII', 'somatic dysfunction',
  'hypoxemia', 'beta-lactam', 'Graves', 'Chapman points', 'murmur', 'differential', 'HbA1c', 'troponin', 'Kernig', 'lupus',
  'viscerosomatic', 'albuterol', 'rib raising', 'warfarin', 'DKA', 'appendicitis', 'Addison', 'myasthenia', 'P wave',
];
let ORB;
function init() {
  const r = rng(909);
  ORB = WORDS.map((w, i) => ({ w, a: r.range(0, TAU), rr: r.range(0.75, 1.3), tilt: r.range(-0.75, 0.75), sp: r.range(0.8, 1.25), size: r.range(18, 30), kind: i % 9 === 4 ? 'heart' : i % 9 === 7 ? 'ecg' : 'word', y: r.range(-90, 90) }));
}

function desk(g, t, glowA) {
  const floor = 900;
  // monitor glow on the student
  glow(g, 1060, 560, 700, '#9fb3b0', 0.22 * glowA);
  g.fillStyle = '#141211';
  g.fillRect(760, floor - 330, 620, 18); // desk top
  g.fillRect(1320, floor - 312, 18, 312);
  // monitor (seen from the side), its light
  g.fillStyle = '#0c0c0c';
  g.fillRect(1180, floor - 560, 22, 220);
  g.fillRect(1150, floor - 345, 90, 12);
  const sp = seg(t, B.screen[0], B.screen[0] + 0.4);
  g.fillStyle = rgba('#dfe7e4', 0.25 + 0.2 * sp);
  g.beginPath(); g.moveTo(1180, floor - 560); g.lineTo(840, floor - 700); g.lineTo(840, floor - 180); g.lineTo(1180, floor - 340); g.closePath();
  g.globalAlpha = 0.18 * glowA; g.fill(); g.globalAlpha = 1;
  // chair + student
  g.fillStyle = '#1b1816'; g.fillRect(830, floor - 250, 150, 16); g.fillRect(890, floor - 234, 16, 234);
  const pose = sitPose({ lean: 0.1, headTilt: 0.15, hands: 'notebook', seatH: 0.3 });
  drawFigure(g, pose, 900, floor, 640, { color: '#070606', dir: 1 });
  // mouse hand
  const clickDip = env(t, B.click - 0.05, B.click, B.click + 0.02, B.click + 0.12) * 3;
  g.fillStyle = '#232323';
  g.beginPath(); g.ellipse(1105, floor - 340, 34, 14, 0, 0, TAU); g.fill();
  hand(g, 1050, floor - 356 + clickDip, 58, 0.05, { curl: 0.45, fill: '#070606', thumb: 0.2 });
}

function orbit(g, t) {
  const k = seg(t, B.orbit[0], B.orbit[1], ease.inCubic);
  if (t > B.stop + 0.15) return;
  const stopFade = 1 - seg(t, B.stop, B.stop + 0.15);
  const speed = (tt) => 0.25 * tt + 0.55 * tt * tt * tt; // turns, integrated
  const cx = 940, cy = 480;
  const items = ORB.map((o) => {
    const turns = speed(t) * o.sp;
    const ang = o.a + turns * TAU;
    const R = 620 * o.rr;
    const x = cx + Math.cos(ang) * R, z = Math.sin(ang);
    const y = cy + o.y + z * R * 0.22 - Math.cos(ang) * R * Math.sin(o.tilt) * 0.55;
    return { o, x, y, z, ang, R };
  }).sort((a, b) => a.z - b.z);
  for (const it of items) {
    const depth = (it.z + 1) / 2;
    const a = stopFade * lerp(0.25, 1, depth) * seg(t, 0, 0.6);
    const s = lerp(0.6, 1.25, depth);
    // motion smear grows with speed
    const smear = clamp(k * 1.2) * 0.35 * it.o.sp;
    if (smear > 0.02) {
      g.save();
      g.globalAlpha = a * 0.35;
      g.strokeStyle = C.lamp;
      g.lineWidth = 2 * s;
      g.beginPath();
      for (let j = 0; j <= 12; j++) {
        const aa = it.ang - (j / 12) * smear;
        const x = cx + Math.cos(aa) * it.R, zz = Math.sin(aa);
        const y = cy + it.o.y + zz * it.R * 0.22 - Math.cos(aa) * it.R * Math.sin(it.o.tilt) * 0.55;
        if (j === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      g.restore();
    }
    g.save();
    g.globalAlpha = a * (1 - k * 0.5);
    if (it.o.kind === 'heart') heart(g, it.x, it.y, 0.22 * s, pulse(t, 110, 0) * 0.7, { line: C.lamp, vessels: false });
    else if (it.o.kind === 'ecg') {
      const pts = [];
      for (let i = 0; i < 60; i++) pts.push([it.x - 60 * s + i * 2 * s, it.y - ecg((i / 40 + t * 2) % 1) * 30 * s]);
      stroke(g, pts, C.vermilion, 2);
    } else {
      font(g, FONT.mono, it.o.size * s);
      g.fillStyle = depth > 0.5 ? C.light : C.dust;
      g.textAlign = 'center';
      g.fillText(it.o.w, it.x, it.y);
    }
    g.restore();
  }
  // the clock, spinning absurdly
  const cl = seg(t, 1.0, 1.6) * stopFade;
  if (cl > 0) {
    const x = 330, y = 250, R = 70;
    circle(g, x, y, R, { stroke: C.bone, width: 2, alpha: cl });
    const turns = t * 0.4 + t ** 4 * 0.06;
    stroke(g, [[x, y], [x + Math.cos(turns * TAU - Math.PI / 2) * 55, y + Math.sin(turns * TAU - Math.PI / 2) * 55]], C.bone, 2, cl);
    stroke(g, [[x, y], [x + Math.cos(turns * TAU / 12 - Math.PI / 2) * 35, y + Math.sin(turns * TAU / 12 - Math.PI / 2) * 35]], C.bone, 4, cl);
  }
}

function worldBeyond(g, t) {
  // beyond the door: daylight, the campus, and everything past it
  fill(g, C.paper);
  campus(g, { draw: 1, line: C.graphite, glow: 0, door: 0, ground: C.paper, lightColor: C.lamp });
}

export default {
  init,
  draw(g, t) {
    fill(g, '#0b0b0b');
    const zoom = kf(t, [[0, 1], [B.stop, 1.12, ease.linear], [B.screen[1], 1.5, ease.inOutCubic]]);
    withCam(g, { x: lerp(960, 1000, seg(t, B.stop, B.screen[1])), y: 560, z: zoom }, () => {
      desk(g, t, 1);
    });
    orbit(g, t);
    // after the silence: the screen, the words
    const sp = env(t, B.screen[0], B.screen[0] + 0.5, B.flash[0], B.flash[0] + 0.01);
    if (sp > 0) {
      g.save();
      g.globalAlpha = sp;
      reveal(g, 'COMLEX', 960, 300, { size: 170, color: C.light, tracking: 0.18, p: seg(t, B.screen[0], B.screen[0] + 0.8), stagger: 0.4 });
      caps(g, 'LEVEL 1', 960, 370, { size: 24, color: C.bone, tracking: 0.8, alpha: seg(t, B.screen[0] + 0.5, B.screen[0] + 1.0) });
      g.restore();
    }
    // click → white
    const fl = env(t, B.flash[0], B.flash[0] + 0.08, B.flash[1], B.door[0] + 0.5, ease.inOutSine);
    if (t > B.flash[0]) {
      // doors part to reveal the world beyond
      const op = seg(t, B.door[0], B.door[1], ease.inOutCubic);
      if (op > 0) {
        worldBeyond(g, t);
        const half = (W / 2) * (1 - op);
        g.fillStyle = '#f7f2e8';
        g.fillRect(0, 0, half, H);
        g.fillRect(W - half, 0, half, H);
        // leaves swing toward us: bright edges
        g.fillStyle = rgba('#000', 0.08 * (1 - op));
        g.fillRect(half - 30, 0, 30, H);
        g.fillRect(W - half, 0, 30, H);
      }
      if (fl > 0) { g.fillStyle = rgba('#f7f2e8', fl); g.fillRect(0, 0, W, H); }
    }
    return { dark: t < B.flash[0] ? 1 : 0 };
  },
};
