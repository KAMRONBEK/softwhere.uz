export { BRIEF_PRICE_MODE, IS_PLAN_LAUNCHED, parsePriceMode, type BriefPriceMode } from '@/core/briefPriceMode';

/** Sent by a page that can render a plan without a price; a tab from an older deploy does not send it. */
export const BRIEF_CONTRACT = 2;
