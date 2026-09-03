import type { AbstractIntlMessages } from 'next-intl';

/**
 * Message namespaces that reach the browser on EVERY page.
 *
 * `NextIntlClientProvider` serialises whatever it is given into each page's
 * HTML. Handing it the whole bundle (30–48KB per locale, ru largest) shipped
 * `servicePages`, `privacy`, `faq` and the 11–16KB `estimator` namespace into
 * every blog post for zero rendered benefit. This list is the layout's client tree — Header,
 * Footer, TelegramChat — plus the homepage sections that hydrate on the client
 * (Contact, ProjectSlider). Anything else is provided by the page that needs
 * it via a nested provider: see `pickMessages` and docs/i18n.md.
 */
export const CLIENT_MESSAGE_NAMESPACES = ['header', 'footer', 'contact', 'toastMessage', 'projects'] as const;

/**
 * Return a copy of `messages` holding only the given top-level namespaces.
 * Missing namespaces are skipped rather than thrown on, so a typo shows up as
 * next-intl's own MISSING_MESSAGE error at the call site, not as a crash here.
 */
export function pickMessages(messages: AbstractIntlMessages, namespaces: readonly string[]): AbstractIntlMessages {
  return Object.fromEntries(namespaces.filter(ns => ns in messages).map(ns => [ns, messages[ns]]));
}
