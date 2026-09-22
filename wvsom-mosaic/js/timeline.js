// Chapter timing, transition choreography and the camera path.
// Board coordinates are tile units: (0,0) is the top-left tesserae,
// (256,144) the bottom-right. Heights are in tile units above the grout bed.

export const CHAPTERS = [
  { t: 0.0, scene: 'campus', style: 'drop', delay: { type: 'opening' }, dur: 1.5, all: true },
  { t: 17.0, scene: 'arrival', style: 'flip', delay: { type: 'sweep', dir: [-1, -0.25], speed: 55, jitter: 0.6 }, dur: 1.2, all: true },
  { t: 28.0, scene: 'learning', style: 'scatter', delay: { type: 'radial', at: [176, 104], speed: 60, jitter: 0.9 }, dur: 1.9 },
  { t: 40.5, scene: 'heart', style: 'wave', delay: { type: 'radial', at: [128, 78], speed: 42, jitter: 0.35 }, dur: 1.4, all: true, amp: 1.1 },
  { t: 52.0, scene: 'omm', style: 'migrate', src: [128, 78], delay: { type: 'radial', at: [128, 78], speed: 70, jitter: 1.2 }, dur: 2.2 },
  { t: 63.5, scene: 'night', style: 'scatter', delay: { type: 'radial', at: [80, 70], speed: 70, jitter: 0.8 }, dur: 1.8 },
  { t: 75.0, scene: 'landscape', style: 'rise', delay: { type: 'sweep', dir: [1, 0.35], speed: 80, jitter: 0.5 }, dur: 1.7, all: true },
  { t: 87.5, scene: 'hospital', style: 'flip', delay: { type: 'sweep', dir: [-1, 0], speed: 90, jitter: 0.35, bands: 6 }, dur: 1.1, all: true },
  { t: 98.0, scene: 'handmeet', style: 'wave', delay: { type: 'radial', at: [128, 72], speed: 60, jitter: 0.4 }, dur: 1.1, all: true, amp: 0.8 },
  { t: 101.2, scene: 'goldburst', style: 'wave', delay: { type: 'radial', at: [132, 80], speed: 55, jitter: 0.2 }, dur: 1.0, amp: 1.3 },
  { t: 104.6, scene: 'graduation', style: 'migrate', src: [132, 80], delay: { type: 'radial', at: [132, 80], speed: 60, jitter: 1.4 }, dur: 2.3 },
  { t: 116.5, scene: 'finale', style: 'flip', delay: { type: 'radial', at: [128, 72], speed: 30, jitter: 0.8 }, dur: 1.3, all: true },
  { t: 126.0, scene: 'identity', style: 'flip', delay: { type: 'radial', at: [128, 72], speed: 20, jitter: 0.5 }, dur: 1.4 },
];

export const TEXT_IN = 129.0;
export const DURATION = 142.0;

// Camera shots: [time, look target [bx, by, height], distance, elevation°, azimuth°, aperture scale]
// Azimuth 0 looks "up" the artwork from its bottom edge; positive swings the camera to the right.
const SHOTS = [
  // the empty bed, the first green tile, then hundreds
  [0.0, [98, 124, 0.3], 11, 26, 8, 1.5],
  [3.6, [98, 123, 0.3], 14, 30, 2, 1.4],
  [7.2, [104, 112, 0.4], 46, 38, -6, 1.0],
  [11.0, [128, 80, 0], 175, 50, 0, 0.45],
  // glide low across the lawn toward the portico
  [14.8, [128, 70, 1.0], 70, 30, -16, 0.9],
  // arrival
  [18.0, [150, 88, 1], 175, 48, 6, 0.45],
  [22.0, [182, 92, 2], 110, 38, 12, 0.6],
  [26.0, [178, 62, 3], 58, 30, 18, 0.9],
  // lecture hall: books, anatomy, microscope, stethoscope, classmates
  [29.0, [140, 76, 1], 175, 48, 6, 0.45],
  [32.5, [196, 104, 2], 60, 32, 22, 0.9],
  [36.0, [74, 104, 1], 70, 34, -20, 0.9],
  [39.5, [128, 72, 1], 170, 50, -4, 0.45],
  // the heart
  [44.0, [128, 80, 1], 150, 46, 4, 0.5],
  [48.5, [132, 86, 2], 80, 34, -10, 0.75],
  // osteopathic hands
  [52.5, [128, 78, 1], 175, 52, 0, 0.45],
  [56.5, [96, 78, 2], 105, 38, -12, 0.65],
  [60.5, [78, 76, 1], 70, 30, 10, 0.85],
  // late night
  [64.0, [128, 74, 1], 175, 50, 0, 0.45],
  [68.0, [176, 84, 2], 100, 36, 14, 0.6],
  [72.0, [96, 70, 2], 80, 30, -16, 0.75],
  // West Virginia
  [75.5, [128, 76, 0], 185, 46, 0, 0.4],
  [79.5, [128, 94, 2], 120, 32, 0, 0.55],
  [83.5, [208, 118, 3], 64, 28, 18, 0.9],
  // clinical rotations
  [87.5, [128, 76, 1], 180, 48, 0, 0.4],
  [91.5, [150, 88, 2], 120, 36, 8, 0.55],
  [95.5, [190, 92, 2], 90, 32, 16, 0.7],
  // hands meet; gold radiates
  [98.5, [132, 80, 2], 150, 46, 0, 0.45],
  [101.2, [140, 74, 2], 115, 44, 4, 0.6],
  [103.6, [132, 80, 1], 175, 52, 0, 0.4],
  // graduation
  [107.0, [120, 74, 2], 170, 44, -6, 0.45],
  [111.5, [170, 68, 2], 90, 32, 12, 0.65],
  [115.5, [160, 76, 1], 120, 38, 8, 0.55],
  // one enormous mosaic
  [119.0, [128, 74, 1], 90, 44, 0, 0.6],
  [123.0, [128, 73, 0], 200, 58, 0, 0.35],
  [128.0, [128, 84, 0], 275, 66, 0, 0.22],
  [135.0, [128, 97, 0], 318, 70, 0, 0.18],
  [142.0, [128, 98, 0], 324, 70, 0, 0.18],
];

const RAD = Math.PI / 180;
export const CAMERA = SHOTS.map(([t, look, d, el, az, ap]) => {
  const c = Math.cos(el * RAD);
  return [t, [look[0] + Math.sin(az * RAD) * c * d, look[1] + Math.cos(az * RAD) * c * d, look[2] + Math.sin(el * RAD) * d], look, ap];
});
