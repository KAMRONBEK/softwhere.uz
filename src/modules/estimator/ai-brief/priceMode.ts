/**
 * What a visitor's plan shows: 'range' (the engine's price range) or 'request'
 * (no price; the visitor sends the plan and a person quotes it). Inlined at
 * build time for server and client alike, so they never disagree;
 * next.config.mjs refuses a 'request' build without BRIEF_TOKEN_SECRET.
 */
export type BriefPriceMode = 'range' | 'request';

export function parsePriceMode(value: string | undefined): BriefPriceMode {
  return value === 'request' ? 'request' : 'range';
}

export const BRIEF_PRICE_MODE = parsePriceMode(process.env.NEXT_PUBLIC_BRIEF_PRICE_MODE);

/** Sent by a page that can render a plan without a price; a tab from an older deploy does not send it. */
export const BRIEF_CONTRACT = 2;
