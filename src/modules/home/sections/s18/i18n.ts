/**
 * The demo's words come from `home.crm-build` (src/messages/home/crm-build);
 * each component gets its translator from useTranslations('home.crm-build').
 * Money is written per market: dollars for the English site, so'm (in the
 * visitor's language: soʻm / сум) for the Uzbek and Russian sites.
 */
import type { useTranslations } from 'next-intl';
import { groupThousands, type Currency } from './data';

export type CrmT = ReturnType<typeof useTranslations<'home.crm-build'>>;

export interface Money {
  currency: Currency;
  /** $2,550 / 31 500 000 soʻm. */
  full: (amount: number) => string;
  /** Card-sized: $2,550 / 31,5 mln (the cards' currency is the market's own). */
  short: (amount: number) => string;
}

const NBSP = '\u00a0';

function formatUsd(amount: number): string {
  return `$${groupThousands(amount, ',')}`;
}

export function moneyFor(currency: Currency, t: CrmT): Money {
  if (currency === 'usd') return { currency, full: formatUsd, short: formatUsd };
  return {
    currency,
    // Written by hand, not Intl: so'm markets group with a space and use a decimal comma (uz and ru alike).
    full: amount => t('money.som', { amount: groupThousands(amount, NBSP) }),
    short: amount => {
      const millions = amount / 1_000_000;
      const rounded = millions >= 100 ? Math.round(millions) : Math.round(millions * 10) / 10;
      return t('money.millions', { amount: String(rounded).replace('.', ',') });
    },
  };
}
