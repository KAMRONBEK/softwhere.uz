import {
  Commissioner,
  Cormorant,
  Geist_Mono,
  Geologica,
  IBM_Plex_Mono,
  Literata,
  Martian_Mono,
  Onest,
  Science_Gothic,
  Sofia_Sans_Extra_Condensed,
} from 'next/font/google';

/**
 * Font registry for the lab styles — THE place to add families.
 *
 * Rules for adding a family (art director):
 * 1. Declare it below at module scope (next/font requires a top-level const
 *    with literal options) with `variable: '--lab-ff-<key>'`.
 * 2. Check it covers Cyrillic before picking it — RU/UZ copy must render in
 *    the same face. Uzbek Latin needs only `latin` (its oʻ/gʻ apostrophe,
 *    U+02BB, is in Google's latin range):
 *    node -e "console.log(require('next/dist/compiled/@next/font/dist/google/font-data.json')['Family Name'].subsets)"
 * 3. Register it in LAB_FONTS with the same css var, then reference the key
 *    from a style in styles.ts (fonts.display / fonts.body / fonts.mono).
 * 4. Only the default style (A) preloads, and only its `latin` files: the
 *    lab's copy is English. `subsets` does NOT limit coverage: next/font
 *    emits an @font-face for every subset the family has (Cyrillic
 *    included), each with its unicode-range, and `subsets` only picks which
 *    files get a <link rel=preload> (next/font's google loader:
 *    findFontFilesInCss(css, preload ? subsets : undefined)). Preloading
 *    'cyrillic' too would download three unused files on every English
 *    visit. Every other family is `preload: false`.
 * 5. How lazy loading works: nothing references a family until a style's
 *    tokens point --font-display/-body/-mono at it (theme/tokens.ts), and the
 *    browser downloads an @font-face file only when rendered text uses it.
 *    So B, C and D cost nothing until a visitor picks one or opens a theme
 *    picker: its previews set each style's display face, and pointing at,
 *    focusing or pressing an option warms that one style's three faces
 *    (theme/fontWarm.ts prefetchStyleFonts, skipped under Save-Data). They
 *    swap in (`display: 'swap'`).
 * 6. Variable families load as one file per subset (no `weight`); static
 *    families list only the weights a style uses. No extra axes: Science
 *    Gothic's width axis alone would more than double its download.
 *
 * Measured woff2 cost per style (latin + cyrillic, before unicode-range
 * splitting, which skips cyrillic on English pages):
 * A ≈ 140 KB, B ≈ 180 KB, C ≈ 75 KB, D ≈ 155 KB.
 */

// ── A · Observatory (default style: preloaded, latin files only — rule 4) ──

/**
 * next/font has no metric overrides for Science Gothic (a 2025 family), so it
 * gets a hand-made fallback: Arial (or a metric twin) scaled to Science
 * Gothic's width and line box, so the swap from fallback to the real face
 * (a slow first visit, a switch whose fonts missed the wait) barely moves the
 * text. Values measured from the latin woff2 at its default instance with
 * next/font's own getFallbackMetricsFromFontFile (fontkit): unitsPerEm 2000,
 * ascent 2176, descent -776, line gap 0, average width 125.9% of Arial's.
 * The face is declared in the token stylesheet (FALLBACK_FACES_CSS).
 */
const SCIENCE_GOTHIC_FALLBACK = 'Science Gothic Fallback';

const scienceGothic = Science_Gothic({
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: false,
  // A literal: next/font only takes literal options (same name as SCIENCE_GOTHIC_FALLBACK).
  fallback: ['Science Gothic Fallback'],
  variable: '--lab-ff-science-gothic',
});

/** @font-face rules for the hand-made fallbacks above (inlined with the tokens, theme/tokens.ts). */
export const FALLBACK_FACES_CSS = `@font-face{font-family:'${SCIENCE_GOTHIC_FALLBACK}';src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('Arimo'),local('Helvetica');size-adjust:125.9%;ascent-override:86.42%;descent-override:30.82%;line-gap-override:0%}`;

const onest = Onest({
  subsets: ['latin'],
  display: 'swap',
  variable: '--lab-ff-onest',
});

const martianMono = Martian_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--lab-ff-martian-mono',
});

// ── B · Concrete ────────────────────────────────────────────────────────────
const sofiaSansExtraCondensed = Sofia_Sans_Extra_Condensed({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: false,
  variable: '--lab-ff-sofia-sans-xcond',
});

const literata = Literata({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: false,
  variable: '--lab-ff-literata',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500'],
  display: 'swap',
  preload: false,
  variable: '--lab-ff-ibm-plex-mono',
});

// ── C · Silk ────────────────────────────────────────────────────────────────
const geologica = Geologica({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: false,
  variable: '--lab-ff-geologica',
});

const geistMono = Geist_Mono({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: false,
  variable: '--lab-ff-geist-mono',
});

// ── D · Pomegranate (mono shared with B) ────────────────────────────────────
const cormorant = Cormorant({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: false,
  variable: '--lab-ff-cormorant',
});

const commissioner = Commissioner({
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  preload: false,
  variable: '--lab-ff-commissioner',
});

// ── Add more pairings above this line (preload: false) ──────────────────────

interface LabFont {
  /** Human name, shown in the control panel. */
  label: string;
  /** next/font class that defines the css var; applied on the lab root. */
  className: string;
  /** The custom property next/font defines, e.g. '--lab-ff-onest'. */
  cssVar: string;
  /** Resolved family string, for canvas/WebGL text that cannot read CSS vars. */
  family: string;
}

function entry(label: string, font: { variable: string; style: { fontFamily: string } }, cssVar: string): LabFont {
  return { label, className: font.variable, cssVar, family: font.style.fontFamily };
}

export const LAB_FONTS = {
  'science-gothic': entry('Science Gothic', scienceGothic, '--lab-ff-science-gothic'),
  onest: entry('Onest', onest, '--lab-ff-onest'),
  'martian-mono': entry('Martian Mono', martianMono, '--lab-ff-martian-mono'),
  'sofia-sans-xcond': entry('Sofia Sans Extra Condensed', sofiaSansExtraCondensed, '--lab-ff-sofia-sans-xcond'),
  literata: entry('Literata', literata, '--lab-ff-literata'),
  'ibm-plex-mono': entry('IBM Plex Mono', ibmPlexMono, '--lab-ff-ibm-plex-mono'),
  geologica: entry('Geologica', geologica, '--lab-ff-geologica'),
  'geist-mono': entry('Geist Mono', geistMono, '--lab-ff-geist-mono'),
  cormorant: entry('Cormorant', cormorant, '--lab-ff-cormorant'),
  commissioner: entry('Commissioner', commissioner, '--lab-ff-commissioner'),
} satisfies Record<string, LabFont>;

export type LabFontKey = keyof typeof LAB_FONTS;

/** Every font's variable class, joined — goes on the lab root element. */
export const LAB_FONT_CLASSNAMES = Object.values(LAB_FONTS)
  .map(font => font.className)
  .join(' ');
