#!/usr/bin/env node
/**
 * Checks the homepage copy in src/messages/home/<part>/{en,ru,uz}.json:
 *   - every part folder has all three files and valid JSON;
 *   - every section part has `heading` and `summary` (the server-rendered fallback);
 *   - ru/uz have exactly en's keys (missing keys fall back to English at runtime,
 *     extra keys are dead);
 *   - ru/uz values still identical to English (untranslated), as a to-do list.
 *
 *   node scripts/check-home-messages.mjs            # all parts
 *   node scripts/check-home-messages.mjs xray hero  # some parts
 *
 * Exit code 1 on missing files, bad JSON, missing heading/summary or key drift;
 * untranslated values are reported but do not fail.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'messages', 'home');
const LOCALES = ['en', 'ru', 'uz'];
const PAGE_WIDE = new Set(['header', 'shared', 'posts']);
/** Brand and tech words that legitimately stay English in every locale. */
const SAME_EVERYWHERE = /^[\s\d{}#.,:;·/+\-–—'’"“”()]*$|^(SoftWhere|Telegram|iOS|Android|Web|CRM|RAG|AI|API|App Store|Google Play)$/;

function flatten(value, prefix = '', out = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) flatten(child, name, out);
    else out.set(name, child);
  }
  return out;
}

const requested = process.argv.slice(2);
const parts = readdirSync(ROOT)
  .filter(name => statSync(path.join(ROOT, name)).isDirectory())
  .filter(name => requested.length === 0 || requested.includes(name))
  .sort();

let failed = false;
const fail = message => {
  failed = true;
  console.log(`  ✗ ${message}`);
};

for (const part of parts) {
  console.log(`${part}`);
  const files = {};
  for (const locale of LOCALES) {
    const file = path.join(ROOT, part, `${locale}.json`);
    if (!existsSync(file)) {
      fail(`${locale}.json missing`);
      continue;
    }
    try {
      files[locale] = flatten(JSON.parse(readFileSync(file, 'utf8')));
    } catch (error) {
      fail(`${locale}.json: ${error.message}`);
    }
  }
  const en = files.en;
  if (!en) continue;
  if (!PAGE_WIDE.has(part)) {
    for (const key of ['heading', 'summary']) if (!en.has(key)) fail(`en.json has no "${key}" (the static fallback needs it)`);
  }
  for (const locale of ['ru', 'uz']) {
    const other = files[locale];
    if (!other) continue;
    const missing = [...en.keys()].filter(key => !other.has(key));
    const extra = [...other.keys()].filter(key => !en.has(key));
    if (missing.length) fail(`${locale}: missing ${missing.join(', ')}`);
    if (extra.length) fail(`${locale}: not in en ${extra.join(', ')}`);
    const same = [...en.entries()]
      .filter(([key, value]) => other.get(key) === value && !SAME_EVERYWHERE.test(String(value)))
      .map(([key]) => key);
    if (same.length)
      console.log(`  · ${locale}: ${same.length}/${en.size} untranslated (${same.slice(0, 6).join(', ')}${same.length > 6 ? ', …' : ''})`);
  }
}

process.exit(failed ? 1 : 0);
