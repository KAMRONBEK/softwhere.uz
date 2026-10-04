#!/usr/bin/env node
// Renders project compositions to ../public/videos/<slug>.mp4 (+ <slug>.jpg poster) for the website.
// Usage: node scripts/render.mjs [--only=talim-ai,truck-me] [--concurrency=4] [--no-poster]
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { renderMedia, renderStill } from '@remotion/renderer';
import { parseArgs, VIDEO_ROOT } from './lib/images.mjs';
import { bundleProject, resolveIds, selectProject } from './lib/remotion.mjs';

const OUT_DIR = path.resolve(VIDEO_ROOT, '../public/videos');
/** Silent H.264 that every browser autoplays; slow preset + CRF 26 keeps screen content crisp and small. */
const ENCODE = {
  codec: 'h264',
  crf: 26,
  x264Preset: 'slow',
  pixelFormat: 'yuv420p',
  colorSpace: 'bt709',
  imageFormat: 'jpeg',
  jpegQuality: 92,
  muted: true,
};
/** Intro title card frame (icon, name and chips fully in). */
const POSTER_FRAME = 66;
const POSTER_QUALITY = 85;
const DEFAULT_CONCURRENCY = 4;

const renderOne = async (serveUrl, id, { concurrency, poster }) => {
  const composition = await selectProject(serveUrl, id);
  const output = path.join(OUT_DIR, `${id}.mp4`);
  let lastLogged = -1;
  await renderMedia({
    ...ENCODE,
    composition,
    serveUrl,
    inputProps: {},
    outputLocation: output,
    concurrency,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== lastLogged) {
        lastLogged = pct;
        process.stdout.write(`  ${id}: ${pct}%\r`);
      }
    },
  });
  if (poster) {
    await renderStill({
      composition,
      serveUrl,
      inputProps: {},
      frame: Math.min(POSTER_FRAME, composition.durationInFrames - 1),
      output: path.join(OUT_DIR, `${id}.jpg`),
      imageFormat: 'jpeg',
      jpegQuality: POSTER_QUALITY,
    });
  }
  const { size } = await stat(output);
  console.log(
    `✓ ${id} → public/videos/${id}.mp4  ${(size / 1e6).toFixed(2)} MB, ${(composition.durationInFrames / composition.fps).toFixed(1)}s`
  );
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const ids = await resolveIds(args.only);
  const options = { concurrency: Number(args.concurrency ?? DEFAULT_CONCURRENCY), poster: !args['no-poster'] };
  await mkdir(OUT_DIR, { recursive: true });
  const serveUrl = await bundleProject();

  const failures = [];
  for (const id of ids) {
    try {
      await renderOne(serveUrl, id, options);
    } catch (error) {
      failures.push(id);
      console.error(`✗ ${id}: ${error.message}`);
    }
  }
  if (failures.length) {
    console.error(`\n${failures.length}/${ids.length} failed: ${failures.join(', ')}`);
    process.exit(1);
  }
};

main().catch(error => {
  console.error(`render failed: ${error.message}`);
  process.exit(1);
});
