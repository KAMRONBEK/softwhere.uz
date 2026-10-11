/**
 * Homepage copy, one folder per part: `src/messages/home/<part>/{en,ru,uz}.json`.
 * Each part is merged into the request messages as `home.<part>`, so a section
 * reads its copy with `useTranslations('home.<sectionId>')` (e.g.
 * `useTranslations('home.xray')`). One folder per section keeps parallel edits
 * from colliding in the 30–48KB site bundles (src/messages/<locale>.json).
 *
 * Contract for a section part (the shell's server-rendered fallback reads it):
 * - `heading` (required): the section's one heading, plain text. The static
 *   HTML that crawlers and first paint see, and the text the live section's
 *   SectionHeading should show.
 * - `summary` (required): one or two sentences under it in the static HTML.
 * Both may use the portfolio facts as ICU arguments ({projects}, {us}, …:
 * src/modules/home/media/facts.ts).
 *
 * Missing keys in ru/uz fall back to English (deep merge below), so a partial
 * translation never breaks the page; `node scripts/check-home-messages.mjs`
 * lists them.
 */

/** Every part, in page order, then the page-wide parts. Add a folder here when you add one on disk. */
export const HOME_MESSAGE_PARTS = [
  'hero',
  'manifesto',
  'xray',
  'assembly',
  'code-to-ui',
  'devices',
  'telegram',
  'mobile-build',
  'web-build',
  'rag-build',
  'crm-build',
  'ai-demo',
  'work-wall',
  'numbers',
  'globe',
  'process',
  'stack-physics',
  'finale',
  // Page-wide: visitor header + theme switcher, copy several sections share, the blog block.
  'header',
  'shared',
  'posts',
] as const;

export type HomeMessagePart = (typeof HOME_MESSAGE_PARTS)[number];
export type HomeLocale = 'en' | 'ru' | 'uz';

export type Messages = { [key: string]: string | Messages };

function isObject(value: unknown): value is Messages {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `override` wins key by key; nested objects merge, anything else replaces. Returns a new object. */
function deepMerge(base: Messages, override: Messages): Messages {
  const merged: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = merged[key];
    merged[key] = isObject(current) && isObject(value) ? deepMerge(current, value) : value;
  }
  return merged;
}

/**
 * One part for one locale, English filling any key the locale lacks. Also
 * used on the client: each homepage section loads its own part with its code
 * (src/modules/home/components/SectionMessages.tsx).
 */
export async function loadHomePart(part: HomeMessagePart, locale: HomeLocale): Promise<Messages> {
  const english = (await import(`./${part}/en.json`)).default as Messages;
  if (locale === 'en') return english;
  const localized = (await import(`./${part}/${locale}.json`)).default as Messages;
  return deepMerge(english, localized);
}

/** The `home` namespace for one locale: `{ hero: {...}, xray: {...}, … }`. */
export async function loadHomeMessages(locale: HomeLocale): Promise<Messages> {
  const parts = await Promise.all(HOME_MESSAGE_PARTS.map(async part => [part, await loadHomePart(part, locale)] as const));
  return Object.fromEntries(parts);
}
