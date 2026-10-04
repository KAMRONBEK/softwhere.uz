#!/usr/bin/env node
// Renders evenly spaced stills of a composition plus a contact sheet, for visual QA without watching the video.
// Usage: node scripts/extract-frames.mjs --only=truck-me [--count=12] [--frames=40,120,300]
// Output: video/frames/<slug>/f-<frame>.jpg and video/frames/<slug>/sheet.jpg (git-ignored).
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { renderStill } from '@remotion/renderer';
import sharp from 'sharp';
import { parseArgs, VIDEO_ROOT } from './lib/images.mjs';
import { bundleProject, resolveIds, selectProject } from './lib/remotion.mjs';

const DEFAULT_COUNT = 12;
const SHEET = { columns: 4, thumbWidth: 640, thumbHeight: 360, gap: 8 };

const pickFrames = (duration, count, explicit) =>
  explicit
    ? explicit
        .split(',')
        .map(Number)
        .filter(f => Number.isFinite(f) && f >= 0 && f < duration)
    : Array.from({ length: count }, (_, i) => Math.round(((i + 0.5) * duration) / count));

const contactSheet = async (files, output) => {
  const rows = Math.ceil(files.length / SHEET.columns);
  const thumbs = await Promise.all(files.map(file => sharp(file).resize(SHEET.thumbWidth, SHEET.thumbHeight).toBuffer()));
  await sharp({
    create: {
      width: SHEET.columns * (SHEET.thumbWidth + SHEET.gap) + SHEET.gap,
      height: rows * (SHEET.thumbHeight + SHEET.gap) + SHEET.gap,
      channels: 3,
      background: '#000000',
    },
  })
    .composite(
      thumbs.map((input, i) => ({
        input,
        left: SHEET.gap + (i % SHEET.columns) * (SHEET.thumbWidth + SHEET.gap),
        top: SHEET.gap + Math.floor(i / SHEET.columns) * (SHEET.thumbHeight + SHEET.gap),
      }))
    )
    .jpeg({ quality: 80 })
    .toFile(output);
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const ids = await resolveIds(args.only);
  const serveUrl = await bundleProject();
  for (const id of ids) {
    const composition = await selectProject(serveUrl, id);
    const dir = path.join(VIDEO_ROOT, 'frames', id);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const frames = pickFrames(
      composition.durationInFrames,
      Number(args.count ?? DEFAULT_COUNT),
      typeof args.frames === 'string' ? args.frames : null
    );
    const files = [];
    for (const frame of frames) {
      const output = path.join(dir, `f-${String(frame).padStart(4, '0')}.jpg`);
      await renderStill({ composition, serveUrl, inputProps: {}, frame, output, imageFormat: 'jpeg', jpegQuality: 85 });
      files.push(output);
    }
    await contactSheet(files, path.join(dir, 'sheet.jpg'));
    console.log(`✓ ${id}: ${files.length} frames of ${composition.durationInFrames} → frames/${id}/sheet.jpg`);
  }
};

main().catch(error => {
  console.error(`extract-frames failed: ${error.message}`);
  process.exit(1);
});
