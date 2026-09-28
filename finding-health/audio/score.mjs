#!/usr/bin/env node
// FINDING HEALTH — procedural score + sound design, locked to the master timeline.
//   node audio/score.mjs out/score.wav
// One musical identity in D (dorian/mixolydian colour, plucked-string pulse for Appalachia):
// curious → rhythmic and crowded → silence → broad and cinematic → stripped back → earned.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, Bus, pad, pluck, piano, reverb, writeWav } from './synth.mjs';
import { playCue } from './sfx.mjs';
import { SCENES, DURATION } from '../src/config/timeline.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = {
  origin: 's01-origin', firstweeks: 's02-firstweeks', whitecoat: 's03-whitecoat', body: 's04-body', omm: 's05-omm',
  clinical: 's06-clinical', patient: 's07-patient', systems: 's08-systems', comlex: 's09-comlex', statewide: 's10-statewide',
  rotations: 's11-rotations', human: 's12-human', choice: 's13-choice', match: 's14-match', return: 's15-return',
  graduation: 's16-graduation', final: 's17-final',
};

// chords (MIDI)
const CH = {
  D: [50, 57, 64, 66], Dhi: [62, 69, 74, 76], Bm: [47, 54, 57, 62], G: [43, 50, 54, 59], A: [45, 52, 57, 62],
  Em: [40, 47, 55, 66], Dmaj9: [50, 57, 64, 66, 69], Asus: [45, 52, 57, 62, 64],
};
const PENT = [62, 64, 66, 69, 71, 74, 76, 78, 81]; // D major pentatonic

// per-section music level: the broad middle of the film needs more body than the intimate scenes
const LEVEL = { origin: 1, firstweeks: 1.1, whitecoat: 1.3, body: 1, omm: 1.4, clinical: 1.1, patient: 1.2, systems: 2.0, comlex: 1.5, statewide: 1.9, rotations: 1.9, human: 1.5, choice: 1.4, match: 1.2, return: 1.8, graduation: 1.7, final: 1.3 };

function music(mus, s0, id, dur) {
  const L = LEVEL[id] ?? 1;
  const P = (ch, t, d, o = {}) => ch.forEach((m, i) => pad(mus, m, s0 + t, d, { pan: (i / (ch.length - 1)) * 1.2 - 0.6, ...o, gain: (o.gain ?? 0.05) * L }));
  const K = (m, t, o = {}) => pluck(mus, m, s0 + t, { pan: ((m * 7) % 11) / 11 - 0.5, seed: Math.round((s0 + t) * 100), ...o, gain: (o.gain ?? 0.16) * L });
  switch (id) {
    case 'origin': {
      P([62, 69, 76], 3.0, 12.5, { gain: 0.03, attack: 5, tab: 'air' });
      [[5.0, 69], [6.5, 74], [7.2, 76], [9.0, 78]].forEach(([t, m]) => K(m, t, { gain: 0.1, decay: 0.998 }));
      for (let k = 0; k < 4; k++) [74, 69, 76, 78].forEach((m, j) => K(m, 10 + k + j * 0.25, { gain: 0.06 + k * 0.015, decay: 0.997 }));
      P(CH.G, 12.6, 2.1, { gain: 0.04, attack: 1.2, release: 0.8 });
      P(CH.Dmaj9, 14.6, 1.4, { gain: 0.06, attack: 0.3, release: 2.5 });
      break;
    }
    case 'firstweeks': {
      const bpm = 112, e = 60 / bpm / 2;
      const prog = [CH.D, CH.Bm, CH.G, CH.A];
      for (let t = 1.0, k = 0; t < 8.05; t += e, k++) {
        const ch = prog[Math.floor((t - 1) / 1.2) % 4];
        K(ch[k % ch.length] + 12, t, { gain: 0.08 + (t / 8) * 0.06, decay: 0.994 });
        if (t > 4.5) K(PENT[(k * 3) % PENT.length], t + e / 2, { gain: 0.05, decay: 0.992 });
        if (t > 5.8 && k % 2 === 0) K(ch[0] - 12, t, { gain: 0.1, decay: 0.99 });
      }
      prog.forEach((ch, i) => P(ch, 1.0 + i * 1.8, 1.8, { gain: 0.025, attack: 0.3, release: 0.4 }));
      P(CH.Dmaj9, 7.25, 0.8, { gain: 0.06, attack: 0.01, release: 0.2 });
      break;
    }
    case 'whitecoat': {
      P([57, 62, 64, 69, 74], 1.0, 8.0, { gain: 0.04, attack: 3.2, tab: 'air', release: 2.2 });
      piano(mus, 74, s0 + 4.7, { gain: 0.14, dur: 4 });
      piano(mus, 66, s0 + 5.3, { gain: 0.1, dur: 4 });
      break;
    }
    case 'body': {
      const bpm = 96, sx = 60 / bpm / 4;
      const prog = [[CH.Bm, 0, 4.5], [CH.G, 4.5, 9], [CH.Em, 9, 13.5], [CH.Asus, 13.5, 17.3]];
      prog.forEach(([ch, a, b]) => P(ch, a, b - a, { gain: 0.035, attack: 1.2, release: 1 }));
      for (let t = 0.5, k = 0; t < 17.3; t += sx, k++) {
        const [ch] = prog.find(([, a, b]) => t >= a && t < b) || prog[0];
        const g = 0.035 + (t / 17) * 0.06;
        K(ch[(k * 2) % ch.length] + 24, t, { gain: g, decay: 0.993, bright: 0.3 });
      }
      break;
    }
    case 'omm': {
      P(CH.D.map((m) => m - 12), 0, 11, { gain: 0.04, attack: 2, bright: 0.2, release: 1.5 });
      [[1.5, 57], [4.0, 66], [6.0, 64], [8.5, 62]].forEach(([t, m]) => piano(mus, m, s0 + t, { gain: 0.13, dur: 4 }));
      break;
    }
    case 'clinical': {
      P(CH.G, 0.2, 5, { gain: 0.03, attack: 1 });
      P(CH.Asus, 5.2, 3.4, { gain: 0.03, attack: 0.8 });
      for (let t = 1.6; t < 8.6; t += 60 / 72) K(38, t, { gain: 0.14, decay: 0.985, bright: 0 });
      for (let t = 3.6, k = 0; t < 8.6; t += 60 / 144, k++) K(PENT[(k * 5) % PENT.length], t, { gain: 0.04, decay: 0.99 });
      P(CH.Dmaj9, 8.6, 2.4, { gain: 0.025, attack: 1.5 });
      break;
    }
    case 'patient': {
      piano(mus, 57, s0 + 8.2, { gain: 0.12, dur: 5 });
      piano(mus, 62, s0 + 10.4, { gain: 0.1, dur: 4 });
      break;
    }
    case 'systems': {
      const bpm = 104, sx = 60 / bpm / 4;
      [[CH.Em, 0], [CH.G, 3], [CH.D, 6], [CH.Asus, 9]].forEach(([ch, a]) => P(ch, a, 3, { gain: 0.035, attack: 0.8, release: 0.8 }));
      for (let t = 0.3, k = 0; t < 11.5; t += sx, k++) {
        K(PENT[(k * 2) % PENT.length], t, { gain: 0.035 + (t / 12) * 0.04, decay: 0.992 });
        if (t > 4 && k % 3 === 0) K(PENT[(k * 5 + 3) % PENT.length] - 12, t + sx / 2, { gain: 0.04, decay: 0.99 });
      }
      break;
    }
    case 'comlex': {
      P(CH.Asus, 0, 4.7, { gain: 0.05, attack: 3.5, release: 0.05, bright: 1 });
      P([62, 69, 74, 78], 7.0, 1.2, { gain: 0.04, attack: 0.6, tab: 'air', release: 2 });
      break;
    }
    case 'statewide': {
      [[CH.G, 0, 3], [CH.D, 3, 6], [CH.Bm, 6, 9], [CH.Asus, 9, 12]].forEach(([ch, a, b]) => P(ch, a, b - a, { gain: 0.045, attack: 1, release: 1.2 }));
      [[31, 0, 3], [38, 3, 6], [35, 6, 9], [33, 9, 12]].forEach(([m, a, b]) => pad(mus, m, s0 + a, b - a, { gain: 0.05, attack: 0.5, bright: 0.1 }));
      for (let t = 1.5, k = 0; t < 11.6; t += 60 / 88, k++) { K([62, 69, 74, 69][k % 4], t, { gain: 0.09, decay: 0.997 }); if (k % 2) K([74, 81, 78, 76][k % 4], t + 0.34, { gain: 0.05, decay: 0.996 }); }
      break;
    }
    case 'rotations': {
      const T0 = 0.9, STEP = 1.95;
      const prog = [CH.D, CH.Bm, CH.G, CH.Asus, CH.Em, CH.G, CH.A];
      prog.forEach((ch, i) => { P(ch, T0 + i * STEP, STEP, { gain: 0.04, attack: 0.4, release: 0.6 }); pad(mus, ch[0] - 12, s0 + T0 + i * STEP, STEP, { gain: 0.06, attack: 0.1, bright: 0.1 }); });
      for (let t = 0.3, k = 0; t < 14.8; t += 60 / 100 / 2, k++) {
        const i = Math.max(0, Math.min(6, Math.floor((t - T0) / STEP)));
        const ch = prog[i];
        K(ch[k % ch.length] + 12, t, { gain: 0.07, decay: 0.993 });
        if (i === 6) K(ch[(k + 2) % ch.length] + 24, t + 0.15, { gain: 0.05, decay: 0.99 });
      }
      break;
    }
    case 'human': {
      P(CH.Bm.map((m) => m - 12), 0, 9, { gain: 0.025, attack: 2, bright: 0.2 });
      break;
    }
    case 'choice': {
      P(CH.Asus, 0.2, 8.6, { gain: 0.035, attack: 2.5, tab: 'air' });
      break;
    }
    case 'match': {
      P(CH.Dmaj9, 5.4, 2.6, { gain: 0.08, attack: 0.6, release: 3 });
      pad(mus, 38, s0 + 5.4, 2.6, { gain: 0.08, attack: 0.4, bright: 0.1, release: 3 });
      K(74, 5.45, { gain: 0.12 }); K(78, 5.7, { gain: 0.1 }); K(81, 5.95, { gain: 0.1 });
      break;
    }
    case 'return': {
      P(CH.G, 0, 4.5, { gain: 0.045, attack: 1 });
      P(CH.D, 4.5, 4.5, { gain: 0.045, attack: 1 });
      for (let t = 0.4, k = 0; t < 8.8; t += 0.5, k++) K([62, 66, 69, 74, 71, 69][k % 6], t, { gain: 0.06, decay: 0.997 });
      break;
    }
    case 'graduation': {
      [[CH.D, 0], [CH.Bm, 2.5], [CH.G, 5], [CH.A, 7.5]].forEach(([ch, a]) => { P(ch, a, 2.5, { gain: 0.05, attack: 0.8, release: 1 }); pad(mus, ch[0] - 12, s0 + a, 2.5, { gain: 0.06, bright: 0.1 }); });
      [[2.6, 66], [4.4, 69], [7.0, 74], [8.2, 76]].forEach(([t, m]) => piano(mus, m, s0 + t, { gain: 0.14, dur: 4 }));
      break;
    }
    case 'final': {
      P(CH.G, 0, 3.6, { gain: 0.045, attack: 0.5 });
      P(CH.Asus, 3.6, 3.3, { gain: 0.04, attack: 1, release: 0.4 });
      P(CH.Dmaj9, 8.1, 6.4, { gain: 0.06, attack: 1.2, release: 3 });
      pad(mus, 38, s0 + 8.1, 6.4, { gain: 0.07, attack: 1.5, bright: 0.1, release: 3 });
      [[9.6, 69], [10.35, 74], [11.1, 78]].forEach(([t, m]) => K(m, t, { gain: 0.1, decay: 0.998 }));
      piano(mus, 50, s0 + 12.6, { gain: 0.14, dur: 5 });
      break;
    }
  }
  void dur;
}

async function main() {
  const out = path.resolve(ROOT, process.argv[2] || 'out/score.wav');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const total = DURATION + 3;
  const mus = new Bus(total), sfx = new Bus(total);
  let cueCount = 0;
  for (const s of SCENES) {
    music(mus, s.start, s.id, s.dur);
    const mod = await import(path.join(ROOT, 'src/scenes', FILES[s.id] + '.js'));
    for (const c of mod.cues || []) {
      if (c.t > s.dur + 0.5) continue;
      playCue(sfx, s.start + c.t, c);
      cueCount++;
    }
  }
  const room = new Bus(total);
  mus.mixInto(room, 0.55);
  sfx.mixInto(room, 0.25);
  const wet = reverb(room, { room: 0.86, damp: 0.4 });
  const master = new Bus(total);
  mus.mixInto(master, 0.9);
  sfx.mixInto(master, 1.0);
  wet.mixInto(master, 0.9);
  // fade in/out at the very edges
  for (let i = 0; i < master.n; i++) {
    const t = i / SR;
    const e = Math.min(1, t / 0.05) * Math.min(1, Math.max(0, (DURATION + 2.5 - t) / 2.5));
    master.L[i] *= e; master.R[i] *= e;
  }
  writeWav(out, fs, master, -1);
  console.log(`wrote ${out}  ${DURATION.toFixed(1)}s  ${cueCount} cues`);
}
await main();
