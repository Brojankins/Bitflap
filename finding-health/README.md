# FINDING HEALTH
*A Journey Through Medical School* — a code-driven, frame-accurate motion-design short
following one student through four years at the West Virginia School of Osteopathic
Medicine, from Day One to graduation.

1920×1080 · 30 fps · 3:14 · stereo 48 kHz. Every frame and every sample is a pure function
of time. There are no AI video clips, no stock footage, and no `Math.random`. Re-rendering
gives bit-identical pictures.

## Quick start

```bash
npm install                     # installs playwright (uses the preinstalled Chromium)
pip install imageio-ffmpeg      # or set FFMPEG=/path/to/ffmpeg (needs libx264 + aac)

npm run preview                 # http://localhost:8080 — scrubber, scene jump, ←/→ frame step
npm run stills                  # 3 stills per scene → out/stills (half res)
npm run audio                   # procedural score + sound design → out/score.wav
npm run draft                   # half-res draft with sound → out/finding-health-draft.mp4 (~2.5 min)
npm run final                   # full 1080p master → out/finding-health-1080p.mp4
```

Useful render flags: `--from 64 --to 75` (seconds, render one stretch), `--workers 4`,
`--scale 0.5`, `stills --scene omm,clinical --at 0.2,0.6`. `render/contact.sh DIR` tiles
stills into a contact sheet. `render/debug.mjs FRAME` renders one frame and reports errors.

## Structure

```
index.html              preview player + headless render hook (window.FH)
src/film.js             frame → scene → pixels; grain/vignette finishing pass
src/config/timeline.js  MASTER TIMELINE: scene order + durations (the only place they live)
src/config/design.js    colour, type, spacing, depth, motion vocabulary, texture
src/lib/                reusable components
  core.js               easing, keyframes (kf/seg/env), seeded RNG, Perlin noise, curves
  draw.js               camera, partial strokes ("draws itself"), callouts, hatching, layers
  type.js               kinetic typography (per-letter reveal, caps, type-on)
  texture.js            film grain, paper fibre, vignette
  terrain.js            Appalachian ridge-and-valley heightfield, contours, 3D ridgelines
  geo.js                West Virginia / US outlines, towns, projection
  figure.js             silhouette rig (walk/sit/stand), back view, coat/gown/hood, hands
  anatomy.js            skeleton, muscle, heart, lungs, kidney, cells, H&E tissue, ECG, trees
  campus.js             campus facade + the recurring door
  corridor.js           one-point-perspective clinical corridor
src/scenes/s01…s17      one module per sequence: `draw(g, t)` + `cues` (sound sync points)
audio/                  synth.mjs (pads, Karplus–Strong plucks, piano, reverb, WAV),
                        sfx.mjs (every cue type), score.mjs (music + mix, reads the timeline)
assets/fonts            Instrument Serif, Inter Tight, IBM Plex Mono (OFL, licences included)
assets/brand            put the approved WVSOM logo here (see its README)
docs/narration.md       optional narration script
```

**Changing timing.** Edit a duration in `timeline.js`; scene starts, frame count, render
ranges and the audio all follow. Each scene keeps its internal beats in a `B` table at the
top of its file, and its sound cues in `cues` (local seconds) next to them.

**Adding a scene.** Create `src/scenes/sNN-name.js` exporting `{ init?, draw(g, t, {dur}) }`
and `cues`, register it in `film.js` and `audio/score.mjs`, add it to the timeline.
Draw in 1920×1080 design space; return `{ dark: 0..1 }` to tune grain for the ground.

## The film, sequence by sequence

The camera scale grows with the student's understanding: cell → organ → body → patient →
family → community → West Virginia → the country. Every sequence ends on the object the
next one begins with.

| # | Sequence | Hand-off into the next |
|---|---|---|
| 1 | Origin: light → cell → division → neurons → drainage → contours → ridgelines → road → WV → Lewisburg → campus → DAY ONE | door light becomes the desk's page |
| 2 | First weeks: calm notebook → the semester piles up (clocks too fast, coffee vanishing) → WHICH OF THE FOLLOWING… → freeze | one page left floating in the dark |
| 3 | White coat: the page becomes cloth, placed on the shoulders by someone else's hands; STUDENT DOCTOR | the coat's white becomes the atlas page |
| 4 | The body: bones assemble, muscle, fascia, nerves, blood; zoom into skeletal-muscle H&E; the student walks across tissue; pull back to an atlas of connected systems | one contraction pushes forward |
| 5 | Osteopathic medicine: palpation opens bone/muscle/fascia; the back becomes a contour landscape whose restrictions relax as the hands work. *The body is a unit.* | a contour lifts off as stethoscope tubing |
| 6 | Clinical skills: chest piece → phonocardiogram → ECG → LISTEN. → cuff gauge becomes an aperture → POCUS apical 4-chamber → standardized-patient room | the practice-room door closes |
| 7 | First patient: ROOM 204, a pause at the handle, two people, the notebook closes | the patient's breath: lungs |
| 8 | Year two: one bronchial tree turned into a tree and then vessels; endocrine network; nephron as architecture; gut unfolds to a line; development; everything intersects | acceleration into the orbit |
| 9 | COMLEX Level 1: everything orbits; silence; click; the door opens on the campus | the campus |
| 10 | Statewide campus: pull up to a relief map; routes drawn as myelinated nerves with saltatory impulses; flyover of ridges and towns | into a hospital's light |
| 11 | Rotations: a corridor whose doors flood the frame with each specialty's visual language; a mentor's hand, a redone suture | the corridor |
| 12 | Medicine becomes human: an elderly hand, a child's shoes, a family waiting, bedside teaching, 2:14 a.m., the drive home | the road's vanishing point = the corridor's |
| 13 | Choice: doors vanish; applications, interviews, places; WV widens to the US; RANK ORDER LIST folds into an envelope | the envelope |
| 14 | Match Day: tension, opening, relief in posture — never the contents; a line launches | the line's destination |
| 15 | Return: paths converge on Lewisburg; memories inside the student's silhouette | the Day One door |
| 16 | Graduation: the white-coat framing repeated with the hood; STUDENT DOCTOR loses a word; the stage; the door opens outward | daylight |
| 17 | Final: rise through campus → state → Appalachia at night; one contour beats; FINDING HEALTH; logo | — |

## Accuracy notes

- Preclinical curriculum is named *Finding Health* and shown as integrated systems, with
  OMM/OPP, clinical skills, standardized patients, simulation and POCUS.
- White coat is received early and framed as responsibility beginning; the graduation
  echo uses the doctoral hood instead (kelly-green velvet = medicine).
- COMLEX Level 1 is a threshold into the clinical years, not a transformation into a physician.
- Years 3–4 happen across the Statewide Campus. Town nodes are illustrative communities, not an
  official list of WVSOM regional sites. Map outlines are simplified illustrations.
- Match Day precedes graduation; no specialty or destination is revealed. Arcs include
  in-state destinations so leaving West Virginia is not implied.
- Echo labels follow display convention (apical 4-chamber: LV screen-right, atria far field);
  histology shows skeletal muscle in transverse section with peripheral nuclei.

## Known limits / next passes

- **Logo:** placeholder until an approved file is added to `assets/brand/`.
- Hands are the weakest drawn element; a hand-authored hand library would lift S3, S5, S14.
- The score is procedural and intentionally restrained; for broadcast, treat it as a
  temp/sync track and consider a composed score that follows the same cue map.
- Runtime is 3:14. The brief's per-sequence minimums sum to ~3:51, so every sequence was
  compressed; tighten further in `timeline.js` if a hard 3:10 cap is needed.
