import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { loadHomeMessages } from '../messages/home';

const locales = ['en', 'ru', 'uz'] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(locales, requested) ? requested : 'uz';
  const [site, home] = await Promise.all([import(`../messages/${locale}.json`), loadHomeMessages(locale)]);

  // `home` is the homepage's per-section copy (src/messages/home/). It is only
  // server-side here: the layout's client provider never picks it, and the
  // homepage hands just `home` (+ what its client tree reads) to the browser.
  return {
    locale,
    messages: { ...site.default, home },
  };
});
