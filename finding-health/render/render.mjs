#!/usr/bin/env node
// Deterministic frame renderer.
//   node render/render.mjs stills --scenes [--at 0.15,0.5,0.85] [--scale 0.5]
//   node render/render.mjs stills --frames 120,480 [--scale 1]
//   node render/render.mjs video --scale 0.5 --out out/draft.mp4 [--workers 4] [--from 0 --to 30] [--audio out/score.wav]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mode = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true; };

export function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { return execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim(); } catch {}
  return 'ffmpeg';
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, () => res(srv));
  });
}

async function openPage(browser, port, scale) {
  const page = await browser.newPage({ viewport: { width: Math.round(1920 * scale), height: Math.round(1080 * scale) } });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('[console]', m.text()); });
  await page.goto(`http://localhost:${port}/index.html?render=1&scale=${scale}`);
  await page.waitForFunction('window.FH_READY === true', null, { timeout: 180000 });
  return page;
}

const launch = () => chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb', '--disable-lcd-text'] });

async function stills() {
  const scale = parseFloat(opt('scale', '0.5'));
  const out = path.join(ROOT, opt('out', 'out/stills'));
  fs.mkdirSync(out, { recursive: true });
  const srv = await serve();
  const browser = await launch();
  const page = await openPage(browser, srv.address().port, scale);
  const meta = await page.evaluate(() => ({ frames: FH.frames, fps: FH.fps, scenes: FH.scenes.map((s) => ({ id: s.id, start: s.start, dur: s.dur })) }));
  let list = [];
  if (opt('frames')) list = String(opt('frames')).split(',').map((x) => ({ f: parseInt(x) }));
  else {
    const at = String(opt('at', '0.12,0.5,0.88')).split(',').map(parseFloat);
    const only = opt('scene') ? String(opt('scene')).split(',') : null;
    meta.scenes.forEach((s, i) => { if (only && !only.includes(s.id)) return; at.forEach((a) => list.push({ f: Math.round((s.start + s.dur * a) * meta.fps), name: `${String(i + 1).padStart(2, '0')}-${s.id}-${Math.round(a * 100)}` })); });
  }
  for (const it of list) {
    const t0 = Date.now();
    const url = await page.evaluate((f) => FH.grab(f, 'image/png'), it.f);
    const file = path.join(out, (it.name || `f${String(it.f).padStart(5, '0')}`) + '.png');
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(file, `${Date.now() - t0}ms`);
  }
  await browser.close();
  srv.close();
}

async function video() {
  const scale = parseFloat(opt('scale', '0.5'));
  const workers = parseInt(opt('workers', '4'));
  const outFile = path.join(ROOT, opt('out', 'out/draft.mp4'));
  const q = parseFloat(opt('quality', scale >= 1 ? '0.95' : '0.9'));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const ff = ffmpegPath();
  const srv = await serve();
  const browser = await launch();
  const probe = await openPage(browser, srv.address().port, scale);
  const { frames, fps } = await probe.evaluate(() => ({ frames: FH.frames, fps: FH.fps }));
  await probe.close();
  const f0 = Math.round(parseFloat(opt('from', '0')) * fps);
  const f1 = Math.min(frames, opt('to') ? Math.round(parseFloat(opt('to')) * fps) : frames);
  const total = f1 - f0;
  const chunk = Math.ceil(total / workers);
  const tmp = path.join(ROOT, 'out/.segments');
  fs.mkdirSync(tmp, { recursive: true });
  const crf = scale >= 1 ? '16' : '22';
  const t0 = Date.now();
  let done = 0;
  const segs = await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const a = f0 + w * chunk, b = Math.min(f1, a + chunk);
    if (a >= b) return null;
    const seg = path.join(tmp, `seg${w}.mp4`);
    const page = await openPage(browser, srv.address().port, scale);
    const enc = spawn(ff, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', scale >= 1 ? 'slow' : 'veryfast', '-crf', crf, '-pix_fmt', 'yuv420p', '-r', String(fps), seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      const url = await page.evaluate(([f, q]) => FH.grab(f, 'image/jpeg', q), [f, q]);
      const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
      if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
      done++;
      if (done % 150 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`${done}/${total} frames  ${el.toFixed(0)}s  eta ${((el / done) * (total - done)).toFixed(0)}s`);
      }
    }
    enc.stdin.end();
    await new Promise((r) => enc.on('close', r));
    await page.close();
    return seg;
  }));
  await browser.close();
  srv.close();
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, segs.filter(Boolean).map((s) => `file '${s}'`).join('\n'));
  const audio = opt('audio');
  const argsCat = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  if (audio && fs.existsSync(path.join(ROOT, audio))) {
    argsCat.push('-ss', String(f0 / fps), '-t', String(total / fps), '-i', path.join(ROOT, audio), '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest');
  } else argsCat.push('-c', 'copy');
  argsCat.push('-movflags', '+faststart', outFile);
  execFileSync(ff, argsCat, { stdio: 'inherit' });
  console.log(`wrote ${outFile} (${total} frames) in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

if (mode === 'stills') await stills();
else if (mode === 'video') await video();
else console.log('usage: render.mjs stills|video [options]');
