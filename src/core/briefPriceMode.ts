/**
 * What a visitor's AI plan shows: 'range' (the engine's price range), 'from'
 * (one starting price and a request form) or 'request' (a request form, no
 * price). Inlined at build time for server and client alike, so they never
 * disagree; next.config.mjs refuses the last two without BRIEF_TOKEN_SECRET.
 *
 * It is also the launch switch: outside 'range' the AI plan replaces the
 * step-by-step estimator (links, sitemap, indexing, a redirect in
 * next.config.mjs), so undoing it is one setting and a redeploy.
 */
export type BriefPriceMode = 'range' | 'from' | 'request';

export function parsePriceMode(value: string | undefined): BriefPriceMode {
  return value === 'request' || value === 'from' ? value : 'range';
}

export const BRIEF_PRICE_MODE = parsePriceMode(process.env.NEXT_PUBLIC_BRIEF_PRICE_MODE);

/** The plan has its own request form, and the step-by-step estimator is retired. */
export const IS_PLAN_LAUNCHED = BRIEF_PRICE_MODE !== 'range';

/** Where "get an estimate" leads, without the locale. */
export const ESTIMATE_PATH = IS_PLAN_LAUNCHED ? '/ai-estimate' : '/estimator';
