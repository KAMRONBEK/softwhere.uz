#!/usr/bin/env node
// Render an HTML animation to an MP4 (H.264) or to still frames.
//
// The page must define window.render(t) that draws the frame at t seconds.
// Usage:
//   node render.js <page.html> <out.mp4> [--fps 30] [--duration 25] [--width 1080] [--height 1920]
//   node render.js <page.html> --stills 1.5,5,12 [--width 1080] [--height 1920]
//
// Needs Playwright with Chromium (preinstalled in Claude Code on the web) and an
// ffmpeg with libx264: `pip install imageio-ffmpeg` provides one. Set FFMPEG to
// override the binary, PLAYWRIGHT_PATH to point at a specific playwright package.
const path = require('path');
const { spawn, execSync } = require('child_process');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}

function loadPlaywright() {
  if (process.env.PLAYWRIGHT_PATH) return require(process.env.PLAYWRIGHT_PATH);
  try {
    return require('playwright');
  } catch {
    const root = execSync('npm root -g').toString().trim();
    return require(path.join(root, 'playwright'));
  }
}

function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  return execSync('python3 -c "import imageio_ffmpeg as f; print(f.get_ffmpeg_exe())"').toString().trim();
}

(async () => {
  const page = path.resolve(process.argv[2]);
  const width = Number(arg('width', 1080));
  const height = Number(arg('height', 1920));
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.goto('file://' + page, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  const failed = await p.evaluate(() => [...document.fonts].filter(f => f.status !== 'loaded').map(f => f.family));
  if (failed.length) console.warn('Fonts not loaded:', failed.join(', '));

  const stills = arg('stills');
  if (stills) {
    for (const t of stills.split(',').map(Number)) {
      await p.evaluate(x => window.render(x), t);
      const out = path.join(path.dirname(page), `still-${t}.png`);
      await p.screenshot({ path: out });
      console.log(out);
    }
  } else {
    const out = path.resolve(process.argv[3]);
    const fps = Number(arg('fps', 30));
    const duration = Number(arg('duration', 25));
    const ff = spawn(
      ffmpegPath(),
      [
        '-y',
        '-loglevel',
        'error',
        '-f',
        'image2pipe',
        '-framerate',
        String(fps),
        '-c:v',
        'mjpeg',
        '-i',
        '-',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-profile:v',
        'high',
        '-crf',
        '18',
        '-preset',
        'medium',
        '-movflags',
        '+faststart',
        out,
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] }
    );
    for (let i = 0; i < Math.round(fps * duration); i++) {
      await p.evaluate(x => window.render(x), i / fps);
      const frame = await p.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(frame)) await new Promise(r => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log(out);
  }
  if (errors.length) console.warn('Page errors:', errors.join('\n'));
  await browser.close();
})();
