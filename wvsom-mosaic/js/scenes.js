// Scene painters for the mosaic film.
//
// Every chapter is painted into a W x H "cartoon" (in the fresco sense): one
// pixel per tessera. The Painter keeps three parallel layers in sync:
//   colour   – the glaze / glass colour of each tile
//   relief   – how far each tile is raised above the grout bed
//   material – which physical material the tile is cut from
// The engine samples these layers and physically re-lays the tiles.

export const W = 256;
export const H = 144;
export const M = { CER: 0, STONE: 1, GLASS: 2, GOLD: 3, ENAMEL: 4, MATTE: 5 };
export const MAX_RELIEF = 1.5;

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOut = (t) => { t = clamp(t); return 1 - (1 - t) ** 3; };

export function rng(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Material ids are one-hot encoded over two RGB canvases so that anti-aliased
// edges blend between two materials instead of inventing a third one.
const MAT_ENC = [['#ff0000', 0], ['#00ff00', 0], ['#0000ff', 0], ['#ff0000', 1], ['#00ff00', 1], ['#0000ff', 1]];

function makeCtx() {
  const cv = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(W, H)
    : Object.assign(document.createElement('canvas'), { width: W, height: H });
  return cv.getContext('2d', { willReadFrequently: true });
}

const gray = (h) => { const v = Math.round(clamp(h / MAX_RELIEF) * 255); return `rgb(${v},${v},${v})`; };

export class Painter {
  constructor() {
    this.c = makeCtx();
    this.r = makeCtx();
    this.m = [makeCtx(), makeCtx()];
    this.all = [this.c, this.r, this.m[0], this.m[1]];
    this.logo = null;
  }
  reset() {
    for (const x of this.all) {
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
      x.setLineDash([]);
    }
  }
  _fillStyle(ctx, s) { return typeof s === 'function' ? s(ctx) : s; }
  _relStyle(ctx, h) { return typeof h === 'function' ? h(ctx) : gray(h); }
  _matStyles(id) {
    const [col, k] = MAT_ENC[id];
    this.m[k].fillStyle = this.m[k].strokeStyle = col;
    this.m[1 - k].fillStyle = this.m[1 - k].strokeStyle = '#000';
  }
  shape(col, mat, h, pathFn, rule = 'nonzero') {
    const { c, r } = this;
    c.fillStyle = this._fillStyle(c, col); pathFn(c); c.fill(rule);
    if (h !== null) { r.fillStyle = this._relStyle(r, h); pathFn(r); r.fill(rule); }
    if (mat !== null) { this._matStyles(mat); for (const m of this.m) { pathFn(m); m.fill(rule); } }
  }
  stroke(col, mat, h, width, pathFn, opt = {}) {
    for (const x of this.all) {
      x.lineWidth = width; x.lineCap = opt.cap || 'round'; x.lineJoin = opt.join || 'round';
      x.setLineDash(opt.dash || []); x.lineDashOffset = opt.dashOffset || 0;
    }
    const { c, r } = this;
    c.strokeStyle = this._fillStyle(c, col); pathFn(c); c.stroke();
    if (h !== null) { r.strokeStyle = this._relStyle(r, h); pathFn(r); r.stroke(); }
    if (mat !== null) { this._matStyles(mat); for (const m of this.m) { pathFn(m); m.stroke(); } }
    for (const x of this.all) x.setLineDash([]);
  }
  // Colour-only overlay: shading, glows, glaze variation.
  tint(col, pathFn, alpha = 1, op = 'source-over') {
    const c = this.c;
    c.save(); c.globalAlpha = alpha; c.globalCompositeOperation = op;
    c.fillStyle = this._fillStyle(c, col); pathFn(c); c.fill(); c.restore();
  }
  tintStroke(col, width, pathFn, alpha = 1) {
    const c = this.c;
    c.save(); c.globalAlpha = alpha; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = this._fillStyle(c, col); pathFn(c); c.stroke(); c.restore();
  }
  lift(h, pathFn) { const r = this.r; r.fillStyle = this._relStyle(r, h); pathFn(r); r.fill(); }
  bg(col, mat, h) { this.shape(col, mat, h, (c) => { c.beginPath(); c.rect(-4000, -4000, 8000, 8000); }); }
  text(str, x, y, font, col, mat, h) {
    for (const x2 of this.all) { x2.font = font; x2.textAlign = 'center'; x2.textBaseline = 'middle'; }
    this.c.fillStyle = this._fillStyle(this.c, col); this.c.fillText(str, x, y);
    this.r.fillStyle = gray(h); this.r.fillText(str, x, y);
    this._matStyles(mat); for (const m of this.m) m.fillText(str, x, y);
  }
  image(img, x, y, w, h, mat, rel) {
    this.c.drawImage(img, x, y, w, h);
    this.r.fillStyle = gray(rel); this.r.fillRect(x, y, w, h);
    this._matStyles(mat); for (const m of this.m) m.fillRect(x, y, w, h);
  }
  save() { for (const x of this.all) x.save(); }
  restore() { for (const x of this.all) x.restore(); }
  translate(x, y) { for (const c of this.all) c.translate(x, y); }
  scale(sx, sy = sx) { for (const c of this.all) c.scale(sx, sy); }
  rotate(a) { for (const c of this.all) c.rotate(a); }
  clip(pathFn) { for (const c of this.all) { pathFn(c); c.clip(); } }
  read() {
    const g = (x) => x.getImageData(0, 0, W, H).data;
    return { col: g(this.c), rel: g(this.r), m0: g(this.m[0]), m1: g(this.m[1]) };
  }
}

// ---------------------------------------------------------------- path helpers
const ell = (x, y, rx, ry, rot = 0) => (c) => { c.beginPath(); c.ellipse(x, y, Math.max(rx, 0.01), Math.max(ry, 0.01), rot, 0, TAU); };
const circ = (x, y, r) => ell(x, y, r, r);
const rect = (x, y, w, h) => (c) => { c.beginPath(); c.rect(x, y, w, h); };
const rrect = (x, y, w, h, r) => (c) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const poly = (pts) => (c) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); };
const pl = (pts) => (c) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); };
const seg = (x0, y0, x1, y1) => (c) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); };
const pth = (fn) => (c) => { c.beginPath(); fn(c); };
const all = (c) => { c.beginPath(); c.rect(-4000, -4000, 8000, 8000); };

const lin = (x0, y0, x1, y1, stops) => (c) => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  return g;
};
const rad = (x, y, r0, r1, stops, fx = x, fy = y) => (c) => {
  const g = c.createRadialGradient(fx, fy, r0, x, y, r1);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  return g;
};
// Dome-shaped relief (grayscale radial gradient in relief units).
const dome = (x, y, r, h0, h1) => (c) => {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, gray(h0)); g.addColorStop(1, gray(h1));
  return g;
};

// Sample a centre-line and build a ribbon polygon that tapers along its length.
function ribbon(pts, w0, w1) {
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const w = lerp(w0, w1, i / (pts.length - 1)) / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  return L.concat(R.reverse());
}
function catmull(ctrl, n = 16) {
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t2 + (-a + 3 * b - 3 * c2 + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(ctrl[ctrl.length - 1]);
  return out;
}
function partial(pts, frac) {
  const n = Math.max(2, Math.floor(pts.length * clamp(frac)));
  return pts.slice(0, n);
}

// ---------------------------------------------------------------- landscape parts
function ridge(P, y0, amps, freqs, seed, col, mat, h, yEnd = H + 4) {
  const r = rng(seed);
  const ph = freqs.map(() => r() * TAU);
  const yAt = (x) => { let y = y0; freqs.forEach((f, k) => { y -= amps[k] * Math.sin(x * f + ph[k]); }); return y; };
  P.shape(col, mat, h, (c) => {
    c.beginPath(); c.moveTo(-4, yEnd);
    for (let x = -4; x <= W + 4; x += 2) c.lineTo(x, yAt(x));
    c.lineTo(W + 4, yEnd); c.closePath();
  });
  return yAt;
}

function tree(P, x, y, s, greens, h = 0.4) {
  P.stroke('#4a2f1d', M.MATTE, h * 0.8, Math.max(1, s * 0.12), seg(x, y, x, y - s * 0.45));
  const g = greens;
  P.shape(g[0], M.CER, h, ell(x, y - s * 0.62, s * 0.42, s * 0.36));
  P.shape(g[1], M.CER, h + 0.05, ell(x - s * 0.18, y - s * 0.72, s * 0.3, s * 0.27));
  P.shape(g[2 % g.length], M.CER, h + 0.08, ell(x + s * 0.14, y - s * 0.82, s * 0.26, s * 0.24));
  P.tint('#fff3c4', ell(x - s * 0.16, y - s * 0.86, s * 0.14, s * 0.1), 0.25);
}
function conifer(P, x, y, s, col, h = 0.4) {
  P.stroke('#3b2716', M.MATTE, h * 0.7, Math.max(1, s * 0.1), seg(x, y, x, y - s * 0.25));
  for (let k = 0; k < 3; k++) {
    const yy = y - s * (0.2 + k * 0.26), w = s * (0.34 - k * 0.08);
    P.shape(col, M.CER, h + k * 0.04, poly([[x - w, yy], [x + w, yy], [x, yy - s * 0.42]]));
  }
}

function sun(P, x, y, r, rays = true) {
  P.tint(rad(x, y, 0, r * 5, [[0, 'rgba(255,214,120,0.75)'], [1, 'rgba(255,190,110,0)']]), circ(x, y, r * 5));
  if (rays) for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    P.stroke('#f2b54a', M.GOLD, 0.2, 1, seg(x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 1.4, x + Math.cos(a) * r * (k % 2 ? 2.2 : 2.8), y + Math.sin(a) * r * (k % 2 ? 2.2 : 2.8)));
  }
  P.shape(rad(x, y, 0, r, [[0, '#fff1b8'], [0.6, '#ffd45e'], [1, '#e9a52a']], x - r * 0.3, y - r * 0.3), M.GOLD, 0.45, circ(x, y, r));
}
function cloud(P, x, y, s, col = '#f7e3cc', shade = '#c9a6a0') {
  P.shape(col, M.CER, 0.15, pth((c) => {
    c.ellipse(x, y, s, s * 0.32, 0, 0, TAU);
    c.moveTo(x + s * 0.2, y); c.ellipse(x - s * 0.25, y - s * 0.22, s * 0.42, s * 0.3, 0, 0, TAU);
    c.moveTo(x + s * 0.6, y); c.ellipse(x + s * 0.25, y - s * 0.28, s * 0.36, s * 0.32, 0, 0, TAU);
  }));
  P.tint(shade, ell(x, y + s * 0.12, s * 0.95, s * 0.16), 0.55);
}

// ---------------------------------------------------------------- architecture
function campusBuilding(P, cx, by, sc, seed = 3) {
  const r = rng(seed);
  const S = (v) => v * sc;
  const stone = '#d6c8ab', stoneDk = '#b3a282', copper = '#4f8f73';
  // wings
  P.shape(lin(cx - S(62), 0, cx + S(62), 0, [[0, '#c2b293'], [0.5, stone], [1, '#a8987a']]), M.STONE, 0.32, rect(cx - S(62), by - S(20), S(124), S(20)));
  P.shape(copper, M.CER, 0.36, poly([[cx - S(64), by - S(20)], [cx + S(64), by - S(20)], [cx + S(58), by - S(26)], [cx - S(58), by - S(26)]]));
  // main block
  P.shape(lin(cx - S(34), 0, cx + S(34), 0, [[0, '#d9ccb0'], [1, '#bba98a']]), M.STONE, 0.4, rect(cx - S(34), by - S(32), S(68), S(32)));
  P.shape('#3f4a52', M.STONE, 0.45, poly([[cx - S(36), by - S(32)], [cx + S(36), by - S(32)], [cx + S(28), by - S(40)], [cx - S(28), by - S(40)]]));
  // windows
  const win = (x, y, w, h) => {
    const lit = r() < 0.35;
    P.shape(lit ? '#f2b440' : '#1c2c48', M.GLASS, 0.28, rect(x, y, w, h));
    P.stroke('#efe8d8', M.CER, 0.34, Math.max(0.6, S(0.6)), seg(x, y + h / 2, x + w, y + h / 2));
  };
  for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
    const x = cx + side * S(40 + k * 5.2) - S(1.6);
    win(x, by - S(16), S(3.2), S(5)); win(x, by - S(8), S(3.2), S(5));
  }
  for (let k = 0; k < 6; k++) {
    const x = cx - S(31) + k * S(4.2) + (k >= 3 ? S(38) : 0) - (k >= 3 ? S(12.6) : 0);
    win(x, by - S(28), S(3), S(4.6)); win(x, by - S(20), S(3), S(4.6));
  }
  // portico
  P.shape('#f2eee4', M.CER, 0.5, poly([[cx - S(20), by - S(28)], [cx + S(20), by - S(28)], [cx, by - S(38)]]));
  P.shape(stoneDk, M.STONE, 0.44, poly([[cx - S(14), by - S(29)], [cx + S(14), by - S(29)], [cx, by - S(35)]]));
  P.shape('#efeadf', M.CER, 0.5, rect(cx - S(20), by - S(28), S(40), S(3)));
  for (let k = 0; k < 6; k++) {
    const x = cx - S(17) + k * S(6.8);
    P.shape(lin(x - S(1.3), 0, x + S(1.3), 0, [[0, '#ffffff'], [1, '#cfc8ba']]), M.CER, 0.55, rect(x - S(1.2), by - S(25), S(2.4), S(24)));
  }
  P.shape('#1d2533', M.GLASS, 0.2, rect(cx - S(3), by - S(12), S(6), S(11)));
  for (let k = 0; k < 3; k++) P.shape(k % 2 ? '#e2d8c4' : '#cbbd9f', M.STONE, 0.3 - k * 0.05, rect(cx - S(22 + k * 2), by - S(1) + S(k * 1.2), S(44 + k * 4), S(1.3)));
  // cupola
  P.shape(stone, M.STONE, 0.55, rect(cx - S(5), by - S(49), S(10), S(10)));
  P.shape('#1c2c48', M.GLASS, 0.5, rect(cx - S(2), by - S(47), S(4), S(6)));
  P.shape(rad(cx - S(2), by - S(52), 0, S(7), [[0, '#8fd0b0'], [1, copper]]), M.CER, 0.62, pth((c) => c.ellipse(cx, by - S(49), S(6.5), S(6), 0, Math.PI, TAU)));
  P.stroke('#e8b640', M.GOLD, 0.7, Math.max(0.8, S(1)), seg(cx, by - S(55), cx, by - S(62)));
  // warm raking light across facade
  P.tint(lin(cx - S(60), 0, cx + S(60), 0, [[0, 'rgba(255,200,120,0.22)'], [1, 'rgba(40,30,60,0.2)']]), rect(cx - S(64), by - S(62), S(128), S(62)));
}

// ---------------------------------------------------------------- figures
const SKINS = ['#c98d66', '#8a5a3c', '#e6b894', '#5e3b26', '#d9a47c', '#b07650'];
const HAIRS = ['#2b1b12', '#141010', '#6b4423', '#caa46a', '#3a2418', '#8a8a8a'];

function limb(P, col, mat, h, w, x0, y0, sg, a1, l1, a2, l2) {
  const x1 = x0 + sg * Math.sin(a1) * l1, y1 = y0 + Math.cos(a1) * l1;
  const x2 = x1 + sg * Math.sin(a2) * l2, y2 = y1 + Math.cos(a2) * l2;
  const path = pl([[x0, y0], [x1, y1], [x2, y2]]);
  P.stroke(shade(col, 0.45), mat, h - 0.02, w + 1.2, path);
  P.stroke(lin(x0 - w, y0, x0 + w, y0, [[0, lighten(col, 0.12)], [1, shade(col, 0.78)]]), mat, h, w, path);
  return [x2, y2];
}

export function person(P, o) {
  const { x, y, s } = o;
  const skin = o.skin || SKINS[0], hair = o.hair || HAIRS[0];
  const top = o.top || '#2f6b8f', bottom = o.bottom || '#27313f', shoe = o.shoe || '#1b1b1b';
  const h = o.h ?? 0.4;
  const walking = o.walk !== undefined && o.walk !== null;
  const ph = walking ? o.walk : 0;
  const bob = walking ? Math.abs(Math.sin(ph)) * s * 0.012 : 0;
  const hr = s * 0.07;
  const headY = y - s + hr - bob;
  const shY = y - s * 0.8 - bob, shW = s * 0.13;
  const hipY = y - s * 0.47 - bob, hipW = s * 0.095;
  const legW = s * 0.078, armW = s * 0.06;
  const sleeve = o.coat ? '#f1efe8' : (o.sleeve || top);

  if (o.hairStyle === 'long') P.shape(hair, M.MATTE, h + 0.02, rrect(x - hr * 1.05, headY - hr * 0.6, hr * 2.1, hr * 2.8, hr * 0.8));
  if (o.pack) P.shape(o.pack, M.MATTE, h - 0.05, rrect(x - shW * 1.15, shY - s * 0.02, shW * 2.3, s * 0.3, s * 0.05));

  // legs
  const legA = walking ? 0.34 * Math.sin(ph) : 0;
  const legLen = y - hipY;
  if (o.gown) {
    P.shape(lin(x - shW, 0, x + shW, 0, [[0, o.gown], [1, '#050507']]), M.MATTE, h, poly([[x - shW * 1.05, shY], [x + shW * 1.05, shY], [x + s * 0.17, y - s * 0.06], [x - s * 0.17, y - s * 0.06]]));
    for (const sg of [-1, 1]) P.shape(shoe, M.CER, h, ell(x + sg * hipW * 0.5 + sg * Math.sin(legA * sg) * s * 0.05, y - legW * 0.3, legW * 0.8, legW * 0.45));
  } else {
    for (const sg of [-1, 1]) {
      const a = sg * legA;
      const fx = x + sg * hipW * 0.5 + Math.sin(a) * legLen, fy = hipY + Math.cos(a) * legLen;
      const leg = seg(x + sg * hipW * 0.5, hipY, fx, fy - legW * 0.3);
      P.stroke(shade(o.scrubs || bottom, 0.45), M.MATTE, h - 0.02, legW + 1.2, leg);
      P.stroke(o.scrubs || bottom, M.MATTE, h, legW, leg);
      P.tintStroke(lighten(o.scrubs || bottom, 0.25), Math.max(0.6, legW * 0.25), seg(x + sg * hipW * 0.5 - legW * 0.22, hipY + 2, fx - legW * 0.22, fy - legW), 0.35);
      P.shape(shoe, M.CER, h, ell(fx + legW * 0.1, fy - legW * 0.3, legW * 0.8, legW * 0.45));
    }
  }
  // torso
  const torso = pth((c) => {
    c.moveTo(x - shW, shY + shW * 0.3);
    c.quadraticCurveTo(x - shW, shY, x - shW * 0.6, shY - s * 0.01);
    c.lineTo(x + shW * 0.6, shY - s * 0.01);
    c.quadraticCurveTo(x + shW, shY, x + shW, shY + shW * 0.3);
    c.lineTo(x + hipW * 1.05, hipY + s * 0.03);
    c.lineTo(x - hipW * 1.05, hipY + s * 0.03);
    c.closePath();
  });
  if (!o.gown) {
    P.shape(lin(x - shW, 0, x + shW, 0, [[0, lighten(o.scrubs || top, 0.1)], [0.55, o.scrubs || top], [1, shade(o.scrubs || top, 0.6)]]), M.MATTE, h + 0.03, torso);
    P.stroke(shade(o.scrubs || top, 0.42), M.MATTE, h + 0.03, 1, torso);
    P.tintStroke(shade(o.scrubs || top, 0.6), Math.max(0.6, s * 0.01), pth((c) => { c.moveTo(x - shW * 0.3, shY + s * 0.08); c.quadraticCurveTo(x - shW * 0.1, shY + s * 0.2, x - shW * 0.35, hipY); }), 0.6);
    P.shape(shade(o.scrubs || top, 0.55), M.MATTE, h + 0.05, pth((c) => { c.moveTo(x - s * 0.04, shY - s * 0.005); c.lineTo(x + s * 0.04, shY - s * 0.005); c.lineTo(x, shY + s * 0.05); c.closePath(); }));
  }
  if (o.coat) {
    const cy = y - s * 0.26;
    for (const sg of [-1, 1]) {
      P.shape(lin(x - shW, 0, x + shW, 0, [[0, '#ffffff'], [1, '#c9c6bd']]), M.CER, h + 0.08, poly([
        [x + sg * shW * 0.35, shY - s * 0.01], [x + sg * shW * 1.02, shY + s * 0.02], [x + sg * s * 0.16, cy], [x + sg * s * 0.02, cy], [x + sg * s * 0.03, shY + s * 0.14]]));
      P.stroke('#8f8b80', M.CER, h + 0.08, 0.8, poly([[x + sg * shW * 0.35, shY - s * 0.01], [x + sg * shW * 1.02, shY + s * 0.02], [x + sg * s * 0.16, cy], [x + sg * s * 0.02, cy], [x + sg * s * 0.03, shY + s * 0.14]]));
      P.shape('#d9d5ca', M.CER, h + 0.1, rect(x + sg * s * 0.1 - s * 0.03, cy - s * 0.12, s * 0.06, s * 0.035));
    }
    P.stroke('#b9b5aa', M.CER, h + 0.1, Math.max(0.6, s * 0.006), seg(x - s * 0.1, y - s * 0.43, x - s * 0.05, y - s * 0.43));
  }
  if (o.pack) for (const sg of [-1, 1]) P.stroke(shade(o.pack, 0.8), M.MATTE, h + 0.06, s * 0.025, seg(x + sg * shW * 0.55, shY, x + sg * shW * 0.7, hipY - s * 0.02));
  // arms
  const swing = walking ? 0.35 * Math.sin(ph) : 0;
  const hands = [];
  for (const sg of [-1, 1]) {
    const ar = sg < 0 ? o.lArm : o.rArm;
    const a1 = ar ? ar[0] : 0.12 - sg * swing;
    const a2 = ar ? ar[1] : a1 + 0.12;
    const x0 = x + sg * (shW - armW * 0.45), y0 = shY + armW * 0.5;
    const end = limb(P, o.gown ? '#0d0d12' : sleeve, o.coat ? M.CER : M.MATTE, h + 0.06, o.gown ? armW * 1.35 : armW, x0, y0, sg, a1, s * 0.19, a2, s * 0.18);
    P.shape(skin, M.CER, h + 0.07, circ(end[0], end[1], armW * 0.62));
    hands.push(end);
  }
  if (o.gown) {
    P.shape(o.hood || '#1f7a4a', M.ENAMEL, h + 0.08, poly([[x - shW * 0.9, shY], [x + shW * 0.9, shY], [x, shY + s * 0.16]]));
    P.stroke('#e0b447', M.GOLD, h + 0.1, Math.max(0.7, s * 0.012), pl([[x - shW * 0.9, shY], [x, shY + s * 0.16], [x + shW * 0.9, shY]]));
  }
  // neck + head
  P.stroke(shade(skin, 0.85), M.CER, h + 0.05, s * 0.05, seg(x, headY + hr * 0.8, x, shY + s * 0.01));
  for (const sg of [-1, 1]) P.shape(shade(skin, 0.8), M.CER, h + 0.12, ell(x + sg * hr * 0.9, headY + hr * 0.1, hr * 0.2, hr * 0.28));
  P.shape(rad(x, headY, 0, hr * 1.2, [[0, lighten(skin, 0.18)], [0.7, skin], [1, shade(skin, 0.72)]], x - hr * 0.35, headY - hr * 0.4), M.CER, h + 0.14, ell(x, headY, hr * 0.9, hr));
  P.stroke(shade(skin, 0.5), M.CER, h + 0.14, Math.max(0.6, hr * 0.12), ell(x, headY, hr * 0.9, hr));
  const hs = o.hairStyle || 'short';
  if (hs === 'grey') P.shape('#b9b6b0', M.MATTE, h + 0.16, pth((c) => c.ellipse(x, headY - hr * 0.12, hr * 0.95, hr * 0.9, 0, Math.PI * 1.02, TAU * 0.99)));
  else if (hs !== 'bald') P.shape(hair, M.MATTE, h + 0.16, pth((c) => c.ellipse(x, headY - hr * 0.15, hr * 0.98, hr * 0.92, 0, Math.PI * 0.98, TAU * 1.01)));
  if (hs === 'bun') P.shape(hair, M.MATTE, h + 0.18, circ(x, headY - hr * 1.05, hr * 0.42));
  if (s >= 40) {
    for (const sg of [-1, 1]) {
      P.shape('#f4efe6', M.ENAMEL, h + 0.16, ell(x + sg * hr * 0.36, headY + hr * 0.12, hr * 0.2, hr * 0.12));
      P.shape('#24160f', M.GLASS, h + 0.18, circ(x + sg * hr * 0.34, headY + hr * 0.13, Math.max(0.45, hr * 0.1)));
      P.tintStroke(hs === 'grey' ? '#8a8680' : shade(hair, 0.9), Math.max(0.5, hr * 0.1), seg(x + sg * hr * 0.18, headY - hr * 0.12, x + sg * hr * 0.56, headY - hr * 0.08), 0.9);
      P.tint('#e0786a', circ(x + sg * hr * 0.5, headY + hr * 0.45, hr * 0.18), 0.25);
    }
    P.tintStroke(shade(skin, 0.62), Math.max(0.5, hr * 0.1), pth((c) => { c.moveTo(x + hr * 0.02, headY + hr * 0.12); c.lineTo(x + hr * 0.1, headY + hr * 0.4); c.lineTo(x - hr * 0.06, headY + hr * 0.44); }), 0.8);
    P.tintStroke('#8a3b30', Math.max(0.5, hr * 0.12), pth((c) => { c.moveTo(x - hr * 0.25, headY + hr * 0.62); c.quadraticCurveTo(x, headY + hr * 0.74, x + hr * 0.25, headY + hr * 0.62); }), 0.85);
  }
  if (hs !== 'bald') P.tint(lighten(hs === 'grey' ? '#b9b6b0' : hair, 0.35), pth((c) => c.ellipse(x - hr * 0.3, headY - hr * 0.72, hr * 0.35, hr * 0.14, -0.4, 0, TAU)), 0.5);
  if (o.cap) {
    P.shape('#101014', M.CER, h + 0.22, poly([[x - hr * 1.6, headY - hr * 0.8], [x + hr * 1.3, headY - hr * 1.15], [x + hr * 1.7, headY - hr * 0.75], [x - hr * 1.2, headY - hr * 0.45]]));
    P.stroke('#e8b640', M.GOLD, h + 0.25, Math.max(0.6, s * 0.01), pl([[x + hr * 0.1, headY - hr * 0.8], [x + hr * 1.5, headY - hr * 0.7], [x + hr * 1.55, headY + hr * 0.3]]));
  }
  if (o.steth) stethOnNeck(P, x, shY, s, h + 0.2);
  return { hands, headY, shY, hipY };
}

function stethOnNeck(P, x, shY, s, h) {
  P.stroke('#23252b', M.CER, h, Math.max(0.8, s * 0.018), pth((c) => {
    c.moveTo(x - s * 0.045, shY - s * 0.005);
    c.bezierCurveTo(x - s * 0.1, shY + s * 0.08, x - s * 0.06, shY + s * 0.2, x + s * 0.02, shY + s * 0.2);
    c.moveTo(x + s * 0.045, shY - s * 0.005);
    c.bezierCurveTo(x + s * 0.09, shY + s * 0.05, x + s * 0.07, shY + s * 0.11, x + s * 0.05, shY + s * 0.12);
  }));
  P.shape(rad(x + s * 0.02, shY + s * 0.2, 0, s * 0.03, [[0, '#ffffff'], [1, '#9aa1ab']]), M.GOLD, h + 0.05, circ(x + s * 0.02, shY + s * 0.21, Math.max(0.9, s * 0.024)));
}

// Hand drawn in local space: wrist at origin, fingers along -y, palm facing viewer.
export function hand(P, x, y, ang, sc, skin, o = {}) {
  const h = o.h ?? 0.55;
  P.save(); P.translate(x, y); P.rotate(ang); P.scale(o.mirror ? -sc : sc, sc);
  const dk = shade(skin, 0.72), lt = lighten(skin, 0.15);
  const curl = o.curl ?? 1;
  P.stroke(shade(skin, 0.55), M.CER, h - 0.07, 15.2, seg(0, 2, 0, o.sleeve ? 16 : 40));
  P.stroke(lin(-8, 0, 8, 0, [[0, lt], [1, dk]]), M.CER, h - 0.06, 14, seg(0, 2, 0, o.sleeve ? 16 : 40));
  if (o.sleeve) {
    P.shape(lin(-11, 0, 11, 0, [[0, lighten(o.sleeve, 0.12)], [0.6, o.sleeve], [1, shade(o.sleeve, 0.65)]]), o.sleeveMat ?? M.CER, h - 0.03, rrect(-10.5, 12, 21, 70, 3));
    P.stroke(shade(o.sleeve, 0.5), o.sleeveMat ?? M.CER, h - 0.03, 0.9, rrect(-10.5, 12, 21, 70, 3));
    P.tintStroke(shade(o.sleeve, 0.7), 1, seg(-10, 16, 10, 16), 0.8);
  }
  // thumb
  P.stroke(shade(skin, 0.55), M.CER, h + 0.04, 6.0, pl([[-7, -5], [-13, -11], [-16, -18]]));
  P.stroke(lin(-18, 0, -6, 0, [[0, dk], [1, skin]]), M.CER, h + 0.05, 5.0, pl([[-7, -5], [-13, -11], [-16, -18]]));
  // fingers
  const fx = [-6.3, -2.1, 2.1, 6.3], fl = [11, 14.5, 13.5, 10.5];
  for (let k = 0; k < 4; k++) {
    const spread = (k - 1.5) * 1.3;
    const len = fl[k] * curl;
    const fp = pl([[fx[k], -19], [fx[k] + spread * 0.6, -19 - len * 0.55], [fx[k] + spread, -19 - len]]);
    P.stroke(shade(skin, 0.55), M.CER, h + 0.06, 5.0, fp);
    P.stroke(lin(fx[k] - 2, 0, fx[k] + 2, 0, [[0, lt], [1, shade(skin, 0.82)]]), M.CER, h + 0.08, 3.9, fp);
    P.tint(shade(skin, 0.6), ell(fx[k] + spread * 0.3, -19 - len * 0.45, 1.6, 0.35), 0.6);
    P.tint(lighten(skin, 0.3), ell(fx[k] + spread, -19 - len + 1.3, 1.2, 1.5), 0.55);
  }
  // palm
  P.shape(rad(-2, -12, 1, 16, [[0, lt], [0.7, skin], [1, dk]]), M.CER, dome(0, -11, 13, h + 0.12, h), rrect(-9, -22, 18, 23, 6));
  P.stroke(shade(skin, 0.55), M.CER, h + 0.1, 0.8, rrect(-9, -22, 18, 23, 6));
  P.tintStroke(shade(skin, 0.62), 0.7, pth((c) => { c.moveTo(-7, -9); c.quadraticCurveTo(-1, -13, 7, -16); c.moveTo(-5, -4); c.quadraticCurveTo(0, -8, 3, -3); }), 0.7);
  P.restore();
}

export function drawHeart(P, cx, cy, s, beat = 0) {
  const k = (s / 100) * (1 + 0.05 * beat);
  P.save(); P.translate(cx, cy); P.scale(k);
  const red = '#b3121f';
  // great vessels behind
  P.stroke(lin(-10, -70, 30, -20, [[0, '#d42a36'], [1, '#7c0c16']]), M.GLASS, 0.55, 13, pth((c) => { c.moveTo(-4, -18); c.bezierCurveTo(-8, -54, 26, -66, 30, -36); c.lineTo(32, -10); }));
  for (const [bx, w] of [[-3, 6], [8, 5.5], [18, 5]]) P.stroke('#a30f1c', M.GLASS, 0.6, w, pth((c) => { c.moveTo(bx + 2, -50); c.lineTo(bx, -76); }));
  P.stroke(lin(-30, -60, -20, -20, [[0, '#4a4fb0'], [1, '#2b2e7a']]), M.GLASS, 0.6, 11, seg(-26, -64, -24, -20));
  P.shape(rad(-26, -14, 2, 20, [[0, '#c7303c'], [1, '#6e0c16']]), M.GLASS, 0.65, ell(-26, -12, 16, 19, -0.3));
  P.shape(rad(24, -18, 1, 12, [[0, '#b8202d'], [1, '#6a0b15']]), M.GLASS, 0.62, ell(26, -16, 12, 9, 0.4));
  // ventricles
  const body = pth((c) => {
    c.moveTo(-36, -8);
    c.bezierCurveTo(-46, 22, -20, 52, 8, 64);
    c.bezierCurveTo(24, 52, 46, 24, 42, -6);
    c.bezierCurveTo(30, -24, -18, -26, -36, -8);
  });
  P.shape(rad(-2, 14, 2, 60, [[0, '#ef3b48'], [0.45, red], [1, '#4d0710']], -14, -2), M.GLASS, dome(-2, 16, 55, 1.0, 0.55), body);
  // pulmonary trunk in front
  P.stroke(lin(-10, -50, 20, -10, [[0, '#6d5bd0'], [1, '#3a2e8a']]), M.GLASS, 0.9, 12, pth((c) => { c.moveTo(6, -10); c.bezierCurveTo(6, -30, 0, -40, -18, -46); c.moveTo(4, -32); c.bezierCurveTo(12, -44, 22, -44, 30, -40); }));
  // grooves & coronary vessels
  P.stroke('#5e0a12', M.GLASS, 0.9, 2.6, pth((c) => { c.moveTo(10, -12); c.bezierCurveTo(4, 12, 12, 36, 8, 60); }));
  P.stroke('#ff6a4d', M.ENAMEL, 1.0, 1.6, pth((c) => {
    c.moveTo(12, -12); c.bezierCurveTo(6, 12, 14, 36, 9, 58);
    c.moveTo(8, 14); c.quadraticCurveTo(-4, 20, -12, 34);
    c.moveTo(-30, -2); c.bezierCurveTo(-38, 18, -24, 38, -6, 50);
    c.moveTo(14, 20); c.quadraticCurveTo(26, 28, 30, 40);
  }));
  P.stroke('#5b62d8', M.GLASS, 0.95, 1.1, pth((c) => { c.moveTo(16, -10); c.bezierCurveTo(12, 14, 18, 34, 13, 54); }));
  // glass sheen
  P.tint(rad(-16, -2, 0, 16, [[0, 'rgba(255,220,220,0.55)'], [1, 'rgba(255,220,220,0)']]), ell(-16, -2, 16, 12));
  P.restore();
}

function book(P, x, y, w, h, col, rot = 0, rel = 0.35) {
  P.save(); P.translate(x, y); P.rotate(rot);
  P.shape(lin(0, -h, 0, 0, [[0, lighten(col, 0.15)], [1, shade(col, 0.7)]]), M.CER, rel, rect(-w / 2, -h, w, h));
  P.shape('#f3ead6', M.MATTE, rel + 0.02, rect(-w / 2 + 1.5, -h + h * 0.25, w - 3, h * 0.25));
  P.tintStroke('#e8c168', 0.6, seg(-w / 2 + 2, -h * 0.8, -w / 2 + 2 + w * 0.3, -h * 0.8), 0.8);
  P.restore();
}
function openBook(P, x, y, w, rel = 0.35) {
  P.shape('#7a2a1d', M.CER, rel - 0.05, poly([[x - w / 2 - 2, y + 2], [x + w / 2 + 2, y + 2], [x + w / 2 + 1, y - w * 0.28], [x - w / 2 - 1, y - w * 0.28]]));
  for (const sg of [-1, 1]) {
    P.shape(lin(x, 0, x + sg * w / 2, 0, [[0, '#d8ceb8'], [1, '#fbf6ea']]), M.CER, rel, pth((c) => {
      c.moveTo(x, y); c.quadraticCurveTo(x + sg * w * 0.25, y - 2, x + sg * w / 2, y); c.lineTo(x + sg * w / 2, y - w * 0.3); c.quadraticCurveTo(x + sg * w * 0.25, y - w * 0.34, x, y - w * 0.3); c.closePath();
    }));
    for (let l = 0; l < 4; l++) P.tintStroke('#5d6b7a', 0.5, seg(x + sg * 3, y - w * 0.24 + l * w * 0.05, x + sg * (w / 2 - 3), y - w * 0.24 + l * w * 0.05), 0.55);
  }
}
function microscope(P, x, y, s, rel = 0.5) {
  const S = (v) => v * s;
  P.shape('#2b2f36', M.CER, rel, rrect(x - S(12), y - S(4), S(24), S(4), S(1.5)));
  P.stroke(lin(x - 4, 0, x + 4, 0, [[0, '#f2f2f2'], [1, '#9aa1ab']]), M.GOLD, rel + 0.1, S(4), pth((c) => { c.moveTo(x + S(6), y - S(4)); c.quadraticCurveTo(x + S(9), y - S(18), x + S(2), y - S(26)); }));
  P.shape('#dfe3e8', M.CER, rel + 0.05, rect(x - S(8), y - S(14), S(14), S(2)));
  P.stroke(lin(x - 3, 0, x + 3, 0, [[0, '#ffffff'], [1, '#8d96a3']]), M.GOLD, rel + 0.15, S(3.6), seg(x - S(1), y - S(15), x - S(7), y - S(32)));
  P.stroke('#1b1d22', M.CER, rel + 0.2, S(2.6), seg(x - S(6.5), y - S(31), x - S(8.5), y - S(36)));
  P.shape('#1c6fb0', M.GLASS, rel + 0.1, rect(x - S(5), y - S(15.5), S(4), S(1.2)));
}
function stethoscope(P, x, y, s, rel = 0.45) {
  const S = (v) => v * s;
  P.stroke('#1f2226', M.CER, rel, S(2.4), pth((c) => {
    c.moveTo(x - S(10), y - S(24)); c.bezierCurveTo(x - S(14), y - S(6), x + S(2), y - S(4), x, y - S(16));
    c.moveTo(x + S(10), y - S(24)); c.bezierCurveTo(x + S(12), y - S(10), x + S(4), y - S(6), x, y - S(16));
    c.moveTo(x, y - S(10)); c.bezierCurveTo(x - S(2), y + S(4), x + S(14), y + S(8), x + S(18), y + S(2));
  }));
  P.stroke('#c7ccd3', M.GOLD, rel + 0.08, S(1.6), pth((c) => { c.moveTo(x - S(10), y - S(24)); c.lineTo(x - S(9), y - S(28)); c.moveTo(x + S(10), y - S(24)); c.lineTo(x + S(9), y - S(28)); }));
  P.shape(rad(x + S(19), y + S(2), 0, S(5), [[0, '#ffffff'], [0.6, '#b9c0c9'], [1, '#6c7480']], x + S(17.5), y + S(0.5)), M.GOLD, rel + 0.15, circ(x + S(20), y + S(2), S(4.6)));
  P.shape('#2d3a4a', M.GLASS, rel + 0.2, circ(x + S(20), y + S(2), S(2.2)));
}
function skull(P, x, y, s, rel = 0.5) {
  const ivory = '#e9dfc8';
  P.shape(rad(x - s * 0.2, y - s * 0.3, 0, s, [[0, '#fbf5e6'], [1, '#bfae8a']]), M.STONE, dome(x, y - s * 0.2, s, rel + 0.2, rel), pth((c) => {
    c.ellipse(x, y - s * 0.25, s * 0.7, s * 0.62, 0, 0, TAU);
    c.moveTo(x - s * 0.4, y + s * 0.1); c.roundRect(x - s * 0.38, y + s * 0.05, s * 0.76, s * 0.45, s * 0.12);
  }));
  for (const sg of [-1, 1]) P.shape('#2a2420', M.STONE, rel + 0.05, ell(x + sg * s * 0.25, y - s * 0.1, s * 0.16, s * 0.14));
  P.shape('#2a2420', M.STONE, rel + 0.05, poly([[x, y + s * 0.02], [x - s * 0.07, y + s * 0.18], [x + s * 0.07, y + s * 0.18]]));
  for (let k = -2; k <= 2; k++) P.shape(ivory, M.CER, rel + 0.1, rect(x + k * s * 0.12 - s * 0.05, y + s * 0.32, s * 0.09, s * 0.12));
}
function bone(P, x0, y0, x1, y1, w, rel = 0.45) {
  P.stroke(lin(x0, y0 - w, x0, y0 + w, [[0, '#fbf3df'], [1, '#bda985']]), M.STONE, rel, w, seg(x0, y0, x1, y1));
  const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * w * 0.5, ny = Math.cos(a) * w * 0.5;
  for (const [px, py] of [[x0, y0], [x1, y1]]) {
    P.shape('#f1e7cf', M.STONE, rel + 0.08, circ(px + nx, py + ny, w * 0.75));
    P.shape('#e3d6b8', M.STONE, rel + 0.06, circ(px - nx, py - ny, w * 0.75));
  }
}
function skeletonPoster(P, x, y, w, h) {
  P.shape('#efe6cf', M.MATTE, 0.2, rect(x, y, w, h));
  P.stroke('#6b4423', M.CER, 0.28, 1.4, (c) => { c.beginPath(); c.rect(x, y, w, h); });
  const cx = x + w / 2, u = h / 60;
  const bc = '#8c7a5a';
  P.shape(bc, M.STONE, 0.3, circ(cx, y + 7 * u, 3.4 * u));
  P.stroke(bc, M.STONE, 0.3, 1, pth((c) => {
    c.moveTo(cx, y + 11 * u); c.lineTo(cx, y + 32 * u);
    for (let k = 0; k < 5; k++) { const yy = y + (14 + k * 3) * u; c.moveTo(cx - 7 * u, yy + 1 * u); c.quadraticCurveTo(cx, yy - 1.5 * u, cx + 7 * u, yy + 1 * u); }
    c.moveTo(cx - 9 * u, y + 13 * u); c.lineTo(cx + 9 * u, y + 13 * u);
    c.moveTo(cx - 9 * u, y + 13 * u); c.lineTo(cx - 12 * u, y + 30 * u); c.lineTo(cx - 13 * u, y + 40 * u);
    c.moveTo(cx + 9 * u, y + 13 * u); c.lineTo(cx + 12 * u, y + 30 * u); c.lineTo(cx + 13 * u, y + 40 * u);
    c.moveTo(cx - 5 * u, y + 33 * u); c.lineTo(cx + 5 * u, y + 33 * u);
    c.moveTo(cx - 4 * u, y + 34 * u); c.lineTo(cx - 5 * u, y + 46 * u); c.lineTo(cx - 5 * u, y + 57 * u);
    c.moveTo(cx + 4 * u, y + 34 * u); c.lineTo(cx + 5 * u, y + 46 * u); c.lineTo(cx + 5 * u, y + 57 * u);
  }));
  P.stroke('#c3202f', M.GLASS, 0.32, 0.8, pth((c) => { c.moveTo(cx - 2 * u, y + 20 * u); c.lineTo(cx + 1 * u, y + 22 * u); }));
}

function clock(P, x, y, r, t, rel = 0.4) {
  P.shape('#b8741a', M.GOLD, rel, circ(x, y, r + 1.6));
  P.shape(rad(x - r * 0.3, y - r * 0.3, 0, r * 1.3, [[0, '#fffaf0'], [1, '#d8ccb4']]), M.CER, rel + 0.05, circ(x, y, r));
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU;
    P.shape('#2a2420', M.CER, rel + 0.08, circ(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82, k % 3 ? 0.55 : 0.9));
  }
  const ha = t * TAU / 2.6 - Math.PI / 2, ma = t * TAU * 1.3 - Math.PI / 2;
  P.stroke('#1b1714', M.CER, rel + 0.12, 1.6, seg(x, y, x + Math.cos(ha) * r * 0.5, y + Math.sin(ha) * r * 0.5));
  P.stroke('#1b1714', M.CER, rel + 0.14, 1.1, seg(x, y, x + Math.cos(ma) * r * 0.78, y + Math.sin(ma) * r * 0.78));
  P.shape('#c3202f', M.ENAMEL, rel + 0.16, circ(x, y, 1));
}

function coffee(P, x, y, s, t, k) {
  P.shape(lin(x - s, 0, x + s, 0, [[0, '#fbf7ee'], [1, '#c4bba9']]), M.CER, 0.45, rrect(x - s * 0.6, y - s * 1.2, s * 1.2, s * 1.2, s * 0.2));
  P.stroke('#e7e0d2', M.CER, 0.45, s * 0.22, pth((c) => c.ellipse(x + s * 0.72, y - s * 0.62, s * 0.3, s * 0.3, 0, -1.4, 1.4)));
  P.shape('#3b2014', M.GLASS, 0.5, ell(x, y - s * 1.2, s * 0.58, s * 0.16));
  P.tintStroke('#d8c9b8', 0.8, pth((c) => { const o = Math.sin(t * 2 + k) * 1.4; c.moveTo(x, y - s * 1.5); c.bezierCurveTo(x + 2 + o, y - s * 2, x - 2 - o, y - s * 2.4, x + o, y - s * 3); }), 0.35);
}

function flashcard(P, x, y, w, h, rot, col, kind) {
  P.save(); P.translate(x, y); P.rotate(rot);
  P.shape(col, M.ENAMEL, 0.7, rect(-w / 2, -h / 2, w, h));
  P.tint('rgba(0,0,0,0.25)', rect(-w / 2 + 1, h / 2, w, 1));
  if (kind === 0) for (let l = 0; l < 3; l++) P.stroke('#3d4a5c', M.CER, 0.72, 0.8, seg(-w / 2 + 2, -h / 2 + 2.5 + l * 2.6, w / 2 - 2 - (l === 2 ? 5 : 0), -h / 2 + 2.5 + l * 2.6));
  else if (kind === 1) P.stroke('#c3202f', M.GLASS, 0.74, 0.9, pl([[-w / 2 + 1, 0], [-3, 0], [-1.5, -3.5], [0, 3], [1.5, -1], [3, 0], [w / 2 - 1, 0]]));
  else if (kind === 2) { P.stroke('#2d6fb0', M.GLASS, 0.74, 0.9, circ(-w / 4, 0, 2.6)); P.stroke('#3d4a5c', M.CER, 0.72, 0.7, seg(0, -1, w / 2 - 2, -1)); P.stroke('#3d4a5c', M.CER, 0.72, 0.7, seg(0, 2, w / 2 - 4, 2)); }
  else { P.stroke('#7a1d2a', M.GLASS, 0.74, 0.8, pth((c) => { c.moveTo(0, -3.5); c.bezierCurveTo(-4, -3, -4, 3, 0, 3.5); c.bezierCurveTo(4, 3, 4, -3, 0, -3.5); c.moveTo(0, -3.5); c.lineTo(0, 3.5); })); }
  P.restore();
}

function hospitalBed(P, x, y, w, rel = 0.35) {
  P.stroke('#9aa6b2', M.GOLD, rel, 1.4, pth((c) => { c.moveTo(x, y); c.lineTo(x, y + 14); c.moveTo(x + w, y - 6); c.lineTo(x + w, y + 14); }));
  P.shape('#f7f7f4', M.CER, rel + 0.05, rrect(x, y - 3, w, 6, 2));
  P.shape(lin(x, y, x + w, y, [[0, '#5aa0d8'], [1, '#2d6fb0']]), M.CER, rel + 0.1, rrect(x + w * 0.35, y - 4, w * 0.65, 7, 2));
  P.shape('#ffffff', M.CER, rel + 0.12, ell(x + w * 0.14, y - 4, w * 0.12, 3));
}

// ---------------------------------------------------------------- colour utils
function hexToRgb(hx) { const n = parseInt(hx.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join(''); }
export function shade(hx, f) { const [r, g, b] = hexToRgb(hx); return rgbToHex(r * f, g * f, b * f); }
export function lighten(hx, f) { const [r, g, b] = hexToRgb(hx); return rgbToHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f); }

// Background andamento – rows of tesserae that follow a curve, the way a
// mosaicist lays the ground around a figure.
function andamento(P, cx, cy, cols, step = 3, aspect = 0.62, rmax = 260, mat = M.STONE, h = 0.05) {
  let k = 0;
  for (let r = rmax; r > 2; r -= step, k++) P.shape(cols[k % cols.length], mat, h, ell(cx, cy, r, r * aspect));
}
function hRows(P, y0, y1, cols, step, amp, freq, mat, h, ph = 0) {
  let k = 0;
  for (let y = y1; y > y0 - step; y -= step, k++) {
    P.shape(cols[k % cols.length], mat, h, pth((c) => {
      c.moveTo(-4, y1 + 4);
      for (let x = -4; x <= W + 4; x += 4) c.lineTo(x, y + Math.sin(x * freq + k * 0.7 + ph) * amp);
      c.lineTo(W + 4, y1 + 4); c.closePath();
    }));
  }
}

// ================================================================= SCENES
// Each scene: paint(P, t) where t is seconds since the chapter began.

function paintCampus(P, t, opts = {}) {
  P.bg(lin(0, 0, 0, 84, [[0, '#15305c'], [0.4, '#3f6fa6'], [0.78, '#e7a66c'], [1, '#f6cf94']]), M.ENAMEL, 0.04);
  sun(P, 206, 40, 7);
  cloud(P, 52, 22, 18); cloud(P, 150, 14, 14, '#f3d7c4'); cloud(P, 236, 20, 10);
  ridge(P, 60, [7, 3, 1.5], [0.021, 0.063, 0.15], 11, '#5f7d9c', M.STONE, 0.1);
  ridge(P, 68, [6, 3, 1.5], [0.025, 0.07, 0.19], 12, '#3e6b62', M.STONE, 0.14);
  const hy = ridge(P, 78, [4, 2, 1], [0.03, 0.08, 0.2], 13, '#2f6b3a', M.CER, 0.18);
  const r = rng(21);
  for (let k = 0; k < 70; k++) {
    const x = r() * W, y = hy(x) + 6 + r() * 6;
    if (Math.abs(x - 128) < 58 && y > 72) continue;
    const g = [['#1f5a2e', '#2f7a3a', '#4e9a45'], ['#244f2b', '#3a6f35', '#5d8f3e'], ['#2b6a3a', '#3f8a46', '#7bb35a']][k % 3];
    r() < 0.3 ? conifer(P, x, y, 7 + r() * 5, '#1d4a2a', 0.22) : tree(P, x, y, 7 + r() * 6, g, 0.24);
  }
  // lawn with mowing stripes
  P.shape(lin(0, 86, 0, H, [[0, '#3e8c41'], [1, '#1f5c2b']]), M.MATTE, 0.1, rect(-4, 86, W + 8, H));
  for (let k = -20; k < 40; k++) P.tint('#d9f2a0', poly([[k * 12, H], [k * 12 + 6, H], [128 + (k * 12 + 6 - 128) * 0.35, 86], [128 + (k * 12 - 128) * 0.35, 86]]), k % 2 ? 0.1 : 0);
  campusBuilding(P, 128, 90, 1);
  // flower beds
  for (let k = 0; k < 120; k++) {
    const x = 60 + r() * 136, y = 90 + r() * 3;
    if (Math.abs(x - 128) < 24) continue;
    P.shape(['#d6453d', '#f2c14e', '#8e5bd1', '#f08aa8'][k % 4], M.ENAMEL, 0.3, circ(x, y, 0.8));
  }
  // path
  P.shape(lin(0, 90, 0, H, [[0, '#e3d6bb'], [1, '#b7a787']]), M.STONE, 0.2, poly([[119, 90], [137, 90], [160, H + 2], [96, H + 2]]));
  for (let y = 92; y < H; y += 3 + (y - 90) * 0.06) {
    const f = (y - 90) / 54;
    P.stroke('#9c8c6e', M.STONE, 0.18, 0.5, seg(119 - 23 * f, y, 137 + 23 * f, y));
  }
  tree(P, 58, 96, 30, ['#2d6d34', '#3f8a46', '#6aa84f']);
  tree(P, 200, 96, 32, ['#2a6a31', '#3a8440', '#62a24b']);
  tree(P, 24, 118, 40, ['#285f2e', '#377a3b', '#5f9c47']);
  tree(P, 236, 122, 44, ['#2f6d33', '#448f48', '#78b35a']);
  conifer(P, 82, 100, 20, '#1d4f2c'); conifer(P, 176, 100, 22, '#1b4a29');
  if (opts.noLight) return;
  P.tint(lin(0, 0, W, 0, [[0, 'rgba(10,20,40,0.25)'], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(255,190,110,0.15)']]), all);
}

function paintArrival(P, t) {
  P.bg(lin(0, 0, 0, 78, [[0, '#2b5f9e'], [0.6, '#79aee0'], [1, '#f2dcb6']]), M.ENAMEL, 0.04);
  sun(P, 40, 26, 6);
  cloud(P, 120, 18, 16, '#fbf1e6', '#b9c6d8'); cloud(P, 200, 28, 12, '#fbf1e6', '#b9c6d8');
  ridge(P, 56, [6, 3, 1.5], [0.02, 0.06, 0.16], 31, '#6784a4', M.STONE, 0.1);
  const hy = ridge(P, 66, [5, 2, 1], [0.028, 0.07, 0.18], 32, '#3d7050', M.STONE, 0.14);
  const r = rng(33);
  for (let k = 0; k < 40; k++) { const x = r() * W; tree(P, x, hy(x) + 7 + r() * 4, 6 + r() * 4, ['#244f2b', '#3a6f35', '#5d8f3e'], 0.2); }
  P.shape(lin(0, 76, 0, H, [[0, '#4a9a48'], [1, '#27692f']]), M.MATTE, 0.1, rect(-4, 76, W + 8, H));
  campusBuilding(P, 84, 80, 0.62, 7);
  tree(P, 36, 84, 22, ['#2d6d34', '#3f8a46', '#6aa84f']);
  tree(P, 132, 84, 20, ['#2a6a31', '#3a8440', '#62a24b']);
  // winding path toward the portico
  const path = catmull([[84, 80], [100, 94], [150, 106], [182, 122], [214, 150]], 10);
  P.shape(lin(0, 80, 0, H, [[0, '#ddd0b3'], [1, '#b3a282']]), M.STONE, 0.18, poly(ribbon(path, 5, 44)));
  for (let k = 0; k < 90; k++) { const x = r() * W, y = 100 + r() * 44; if (Math.abs(x - (150 + (y - 106) * 1.4)) > 30) P.shape(['#e5c84a', '#ffffff', '#d85a4a'][k % 3], M.ENAMEL, 0.16, circ(x, y, 0.6)); }
  // tiny classmates near the building
  for (let k = 0; k < 3; k++) person(P, { x: 104 + k * 9 + Math.sin(t * 0.6 + k) * 3, y: 86 + k * 0.6, s: 13, top: ['#c3202f', '#f2c14e', '#2d6fb0'][k], walk: t * 4 + k, h: 0.25 });
  // the student arriving
  const x = 206 - 30 * easeOut(t / 9), ph = t * 4.3;
  const moving = t < 8.5;
  const suitcaseX = x + 22;
  P.stroke('#2a2a2e', M.GOLD, 0.35, 1.3, seg(suitcaseX - 2, 124, x + 14, 108));
  P.shape(lin(suitcaseX - 8, 0, suitcaseX + 8, 0, [[0, '#2f7fb5'], [1, '#1b4f75']]), M.CER, 0.42, rrect(suitcaseX - 8, 118, 16, 20, 2.5));
  P.stroke('#123a5a', M.CER, 0.45, 0.8, seg(suitcaseX - 4, 120, suitcaseX - 4, 136));
  P.stroke('#123a5a', M.CER, 0.45, 0.8, seg(suitcaseX + 4, 120, suitcaseX + 4, 136));
  person(P, { x, y: 140, s: 92, walk: moving ? ph : null, skin: SKINS[4], hair: HAIRS[2], hairStyle: 'long', top: '#1f7a4a', bottom: '#2a3345', pack: '#c3202f', rArm: [0.42, 0.9], h: 0.5 });
  P.tint(lin(0, 0, W, 0, [[0, 'rgba(255,210,140,0.18)'], [1, 'rgba(20,30,60,0.12)']]), all);
}

function paintLearning(P, t) {
  const A = (k) => t >= k;
  // warm wood-panelled lecture room
  P.bg(lin(0, 0, 0, H, [[0, '#6b4a33'], [1, '#4a2f1f']]), M.MATTE, 0.04);
  hRows(P, 0, 104, ['#6e4b33', '#63432d', '#74503a'], 4, 0.4, 0.05, M.MATTE, 0.06);
  // chalkboard
  P.shape('#5a3a22', M.CER, 0.28, rect(62, 8, 132, 58));
  P.shape(lin(0, 10, 0, 64, [[0, '#244236'], [1, '#17302a']]), M.STONE, 0.2, rect(65, 11, 126, 52));
  if (A(0.6)) {
    P.stroke('#e9efe6', M.CER, 0.26, 0.9, pth((c) => {
      c.moveTo(80, 20); c.bezierCurveTo(84, 30, 76, 40, 82, 54); // spine sketch
      for (let k = 0; k < 7; k++) { c.moveTo(77, 24 + k * 4.4); c.lineTo(85, 23 + k * 4.4); }
    }));
  }
  if (A(1.0)) P.stroke('#f2c14e', M.GOLD, 0.26, 0.9, pth((c) => { c.moveTo(100, 22); c.lineTo(126, 22); c.moveTo(100, 28); c.lineTo(118, 28); c.moveTo(100, 34); c.lineTo(122, 34); }));
  if (A(1.4)) {
    P.stroke('#e9efe6', M.CER, 0.26, 0.9, circ(160, 34, 13));
    P.stroke('#e8738a', M.ENAMEL, 0.26, 0.9, pth((c) => { c.moveTo(150, 34); c.bezierCurveTo(154, 26, 166, 26, 170, 34); c.moveTo(152, 40); c.bezierCurveTo(158, 44, 164, 44, 168, 40); }));
    P.stroke('#e9efe6', M.CER, 0.26, 0.7, pth((c) => { c.moveTo(174, 30); c.lineTo(184, 24); c.moveTo(174, 38); c.lineTo(184, 44); }));
  }
  if (A(1.8)) P.stroke('#e9efe6', M.CER, 0.26, 0.8, pl([[100, 50], [108, 50], [111, 42], [114, 56], [117, 48], [130, 48]]));
  // anatomy poster
  if (A(1.2)) skeletonPoster(P, 18, 12, 34, 62);
  else P.shape('#6e4b33', M.MATTE, 0.06, rect(18, 12, 34, 62));
  // periodic study lamps on the wall
  if (A(2.2)) for (const lx of [206, 236]) { P.shape('#e0a526', M.GOLD, 0.35, circ(lx, 24, 3)); P.tint(rad(lx, 24, 0, 18, [[0, 'rgba(255,200,110,0.5)'], [1, 'rgba(255,200,110,0)']]), circ(lx, 24, 18)); }
  // classmates behind the desk
  if (A(5.2)) person(P, { x: 70, y: 150, s: 70, skin: SKINS[1], hair: HAIRS[1], top: '#e0452b', lArm: [0.3, 0.3], rArm: [0.5, 2.8 + 0.25 * Math.sin(t * 5)], h: 0.34 });
  if (A(5.8)) person(P, { x: 190, y: 150, s: 70, skin: SKINS[2], hair: HAIRS[3], hairStyle: 'bun', top: '#7a4bd1', h: 0.34 });
  // the student, reading
  person(P, { x: 128, y: 158, s: 94, skin: SKINS[4], hair: HAIRS[2], hairStyle: 'long', top: '#1f7a4a', lArm: [0.5, -0.6], rArm: [0.5, -0.6], h: 0.44 });
  // desk
  P.shape(lin(0, 104, 0, H, [[0, '#8a5a2b'], [0.1, '#6e4420'], [1, '#3e2512']]), M.STONE, 0.3, rect(-4, 106, W + 8, 44));
  for (let k = 0; k < 8; k++) P.tintStroke('#a8743c', 0.6, seg(0, 112 + k * 4, W, 111 + k * 4 + (k % 2)), 0.35);
  openBook(P, 128, 118, 36, 0.42);
  if (A(1.8)) { const cols = ['#9e1b25', '#1d3f6e', '#2f6b3a', '#b8741a', '#5a3fa0']; const n = Math.min(5, 1 + Math.floor((t - 1.8) * 2.5)); for (let k = 0; k < n; k++) book(P, 48 + (k % 2) * 2, 116 - k * 6.2, 34 - k * 2, 6, cols[k], (k % 2 ? 0.03 : -0.02), 0.38 + k * 0.06); }
  if (A(2.6)) microscope(P, 206, 120, 1.25);
  if (A(3.3)) stethoscope(P, 160, 132, 0.9);
  if (A(4.0)) skull(P, 92, 128, 8.5);
  if (A(4.5)) bone(P, 14, 136, 44, 128, 3.4);
  if (A(6.4)) for (let k = 0; k < 3; k++) book(P, 236, 132, 26, 5, ['#c3202f', '#2d6fb0', '#e0a526'][k], 0, 0.36 + k * 0.03);
  P.tint(rad(128, 60, 20, 200, [[0, 'rgba(255,210,150,0.12)'], [1, 'rgba(10,5,0,0.35)']]), all);
}

function heartBeat(t) {
  if (t < 2.4) return 0;
  const p = ((t - 2.4) % 0.95 + 0.95) % 0.95;
  return Math.exp(-((p / 0.06) ** 2)) + 0.55 * Math.exp(-(((p - 0.26) / 0.06) ** 2));
}

function paintHeart(P, t) {
  P.bg('#100a10', M.STONE, 0.03);
  andamento(P, 128, 74, ['#150c14', '#1b0f18', '#130a12', '#20111a'], 2.6, 1, 260, M.STONE, 0.04);
  // scattered deep-red glass gathered into the ground
  const r = rng(41);
  for (let k = 0; k < 260; k++) {
    const a = r() * TAU, d = 52 + r() * 120;
    P.shape(['#5e0a12', '#7c0c16', '#3a0610'][k % 3], M.GLASS, 0.1, circ(128 + Math.cos(a) * d, 74 + Math.sin(a) * d * 0.7, 0.6));
  }
  P.tint(rad(128, 74, 0, 90, [[0, 'rgba(160,20,30,0.35)'], [1, 'rgba(160,20,30,0)']]), circ(128, 74, 90));
  drawHeart(P, 128, 78, 98, heartBeat(t));
}

function paintOMM(P, t) {
  P.bg(lin(0, 0, 0, H, [[0, '#caa27a'], [1, '#8a5d3d']]), M.STONE, 0.04);
  hRows(P, -4, H + 4, ['#c49a70', '#b98f66', '#cfa77e', '#b08560'], 3, 1.2, 0.03, M.STONE, 0.05);
  P.tint(rad(120, 70, 30, 190, [[0, 'rgba(255,230,190,0.25)'], [1, 'rgba(60,30,10,0.45)']]), all);
  // treatment table
  P.shape('#2f4a5c', M.CER, 0.32, rrect(26, 100, 208, 10, 3));
  P.shape('#23394a', M.CER, 0.26, rect(40, 110, 6, 30)); P.shape('#23394a', M.CER, 0.26, rect(214, 110, 6, 30));
  // patient lying supine, head to the left
  const pr = 0.36;
  P.shape('#e8e2d4', M.CER, pr, rrect(34, 92, 26, 8, 3)); // pillow
  P.stroke(lin(0, 84, 0, 100, [[0, '#8fb0c6'], [1, '#56788f']]), M.MATTE, pr + 0.06, 20, seg(76, 88, 146, 89));
  P.stroke('#3e4f63', M.MATTE, pr + 0.04, 13, seg(146, 91, 222, 93));
  P.shape('#1b1b1b', M.CER, pr + 0.06, ell(226, 88, 3.5, 5.5));
  P.stroke('#86a7bd', M.MATTE, pr + 0.1, 6, seg(82, 94, 136, 95));
  P.shape(rad(52, 84, 1, 12, [[0, '#e3b28e'], [1, '#a8704c']], 48, 80), M.CER, pr + 0.14, ell(54, 86, 10, 9));
  P.shape('#3a2418', M.MATTE, pr + 0.12, pth((c) => c.ellipse(49, 88, 9, 8, 0.4, 0.9, 3.6)));
  // vertebrae & fascial lines – the anatomy made visible
  const spine = catmull([[63, 94], [80, 97], [104, 98.5], [128, 98], [146, 96]], 12);
  const sp = clamp((t - 1.6) / 2.2);
  const nv = Math.floor(spine.length * sp);
  for (let k = 0; k < nv; k += 2) P.shape(k % 4 ? '#f3ead2' : '#e2d3ad', M.STONE, pr + 0.2, ell(spine[k][0], spine[k][1], 1.4, 1.1));
  const lines = [
    [[62, 80], [80, 76], [104, 78], [132, 80], [160, 84], [200, 88], [228, 88]],
    [[98, 70], [110, 82], [126, 86], [150, 88], [186, 92], [222, 95]],
    [[62, 80], [70, 86], [86, 90], [110, 92], [140, 92]],
  ];
  lines.forEach((ln, i) => {
    const pts = partial(catmull(ln, 10), clamp((t - 2.2 - i * 0.4) / 2.6));
    P.stroke('#f2c14e', M.GOLD, pr + 0.24, 1, pl(pts), { dash: [1.6, 1.4] });
  });
  // touch ripples beneath the hands
  if (t > 2.4) for (let k = 0; k < 3; k++) {
    const rr = ((t - 2.4) * 9 + k * 9) % 27 + 3;
    P.stroke('#f6d38a', M.ENAMEL, null, 0.7, ell(64, 80, rr, rr * 0.55));
  }
  // practitioner's hands descending
  const drop = 42 * (1 - easeOut((t - 0.2) / 2.4));
  const skin = '#c68a64';
  hand(P, 58, 44 - drop, Math.PI + 0.3, 1.12, skin, { sleeve: '#2c6e8e', sleeveMat: M.MATTE, h: 0.72, curl: 0.9 });
  hand(P, 96, 50 - drop, Math.PI - 0.1, 1.12, skin, { sleeve: '#2c6e8e', sleeveMat: M.MATTE, h: 0.72, mirror: true, curl: 0.9 });
  P.tint(rad(80, 60, 0, 70, [[0, 'rgba(255,200,120,0.22)'], [1, 'rgba(255,200,120,0)']]), circ(80, 60, 70));
}

function paintNight(P, t) {
  P.bg(lin(0, 0, 0, 104, [[0, '#0e1430'], [1, '#1b2146']]), M.ENAMEL, 0.04);
  hRows(P, -4, 106, ['#121a3a', '#161e42', '#10173a'], 3, 0.6, 0.04, M.CER, 0.05);
  // window with night sky
  P.shape('#3a2c22', M.MATTE, 0.3, rect(14, 8, 80, 62));
  P.shape(lin(0, 11, 0, 67, [[0, '#07122e'], [1, '#1c3566']]), M.GLASS, 0.18, rect(17, 11, 74, 56));
  const r = rng(61);
  for (let k = 0; k < 40; k++) { const tw = 0.5 + 0.5 * Math.sin(t * 3 + k); P.shape(tw > 0.3 ? '#f7e7a8' : '#8a90b8', M.GOLD, 0.22, circ(18 + r() * 72, 12 + r() * 40, 0.5)); }
  P.tint(rad(72, 26, 0, 20, [[0, 'rgba(240,230,190,0.45)'], [1, 'rgba(240,230,190,0)']]), circ(72, 26, 20));
  P.shape('#f3e6c0', M.ENAMEL, 0.3, pth((c) => { c.arc(72, 26, 7, 0, TAU); c.moveTo(78, 23); c.arc(75, 23, 6, 0, TAU, true); }), 'evenodd');
  ridge(P, 60, [4, 2], [0.06, 0.2], 62, '#0a1428', M.STONE, 0.2, 67);
  P.shape('#3a2c22', M.MATTE, 0.32, rect(53, 8, 3, 62)); P.shape('#3a2c22', M.MATTE, 0.32, rect(14, 37, 80, 3));
  // wall clock racing through the night
  clock(P, 222, 30, 15, t);
  // lamp glow pool
  P.tint(rad(178, 74, 0, 110, [[0, 'rgba(255,180,70,0.75)'], [0.35, 'rgba(240,150,50,0.35)'], [1, 'rgba(240,150,50,0)']]), all);
  // student hunched over the books
  person(P, { x: 122, y: 164, s: 104, skin: SKINS[4], hair: HAIRS[2], hairStyle: 'long', top: '#6b3f8f', lArm: [0.55, -0.4], rArm: [0.62, 3.55], h: 0.44 });
  P.tint(lin(90, 0, 150, 0, [[0, 'rgba(0,0,30,0.35)'], [1, 'rgba(255,170,70,0.25)']]), rect(90, 40, 60, 66));
  // desk
  P.shape(lin(0, 104, 0, H, [[0, '#8a5427'], [1, '#3a2010']]), M.STONE, 0.3, rect(-4, 104, W + 8, 44));
  for (let k = 0; k < 9; k++) P.tintStroke('#b07a3c', 0.6, seg(0, 110 + k * 4, W, 109 + k * 4 + (k % 2)), 0.3);
  P.tint(rad(178, 112, 0, 70, [[0, 'rgba(255,200,90,0.6)'], [1, 'rgba(255,200,90,0)']]), ell(178, 112, 80, 22));
  // lamp: green glass shade, bronze arm, amber bulb
  P.shape('#3b2a18', M.GOLD, 0.45, ell(196, 108, 12, 3.5));
  P.stroke('#6b4a22', M.GOLD, 0.5, 2.4, pl([[196, 106], [200, 82], [186, 62]]));
  P.shape(lin(0, 54, 0, 72, [[0, '#2f9a64'], [1, '#0f4a2e']]), M.GLASS, 0.62, poly([[168, 72], [202, 70], [192, 56], [176, 57]]));
  P.shape('#ffe39a', M.GLASS, 0.7, ell(185, 72, 9, 2.2));
  P.tint('rgba(255,190,90,0.18)', poly([[168, 72], [202, 70], [236, 112], [140, 116]]));
  openBook(P, 128, 118, 40, 0.42);
  // stacks growing through the night
  const cols = ['#9e1b25', '#1d3f6e', '#2f6b3a', '#b8741a', '#5a3fa0', '#c3202f', '#2d6fb0', '#e0a526'];
  const n = Math.min(8, 2 + Math.floor(t * 0.9));
  for (let k = 0; k < n; k++) book(P, 44 + (k % 3) - 1, 118 - k * 5.4, 36 - (k % 3) * 3, 5.2, cols[k], (k % 2 ? 0.04 : -0.03), 0.36 + k * 0.05);
  const cups = Math.min(4, 1 + Math.floor(t / 2.1));
  for (let k = 0; k < cups; k++) coffee(P, 158 + k * 12, 122 + (k % 2) * 3, 5, t, k);
  // flashcards and notes flickering into existence around the student
  const fcol = ['#fff4c9', '#cfe8ff', '#ffd6e0', '#e5ffd6'];
  for (let k = 0; k < 30; k++) {
    const ta = 0.4 + k * 0.33, life = 1.5;
    if (t < ta || t > ta + life) continue;
    const rr = rng(700 + k);
    let x = 70 + rr() * 110, y = 14 + rr() * 76;
    if (x > 100 && x < 150 && y > 40) x += x < 125 ? -34 : 34;
    flashcard(P, x, y, 16, 11, (rr() - 0.5) * 0.6, fcol[k % 4], k % 4);
  }
}

function paintLandscape(P, t) {
  P.bg(lin(0, 0, 0, 74, [[0, '#1f63c0'], [0.6, '#79b4e6'], [1, '#dcefe9']]), M.ENAMEL, 0.04);
  sun(P, 214, 24, 8);
  cloud(P, 60, 18, 16, '#ffffff', '#b8cde6'); cloud(P, 140, 26, 12, '#ffffff', '#b8cde6'); cloud(P, 250, 42, 10, '#ffffff', '#b8cde6');
  // birds
  for (let k = 0; k < 4; k++) {
    const bx = (40 + k * 16 + t * 6) % (W + 20) - 10, by = 30 + Math.sin(k * 2.3) * 6, f = Math.sin(t * 8 + k) * 1.2;
    P.stroke('#27364a', M.CER, 0.2, 0.6, pl([[bx - 2, by - f], [bx, by], [bx + 2, by - f]]));
  }
  const rise = (d) => easeOut((t + 1.2 - d) / 1.6);
  const y1 = ridge(P, 58 + 16 * (1 - rise(0)), [11, 4, 2], [0.017, 0.05, 0.13], 71, '#7d9cc0', M.STONE, 0.16);
  const y2 = ridge(P, 70 + 18 * (1 - rise(0.25)), [12, 5, 2], [0.02, 0.055, 0.14], 72, '#5b8a8c', M.STONE, 0.24);
  const y3 = ridge(P, 84 + 18 * (1 - rise(0.5)), [10, 6, 2], [0.024, 0.06, 0.17], 73, '#3f7f4a', M.CER, 0.32);
  const y4 = ridge(P, 104 + 16 * (1 - rise(0.75)), [8, 5, 3], [0.03, 0.07, 0.19], 74, '#2e6a36', M.CER, 0.4);
  P.tint(lin(0, 40, 0, 90, [[0, 'rgba(210,230,255,0.25)'], [1, 'rgba(210,230,255,0)']]), all);
  // forest of autumn and evergreen tesserae
  const r = rng(75);
  const fall = [['#1f5a2e', '#2f7a3a', '#4e9a45'], ['#c3452a', '#e0663a', '#f08a4a'], ['#d9a126', '#f2c14e', '#f7d77a'], ['#8f2a2a', '#b8402f', '#d86040'], ['#2b6a3a', '#3f8a46', '#7bb35a']];
  const grow = clamp((t - 0.6) / 2.6);
  for (let k = 0; k < 420; k++) {
    const layer = k % 2 ? y3 : y4;
    const x = r() * W, y = layer(x) + 3 + r() * (k % 2 ? 14 : 30);
    const s = (k % 2 ? 5 : 8) + r() * 4;
    const show = r() < grow;
    if (!show || (y > 100 && x > 110 && x < 150)) continue;
    r() < 0.35 ? conifer(P, x, y, s * 1.1, '#1b4a29', k % 2 ? 0.36 : 0.44) : tree(P, x, y, s, fall[Math.floor(r() * fall.length)], k % 2 ? 0.36 : 0.46);
  }
  // river of translucent blue glass
  const river = catmull([[128, 84], [140, 94], [112, 106], [150, 122], [122, 150]], 14);
  const rv = clamp((t - 0.3) / 2.0);
  P.shape(lin(0, 84, 0, H, [[0, '#8fd0f0'], [0.5, '#2d86c6'], [1, '#1b4f8a']]), M.GLASS, 0.14, poly(ribbon(partial(river, rv), 3, 36)));
  P.stroke('#d8f3ff', M.GLASS, 0.18, 0.7, pl(partial(river, rv).map(([x, y], i) => [x + Math.sin(i * 0.7 + t * 2) * 3, y])), { dash: [2, 3], dashOffset: -t * 6 });
  // steel arch bridge spanning the gorge
  const bp = clamp((t - 1.8) / 1.5);
  if (bp > 0) {
    P.stroke('#b0492a', M.GOLD, 0.5, 1.8, pth((c) => { c.moveTo(94, 108); c.quadraticCurveTo(128, 76 + (1 - bp) * 30, 162, 108); }));
    P.stroke('#9c3f25', M.GOLD, 0.52, 1.6, seg(82, 90, 82 + 92 * bp, 90));
    for (let k = 0; k < 9; k++) { const x = 100 + k * 7; if (x < 82 + 92 * bp) P.stroke('#8a3a22', M.GOLD, 0.48, 0.6, seg(x, 90, x, 92 + Math.abs(x - 128) * 0.35)); }
  }
  // the student and classmates hiking a ridge trail
  P.shape('#c9b48a', M.STONE, 0.42, poly(ribbon(catmull([[260, 128], [200, 132], [150, 140], [90, 150]], 8), 5, 7)));
  const hikers = [['#e0452b', SKINS[4], HAIRS[2], 'long', '#1f7a4a'], ['#f2c14e', SKINS[1], HAIRS[1], 'short', '#2d6fb0'], ['#7a4bd1', SKINS[2], HAIRS[3], 'bun', '#c3202f'], ['#2aa6a0', SKINS[3], HAIRS[1], 'short', '#e0a526']];
  hikers.forEach(([top, skin, hair, hs, pack], k) => {
    const x = 236 - t * 3.2 + k * 15;
    person(P, { x, y: 133 + (236 - x) * 0.07 + k * 0.4, s: 34, top, skin, hair, hairStyle: hs, pack, walk: t * 4.8 + k * 1.3, h: 0.55 });
  });
  for (let k = 0; k < 60; k++) P.shape(['#f2c14e', '#e8738a', '#ffffff', '#b27ad9'][k % 4], M.ENAMEL, 0.44, circ(r() * W, 120 + r() * 24, 0.6));
}

function paintHospital(P, t) {
  P.bg('#cfdadd', M.CER, 0.05);
  // ceiling, walls, floor in one-point perspective
  P.shape(lin(0, 0, 0, 40, [[0, '#dde4e6'], [1, '#c6d2d7']]), M.CER, 0.08, poly([[-4, -4], [W + 4, -4], [150, 40], [106, 40]]));
  P.shape(lin(0, 0, 104, 0, [[0, '#9cc6bb'], [1, '#bcd9d1']]), M.CER, 0.1, poly([[-4, -4], [106, 40], [106, 78], [-4, H + 4]]));
  P.shape(lin(W, 0, 150, 0, [[0, '#98b8d6'], [1, '#bdd2e4']]), M.CER, 0.1, poly([[W + 4, -4], [150, 40], [150, 78], [W + 4, H + 4]]));
  P.shape('#d2dde2', M.CER, 0.06, rect(106, 40, 44, 38));
  P.shape(lin(0, 78, 0, H, [[0, '#aabfc9'], [1, '#6f8e9e']]), M.STONE, 0.06, poly([[106, 78], [150, 78], [W + 4, H + 4], [-4, H + 4]]));
  for (let k = 1; k < 9; k++) { const f = k / 9; P.tintStroke('#6f8e9e', 0.5, seg(106 + 44 * f, 78, -4 + (W + 8) * f, H + 4), 0.45); }
  for (let k = 1; k < 7; k++) { const y = 78 + (H - 78) * (k / 7) ** 1.6; P.tintStroke('#6f8e9e', 0.5, seg(0, y, W, y), 0.4); }
  // ceiling light panels, glowing
  for (let k = 0; k < 4; k++) {
    const f0 = 0.15 + k * 0.22, f1 = f0 + 0.1;
    const yA = lerp(40, -4, 1 - f0), yB = lerp(40, -4, 1 - f1);
    const wA = lerp(6, 70, 1 - f0), wB = lerp(6, 70, 1 - f1);
    P.shape('#fffdf2', M.ENAMEL, 0.14, poly([[128 - wA / 2, yA], [128 + wA / 2, yA], [128 + wB / 2, yB], [128 - wB / 2, yB]]));
    P.tint(rad(128, yA, 0, 40, [[0, 'rgba(255,250,220,0.4)'], [1, 'rgba(255,250,220,0)']]), circ(128, yA, 40));
  }
  // doors along both walls
  const door = (side, f, col) => {
    const xn = side < 0 ? lerp(-4, 106, f) : lerp(W + 4, 150, f);
    const xf = side < 0 ? lerp(-4, 106, f + 0.12) : lerp(W + 4, 150, f + 0.12);
    const topN = lerp(-4, 40, f) + (1 - f) * 34, botN = lerp(H + 4, 78, f);
    const topF = lerp(-4, 40, f + 0.12) + (1 - f - 0.12) * 34, botF = lerp(H + 4, 78, f + 0.12);
    P.shape(col, M.CER, 0.14, poly([[xn, topN], [xf, topF], [xf, botF], [xn, botN]]));
    P.shape('#cfe3f2', M.GLASS, 0.16, poly([[lerp(xn, xf, 0.3), lerp(topN, topF, 0.3) + 5], [lerp(xn, xf, 0.7), lerp(topN, topF, 0.7) + 4], [lerp(xn, xf, 0.7), lerp(topN, topF, 0.7) + 11], [lerp(xn, xf, 0.3), lerp(topN, topF, 0.3) + 13]]));
  };
  door(-1, 0.2, '#2d6fb0'); door(-1, 0.55, '#3f8a6e'); door(1, 0.3, '#2d6fb0'); door(1, 0.62, '#3f8a6e');
  P.stroke('#7aa0b4', M.GOLD, 0.2, 1.2, seg(-4, 104, 106, 66)); P.stroke('#7aa0b4', M.GOLD, 0.2, 1.2, seg(W + 4, 104, 150, 66));
  // warm window light spilling across the floor – human, not clinical
  P.tint('rgba(255,210,150,0.35)', poly([[160, 90], [200, 88], [250, 144], [170, 144]]));
  // care team in the corridor
  person(P, { x: 80, y: 98, s: 38, skin: SKINS[3], hair: HAIRS[1], hairStyle: 'bun', scrubs: '#2a9d8f', rArm: [0.3, -0.6], h: 0.3 });
  P.shape('#f2c14e', M.ENAMEL, 0.36, rect(83, 80, 4, 5));
  person(P, { x: 150, y: 100, s: 42, skin: SKINS[2], hairStyle: 'grey', coat: true, top: '#2d4f8a', lArm: [0.4, 0.8 + 0.2 * Math.sin(t * 2)], h: 0.32 });
  // patient on the bed
  hospitalBed(P, 180, 118, 64, 0.34);
  person(P, { x: 214, y: 134, s: 58, skin: SKINS[5], hair: HAIRS[5], hairStyle: 'grey', top: '#9cc3de', lArm: [0.5, -0.4], rArm: [0.3, 0.2], h: 0.42 });
  hospitalBed(P, 180, 118, 64, 0.34);
  P.shape(lin(0, 112, 0, 124, [[0, '#5aa0d8'], [1, '#2d6fb0']]), M.CER, 0.46, rrect(196, 112, 44, 10, 3));
  // the student, now in a white coat, arriving at the bedside
  const x = lerp(42, 150, easeOut(t / 3.8));
  const walking = t < 3.6;
  person(P, { x, y: 142, s: 96, skin: SKINS[4], hair: HAIRS[2], hairStyle: 'long', top: '#1f7a4a', bottom: '#1d3f6e', coat: true, steth: true, walk: walking ? t * 4.4 : null, rArm: walking ? null : [0.6, 1.3], h: 0.52 });
}

const HM_CONTACT = [132, 80];
function paintHandMeet(P, t, burst = false) {
  P.bg(lin(0, 0, W, H, [[0, '#2c1f1b'], [1, '#43302a']]), M.MATTE, 0.04);
  const r = rng(91);
  for (let k = 0; k < 22; k++) {
    const x = r() * W, y = r() * H, rr = 6 + r() * 16;
    P.shape(rad(x, y, 0, rr, [[0, ['#6b4a36', '#3f5a7a', '#8a6a3a'][k % 3]], [1, ['#3a2a24', '#2e3a4a', '#4a3a26'][k % 3]]]), M.GLASS, 0.06, circ(x, y, rr));
  }
  if (burst) {
    const [cx, cy] = HM_CONTACT;
    for (let k = 0; k < 72; k++) {
      const a0 = (k / 72) * TAU + t * 0.02, a1 = a0 + TAU / 72;
      P.shape(['#e8b33a', '#f6d77a', '#c98a1c', '#fbe7a8'][k % 4], M.GOLD, 0.22 + (k % 3) * 0.04, poly([[cx, cy], [cx + Math.cos(a0) * 320, cy + Math.sin(a0) * 320], [cx + Math.cos(a1) * 320, cy + Math.sin(a1) * 320]]));
    }
    for (let rr = 8; rr < 200; rr += 10) P.stroke('#fff3c4', M.GOLD, 0.3, 0.8, ell(cx, cy, rr, rr));
    P.tint(rad(cx, cy, 0, 60, [[0, 'rgba(255,245,200,0.8)'], [1, 'rgba(255,245,200,0)']]), circ(cx, cy, 60));
  }
  // student's hand, white coat cuff, palm open
  hand(P, 92, 96, 1.25, 2.0, '#c68a64', { sleeve: '#f1efe9', h: 0.7, curl: 0.92 });
  // patient's hand arriving from above
  const p = easeOut(t / 3.2);
  const px = lerp(196, 164, p), py = lerp(34, 60, p);
  hand(P, px, py, -2.05 + 0.12 * (1 - p), 1.85, '#dcae8c', { sleeve: '#7d9fc0', sleeveMat: M.MATTE, h: 0.78, mirror: true });
  const sp = rng(92);
  for (let k = 0; k < 6; k++) P.tint('#a8745a', circ(px - 10 + sp() * 12, py + 4 + sp() * 10, 0.7), 0.6);
  if (t > 3.1 || burst) P.tint(rad(HM_CONTACT[0], HM_CONTACT[1], 0, 26, [[0, 'rgba(255,225,140,0.85)'], [1, 'rgba(255,225,140,0)']]), circ(HM_CONTACT[0], HM_CONTACT[1], 26));
}

function paintGraduation(P, t) {
  // velvet curtain with gold valance
  P.bg('#0f3d2a', M.MATTE, 0.05);
  for (let x = -4; x < W + 4; x += 6) P.shape(lin(x, 0, x + 6, 0, [[0, '#0b2f20'], [0.5, '#1a5a3c'], [1, '#0b2f20']]), M.MATTE, 0.1, rect(x, 0, 6, 100));
  P.shape('#d4a53a', M.GOLD, 0.3, pth((c) => { c.moveTo(-4, 0); c.lineTo(W + 4, 0); c.lineTo(W + 4, 12); for (let x = W + 4; x > -8; x -= 12) c.quadraticCurveTo(x - 6, 20, x - 12, 12); c.closePath(); }));
  for (let x = 2; x < W; x += 12) P.shape('#f2d27a', M.GOLD, 0.34, circ(x + 4, 17, 1.2));
  // stage lights
  for (const lx of [60, 128, 196]) P.tint('rgba(255,215,150,0.2)', poly([[lx - 4, 12], [lx + 4, 12], [lx + 34, 104], [lx - 34, 104]]));
  // stage
  P.shape(lin(0, 96, 0, 118, [[0, '#b27a3c'], [1, '#7a4a20']]), M.STONE, 0.22, rect(-4, 96, W + 8, 22));
  for (let k = 0; k < 5; k++) P.tintStroke('#5e3818', 0.5, seg(0, 99 + k * 4, W, 99 + k * 4), 0.5);
  P.shape('#2a180c', M.STONE, 0.18, rect(-4, 116, W + 8, 4));
  // dean at the podium
  const got = t > 6.2;
  person(P, { x: 212, y: 98, s: 62, skin: SKINS[1], hairStyle: 'grey', gown: '#1c1c22', hood: '#1f7a4a', lArm: got ? [0.9, 1.3] : [0.2, 0.3], h: 0.34 });
  P.shape(lin(186, 0, 234, 0, [[0, '#7a4f28'], [1, '#4a2e14']]), M.STONE, 0.42, poly([[190, 70], [232, 70], [228, 98], [194, 98]]));
  P.shape('#e8b640', M.GOLD, 0.48, circ(211, 82, 5)); P.shape('#1f6b45', M.ENAMEL, 0.5, circ(211, 82, 3));
  // graduate crossing the stage
  const x = lerp(30, 176, easeOut(t / 6.2));
  const walking = t < 6.0;
  person(P, { x, y: 100, s: 70, skin: SKINS[4], hair: HAIRS[2], hairStyle: 'long', gown: '#15151b', hood: '#1f7a4a', cap: true, walk: walking ? t * 4.6 : null, rArm: got ? [1.0, 1.5] : null, h: 0.44 });
  if (got) { P.stroke('#fbf6ea', M.CER, 0.6, 2.6, seg(x + 16, 72, x + 26, 69)); P.stroke('#c3202f', M.GLASS, 0.62, 1.4, seg(x + 20, 69.5, x + 20, 72.5)); }
  // gold confetti after the diploma
  if (got) {
    const r = rng(121);
    for (let k = 0; k < 140; k++) {
      const x0 = r() * W, sp = 8 + r() * 10, y = -10 + ((t - 6.2) * sp + r() * 30);
      if (y < 118) P.shape(['#f2c14e', '#e8b33a', '#ffffff', '#1f7a4a'][k % 4], k % 4 === 3 ? M.ENAMEL : M.GOLD, 0.7, circ(x0 + Math.sin(t * 2 + k) * 3, y, 0.7));
    }
  }
  // audience in the foreground
  const r = rng(122);
  for (let row = 0; row < 3; row++) for (let k = 0; k < 24; k++) {
    const hx = k * 11 + (row % 2) * 5 + r() * 3 - 4, hy = 128 + row * 8;
    const cheer = got && r() < 0.35;
    const skin = SKINS[Math.floor(r() * SKINS.length)];
    const top = ['#3b2f4a', '#2a3a4a', '#4a2a2a', '#2a4a3a', '#5a4a2a'][Math.floor(r() * 5)];
    P.shape(top, M.MATTE, 0.5 + row * 0.05, ell(hx, hy + 9, 6, 6));
    P.shape(shade(skin, 0.6), M.CER, 0.56 + row * 0.05, circ(hx, hy, 3.4));
    P.shape(HAIRS[Math.floor(r() * HAIRS.length)], M.MATTE, 0.58 + row * 0.05, pth((c) => c.arc(hx, hy - 0.4, 3.5, Math.PI, TAU)));
    if (cheer) P.stroke(top, M.MATTE, 0.6, 2, seg(hx + 3, hy + 6, hx + 5 + Math.sin(t * 9 + k) * 1.2, hy - 7));
  }
  P.tint(lin(0, 110, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.35)']]), rect(0, 110, W, 40));
}

// ---------------------------------------------------------------- finale
const MEDALLIONS = (() => {
  const out = [];
  for (let k = 0; k < 10; k++) {
    const a = Math.PI * 0.72 + (k / 10) * TAU;
    out.push([128 + Math.cos(a) * 96, 72 + Math.sin(a) * 52]);
  }
  return out;
})();
const MED_R = 16;

function medallion(P, k, x, y) {
  P.save();
  P.clip(circ(x, y, MED_R));
  switch (k) {
    case 0: P.translate(x, y); P.scale(0.36); P.translate(-128, -66); paintCampus(P, 0, { noLight: true }); break;
    case 1: P.bg('#f1e5c8', M.CER, 0.1);
      for (let i = 0; i < 4; i++) book(P, x - 2, y + 10 - i * 5, 22 - i * 2, 4.6, ['#9e1b25', '#1d3f6e', '#2f6b3a', '#b8741a'][i], (i % 2 ? 0.05 : -0.04), 0.3 + i * 0.05);
      openBook(P, x + 1, y - 7, 18, 0.5); break;
    case 2: P.bg('#1a0d14', M.STONE, 0.1); drawHeart(P, x, y + 2, 26, 0); break;
    case 3: P.bg('#c49a70', M.STONE, 0.1); hand(P, x - 6, y + 14, -0.35, 0.72, '#c68a64', { h: 0.5 }); hand(P, x + 6, y + 14, 0.35, 0.72, '#b57a55', { h: 0.52, mirror: true }); break;
    case 4: P.bg(lin(x, y - 16, x, y + 16, [[0, '#5aa0d8'], [1, '#1d3f6e']]), M.GLASS, 0.1); stethoscope(P, x - 5, y + 6, 0.85, 0.45); break;
    case 5: P.translate(x, y); P.scale(0.4); P.translate(-128, -96); paintLandscape(P, 6); break;
    case 6: P.bg(lin(x - 16, 0, x + 16, 0, [[0, '#f2c14e'], [0.5, '#e8738a'], [1, '#7a4bd1']]), M.ENAMEL, 0.1);
      person(P, { x: x - 9, y: y + 18, s: 26, top: '#e0452b', skin: SKINS[1], h: 0.4 });
      person(P, { x: x + 9, y: y + 18, s: 26, top: '#2aa6a0', skin: SKINS[2], hairStyle: 'bun', h: 0.4 });
      person(P, { x, y: y + 20, s: 30, top: '#1f7a4a', skin: SKINS[4], hair: HAIRS[2], hairStyle: 'long', h: 0.45 }); break;
    case 7: P.translate(x, y); P.scale(0.28); P.translate(-HM_CONTACT[0] + 8, -HM_CONTACT[1]); paintHandMeet(P, 5); break;
    case 8: P.bg('#1d3f6e', M.GLASS, 0.1); P.translate(x, y + 30); P.scale(1.1);
      person(P, { x: 0, y: 8, s: 44, coat: true, steth: true, top: '#1f7a4a', skin: SKINS[4], hair: HAIRS[2], hairStyle: 'long', h: 0.4 }); break;
    case 9: P.bg('#0f3d2a', M.MATTE, 0.1);
      P.shape('#101014', M.CER, 0.5, poly([[x - 12, y - 2], [x, y - 8], [x + 12, y - 2], [x, y + 4]]));
      P.shape('#1b1b22', M.CER, 0.45, rrect(x - 6, y, 12, 6, 2));
      P.stroke('#e8b640', M.GOLD, 0.55, 1, pl([[x, y - 2], [x + 9, y + 1], [x + 9, y + 9]]));
      P.stroke('#fbf6ea', M.CER, 0.5, 3, seg(x - 10, y + 11, x + 4, y + 8)); P.stroke('#c3202f', M.GLASS, 0.52, 1.2, seg(x - 3, y + 8.5, x - 3, y + 11.5)); break;
  }
  P.restore();
  P.stroke('#e0b447', M.GOLD, 0.45, 2.2, circ(x, y, MED_R + 1));
  P.stroke('#6b4a1a', M.GOLD, 0.35, 0.8, circ(x, y, MED_R + 2.6));
}

function centerDisc(P, t) {
  const cx = 128, cy = 72, R = 44;
  P.save(); P.clip(circ(cx, cy, R));
  for (let k = 0; k < 48; k++) {
    const a0 = (k / 48) * TAU, a1 = a0 + TAU / 48;
    P.shape(['#f0c75a', '#d99a2b', '#f7de8e', '#e2ad3e'][k % 4], M.GOLD, 0.3, poly([[cx, cy + 20], [cx + Math.cos(a0) * 90, cy + 20 + Math.sin(a0) * 90], [cx + Math.cos(a1) * 90, cy + 20 + Math.sin(a1) * 90]]));
  }
  P.tint(rad(cx, cy + 20, 0, 40, [[0, 'rgba(255,248,220,0.9)'], [1, 'rgba(255,248,220,0)']]), circ(cx, cy + 20, 40));
  ridge(P, 98, [4, 2], [0.06, 0.15], 131, '#5b8a8c', M.STONE, 0.34);
  ridge(P, 106, [4, 2], [0.07, 0.18], 132, '#2f6b3a', M.CER, 0.4);
  P.shape('#1f5a2e', M.CER, 0.42, rect(cx - R, 112, R * 2, 10));
  P.shape(lin(0, 100, 0, 120, [[0, '#e3d6bb'], [1, '#b7a787']]), M.STONE, 0.44, poly(ribbon(catmull([[cx + 2, 104], [cx + 14, 110], [cx - 8, 116], [cx + 4, 124]], 8), 2, 12)));
  person(P, { x: cx, y: 106, s: 62, coat: true, steth: true, top: '#1f7a4a', bottom: '#1d3f6e', skin: SKINS[4], hair: HAIRS[2], hairStyle: 'long', h: 0.62 });
  P.restore();
  P.stroke('#e0b447', M.GOLD, 0.6, 3, circ(cx, cy, R + 1.5));
  P.stroke('#1f6b45', M.ENAMEL, 0.5, 2.4, circ(cx, cy, R + 4.4));
  P.stroke('#f2d27a', M.GOLD, 0.55, 1, circ(cx, cy, R + 6.6));
}

function paintFinale(P, t) {
  P.bg('#0f3b27', M.STONE, 0.05);
  const cols = ['#0f3b27', '#154a31', '#12422c', '#1a5236', '#0f3b27', '#b9ad96', '#154a31', '#12422c', '#1a5236', '#e0b447', '#12422c', '#154a31'];
  andamento(P, 128, 72, cols, 2.4, 0.6, 250, M.STONE, 0.06);
  // corner stones
  for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) P.shape(rad(x, y, 0, 40, [[0, '#b9ad96'], [1, '#6b645a']]), M.STONE, 0.12, circ(x, y, 26));
  // the journey line through every chapter
  P.stroke('#e0b447', M.GOLD, 0.25, 1.2, ell(128, 72, 96, 52), { dash: [2, 1.4] });
  P.stroke('#f7de8e', M.GOLD, 0.22, 0.6, ell(128, 72, 100, 56));
  P.stroke('#f7de8e', M.GOLD, 0.22, 0.6, ell(128, 72, 92, 48));
  // border
  P.stroke('#e0b447', M.GOLD, 0.35, 2, rect(1.5, 1.5, W - 3, H - 3));
  P.stroke('#1f6b45', M.ENAMEL, 0.3, 1.2, rect(4, 4, W - 8, H - 8));
  MEDALLIONS.forEach(([x, y], k) => medallion(P, k, x, y));
  centerDisc(P, t);
}

function paintIdentity(P, t) {
  paintFinale(P, 0);
  const cx = 128, cy = 72, R = 44;
  if (P.logo) {
    P.shape('#f7f3ea', M.CER, 0.45, circ(cx, cy, R));
    const lw = P.logo.width, lh = P.logo.height, k = Math.min((R * 1.5) / lw, (R * 1.5) / lh);
    P.save(); P.clip(circ(cx, cy, R)); P.image(P.logo, cx - (lw * k) / 2, cy - (lh * k) / 2, lw * k, lh * k, M.ENAMEL, 0.55); P.restore();
  } else {
    P.shape(rad(cx - 10, cy - 12, 0, R * 1.2, [[0, '#2a8a58'], [1, '#0b3a24']]), M.GLASS, 0.45, circ(cx, cy, R));
    P.stroke('#e0b447', M.GOLD, 0.55, 1.2, circ(cx, cy, R - 4));
    P.shape('#e0b447', M.GOLD, 0.6, poly([[cx - 26, cy - 8], [cx - 14, cy - 22], [cx - 6, cy - 14], [cx + 4, cy - 28], [cx + 16, cy - 14], [cx + 22, cy - 19], [cx + 30, cy - 8]]));
    P.shape('#0f4a2e', M.GLASS, 0.5, poly([[cx - 20, cy - 8], [cx - 13, cy - 16], [cx - 6, cy - 9], [cx + 4, cy - 20], [cx + 14, cy - 9], [cx + 24, cy - 8]]));
    P.text('WVSOM', cx, cy + 6, 'bold 19px Georgia, "Times New Roman", serif', lin(0, cy - 6, 0, cy + 16, [[0, '#fff1b8'], [1, '#d9a126']]), M.GOLD, 0.7);
    P.stroke('#e0b447', M.GOLD, 0.6, 1, seg(cx - 28, cy + 19, cx + 28, cy + 19));
    for (let k = -2; k <= 2; k++) P.shape('#f7de8e', M.GOLD, 0.62, circ(cx + k * 8, cy + 26, 1.2));
  }
  P.stroke('#e0b447', M.GOLD, 0.6, 3, circ(cx, cy, R + 1.5));
}

function paintEmpty(P) { P.bg('#000000', M.STONE, 0); }

export const SCENES = {
  empty: { paint: paintEmpty },
  campus: { paint: paintCampus },
  arrival: { paint: paintArrival, live: 12, liveStyle: 'live' },
  learning: { paint: paintLearning, live: 12, liveStyle: 'flip', liveJitter: 0.7 },
  heart: {
    paint: paintHeart, live: 20, liveStyle: 'pulse',
    fx: (E, t) => {
      E.setHeart(128, 78, 40, heartBeat(t));
      if (t > 2.4) {
        const n = Math.floor((t - 2.4) / 0.95);
        if (n !== E.fxState.beat) { E.fxState.beat = n; E.ripple(128, 78, 0.7); }
      }
    },
  },
  omm: { paint: paintOMM, live: 12, liveStyle: 'live', events: [[2.6, 62, 80, 0.35], [2.7, 100, 84, 0.3]] },
  night: { paint: paintNight, live: 12, liveStyle: 'live' },
  landscape: { paint: paintLandscape, live: 12, liveStyle: 'rise' },
  hospital: { paint: paintHospital, live: 12, liveStyle: 'live' },
  handmeet: { paint: paintHandMeet, live: 15, liveStyle: 'live', events: [[3.2, HM_CONTACT[0], HM_CONTACT[1], 0.9]] },
  goldburst: { paint: (P, t) => paintHandMeet(P, t + 4, true), events: [[0.0, HM_CONTACT[0], HM_CONTACT[1], 1.2], [0.9, HM_CONTACT[0], HM_CONTACT[1], 0.7]] },
  graduation: { paint: paintGraduation, live: 12, liveStyle: 'live', events: [[6.3, 190, 72, 0.6]] },
  finale: { paint: paintFinale },
  identity: { paint: paintIdentity, events: [[0.2, 128, 72, 0.5]] },
};

export const FOCUS = { campusFirstTile: [98, 124], heart: [128, 78], hands: [80, 70], contact: HM_CONTACT };
