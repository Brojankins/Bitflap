// Analog surface: film grain, paper fibre, vignette. Precomputed once, seeded, then
// offset per frame so grain "lives" without breaking determinism.
import { W, H, mulberry32, fbm, hash1 } from './core.js';
import { makeCanvas } from './draw.js';
import { C, TEXTURE, rgba } from '../config/design.js';

let GRAIN = null, PAPER = null, FIBRE = null;

export function initTextures() {
  if (GRAIN) return;
  GRAIN = [];
  for (let k = 0; k < 4; k++) {
    const c = makeCanvas(512, 512);
    const g = c.getContext('2d');
    const img = g.createImageData(512, 512);
    const r = mulberry32(900 + k);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (r() + r() + r()) / 3; // soft gaussian-ish grain
      const b = Math.floor(v * 255);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    GRAIN.push(c);
  }
  // Paper: low-frequency mottling + fibres, multiplied over paper grounds.
  PAPER = makeCanvas(1024, 1024);
  {
    const g = PAPER.getContext('2d');
    const img = g.createImageData(1024, 1024);
    for (let y = 0; y < 1024; y++) {
      for (let x = 0; x < 1024; x++) {
        const n = fbm(x / 220, y / 220, 4) * 0.5 + fbm(x / 18, y / 18, 2) * 0.12;
        const v = Math.floor(236 + n * 30);
        const i = (y * 1024 + x) * 4;
        img.data[i] = v; img.data[i + 1] = v - 2; img.data[i + 2] = v - 6; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const r = mulberry32(77);
    g.lineCap = 'round';
    for (let i = 0; i < 900; i++) {
      const x = r() * 1024, y = r() * 1024, a = r() * Math.PI, l = 4 + r() * 22;
      g.strokeStyle = r() < 0.5 ? 'rgba(120,100,80,0.10)' : 'rgba(255,255,255,0.18)';
      g.lineWidth = 0.6 + r() * 0.8;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  }
  FIBRE = PAPER;
}

/** Paper ground: flat colour × paper texture. */
export function paperGround(g, color = C.paper, strength = 1) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  const s = g.canvas.width / W;
  g.fillStyle = color;
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.9 * strength;
  g.scale(s * 1.25, s * 1.25);
  const pat = g.createPattern(FIBRE, 'repeat');
  g.fillStyle = pat;
  g.fillRect(0, 0, W, H);
  g.restore();
}

/** Final pass over every frame: grain, vignette, a whisper of halation. */
export function finish(g, frame, { dark = 0.5, grain = 1, vignette = 1 } = {}) {
  const cw = g.canvas.width, ch = g.canvas.height;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  // vignette
  if (vignette > 0) {
    const vg = g.createRadialGradient(cw / 2, ch / 2, ch * 0.35, cw / 2, ch / 2, ch * 1.05);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(12,8,5,${TEXTURE.vignette * vignette * (0.55 + dark * 0.45)})`);
    g.fillStyle = vg;
    g.fillRect(0, 0, cw, ch);
  }
  // grain
  if (grain > 0) {
    const tex = GRAIN[frame % 4];
    const ox = Math.floor(hash1(frame * 3 + 1) * 512), oy = Math.floor(hash1(frame * 7 + 2) * 512);
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = (dark > 0.5 ? TEXTURE.grainInk : TEXTURE.grainPaper) * 1.6 * grain;
    const pat = g.createPattern(tex, 'repeat');
    g.translate(-ox, -oy);
    g.fillStyle = pat;
    g.fillRect(ox, oy, cw, ch);
  }
  g.restore();
}

export const _paperTexture = () => PAPER;
export { rgba };
