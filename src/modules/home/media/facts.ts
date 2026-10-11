import { CONTINENT_COUNT } from '../sections/s11/markets';
import type { HomeFacts } from '../context/HomeFactsContext';
import { getShowcaseProjects, LAB_PROJECTS } from './portfolio';

/**
 * Portfolio-derived numbers that homepage copy interpolates as ICU arguments
 * (`"{projects} products so far"` in src/messages/home/<part>/<locale>.json).
 * Copy never types a number in: it reads one of these, so the page cannot
 * drift from the portfolio data. Add a fact here when a message needs one.
 * The eager client tree reads them through useHomeFacts() (computed on the
 * server, context/HomeFactsContext.tsx); lazy sections may import them.
 */

/** Locations counted as North American clients (same split as the globe's markets.ts). */
const NORTH_AMERICA = new Set(['USA', 'Canada']);
const US_MARKET = 'USA';

const SHOWCASE = getShowcaseProjects();

export const HOME_FACTS: HomeFacts = {
  /** Every product with a walkthrough video (the work wall's total). */
  projects: LAB_PROJECTS.length,
  /** Built for clients in the US or Canada. */
  northAmerica: LAB_PROJECTS.filter(project => NORTH_AMERICA.has(project.location)).length,
  /** Built for the US market (the work wall's lede). */
  us: SHOWCASE.filter(project => project.location === US_MARKET).length,
  /** With a live App Store / Google Play listing. */
  liveInStore: SHOWCASE.filter(project => project.isLiveInStore).length,
  /** Continents the portfolio reaches (the globe's heading). */
  continents: CONTINENT_COUNT,
};

export type { HomeFacts };
