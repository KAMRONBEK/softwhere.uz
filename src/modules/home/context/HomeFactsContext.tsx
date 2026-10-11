'use client';

import { createContext, useContext } from 'react';

/**
 * Portfolio-derived numbers the copy interpolates (media/facts.ts HOME_FACTS).
 * Computed on the server and handed to the shell as a prop, so the eager
 * client bundle (the hero, the static fallbacks) never ships the portfolio
 * data (src/shared/data/projects.ts) just to count it.
 */
// A type alias, not an interface: it must fit next-intl's `Record<string, …>` values.
export type HomeFacts = {
  projects: number;
  northAmerica: number;
  us: number;
  liveInStore: number;
  continents: number;
};

const NO_FACTS: HomeFacts = { projects: 0, northAmerica: 0, us: 0, liveInStore: 0, continents: 0 };

export const HomeFactsContext = createContext<HomeFacts>(NO_FACTS);

/** The portfolio's counts, as ICU arguments for `t(key, facts)`. */
export function useHomeFacts(): HomeFacts {
  return useContext(HomeFactsContext);
}
