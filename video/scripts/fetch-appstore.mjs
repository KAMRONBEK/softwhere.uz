#!/usr/bin/env node
// Downloads an App Store listing's screenshots (and icon) via Apple's public lookup API.
// Usage: node scripts/fetch-appstore.mjs --id=1625351334 --slug=netevia [--country=us] [--ipad] [--max=10] [--icon]
import path from 'node:path';
import { fetchBuffer, MAX_WIDTH, pad2, parseArgs, printSaved, projectDir, requireArg, saveWebp } from './lib/images.mjs';

const USAGE = 'node scripts/fetch-appstore.mjs --id=<numeric id> --slug=<slug> [--country=us] [--ipad] [--max=10] [--icon]';
const DEFAULT_MAX = 10;
/** mzstatic serves any size up to the source; this rewrite asks for the full-resolution PNG. */
const hiRes = url => url.replace(/\/[^/]+$/, '/1290x0w.png');

const lookup = async (id, country) => {
  const json = JSON.parse((await fetchBuffer(`https://itunes.apple.com/lookup?id=${id}&country=${country}`)).toString('utf8'));
  return json.results?.[0];
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const id = requireArg(args, 'id', USAGE);
  const slug = requireArg(args, 'slug', USAGE);
  const country = typeof args.country === 'string' ? args.country : 'us';
  const max = Number(args.max ?? DEFAULT_MAX);

  const app = (await lookup(id, country)) ?? (country === 'us' ? undefined : await lookup(id, 'us'));
  if (!app)
    throw new Error(`App ${id} not found in the ${country}/us storefronts (delisted?). Try archived screenshots via save-images.mjs.`);

  const urls = (args.ipad ? app.ipadScreenshotUrls : app.screenshotUrls) ?? [];
  console.log(`${app.trackName} v${app.version} (${app.currentVersionReleaseDate?.slice(0, 10)}) — ${urls.length} screenshots`);
  if (urls.length === 0) throw new Error('Listing has no screenshots of that kind (try --ipad).');

  const dir = await projectDir(slug);
  const prefix = args.ipad ? 'appstore-ipad' : 'appstore';
  const saved = [];
  for (const [i, url] of urls.slice(0, max).entries()) {
    saved.push(await saveWebp(await fetchBuffer(hiRes(url)), path.join(dir, `${prefix}-${pad2(i + 1)}.webp`), MAX_WIDTH.mobile));
  }
  if (args.icon && app.artworkUrl512) {
    saved.push(await saveWebp(await fetchBuffer(hiRes(app.artworkUrl512)), path.join(dir, 'icon.webp'), MAX_WIDTH.icon));
  }
  printSaved(saved);
};

main().catch(error => {
  console.error(`fetch-appstore failed: ${error.message}`);
  process.exit(1);
});
