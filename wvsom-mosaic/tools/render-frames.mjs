// Render the film to numbered PNG frames, frame-accurately, for encoding to video.
//
//   npx http-server wvsom-mosaic -p 8123          (in one terminal)
//   node wvsom-mosaic/tools/render-frames.mjs --out frames --width 1920 --height 1080 --fps 30
//   ffmpeg -framerate 30 -i frames/%05d.png -c:v libx264 -pix_fmt yuv420p -crf 16 wvsom-mosaic.mp4
//
// Run on a machine with a real GPU: the script launches Chromium with hardware
// acceleration. Use --from/--to (seconds) to render a slice.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', 'frames');
const width = +arg('width', 1920), height = +arg('height', 1080), fps = +arg('fps', 30);
const url = arg('url', 'http://localhost:8123/index.html');
const quality = arg('q', 'ultra');
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: arg('headless', 'false') !== 'false', args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
await page.goto(`${url}?capture=1&q=${quality}`);
await page.waitForFunction(() => window.__ready, null, { timeout: 120000 });
const duration = await page.evaluate(() => window.__film.duration);
const from = +arg('from', 0), to = Math.min(+arg('to', duration), duration);
await page.evaluate(([f, r]) => { window.__film.fps = r; window.__film.seek(f); }, [from, fps]);
await page.evaluate(() => document.body.classList.remove('clean'));
const total = Math.round((to - from) * fps);
for (let n = 0; n <= total; n++) {
  if (n > 0) await page.evaluate(() => window.__film.frame());
  await page.locator('#stage').screenshot({ path: path.join(out, `${String(n).padStart(5, '0')}.png`) });
  if (n % fps === 0) console.log(`${(from + n / fps).toFixed(1)}s / ${to}s`);
}
await browser.close();
