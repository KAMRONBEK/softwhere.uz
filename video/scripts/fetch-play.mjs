#!/usr/bin/env node
// Downloads a Google Play listing's portrait phone screenshots by scraping the public store page.
// Usage: node scripts/fetch-play.mjs --id=com.neteviacard.card --slug=netevia [--hl=en] [--max=8] [--min-aspect=1.4]
import path from 'node:path';
import sharp from 'sharp';
import { fetchBuffer, fetchText, MAX_WIDTH, pad2, parseArgs, printSaved, projectDir, requireArg, saveWebp } from './lib/images.mjs';

const USAGE = 'node scripts/fetch-play.mjs --id=<package> --slug=<slug> [--hl=en] [--max=8] [--min-aspect=1.4]';
const DEFAULT_MAX = 8;
/** Portrait phone screenshots; excludes the square icon, landscape feature graphic and tablet shots. */
const DEFAULT_MIN_ASPECT = 1.4;
const IMAGE_BASE = /https:\/\/play-lh\.googleusercontent\.com\/[A-Za-z0-9_-]{20,}/g;
/** The listing's own carousel images carry data-screenshot-index; "similar apps" thumbnails do not. */
const SCREENSHOT_IMG =
  /<img[^>]*?src="(https:\/\/play-lh\.googleusercontent\.com\/[A-Za-z0-9_-]{20,})[^"]*"[^>]*?data-screenshot-index="(\d+)"/g;

/** Carousel screenshots in display order; falls back to every image on the page if Play changes its markup. */
const screenshotBases = html => {
  const carousel = [...html.matchAll(SCREENSHOT_IMG)].sort((a, b) => Number(a[2]) - Number(b[2])).map(match => match[1]);
  if (carousel.length > 0) return [...new Set(carousel)];
  console.warn('  (no data-screenshot-index images found; falling back to all page images — check for other apps)');
  return [...new Set(html.match(IMAGE_BASE) ?? [])];
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const id = requireArg(args, 'id', USAGE);
  const slug = requireArg(args, 'slug', USAGE);
  const hl = typeof args.hl === 'string' ? args.hl : 'en';
  const max = Number(args.max ?? DEFAULT_MAX);
  const minAspect = Number(args['min-aspect'] ?? DEFAULT_MIN_ASPECT);

  const html = await fetchText(`https://play.google.com/store/apps/details?id=${encodeURIComponent(id)}&hl=${hl}&gl=US`);
  const bases = screenshotBases(html);
  console.log(`${id}: ${bases.length} candidate screenshots`);

  const dir = await projectDir(slug);
  const saved = [];
  for (const base of bases) {
    if (saved.length >= max) break;
    const buffer = await fetchBuffer(`${base}=w1080`).catch(() => null);
    if (!buffer) continue;
    const { width = 0, height = 0 } = await sharp(buffer).metadata();
    if (width < 300 || height / width < minAspect) continue;
    saved.push(await saveWebp(buffer, path.join(dir, `play-${pad2(saved.length + 1)}.webp`), MAX_WIDTH.mobile));
  }
  if (saved.length === 0) throw new Error('No portrait screenshots found (listing gone, or try --min-aspect=1.2).');
  printSaved(saved);
};

main().catch(error => {
  console.error(`fetch-play failed: ${error.message}`);
  process.exit(1);
});
