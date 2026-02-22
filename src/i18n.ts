import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

const locales = ['en', 'ru', 'uz'] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(locales, requested) ? requested : 'uz';

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
