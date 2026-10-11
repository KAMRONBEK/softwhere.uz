'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { ABROAD_CAPTION, type GroupName, type NumberFact } from './facts';

/** One legend entry under the chart: a group, its size, lit (counted) or dimmed (for scale). */
export interface LegendEntry {
  id: string;
  label: string;
  count: number;
  isLit: boolean;
}

export interface NumbersCopy {
  groupName: (name: GroupName) => string;
  short: (fact: NumberFact) => string;
  label: (fact: NumberFact) => string;
  /** The fact read aloud with its number: "54 products built". */
  spoken: (fact: NumberFact) => string;
  caption: (fact: NumberFact) => string;
  /** Null for the facts whose chart is one block (the "hover/tap a dot" hint shows instead). */
  legend: (fact: NumberFact) => readonly LegendEntry[] | null;
  /** "A, B and C" in the visitor's language. */
  list: (items: readonly string[]) => string;
}

/** The section's words for facts computed from data (facts.ts holds no copy). */
export function useNumbersCopy(): NumbersCopy {
  const t = useTranslations('home.numbers');
  return useMemo(() => {
    // From messages, not Intl.ListFormat: browsers without Uzbek list data fall back to English
    // ("A and B"), which would also break hydration against the server's "A va B".
    const list = (items: readonly string[]) =>
      items.length < 2 ? (items[0] ?? '') : t('listAnd', { head: items.slice(0, -1).join(', '), last: items[items.length - 1] });

    const groupName = (name: GroupName): string => {
      switch (name.kind) {
        case 'all':
          return t('all');
        case 'platform':
          return t(`platformGroups.${name.key}`);
        case 'place':
          return name.key ? t(`places.${name.key}`) : name.raw;
        case 'industry':
          return name.key ? t(`industries.${name.key}`) : name.raw;
      }
    };

    const caption = (fact: NumberFact): string => {
      if (fact.id === 'platforms' && fact.caption === 'captionShared') return t('facts.platforms.captionShared');
      if (fact.id !== 'abroad') return t(`facts.${fact.id}.caption`);
      const countries = list(ABROAD_CAPTION.countries.map(key => t(`placesInProse.${key}`)));
      return fact.caption === 'captionNoInternational'
        ? t('facts.abroad.captionNoInternational', { countries })
        : t('facts.abroad.caption', { countries, international: ABROAD_CAPTION.international });
    };

    return {
      groupName,
      short: fact => t(`facts.${fact.id}.short`),
      label: fact => t(`facts.${fact.id}.label`),
      spoken: fact => t(`facts.${fact.id}.spoken`, { value: fact.value }),
      caption,
      legend: fact =>
        fact.hasLegend
          ? fact.groups.map(group => ({
              id: group.id,
              label: groupName(group.name),
              count: group.members.length,
              isLit: group.isLit,
            }))
          : null,
      list,
    };
  }, [t]);
}
