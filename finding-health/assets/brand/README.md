# Brand assets

No official WVSOM brand assets were available when this film was built, so the final
card renders a clearly labelled **placeholder** instead of a logo. Nothing in the film
redraws, approximates or reinterprets the WVSOM logo or seal.

To use the approved logo, place **one** of these files here and re-render:

- `wvsom-logo.svg` (preferred)
- `wvsom-logo.png` (transparent background, at least 1200 px wide)

`src/scenes/s17-final.js` loads it at start-up, draws it unaltered at its native aspect
ratio inside a 560 × 300 px box centred on a dark ground (generous clear space), and
removes the placeholder automatically. If the approved lockup needs a light ground or a
specific clear-space rule, adjust `logoCard()` in that file — never the artwork.

Institutional colours are likewise not assumed anywhere (e.g. the graduation hood lining
is a neutral satin; only the kelly-green velvet, which denotes medicine, is used).
