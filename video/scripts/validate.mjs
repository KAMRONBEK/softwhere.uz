#!/usr/bin/env node
// Validates project configs (JSON syntax, schema, slug, referenced files) without bundling.
// Run on a draft before copying it into src/projects/ — a broken JSON file there breaks every bundle.
// Usage: node scripts/validate.mjs [drafts/<slug>.json ...]   (no args = every src/projects/*.json)
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { PUBLIC_DIR, VIDEO_ROOT } from './lib/images.mjs';

const { projectSchema } = await import('../src/schema.ts');

/** Titles longer than this usually wrap to three lines at caption width. */
const LONG_TITLE = 44;

const referencedFiles = config => [
  ...(config.icon ? [config.icon.src] : []),
  ...config.scenes.flatMap(scene => (scene.type === 'video' ? [scene.src] : scene.shots.map(shot => shot.src))),
];

const exists = async file =>
  access(file)
    .then(() => true)
    .catch(() => false);

const validateFile = async file => {
  let raw;
  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    return { errors: [`not valid JSON: ${error.message}`], warnings: [] };
  }
  const parsed = projectSchema.safeParse(raw);
  if (!parsed.success) return { errors: [z.prettifyError(parsed.error)], warnings: [] };

  const config = parsed.data;
  const expected = path.basename(file, '.json');
  const slugErrors = config.slug === expected ? [] : [`slug "${config.slug}" must equal the file name "${expected}"`];
  const missing = [];
  for (const src of referencedFiles(config)) {
    if (!(await exists(path.join(PUBLIC_DIR, src)))) missing.push(`missing file video/public/${src}`);
  }
  const warnings = config.scenes
    .filter(scene => scene.title.length > LONG_TITLE)
    .map(scene => `long title (may wrap to 3 lines): "${scene.title}"`);
  return { errors: [...slugErrors, ...missing], warnings, summary: `${config.scenes.length} scenes` };
};

const main = async () => {
  const args = process.argv.slice(2);
  const projectsDir = path.join(VIDEO_ROOT, 'src/projects');
  const files = args.length
    ? args
    : (await readdir(projectsDir)).filter(name => name.endsWith('.json')).map(name => path.join(projectsDir, name));

  const results = await Promise.all(files.map(async file => ({ file, ...(await validateFile(file)) })));
  for (const { file, errors, warnings, summary } of results) {
    const label = path.relative(process.cwd(), file);
    console.log(errors.length ? `✗ ${label}` : `✓ ${label} — ${summary}`);
    errors.forEach(error => console.log(`    error: ${error}`));
    warnings.forEach(warning => console.log(`    warn:  ${warning}`));
  }
  if (results.some(result => result.errors.length)) process.exit(1);
};

main().catch(error => {
  console.error(`validate failed: ${error.message}`);
  process.exit(1);
});
