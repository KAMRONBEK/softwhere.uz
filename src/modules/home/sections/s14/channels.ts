import { CONTACT_INFO, SOCIAL_LINKS } from '@/core/constants';

/**
 * The studio's real channels (src/core/constants.ts, also on the live site).
 * A file of its own, with no portfolio import, so the finale's static
 * fallback can render them without pulling the section's data.
 */
const PHONE = CONTACT_INFO.PHONE;
export const PHONE_PRETTY = PHONE.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, '+998 $1 $2 $3 $4');
export const TELEGRAM_HANDLE = `@${SOCIAL_LINKS.TELEGRAM.replace(/^https:\/\/t\.me\//, '')}`;

export type ChannelId = 'telegram' | 'call' | 'email';

export interface DirectChannel {
  id: ChannelId;
  href: string;
  /** What the accessible name says the link reaches (handle, number, address). */
  value: string;
  isExternal: boolean;
}

const DIRECT_CHANNELS: Readonly<Record<ChannelId, DirectChannel>> = {
  telegram: { id: 'telegram', href: SOCIAL_LINKS.TELEGRAM, value: TELEGRAM_HANDLE, isExternal: true },
  call: { id: 'call', href: `tel:${PHONE}`, value: PHONE_PRETTY, isExternal: false },
  email: { id: 'email', href: `mailto:${CONTACT_INFO.EMAIL}`, value: CONTACT_INFO.EMAIL, isExternal: false },
};

const ORDER_LOCAL: readonly ChannelId[] = ['telegram', 'call', 'email'];
const ORDER_INTL: readonly ChannelId[] = ['email', 'call', 'telegram'];

/**
 * Uzbekistan writes on Telegram first; an English-speaking visitor (the US
 * and Europe) expects email first, with Telegram as the extra. Same three
 * channels; the placeholders and examples follow the market in each
 * locale's messages.
 */
export function channelsForLocale(locale: string): readonly DirectChannel[] {
  return (locale === 'en' ? ORDER_INTL : ORDER_LOCAL).map(id => DIRECT_CHANNELS[id]);
}
