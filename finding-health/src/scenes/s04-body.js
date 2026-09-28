// SEQUENCE 4 — LEARNING THE HUMAN BODY
// The coat's white becomes an atlas plate. Bone assembles in space, muscle wraps it,
// fascia veils it, nerves ignite, blood moves. Zoom into tissue; the tissue tilts into a
// landscape the student walks across; pull back — it was a plate in an atlas all along,
// where the organ systems are drawn connected. A heart. One contraction pushes us on.
import { W, H, TAU, clamp, lerp, seg, ease, kf, env, rng, pulse, bez } from '../lib/core.js';
import { C, FONT, rgba } from '../config/design.js';
import { withCam, stroke, strokePart, callout, cropMarks, path, circle, glow } from '../lib/draw.js';
import { paperGround } from '../lib/texture.js';
import { caps, font } from '../lib/type.js';
import { skeletonParts, muscle, heart, histology, lungOutline, branchTree, drawTree, kidney, cell } from '../lib/anatomy.js';
import { drawFigure, walkPose } from '../lib/figure.js';

export const B = {
  bones: [0.2, 3.6],
  muscle: [3.2, 6.0],
  fascia: [5.2, 6.8],
  nerves: [6.2, 8.2],
  blood: [6.8, 8.6],
  zoom: [8.4, 10.8],
  land: [10.4, 13.6],
  atlas: [13.2, 15.8],
  heart: [15.4, 18],
  contraction: 17.35,
};

export const cues = [
  ...Array.from({ length: 14 }, (_, i) => ({ t: 0.3 + i * 0.22, type: 'boneClick', gain: 0.25 + (i % 3) * 0.08 })),
  { t: 3.3, type: 'fibre', dur: 2.4 },
  { t: 5.3, type: 'shimmer', dur: 1.4 },
  { t: 6.3, type: 'nerveSpark', dur: 1.6 },
  { t: 6.9, type: 'flow', dur: 1.6 },
  { t: 8.5, type: 'zoomRise', dur: 2.2 },
  { t: 10.6, type: 'wind', dur: 3 },
  { t: 13.4, type: 'pageTurn', gain: 0.8 },
  ...Array.from({ length: 3 }, (_, i) => ({ t: 15.6 + i * 0.85, type: 'heartbeat', gain: 0.5 + i * 0.1 })),
  { t: B.contraction, type: 'bigBeat' },
];

let PARTS, OFFS, BRONCHI;
const SK = { x: 960, y: 560, s: 0.7 }; // skeleton placement on the plate

function init() {
  PARTS = skeletonParts().sort((a, b) => a.z - b.z);
  const r = rng(404);
  OFFS = PARTS.map((p, i) => {
    const order = p.id.startsWith('v') ? parseInt(p.id.slice(1)) * 0.02 : p.id.startsWith('rib') ? 0.6 + parseInt(p.id.slice(3)) * 0.05 : { skull: 0.9, mandible: 1.0, pelvis: 0.5, sternum: 1.3 }[p.id] ?? 1.5 + r.next() * 0.6;
    const a = r.range(0, TAU);
    return { dx: Math.cos(a) * r.range(500, 1100), dy: Math.sin(a) * r.range(400, 800), rot: r.range(-1.6, 1.6), t0: B.bones[0] + order * 1.25 };
  });
  BRONCHI = branchTree(71, 0, -60, Math.PI / 2, 38, 6, { spread: 0.55, shrink: 0.78, jitter: 0.3, curve: 0.3, widthRoot: 5 });
  histology();
}

// ---------------------------------------------------------------- the body plate
function skeleton(g, t) {
  PARTS.forEach((p, i) => {
    const o = OFFS[i];
    const k = seg(t, o.t0, o.t0 + 0.9, ease.outExpo);
    if (k <= 0) return;
    g.save();
    g.translate(o.dx * (1 - k), o.dy * (1 - k));
    g.translate(p.cx, p.cy);
    g.rotate(o.rot * (1 - k));
    g.translate(-p.cx, -p.cy);
    p.draw(g, Math.min(1, k * 2));
    g.restore();
  });
}

function muscles(g, t) {
  const M = (i) => seg(t, B.muscle[0] + i * 0.28, B.muscle[0] + i * 0.28 + 1.3, ease.inOutSine);
  for (const s of [-1, 1]) {
    muscle(g, [s * 30, -150], [s * 90, -212], [s * 70, -395], [s * 6, 0], M(0), { fibres: 7, alpha: 0.5 }); // sternocleidomastoid
    muscle(g, [s * 70, -208], [s * 20, -40], [s * 235, -165], [0, -10], M(1), { fibres: 22, alpha: 0.5 }); // pectoralis major
    muscle(g, [s * 130, -222], [s * 212, -238], [s * 252, -95], [s * 38, 10], M(2), { fibres: 14, alpha: 0.55 }); // deltoid
    muscle(g, [s * 225, -190], [s * 240, -190], [s * 272, 88], [s * -28, 0], M(3), { fibres: 8, alpha: 0.55 }); // biceps brachii
    muscle(g, [s * 12, -20], [s * 88, -20], [s * 30, 295], [s * 12, 0], M(4), { fibres: 10, alpha: 0.45 }); // rectus abdominis
    muscle(g, [s * 215, -60], [s * 222, 130], [s * 80, 210], [s * 20, 30], M(5), { fibres: 16, alpha: 0.4 }); // external oblique
    muscle(g, [s * 262, 80], [s * 290, 70], [s * 312, 295], [s * -18, 0], M(6), { fibres: 8, alpha: 0.5 }); // forearm flexors
    // tendinous intersections of rectus
    for (const y of [40, 115, 190]) strokePart(g, [[s * 14, y], [s * 80, y - 6]], 0, M(4), C.light, 2, 0.7);
  }
}

function bodyOutline() {
  const half = bez([
    0, -610,
    60, -610, 95, -560, 92, -480, 88, -420, 70, -385, 64, -350,
    100, -300, 200, -268, 250, -250,
    300, -220, 300, -100, 300, 60,
    320, 150, 345, 250, 340, 320,
    300, 330, 290, 250, 270, 150,
    250, 100, 235, 60, 225, -40,
    220, 60, 230, 150, 250, 300,
    255, 400, 240, 560, 230, 640,
    100, 640, 60, 640, 0, 640,
  ], 10);
  return [...half, ...half.slice().reverse().map(([x, y]) => [-x, y])];
}
let BODY;

function fascia(g, t) {
  const p = seg(t, B.fascia[0], B.fascia[1], ease.inOutSine);
  if (p <= 0) return;
  BODY = BODY || bodyOutline();
  g.save();
  path(g, BODY, true);
  g.clip();
  const y1 = lerp(-640, 700, p);
  g.beginPath();
  g.rect(-500, -700, 1000, y1 + 700);
  g.clip();
  g.fillStyle = rgba(C.fascia, 0.3);
  g.fillRect(-500, -700, 1000, 1400);
  // fascial web: long, slightly wandering lines
  g.strokeStyle = rgba('#ffffff', 0.55);
  g.lineWidth = 0.8;
  for (let i = -30; i <= 30; i++) {
    g.beginPath();
    for (let y = -640; y <= 660; y += 20) {
      const x = i * 13 + Math.sin(y * 0.012 + i * 0.7) * 8 + Math.sin(y * 0.03 + i) * 3;
      if (y === -640) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}

function nervesAndVessels(g, t) {
  const np = seg(t, B.nerves[0], B.nerves[1], ease.inOutSine);
  const bp = seg(t, B.blood[0], B.blood[1], ease.inOutSine);
  if (bp > 0) {
    // vessels
    const aorta = bez([40, -110, 20, -190, -40, -200, -30, -130, -28, 0, -26, 120, -20, 250], 16);
    const iliac = [bez([-20, 250, -60, 290, -110, 330, -130, 420], 8), bez([-20, 250, 30, 290, 110, 330, 130, 420], 8)];
    const arms = [-1, 1].map((s) => bez([s * 10, -190, s * 120, -200, s * 220, -180, s * 240, -80, s * 250, 20, s * 280, 150, s * 300, 290], 18));
    g.save();
    g.setLineDash([14, 10]);
    g.lineDashOffset = -t * 90;
    for (const v of [aorta, ...iliac, ...arms]) strokePart(g, v, 0, bp, C.blood, 3.2, 0.85);
    g.restore();
    heart(g, 38, -70, 0.42, pulse(t, 72, 6.8) * 0.8, { alpha: bp, lw: 3 });
  }
  if (np > 0) {
    const cord = [[0, -330], [0, 250]];
    strokePart(g, cord, 0, np, C.ochre, 5, 1);
    for (let i = 0; i < 12; i++) {
      for (const s of [-1, 1]) {
        const y0 = -205 + i * 22;
        const wx = 70 + Math.sin(Math.min(1, (i + 1) / 7) * Math.PI * 0.5) * 150 - Math.max(0, i - 7) * 8;
        const pts = bez([s * 4, y0 + 6, s * wx * 0.7, y0 - 26, s * wx * 1.08, y0 + 18 + i * 3, s * wx * 0.92, y0 + 78 + i * 5], 14);
        strokePart(g, pts, 0, clamp(np * 1.6 - i * 0.05), C.ochre, 2.2, 0.95);
      }
    }
    for (const s of [-1, 1]) {
      const plexus = bez([s * 20, -300, s * 110, -250, s * 200, -170, s * 238, -60, s * 258, 60, s * 292, 160, s * 318, 300], 20);
      strokePart(g, plexus, 0, np, C.ochre, 3.2, 1);
      // travelling impulses
      for (let k = 0; k < 3; k++) {
        const u = ((t * 0.9 + k / 3) % 1);
        if (u < np) {
          const i = Math.floor(u * (plexus.length - 1));
          glow(g, plexus[i][0], plexus[i][1], 30, C.gold, np);
        }
      }
    }
  }
}

const LABELS = [
  ['cranium', [70, -560], [200, -600]], ['clavicle', [150, -210], [360, -300]], ['sternum', [0, -120], [-260, -330]],
  ['humerus', [-245, -40], [-420, -40]], ['costal cartilage', [60, -40], [380, -10]], ['vertebral column', [0, 150], [-360, 180]],
  ['ilium', [180, 280], [390, 300]],
];

function plate(g, t, alpha) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  cropMarks(g, 260, 60, 1400, 960, C.ink, 0.45 * seg(t, 0, 0.6));
  font(g, FONT.mono, 14);
  g.fillStyle = C.graphite;
  g.globalAlpha = alpha * seg(t, 0.2, 0.8);
  g.fillText('PLATE I', 290, 100);
  g.textAlign = 'right';
  g.fillText(t < B.muscle[0] ? 'THE AXIAL & APPENDICULAR SKELETON' : t < B.nerves[0] ? 'MUSCLE  ·  FASCIA' : 'NERVE  ·  VESSEL', 1630, 100);
  g.globalAlpha = alpha;
  g.restore();
  g.save();
  g.globalAlpha = alpha;
  g.translate(SK.x, SK.y);
  g.scale(SK.s, SK.s);
  skeleton(g, t);
  muscles(g, t);
  fascia(g, t);
  nervesAndVessels(g, t);
  LABELS.forEach(([txt, a, b], i) => callout(g, a[0], a[1], b[0], b[1], txt, env(t, 1.6 + i * 0.22, 2.4 + i * 0.22, 5.4, 6.0), { size: 26 }));
  g.restore();
}

// ---------------------------------------------------------------- histology → landscape
function histoPlane(g, t, tilt, scroll, alpha, zoom) {
  if (alpha <= 0) return;
  const tex = histology();
  const pat = g.createPattern(tex, 'repeat');
  const k = g.canvas.width / W;
  g.save();
  g.globalAlpha = alpha;
  if (tilt <= 0.001) {
    // flat: texture filling the frame, magnified
    const m = new DOMMatrix().translateSelf(W / 2, H / 2).scaleSelf(zoom, zoom).translateSelf(-512, -512 - scroll);
    pat.setTransform(m);
    g.fillStyle = pat;
    g.fillRect(0, 0, W, H);
  } else {
    // perspective ground plane: horizon rises from below the frame as tilt grows
    const horizon = lerp(-2400, 430, ease.outCubic(tilt));
    const f = 900, camH = 260;
    // sky
    const sky = g.createLinearGradient(0, 0, 0, Math.max(10, horizon + 60));
    sky.addColorStop(0, '#f3e4e0');
    sky.addColorStop(1, '#e8c3cf');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, Math.max(0, horizon + 2));
    const step = 2;
    for (let y = Math.max(0, Math.floor(horizon + 1)); y < H; y += step) {
      const z = (camH * f) / (y - horizon); // depth
      const a = (f / z) * zoom * 0.9;
      const texY = scroll + z * 1.2;
      const m = new DOMMatrix([a, 0, 0, a, W / 2 - 512 * a, y - texY * a]);
      pat.setTransform(m);
      g.fillStyle = pat;
      g.fillRect(0, y, W, step + 0.5 / k);
    }
    // aerial haze toward the horizon
    const hz = g.createLinearGradient(0, horizon, 0, horizon + 420);
    hz.addColorStop(0, rgba('#f3e4e0', 1));
    hz.addColorStop(1, rgba('#f3e4e0', 0));
    g.fillStyle = hz;
    g.fillRect(0, horizon, W, 420);
    // the student, walking through tissue
    const wp = seg(t, B.land[0] + 0.8, B.land[1] + 0.6);
    if (wp > 0 && tilt > 0.9) {
      const depth = 900; // world depth of the walking line
      const sy = horizon + (camH * f) / depth;
      const sc = (f / depth) * 130;
      drawFigure(g, walkPose(t * 1.1), lerp(560, 1360, wp), sy, sc * 2.4, { color: C.ink, alpha: Math.min(1, wp * 5) * seg(t, B.land[0] + 0.8, B.land[0] + 1.3) });
      g.fillStyle = rgba(C.hema, 0.25);
      g.beginPath(); g.ellipse(lerp(560, 1360, wp), sy, sc * 0.4, sc * 0.08, 0, 0, TAU); g.fill();
    }
  }
  g.restore();
}

// ---------------------------------------------------------------- the atlas
function brain(g, x, y, s) {
  const out = bez([-100, 20, -110, -40, -60, -90, 0, -92, 60, -94, 110, -60, 112, -5, 114, 40, 80, 60, 40, 55, 20, 75, -20, 72, -60, 70, -100, 60, -100, 20], 12);
  g.save(); g.translate(x, y); g.scale(s, s);
  path(g, out, true); g.fillStyle = rgba('#d9b9a8', 0.6); g.fill();
  stroke(g, out, C.ink, 2, 1, true);
  const r = rng(9);
  for (let i = 0; i < 14; i++) {
    const cx = r.range(-80, 85), cy = r.range(-70, 45);
    stroke(g, bez([cx, cy, cx + r.range(-20, 20), cy - 18, cx + r.range(-10, 30), cy + 16, cx + r.range(10, 30), cy + r.range(-10, 10)], 8), C.ink, 1.2, 0.7);
  }
  g.restore();
}

function lungs(g, x, y, s, t, grow = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const br = 1 + 0.04 * Math.sin(t * 2.2);
  g.scale(br, br);
  for (const sd of [-1, 1]) {
    const o = lungOutline(sd, 1);
    path(g, o, true); g.fillStyle = rgba('#d9a79a', 0.45); g.fill();
    stroke(g, o, C.ink, 2, 1, true);
  }
  stroke(g, [[0, -230], [0, -60]], C.ink, 10, 1);
  stroke(g, [[0, -230], [0, -60]], C.paper, 6, 1);
  drawTree(g, BRONCHI, grow, C.ink, { widthScale: 0.55 });
  g.restore();
}

function atlas(g, t, alpha, heartK) {
  if (alpha <= 0) return;
  const sp = seg(t, B.atlas[0], B.atlas[0] + 1.6, ease.house);
  g.save();
  g.globalAlpha = alpha;
  // book spread
  const bx = 960, by = 560, bw = 1560, bh = 900;
  g.fillStyle = rgba('#3a2a1a', 0.2);
  g.filter = 'blur(18px)';
  g.fillRect(bx - bw / 2 + 20, by - bh / 2 + 30, bw, bh);
  g.filter = 'none';
  for (const s of [-1, 1]) {
    const gr = g.createLinearGradient(bx, 0, bx + s * bw / 2, 0);
    gr.addColorStop(0, '#cdbfa7'); gr.addColorStop(0.06, C.paper2); gr.addColorStop(1, C.paper);
    g.fillStyle = gr;
    g.fillRect(s < 0 ? bx - bw / 2 : bx, by - bh / 2, bw / 2, bh);
  }
  // left page: the tissue we just walked across, now a figure on a page
  const L = { x: 250, y: 190, w: 620, h: 620 };
  g.save();
  g.beginPath(); g.rect(L.x, L.y, L.w, L.h); g.clip();
  const pat = g.createPattern(histology(), 'repeat');
  pat.setTransform(new DOMMatrix().translateSelf(L.x - 200, L.y - 300).scaleSelf(0.8, 0.8));
  g.fillStyle = pat; g.fillRect(L.x, L.y, L.w, L.h);
  g.restore();
  g.strokeStyle = C.ink; g.lineWidth = 1; g.strokeRect(L.x, L.y, L.w, L.h);
  font(g, FONT.mono, 15); g.fillStyle = C.graphite;
  g.fillText('FIG. 14  SKELETAL MUSCLE, TRANSVERSE SECTION, H&E', L.x, L.y + L.h + 34);
  // right page: systems, drawn connected
  const nodes = {
    heart: [1250, 420], lungs: [1450, 330], kidney: [1480, 660], brain: [1230, 250],
  };
  const lk = seg(t, B.atlas[0] + 0.8, B.atlas[0] + 2.2);
  const links = [['heart', 'lungs'], ['heart', 'kidney'], ['brain', 'heart'], ['brain', 'lungs'], ['lungs', 'kidney']];
  g.save();
  g.setLineDash([4, 6]);
  links.forEach(([a, b], i) => strokePart(g, [nodes[a], nodes[b]], 0, clamp(lk * 2 - i * 0.2), C.vermilion, 1.3, 0.8));
  g.restore();
  brain(g, ...nodes.brain, 0.62);
  lungs(g, nodes.lungs[0], nodes.lungs[1] + 40, 0.42, t);
  kidney(g, ...nodes.kidney, 0.62);
  heart(g, nodes.heart[0], nodes.heart[1], 0.62 * (1 + heartK), pulse(t, 72, 13) * 0.6, { lw: 2.5 });
  font(g, FONT.mono, 13); g.fillStyle = C.graphite;
  [['nervous', 'brain', -60, -80], ['respiratory', 'lungs', 60, -110], ['cardiovascular', 'heart', -150, 100], ['renal', 'kidney', 70, 90]].forEach(([n, k, dx, dy]) => {
    g.globalAlpha = alpha * lk;
    g.fillText(n.toUpperCase(), nodes[k][0] + dx, nodes[k][1] + dy);
  });
  // the student crosses the spread
  const wp = seg(t, B.atlas[0] + 1.0, B.heart[0] + 0.8);
  if (wp > 0 && wp < 1) {
    g.globalAlpha = alpha * Math.min(1, wp * 8, (1 - wp) * 8);
    drawFigure(g, walkPose(t * 1.3), lerp(420, 1500, wp), 900, 62, { color: C.ink });
  }
  g.restore();
  void sp;
}

export default {
  init,
  draw(g, t) {
    paperGround(g, C.paper);
    // arriving from the coat: first half-second is the coat's warm white
    const carry = 1 - seg(t, 0, 0.6);
    const zp = seg(t, B.zoom[0], B.zoom[1], ease.inExpo);
    const plateZ = lerp(1, 40, zp);
    const target = [SK.x + 268 * SK.s, SK.y + 10 * SK.s];
    const plateA = 1 - seg(t, B.zoom[0] + 1.6, B.zoom[0] + 2.2);
    withCam(g, { x: lerp(960, target[0], seg(t, B.zoom[0], B.zoom[0] + 1.0, ease.inOutSine)), y: lerp(540, target[1], seg(t, B.zoom[0], B.zoom[0] + 1.0, ease.inOutSine)), z: plateZ }, () => {
      plate(g, t, plateA);
    });
    // tissue
    const hA = seg(t, B.zoom[0] + 1.4, B.zoom[0] + 2.1) * (1 - seg(t, B.atlas[0], B.atlas[0] + 0.6));
    const tilt = seg(t, B.land[0], B.land[0] + 1.8, ease.inOutCubic) * (1 - seg(t, B.land[1] - 0.2, B.land[1] + 0.5, ease.inOutCubic));
    const hz = lerp(0.7, 1.7, seg(t, B.zoom[0] + 1.4, B.land[0] + 0.5, ease.outCubic)) * lerp(1, 1.45, seg(t, B.land[1] - 0.2, B.atlas[0] + 0.4));
    histoPlane(g, t, tilt, (t - B.zoom[0]) * 80, hA, hz);
    // atlas
    const aA = seg(t, B.atlas[0], B.atlas[0] + 0.5);
    const pb = seg(t, B.atlas[0] + 0.3, B.atlas[0] + 2.0, ease.inOutCubic);
    const hk = seg(t, B.heart[0], B.heart[0] + 1.6, ease.inOutCubic);
    const heartScreen = [1250, 420];
    const az = lerp(1, 3.6, hk);
    const figC = [560, 500];
    withCam(g, { x: lerp(lerp(figC[0], 960, pb), heartScreen[0], hk), y: lerp(lerp(figC[1], 540, pb), heartScreen[1] + 20, hk), z: lerp(2.6, 1, pb) * az }, () => {
      atlas(g, t, aA, 0);
    });
    // the contraction: a pressure wave and a push forward
    const ct = t - B.contraction;
    if (ct > -0.1) {
      const k = clamp(ct / 0.65);
      g.save();
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = rgba('#7a2a22', ease.inCubic(k));
      g.fillRect(0, 0, W, H);
      g.restore();
      for (let i = 0; i < 3; i++) {
        const r = Math.max(0, ct - i * 0.07) * 2600;
        circle(g, 960, 560, r, { stroke: rgba(C.vermilion, 1), width: 30 * (1 - k), alpha: (1 - k) * 0.5 });
      }
      if (k > 0.5) { g.fillStyle = rgba(C.umber, (k - 0.5) * 2); g.fillRect(0, 0, W, H); }
    }
    if (carry > 0) { g.fillStyle = rgba(C.paper, carry * 0.6); g.fillRect(0, 0, W, H); }
    void caps; void kf;
    return { dark: ct > 0.3 ? 1 : 0 };
  },
};
