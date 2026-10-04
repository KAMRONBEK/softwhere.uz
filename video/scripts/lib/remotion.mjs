// Shared Remotion bundling / composition selection for render + frame scripts.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { selectComposition } from '@remotion/renderer';
import { PUBLIC_DIR, VIDEO_ROOT } from './images.mjs';

export const listProjectIds = async () =>
  (await readdir(path.join(VIDEO_ROOT, 'src/projects')))
    .filter(file => file.endsWith('.json'))
    .map(file => file.replace(/\.json$/, ''))
    .sort();

/** `--only=a,b` → validated ids; no flag → every project. */
export const resolveIds = async onlyArg => {
  const all = await listProjectIds();
  const only = typeof onlyArg === 'string' ? onlyArg.split(',').filter(Boolean) : [];
  const unknown = only.filter(id => !all.includes(id));
  if (unknown.length) throw new Error(`Unknown project(s): ${unknown.join(', ')}. Available: ${all.join(', ')}`);
  return only.length ? only : all;
};

export const bundleProject = () => {
  console.log('Bundling…');
  return bundle({ entryPoint: path.join(VIDEO_ROOT, 'src/index.ts'), publicDir: PUBLIC_DIR, rootDir: VIDEO_ROOT });
};

export const selectProject = (serveUrl, id) => selectComposition({ serveUrl, id, inputProps: {} });
