import type { SectionId } from '../types';

/**
 * The visitor header's structure: where each item jumps and which sections
 * mark it current. Every word a visitor reads is in messages
 * (src/messages/home/header/{en,ru,uz}.json, `home.header`), keyed by target:
 * `stories.<target>.label|note`, `links.<target>`.
 *
 * Labels are the words an owner scans for (what we build, the price, proof,
 * how an engagement runs, the tools), not the page's section names. No
 * project names here: the work wall carries those.
 */

export type StoryTarget = 'telegram' | 'mobile-build' | 'web-build' | 'rag-build' | 'crm-build';
export type LinkTarget = 'ai-demo' | 'work-wall' | 'process' | 'stack-physics';

export interface HeaderLink {
  /** Where the link jumps (the section's DOM id); also its label key. */
  target: LinkTarget;
  /** Sections that mark this link as the current place on the page. */
  group: readonly SectionId[];
}

/** The "how we build" chapter (07–11), in page order (the progress bars fill top to bottom as the visitor reads). */
export const BUILD_STORIES: readonly StoryTarget[] = ['telegram', 'mobile-build', 'web-build', 'rag-build', 'crm-build'];

/** The first nav item opens the stories instead of jumping; it is current anywhere in the chapter. */
export const BUILD_GROUP: readonly SectionId[] = BUILD_STORIES;

/** The other chapters, in page order, so the current-place marker walks left to right as the visitor scrolls. */
export const HEADER_LINKS: readonly HeaderLink[] = [
  { target: 'ai-demo', group: ['ai-demo'] },
  { target: 'work-wall', group: ['work-wall', 'numbers', 'globe'] },
  { target: 'process', group: ['process'] },
  { target: 'stack-physics', group: ['stack-physics'] },
];

/** "Book a call" (home.shared.callCta) jumps to the finale's form. */
export const CTA_TARGET = 'finale' satisfies SectionId;

/**
 * The language switcher: each language by its own name (an autonym reads the
 * same on every page, so it stays here, not in messages), uz first as the
 * site's default.
 */
export const LANGUAGES = [
  { id: 'uz', short: 'UZ', name: 'Oʻzbekcha' },
  { id: 'ru', short: 'RU', name: 'Русский' },
  { id: 'en', short: 'EN', name: 'English' },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]['id'];

/** The current path with its locale segment swapped: `/ru/lab/home` → `/uz/lab/home`, `/ru` → `/en`. */
export function pathForLanguage(pathname: string, language: LanguageId): string {
  const [, , ...rest] = pathname.split('/');
  const tail = rest.filter(Boolean).join('/');
  return tail ? `/${language}/${tail}` : `/${language}`;
}
