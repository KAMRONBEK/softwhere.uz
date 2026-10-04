#!/usr/bin/env node
// Tiles images into one labelled JPEG so a batch of raw screenshots can be reviewed at a glance.
// Usage: node scripts/contact-sheet.mjs <out.jpg> <image> [<image> ...] [--height=520] [--columns=6]
import path from 'node:path';
import sharp from 'sharp';
import { parseArgs } from './lib/images.mjs';

const DEFAULT_HEIGHT = 520;
const DEFAULT_COLUMNS = 6;
const GAP = 10;
const LABEL_HEIGHT = 28;

const label = (text, width) =>
  Buffer.from(
    `<svg width="${width}" height="${LABEL_HEIGHT}"><text x="4" y="20" font-family="Menlo, monospace" font-size="16" fill="#ffb057">${text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')}</text></svg>`
  );

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const [output, ...inputs] = args._;
  if (!output || inputs.length === 0) throw new Error('Usage: node scripts/contact-sheet.mjs <out.jpg> <image> [...]');
  const height = Number(args.height ?? DEFAULT_HEIGHT);
  const columns = Math.min(inputs.length, Number(args.columns ?? DEFAULT_COLUMNS));

  const tiles = await Promise.all(
    inputs.map(async file => {
      const buffer = await sharp(file).resize({ height, width: height, fit: 'inside' }).toBuffer();
      const { width = height } = await sharp(buffer).metadata();
      return { buffer, width, name: path.basename(file) };
    })
  );
  const cellWidth = Math.max(...tiles.map(tile => tile.width));
  const rows = Math.ceil(tiles.length / columns);
  const composites = tiles.flatMap((tile, i) => {
    const left = GAP + (i % columns) * (cellWidth + GAP);
    const top = GAP + Math.floor(i / columns) * (height + LABEL_HEIGHT + GAP);
    return [
      { input: tile.buffer, left, top },
      { input: label(tile.name, cellWidth), left, top: top + height },
    ];
  });

  await sharp({
    create: {
      width: GAP + columns * (cellWidth + GAP),
      height: GAP + rows * (height + LABEL_HEIGHT + GAP),
      channels: 3,
      background: '#000000',
    },
  })
    .composite(composites)
    .jpeg({ quality: 80 })
    .toFile(output);
  console.log(`✓ ${tiles.length} images → ${output}`);
};

main().catch(error => {
  console.error(`contact-sheet failed: ${error.message}`);
  process.exit(1);
});
