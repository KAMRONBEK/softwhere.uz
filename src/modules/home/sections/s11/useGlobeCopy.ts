'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { useProjectDescriber } from '../../media/useProjectDescriber';
import { BEAT_VALUES, BEATS, type Beat, type Examples } from './markets';

/** A beat's words, built from its data (markets.ts) and the section's messages. */
export interface BeatCopy {
  stop: string;
  /** After the numeral: "17" + " in North America". */
  title: string;
  body: string;
  /** Secondary line (examples, distance). */
  detail: string;
  /** The route stop read aloud: "Europe: 6 products". */
  stopLabel: string;
}

/** Uzbek groups thousands like Russian ("4 960"); not every browser ships Uzbek number data. */
export function numberLocale(locale: string): string {
  return locale === 'uz' ? 'ru' : locale;
}

/** Lowercases the first letter unless the word is an acronym ("FinTech" stays, "Мода" → "мода"). */
const lowerFirst = (text: string) => (/^\p{Lu}\p{Ll}/u.test(text) ? `${text[0].toLowerCase()}${text.slice(1)}` : text);

const capitalized = (text: string) => (text ? `${text[0].toUpperCase()}${text.slice(1)}` : text);

/** Every beat's copy in the visitor's language, in BEATS order. */
export function useGlobeCopy(): readonly BeatCopy[] {
  const t = useTranslations('home.globe');
  const locale = useLocale();
  const describer = useProjectDescriber();
  return useMemo(() => {
    // Lists and numbers from messages / a known locale: browser ICU data for Uzbek is patchy
    // (English "and", other separators), and the server must render the same text.
    const list = (items: readonly string[]) =>
      items.length < 2 ? (items[0] ?? '') : t('listAnd', { head: items.slice(0, -1).join(', '), last: items[items.length - 1] });
    const numberFormat = new Intl.NumberFormat(numberLocale(locale));

    // "An AI learning platform, a messenger app and 26 more." Kinds, never names (ru/uz have no articles).
    const kindOf = (project: Examples['projects'][number]) => describer.describe(project);
    // "Event planning" → "event planning" / "планирование мероприятий" / "tadbirlarni rejalashtirish".
    const industryInSentence = (type: string) => lowerFirst(describer.industry({ type }));
    const examplesLine = (examples: Examples | null): string => {
      if (!examples || examples.projects.length === 0) return '';
      const kinds = examples.projects.map(kindOf);
      const line =
        examples.rest > 0 ? t('examplesMore', { list: kinds.join(', '), rest: examples.rest }) : t('examples', { list: list(kinds) });
      return capitalized(line);
    };

    const beatCopy = (beat: Beat): BeatCopy => {
      const examples = examplesLine(beat.examples);
      const km = beat.km === null ? '' : numberFormat.format(beat.km);
      const stop = t(`beats.${beat.id}.stop`);
      const stopLabel = t('stopLabel', { stop, count: beat.count });
      const title = t(`beats.${beat.id}.title`, { count: beat.count });
      switch (beat.id) {
        case 'home':
          return { stop, stopLabel, title, body: t('beats.home.body'), detail: t('beats.home.detail', { examples }) };
        case 'north-america':
          return {
            stop,
            stopLabel,
            title,
            body: t('beats.north-america.body', { us: BEAT_VALUES.us, ca: BEAT_VALUES.ca }),
            detail: t('beats.north-america.detail', { examples, km }),
          };
        case 'oceania': {
          const range = BEAT_VALUES.oceaniaRange;
          return {
            stop,
            stopLabel,
            title,
            body: range
              ? t('beats.oceania.body', { first: industryInSentence(range.first), last: industryInSentence(range.last) })
              : t('beats.oceania.bodyShort'),
            detail: t('beats.oceania.detail', { examples, km }),
          };
        }
        case 'finale':
          return {
            stop,
            stopLabel,
            title,
            body: t('beats.finale.body', { countries: BEAT_VALUES.countries }),
            detail: t('beats.finale.detail', { abroad: BEAT_VALUES.abroad, worldwide: BEAT_VALUES.worldwide }),
          };
        default:
          return { stop, stopLabel, title, body: t(`beats.${beat.id}.body`), detail: t(`beats.${beat.id}.detail`, { examples, km }) };
      }
    };

    return BEATS.map(beatCopy);
  }, [t, locale, describer]);
}
