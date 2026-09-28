// Kinetic typography. Words are physical objects: they arrive, have weight, and leave.
import { clamp, ease, lerp, hash1 } from './core.js';
import { C, FONT } from '../config/design.js';

export function font(g, family, size, weight = 400, italic = false) {
  g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
}

/**
 * Display word(s) with a per-letter rise-and-unblur reveal.
 * p: 0..1 in, q: 0..1 out (letters leave in the same order).
 */
export function reveal(g, text, x, y, {
  size = 132, family = FONT.serif, weight = 400, color = C.light, tracking = 0.02,
  align = 'center', p = 1, q = 0, rise = 0.35, italic = false, stagger = 0.5, alpha = 1,
} = {}) {
  if (p <= 0 || q >= 1 || alpha <= 0) return;
  g.save();
  font(g, family, size, weight, italic);
  g.letterSpacing = `${tracking}em`;
  g.textBaseline = 'alphabetic';
  g.fillStyle = color;
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width + tracking * size);
  const total = widths.reduce((a, b) => a + b, 0) - tracking * size;
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const n = chars.length;
  g.textAlign = 'left';
  g.letterSpacing = '0px';
  for (let i = 0; i < n; i++) {
    const o = n > 1 ? (i / (n - 1)) * stagger : 0;
    const pi = ease.outCubic(clamp((p - o) / (1 - stagger)));
    const qi = ease.inCubic(clamp((q - o) / (1 - stagger)));
    const a = pi * (1 - qi) * alpha;
    if (a > 0.003 && chars[i] !== ' ') {
      g.globalAlpha = a;
      const dy = (1 - pi) * size * rise - qi * size * rise * 0.6;
      g.filter = pi < 0.999 || qi > 0.001 ? `blur(${((1 - pi) + qi) * size * 0.06}px)` : 'none';
      g.fillText(chars[i], cx, y + dy);
    }
    cx += widths[i];
  }
  g.restore();
}

/** Wide-tracked small caps line (signage, captions). */
export function caps(g, text, x, y, { size = 18, color = C.ink, tracking = 0.32, align = 'center', alpha = 1, weight = 500, family = FONT.sans } = {}) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  font(g, family, size, weight);
  g.letterSpacing = `${tracking}em`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  // letterSpacing adds trailing space; compensate for centred text
  g.fillText(text, x + (align === 'center' ? (tracking * size) / 2 : 0), y);
  g.restore();
}

/** Typewriter reveal for mono text (case vignettes, labels). */
export function typeOn(g, text, x, y, p, { size = 20, color = C.ink, align = 'left', alpha = 1, family = FONT.mono, weight = 400, cursor = false } = {}) {
  if (p <= 0 || alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  font(g, family, size, weight);
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  const n = Math.floor(text.length * clamp(p));
  const s = text.slice(0, n);
  g.fillText(s, x, y);
  if (cursor && p < 1) {
    const w = g.measureText(s).width;
    g.fillRect(align === 'left' ? x + w + 3 : x + w / 2 + 3, y - size * 0.5, size * 0.55, size);
  }
  g.restore();
}

/** Text measured width helper. */
export function measure(g, text, family, size, weight = 400, tracking = 0) {
  g.save();
  font(g, family, size, weight);
  g.letterSpacing = `${tracking}em`;
  const w = g.measureText(text).width;
  g.restore();
  return w;
}

/** Scatter letters of a word as physical particles (used for "freeze" and dissolves). */
export function scatterWord(g, text, x, y, k, { size = 120, family = FONT.serif, color = C.ink, seed = 1, spread = 600, alpha = 1 } = {}) {
  g.save();
  font(g, family, size);
  g.fillStyle = color;
  g.textBaseline = 'alphabetic';
  const chars = [...text];
  const widths = chars.map((c) => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = x - total / 2;
  chars.forEach((ch, i) => {
    const h = hash1(seed * 100 + i);
    const dx = (h - 0.5) * spread * k;
    const dy = (hash1(seed * 200 + i) - 0.3) * spread * k * 1.2 + k * k * 400;
    const rot = (hash1(seed * 300 + i) - 0.5) * 2 * k;
    g.save();
    g.globalAlpha = alpha * (1 - k);
    g.translate(cx + widths[i] / 2 + dx, y + dy);
    g.rotate(rot);
    g.fillText(ch, -widths[i] / 2, 0);
    g.restore();
    cx += widths[i];
  });
  g.restore();
}

export const lerpColorAlpha = lerp; // kept for API symmetry
