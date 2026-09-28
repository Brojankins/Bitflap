// Geography: hand-simplified outlines (lon, lat) and a local projection.
// Outlines are deliberately simplified for an illustrated map, not survey accuracy.

export const WV_OUTLINE = [
  // Northern panhandle, down the Ohio River
  [-80.52, 40.64], [-80.52, 39.72], [-79.48, 39.72], [-79.48, 39.21],
  // Maryland line along the North Branch Potomac, out to the Eastern Panhandle
  [-79.3, 39.3], [-79.05, 39.48], [-78.8, 39.62], [-78.46, 39.52], [-78.18, 39.69],
  [-77.95, 39.6], [-77.8, 39.5], [-77.72, 39.32],
  // Virginia line back south-west
  [-77.83, 39.13], [-78.03, 39.0], [-78.35, 39.4], [-78.41, 39.1], [-78.78, 38.89],
  [-78.87, 38.76], [-79.08, 38.66], [-79.21, 38.49], [-79.3, 38.43], [-79.48, 38.46],
  [-79.63, 38.55], [-79.79, 38.26], [-79.96, 38.0], [-80.2, 37.8], [-80.3, 37.52],
  [-80.47, 37.42], [-80.86, 37.43], [-81.22, 37.27], [-81.56, 37.21], [-81.68, 37.2],
  // Kentucky line up the Tug Fork and Big Sandy
  [-81.97, 37.54], [-82.28, 37.67], [-82.3, 37.95], [-82.55, 38.2], [-82.59, 38.4],
  // Ohio River back north-east
  [-82.45, 38.42], [-82.14, 38.84], [-81.76, 38.95], [-81.56, 39.27], [-81.2, 39.39],
  [-81.0, 39.56], [-80.86, 39.65], [-80.87, 39.76], [-80.72, 40.06], [-80.66, 40.4],
  [-80.63, 40.64],
];

export const US_OUTLINE = [
  [-124.7, 48.4], [-122.8, 49.0], [-95.2, 49.0], [-94.6, 48.7], [-89.6, 48.0], [-84.8, 46.8],
  [-84.4, 45.7], [-82.5, 43.0], [-83.0, 42.0], [-78.9, 42.9], [-79.2, 43.4], [-76.3, 43.5],
  [-75.0, 44.9], [-71.5, 45.0], [-70.0, 46.7], [-67.8, 47.1], [-67.0, 44.8], [-70.2, 43.6],
  [-70.8, 42.5], [-70.0, 41.8], [-71.4, 41.4], [-73.8, 40.6], [-74.0, 39.6], [-75.0, 38.8],
  [-75.9, 37.5], [-76.3, 36.9], [-75.5, 35.3], [-76.6, 34.7], [-78.0, 33.9], [-79.3, 33.0],
  [-81.0, 31.8], [-81.4, 30.4], [-80.5, 28.5], [-80.1, 26.5], [-80.4, 25.2], [-81.1, 25.2],
  [-81.8, 26.4], [-82.7, 28.0], [-82.8, 29.2], [-84.0, 30.0], [-85.4, 29.7], [-86.5, 30.4],
  [-88.0, 30.4], [-89.6, 30.2], [-89.4, 29.1], [-90.6, 29.1], [-92.5, 29.6], [-94.0, 29.7],
  [-95.1, 29.2], [-96.7, 28.2], [-97.4, 27.0], [-97.2, 25.9], [-99.2, 26.5], [-100.3, 28.0],
  [-101.4, 29.8], [-102.6, 29.8], [-103.3, 29.0], [-104.5, 29.6], [-106.5, 31.8], [-108.2, 31.8],
  [-111.0, 31.3], [-114.8, 32.5], [-117.1, 32.5], [-118.5, 34.0], [-120.6, 34.6], [-121.9, 36.6],
  [-122.5, 37.8], [-123.8, 39.6], [-124.2, 41.9], [-124.5, 43.0], [-124.0, 46.3],
];

export const LEWISBURG = [-80.45, 37.8];

// Communities used as statewide nodes (not an official list of WVSOM regional sites).
export const WV_TOWNS = [
  { name: 'Lewisburg', ll: [-80.45, 37.8], home: true },
  { name: 'Beckley', ll: [-81.19, 37.78] },
  { name: 'Charleston', ll: [-81.63, 38.35] },
  { name: 'Huntington', ll: [-82.45, 38.42] },
  { name: 'Logan', ll: [-81.99, 37.85] },
  { name: 'Princeton', ll: [-81.1, 37.37] },
  { name: 'Summersville', ll: [-80.85, 38.28] },
  { name: 'Elkins', ll: [-79.85, 38.93] },
  { name: 'Clarksburg', ll: [-80.34, 39.28] },
  { name: 'Morgantown', ll: [-79.96, 39.63] },
  { name: 'Parkersburg', ll: [-81.56, 39.27] },
  { name: 'Wheeling', ll: [-80.72, 40.06] },
  { name: 'Martinsburg', ll: [-77.96, 39.46] },
  { name: 'Petersburg', ll: [-79.12, 38.99] },
];

export const US_PLACES = [
  { name: 'Pittsburgh', ll: [-80.0, 40.44] }, { name: 'Columbus', ll: [-83.0, 39.96] },
  { name: 'Richmond', ll: [-77.44, 37.54] }, { name: 'Philadelphia', ll: [-75.16, 39.95] },
  { name: 'Chicago', ll: [-87.63, 41.88] }, { name: 'Nashville', ll: [-86.78, 36.16] },
  { name: 'Denver', ll: [-104.99, 39.74] }, { name: 'Seattle', ll: [-122.33, 47.61] },
  { name: 'Atlanta', ll: [-84.39, 33.75] }, { name: 'Boston', ll: [-71.06, 42.36] },
  { name: 'Dallas', ll: [-96.8, 32.78] }, { name: 'Phoenix', ll: [-112.07, 33.45] },
  { name: 'Lexington', ll: [-84.5, 38.04] }, { name: 'Roanoke', ll: [-79.94, 37.27] },
  { name: 'Charlotte', ll: [-80.84, 35.23] }, { name: 'Baltimore', ll: [-76.61, 39.29] },
  { name: 'Detroit', ll: [-83.05, 42.33] }, { name: 'San Diego', ll: [-117.16, 32.72] },
];

/**
 * Local equirectangular projection centred on (lon0, lat0).
 * Returns fn(ll) → [x,y] in pixels with `scale` px per degree latitude.
 */
export function projector(lon0, lat0, scale, cx = 960, cy = 540) {
  const k = Math.cos((lat0 * Math.PI) / 180);
  return ([lon, lat]) => [cx + (lon - lon0) * k * scale, cy - (lat - lat0) * scale];
}

/** Point-in-polygon for masks. */
export function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
