/**
 * Section 07 demo data: ids, prices, order numbers. The words live in
 * `src/messages/home/telegram/*.json` (read through `useS07Copy`); the route
 * locale picks the demo currency and payment flow: so'm with an SMS-code card
 * payment for uz/ru, dollars and a plain card for en.
 *
 * Nothing here claims a client, a number or an award. The café is the
 * visitor's own ("Your Café"); the one proof line is derived from
 * projects.ts (the admin panel of a Telegram-bot shop) and, like every story
 * section, describes the product without naming it (founder, 2026-10-10).
 */

export type Currency = 'usd' | 'uzs';
export type ItemId = 'cappuccino' | 'latte' | 'flat' | 'matcha';
export type MiniItemId = ItemId | 'croissant' | 'samsa';
export type SizeId = 's' | 'm' | 'l';
export type TimeId = 'now' | 't20' | 't30';
export type PartId = 'bot' | 'admin' | 'mini';
export type ArtKind = 'cup' | 'rosetta' | 'flat' | 'matcha' | 'croissant' | 'samsa';

export const ORDER_NUMBER = 1042;
/** The café's earlier order (already picked up), so the board isn't empty: a large latte. */
export const PREVIOUS_ORDER = { item: 'latte', size: 'l' } as const;
export const NEXT_ORDER_NUMBER = 1043;
export const CARD_LAST4 = '4417';
export const SMS_CODE_LENGTH = 6;
/** The phone's clock and every message's timestamp. */
export const DEMO_TIME = '10:42';

export const PART_IDS = ['bot', 'admin', 'mini'] as const satisfies readonly PartId[];
export const CATEGORY_IDS = ['coffee', 'bakery', 'tea'] as const;

export interface MenuItem {
  id: MiniItemId;
  art: ArtKind;
}

export const MENU: readonly MenuItem[] = [
  { id: 'cappuccino', art: 'rosetta' },
  { id: 'latte', art: 'cup' },
  { id: 'flat', art: 'flat' },
  { id: 'matcha', art: 'matcha' },
  { id: 'croissant', art: 'croissant' },
  { id: 'samsa', art: 'samsa' },
];

export const BOT_ITEMS: readonly ItemId[] = ['cappuccino', 'latte', 'flat', 'matcha'];
export const SIZE_IDS: readonly SizeId[] = ['s', 'm', 'l'];
export const TIME_IDS: readonly TimeId[] = ['now', 't20', 't30'];

/** Minor units: cents for USD, whole so'm for UZS. Demo prices only. */
const PRICES: Record<Currency, Record<MiniItemId, number>> = {
  usd: { cappuccino: 350, latte: 380, flat: 400, matcha: 440, croissant: 290, samsa: 250 },
  uzs: { cappuccino: 28000, latte: 30000, flat: 32000, matcha: 36000, croissant: 24000, samsa: 12000 },
};

const SIZE_EXTRA: Record<Currency, Record<SizeId, number>> = {
  usd: { s: 0, m: 50, l: 90 },
  uzs: { s: 0, m: 4000, l: 7000 },
};

export function currencyForLocale(locale: string): Currency {
  return locale === 'en' ? 'usd' : 'uzs';
}

/** Groups thousands with a no-break space, identically on server and client. */
function groupThousands(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** `soumUnit` is the localized so'm word ("soʻm", "сум"), from messages. */
export function formatPrice(amount: number, currency: Currency, soumUnit: string): string {
  if (currency === 'usd') return `$${(amount / 100).toFixed(2)}`;
  return `${groupThousands(amount)} ${soumUnit}`;
}

export function itemPrice(id: MiniItemId, currency: Currency): number {
  return PRICES[currency][id];
}

export function sizeExtra(id: SizeId, currency: Currency): number {
  return SIZE_EXTRA[currency][id];
}

export function menuItem(id: MiniItemId): MenuItem {
  return MENU.find(item => item.id === id) ?? MENU[0];
}
