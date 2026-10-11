/**
 * uz / ru message files against en: the same keys, ICU placeholders, plural
 * and select categories, and rich tags; Uzbek letters as U+02BB / U+02BC.
 * No network.
 *
 *   npx tsx tests/i18n/parity.ts
 *
 * Covers `src/messages/{en,uz,ru}.json` and every `src/messages/home/<section>/{en,uz,ru}.json`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  isArgumentElement,
  isDateElement,
  isNumberElement,
  isPluralElement,
  isPoundElement,
  isSelectElement,
  isTagElement,
  isTimeElement,
  parse,
  type MessageFormatElement,
} from '@formatjs/icu-messageformat-parser';
import { Suite } from '../estimator/harness';

const s = new Suite('i18n-parity');
const ROOT = path.resolve(__dirname, '../..');
const MESSAGES = path.join(ROOT, 'src/messages');

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Every leaf string by its dotted key. */
function leaves(value: Json, prefix = '', out = new Map<string, string>()): Map<string, string> {
  if (typeof value === 'string') out.set(prefix, value);
  else if (Array.isArray(value)) value.forEach((v, i) => leaves(v, `${prefix}[${i}]`, out));
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

/**
 * The structure a translation must keep, from the ICU parse: argument names
 * (outside plural/select branches too) and rich tags. A plural may collapse to
 * a single form in Uzbek ("hafta" for "{count, plural, one {week} other {weeks}}")
 * when it only picks the word, so arguments used only as a plural/select
 * selector without "#" are optional.
 */
interface Shape {
  required: Set<string>;
  optional: Set<string>;
  error?: string;
}

function shape(text: string): Shape {
  const required = new Set<string>();
  const optional = new Set<string>();
  let ast: MessageFormatElement[];
  try {
    ast = parse(text, { ignoreTag: false });
  } catch (error) {
    return { required, optional, error: String(error) };
  }
  const usesPound = (els: MessageFormatElement[]): boolean =>
    els.some(
      el =>
        isPoundElement(el) ||
        ((isPluralElement(el) || isSelectElement(el)) && Object.values(el.options).some(o => usesPound(o.value))) ||
        (isTagElement(el) && usesPound(el.children))
    );
  const walk = (els: MessageFormatElement[]) => {
    for (const el of els) {
      if (isTagElement(el)) {
        required.add(`<${el.value}>`);
        walk(el.children);
      } else if (isPluralElement(el) || isSelectElement(el)) {
        const branches = Object.values(el.options).map(o => o.value);
        (isPluralElement(el) && branches.some(usesPound) ? required : optional).add(`{${el.value}}`);
        branches.forEach(walk);
      } else if (isArgumentElement(el) || isNumberElement(el) || isDateElement(el) || isTimeElement(el)) {
        required.add(`{${String(el.value)}}`);
      }
    }
  };
  walk(ast);
  for (const token of required) optional.delete(token);
  return { required, optional };
}

/** The target keeps every required token and adds none the source lacks. */
function kept(source: Shape, target: Shape): boolean {
  if (target.error) return false;
  const allowed = new Set([...source.required, ...source.optional]);
  const targetAll = new Set([...target.required, ...target.optional]);
  return [...source.required].every(t => targetAll.has(t)) && [...targetAll].every(t => allowed.has(t));
}

function pairs(): { name: string; dir: string }[] {
  const list = [{ name: 'main', dir: MESSAGES }];
  for (const entry of fs.readdirSync(path.join(MESSAGES, 'home'), { withFileTypes: true }))
    if (entry.isDirectory() && fs.existsSync(path.join(MESSAGES, 'home', entry.name, 'en.json')))
      list.push({ name: `home/${entry.name}`, dir: path.join(MESSAGES, 'home', entry.name) });
  return list;
}

const read = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8'));

for (const { name, dir } of pairs()) {
  s.group(name);
  const en = leaves(read(path.join(dir, 'en.json')));
  for (const locale of ['uz', 'ru'] as const) {
    const file = path.join(dir, `${locale}.json`);
    let target: Map<string, string>;
    try {
      target = leaves(read(file));
    } catch (error) {
      s.ok(`${locale}: valid JSON`, false, String(error));
      continue;
    }
    const missing = [...en.keys()].filter(k => !target.has(k));
    const extra = [...target.keys()].filter(k => !en.has(k));
    s.ok(
      `${locale}: same keys as en`,
      !missing.length && !extra.length,
      `missing ${missing.slice(0, 8).join(', ')} | extra ${extra.slice(0, 8).join(', ')}`
    );
    const broken = [...en.entries()]
      .filter(([k]) => target.has(k))
      .filter(([k, v]) => !kept(shape(v), shape(target.get(k) ?? '')))
      .map(([k]) => k);
    s.ok(`${locale}: placeholders and tags kept`, !broken.length, broken.slice(0, 8).join(', '));
    if (locale === 'uz') {
      const asciiLetters = [...target.entries()].filter(([, v]) => /[oOgG]['‘’`]/.test(v)).map(([k]) => k);
      s.ok("uz: oʻ/gʻ use U+02BB, not ' or ‘", !asciiLetters.length, asciiLetters.slice(0, 8).join(', '));
      const cyrillic = [...target.entries()].filter(([, v]) => /[Ѐ-ӿ]/.test(v)).map(([k]) => k);
      s.ok('uz: no Cyrillic', !cyrillic.length, cyrillic.slice(0, 8).join(', '));
    }
    if (locale === 'ru') {
      const straightQuotes = [...target.entries()].filter(([, v]) => /"[^"]*[Ѐ-ӿ][^"]*"/.test(v)).map(([k]) => k);
      s.ok('ru: «ёлочки», not "straight quotes"', !straightQuotes.length, straightQuotes.slice(0, 8).join(', '));
    }
  }
}

process.exit(s.report());
