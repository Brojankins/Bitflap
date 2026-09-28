// MASTER TIMELINE — the only place scene order and duration live.
// Change a duration here and everything downstream (frames, audio cues, render
// ranges) follows. Scenes receive local time t ∈ [0, dur) and should design their
// internal beats relative to `dur` where a beat must stretch with the scene.
//
// Durations are compressed from the brief's per-sequence guidance so the film lands
// near 3:10; the brief's sequence minimums alone sum to ~3:51.

export const SCENES = [
  { id: 'origin', title: 'Origin', dur: 16 },
  { id: 'firstweeks', title: 'The First Weeks', dur: 10 },
  { id: 'whitecoat', title: 'White Coat', dur: 9 },
  { id: 'body', title: 'Learning the Human Body', dur: 18 },
  { id: 'omm', title: 'Osteopathic Medicine', dur: 11 },
  { id: 'clinical', title: 'Clinical Skills', dur: 11 },
  { id: 'patient', title: 'The First Patient', dur: 12 },
  { id: 'systems', title: 'Year Two / Connection', dur: 12 },
  { id: 'comlex', title: 'COMLEX / Threshold', dur: 8 },
  { id: 'statewide', title: 'Statewide Campus', dur: 12 },
  { id: 'rotations', title: 'Rotations', dur: 15 },
  { id: 'human', title: 'Medicine Becomes Human', dur: 9 },
  { id: 'choice', title: 'Fourth Year / Choice', dur: 9 },
  { id: 'match', title: 'Match Day', dur: 8 },
  { id: 'return', title: 'Return to Lewisburg', dur: 9 },
  { id: 'graduation', title: 'Graduation', dur: 10 },
  { id: 'final', title: 'Final Reveal', dur: 15 },
];

let acc = 0;
for (const s of SCENES) {
  s.start = acc;
  acc += s.dur;
}
export const DURATION = acc;

export function sceneAt(T) {
  for (let i = SCENES.length - 1; i >= 0; i--) if (T >= SCENES[i].start) return { scene: SCENES[i], index: i, t: T - SCENES[i].start };
  return { scene: SCENES[0], index: 0, t: 0 };
}
export const startOf = (id) => SCENES.find((s) => s.id === id).start;
