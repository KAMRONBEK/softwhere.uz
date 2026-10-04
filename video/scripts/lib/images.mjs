// Shared helpers: download / convert images into lean WebP assets under video/public/projects/<slug>/.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

export const VIDEO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const PUBLIC_DIR = path.join(VIDEO_ROOT, 'public');

/** Phone screens render ~420px wide in the frame; 900px keeps 2x headroom without bloating the repo. */
export const MAX_WIDTH = { mobile: 900, web: 1440, icon: 512 };
const WEBP_QUALITY = 88;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';

/** Parses `--key=value` and bare `--flag` arguments; positional args land in `_`. */
export const parseArgs = argv =>
  argv.reduce(
    (acc, arg) => {
      if (!arg.startsWith('--')) return { ...acc, _: [...acc._, arg] };
      const [key, ...rest] = arg.slice(2).split('=');
      return { ...acc, [key]: rest.length ? rest.join('=') : true };
    },
    { _: [] }
  );

export const requireArg = (args, key, usage) => {
  if (!args[key] || args[key] === true) {
    console.error(`Missing --${key}.\nUsage: ${usage}`);
    process.exit(1);
  }
  return args[key];
};

export const projectDir = async slug => {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Invalid slug "${slug}" (use a-z, 0-9, -)`);
  const dir = path.join(PUBLIC_DIR, 'projects', slug);
  await mkdir(dir, { recursive: true });
  return dir;
};

export const fetchBuffer = async url => {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, 'accept-language': 'en-US,en;q=0.9' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
};

export const fetchText = async url => (await fetchBuffer(url)).toString('utf8');

/** Resizes (never enlarges) and writes WebP; returns the public-relative src plus final dimensions. */
export const saveWebp = async (input, file, maxWidth) => {
  const info = await sharp(input)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(file);
  return { src: path.relative(PUBLIC_DIR, file).split(path.sep).join('/'), width: info.width, height: info.height };
};

export const pad2 = n => String(n).padStart(2, '0');

export const printSaved = saved =>
  saved.forEach(({ src, width, height }) => console.log(`  ${src}  ${width}x${height}  (aspect ${(height / width).toFixed(3)})`));
