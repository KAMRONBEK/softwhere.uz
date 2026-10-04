#!/usr/bin/env node
// Converts any images (URLs or local paths) into numbered WebP assets for a project.
// Usage: node scripts/save-images.mjs --slug=bdm --prefix=archive [--kind=mobile|web|icon] <url-or-path> [...]
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fetchBuffer, MAX_WIDTH, pad2, parseArgs, printSaved, projectDir, requireArg, saveWebp } from './lib/images.mjs';

const USAGE = 'node scripts/save-images.mjs --slug=<slug> --prefix=<name> [--kind=mobile|web|icon] [--start=1] <url-or-path> [...]';

const load = source => (/^https?:\/\//.test(source) ? fetchBuffer(source) : readFile(source));

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const slug = requireArg(args, 'slug', USAGE);
  const prefix = requireArg(args, 'prefix', USAGE);
  const kind = typeof args.kind === 'string' ? args.kind : 'mobile';
  const maxWidth = MAX_WIDTH[kind];
  if (!maxWidth) throw new Error(`Unknown --kind=${kind} (mobile, web or icon)`);
  if (args._.length === 0) throw new Error(`No sources given.\nUsage: ${USAGE}`);

  const start = Number(args.start ?? 1);
  const dir = await projectDir(slug);
  const saved = [];
  for (const [i, source] of args._.entries()) {
    const name = args._.length === 1 && kind === 'icon' ? `${prefix}.webp` : `${prefix}-${pad2(start + i)}.webp`;
    saved.push(await saveWebp(await load(source), path.join(dir, name), maxWidth));
  }
  printSaved(saved);
};

main().catch(error => {
  console.error(`save-images failed: ${error.message}`);
  process.exit(1);
});
