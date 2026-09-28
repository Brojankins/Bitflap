// FINDING HEALTH — shared design system.
// One place for colour, type, spacing, depth and motion vocabulary.

// ---------------------------------------------------------------- colour
// Two grounds carry the whole film: INK (night, interiority, thresholds) and
// PAPER (the atlas, study, daylight). Accents are physiological, not "medical blue":
// arterial red, lamplight ochre, H&E stain pinks/purples, fascia grey-green.
export const C = {
  night: '#0a0908',
  ink: '#15120f',
  ink2: '#221d19',
  umber: '#2a211b',
  graphite: '#4a433b',
  pencil: '#7a7166',
  dust: '#a79c8c',
  paper: '#ece4d4',
  paper2: '#e3d9c6',
  paperShade: '#cdbfa7',
  light: '#f7f2e8',
  bone: '#efe6d2',

  blood: '#9f2f27',
  vermilion: '#c4462e',
  muscle: '#b65a48',
  ochre: '#c9953f',
  gold: '#dcb45e',
  lamp: '#f2d6a0',

  slate: '#1e292e',
  slate2: '#2c3b41',
  teal: '#4a7a72',
  fascia: '#b8c3bd',
  sage: '#8fa38f',

  eosin: '#e6a3bb',
  eosinDeep: '#c97b9a',
  hema: '#5b3f86',

  ecgGrid: '#e9b9ad',
  scrub: '#5f8b83',
  kelly: '#2f7a3b', // doctoral hood velvet for medicine
};

export const rgba = (hex, a = 1) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
export const mixHex = (h1, h2, t) => {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const ch = (s) => Math.round((((a >> s) & 255) * (1 - t)) + (((b >> s) & 255) * t));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

// ---------------------------------------------------------------- type
export const FONT = {
  serif: '"Instrument Serif", "DejaVu Serif", serif', // display: DAY ONE, STUDENT DOCTOR, FINDING HEALTH
  sans: '"Inter Tight", "DejaVu Sans", sans-serif', // wide-tracked caps, signage
  mono: '"IBM Plex Mono", "DejaVu Sans Mono", monospace', // atlas labels, data, case text
};
// Modular scale (1.333) anchored at 18px on a 1920 canvas.
export const TYPE = {
  micro: 15,
  label: 18,
  body: 24,
  title: 42,
  display: 132,
  hero: 220,
  giant: 330,
  tracking: { caps: 0.32, label: 0.12, display: 0.02 },
};

// ---------------------------------------------------------------- spacing / layout
export const GRID = {
  margin: 120, // safe title margin
  col: 1920 / 12,
  baseline: 12,
};

// ---------------------------------------------------------------- depth
// Parallax factors by layer; camera moves are multiplied by these.
export const DEPTH = { far: 0.25, mid: 0.6, subject: 1, near: 1.5, lens: 2.4 };

// ---------------------------------------------------------------- motion vocabulary (seconds)
export const MOTION = {
  wordIn: 0.9, // one word of display type arriving
  hold: 1.6, // minimum readable hold for display type
  morph: 1.4, // conceptual morph between two states
  settle: 0.6,
  restBPM: 62, // the student's resting heart
  studyBPM: 84,
  examBPM: 108,
  matchBPM: 124,
};

// ---------------------------------------------------------------- texture
export const TEXTURE = {
  grainInk: 0.075, // film grain strength on dark grounds
  grainPaper: 0.055,
  vignette: 0.55,
};
