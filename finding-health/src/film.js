// Film runtime: frame → scene → pixels. Pure and deterministic.
import { W, H, FPS } from './lib/core.js';
import { SCENES, DURATION, sceneAt } from './config/timeline.js';
import { initTextures, finish } from './lib/texture.js';

import origin from './scenes/s01-origin.js';
import firstweeks from './scenes/s02-firstweeks.js';
import whitecoat from './scenes/s03-whitecoat.js';
import body from './scenes/s04-body.js';
import omm from './scenes/s05-omm.js';
import clinical from './scenes/s06-clinical.js';
import patient from './scenes/s07-patient.js';
import systems from './scenes/s08-systems.js';
import comlex from './scenes/s09-comlex.js';
import statewide from './scenes/s10-statewide.js';
import rotations from './scenes/s11-rotations.js';
import human from './scenes/s12-human.js';
import choice from './scenes/s13-choice.js';
import match from './scenes/s14-match.js';
import ret from './scenes/s15-return.js';
import graduation from './scenes/s16-graduation.js';
import final from './scenes/s17-final.js';

export const MODULES = { origin, firstweeks, whitecoat, body, omm, clinical, patient, systems, comlex, statewide, rotations, human, choice, match, return: ret, graduation, final };

export const FRAMES = Math.round(DURATION * FPS);
export { SCENES, DURATION, FPS, W, H };

let ready = false;
export async function init() {
  if (ready) return;
  if (document.fonts) {
    await Promise.all([
      document.fonts.load('400 100px "Instrument Serif"'),
      document.fonts.load('italic 400 100px "Instrument Serif"'),
      document.fonts.load('500 20px "Inter Tight"'),
      document.fonts.load('300 20px "Inter Tight"'),
      document.fonts.load('400 20px "IBM Plex Mono"'),
    ]);
  }
  initTextures();
  for (const m of Object.values(MODULES)) if (m.init) await m.init();
  ready = true;
}

/** Render one frame into canvas context g (any size; drawn in 1920×1080 design space). */
export function renderFrame(g, frame) {
  const T = frame / FPS;
  const { scene, t } = sceneAt(T);
  const mod = MODULES[scene.id];
  const k = g.canvas.width / W;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.filter = 'none';
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const look = mod.draw(g, t, { dur: scene.dur, frame, T }) || {};
  g.setTransform(1, 0, 0, 1, 0, 0);
  finish(g, frame, look);
  return { scene: scene.id, t };
}
