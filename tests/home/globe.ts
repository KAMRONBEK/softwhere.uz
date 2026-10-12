/**
 * The globe section's hand-written summary (home.globe.summary: the text
 * crawlers and no-JS visitors read) against the portfolio data it describes
 * (src/modules/home/sections/s11/markets.ts). No network.
 *
 *   npx tsx tests/home/globe.ts
 *
 * Why a test and not generated text: the summary names each region in a
 * grammatical case (ru locative "в Европе", uz "-da" on the last item only),
 * and it renders through the shared SectionFallback with the shared facts.
 * Generating it would need per-region case forms in messages and plumbing
 * outside the section for one sentence, so the words stay hand-written and
 * this check keeps them honest. Adding a market? Update the summary in all
 * three locales and the REGION_WORDS table below.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BEATS, CONTINENT_COUNT, MARKET_REGIONS, type RegionId } from '../../src/modules/home/sections/s11/markets';
import { Suite } from '../estimator/harness';

const s = new Suite('home/globe');
const MESSAGES = path.resolve(__dirname, '../../src/messages/home/globe');

type Locale = 'en' | 'ru' | 'uz';

/** How each locale's summary spells each region, exactly as it appears in the list. */
const REGION_WORDS: Readonly<Record<RegionId, Readonly<Record<Locale, string>>>> = {
  home: { en: 'Uzbekistan', ru: 'Узбекистане', uz: 'Oʻzbekiston' },
  europe: { en: 'Europe', ru: 'Европе', uz: 'Yevropa' },
  'north-america': { en: 'North America', ru: 'Северной Америке', uz: 'Shimoliy Amerika' },
  oceania: { en: 'Australia', ru: 'Австралии', uz: 'Avstraliya' },
};

/** Pulls the region list out of a summary, and the separators between its items. */
const LIST: Readonly<Record<Locale, { pattern: RegExp; separator: RegExp }>> = {
  en: { pattern: /clients in (.+)\.$/u, separator: /, | and / },
  ru: { pattern: /к клиентам в (.+)\.$/u, separator: /, | и / },
  // "…mijozlarimiz esa Oʻzbekiston, Yevropa, Shimoliy Amerika va Avstraliyada." (-da on the last item only)
  uz: { pattern: /mijozlarimiz esa (.+)da\.$/u, separator: /, | va / },
};

s.group('data');
const routeRegions = BEATS.flatMap(beat => (beat.id !== 'finale' && beat.count > 0 ? [beat.id] : []));
s.eq('every market region has a stop on the route', [...MARKET_REGIONS].sort(), [...routeRegions].sort());
s.ok(
  'every market region has summary words',
  MARKET_REGIONS.every(region => region in REGION_WORDS),
  `no REGION_WORDS for ${MARKET_REGIONS.filter(region => !(region in REGION_WORDS)).join(', ')}`
);
// The heading counts continents ("four continents"), the summary lists regions: one each.
s.eq('one region per continent (heading count = summary list length)', MARKET_REGIONS.length, CONTINENT_COUNT);

s.group('summary');
for (const locale of ['en', 'ru', 'uz'] as const) {
  const messages = JSON.parse(fs.readFileSync(path.join(MESSAGES, `${locale}.json`), 'utf8')) as { summary: string };
  const { pattern, separator } = LIST[locale];
  const match = pattern.exec(messages.summary);
  if (!s.ok(`${locale}: summary has a region list`, Boolean(match), `"${messages.summary}" does not match ${pattern}`)) continue;
  const listed = match![1].split(separator);
  const expected = routeRegions.map(region => REGION_WORDS[region]?.[locale] ?? `<${region}>`);
  s.eq(`${locale}: names exactly the market regions, in route order`, listed, expected);
}

process.exit(s.report());
