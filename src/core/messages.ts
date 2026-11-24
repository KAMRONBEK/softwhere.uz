import type { AbstractIntlMessages } from 'next-intl';

/**
 * Message namespaces that reach the browser on EVERY page.
 *
 * `NextIntlClientProvider` serialises whatever it is given into each page's
 * HTML. Handing it the whole bundle (30–48KB per locale, ru largest) shipped
 * `servicePages`, `privacy`, `faq` and the 11–16KB `estimator` namespace into
 * every blog post for zero rendered benefit. These are what the layout's
 * floating widgets and the Contact section read; the header's strings come from
 * `pickSiteChromeMessages`. Anything else is provided by the page that needs
 * it via a nested provider: see `pickMessages` and docs/i18n.md.
 */
export const CLIENT_MESSAGE_NAMESPACES = ['contact', 'toastMessage', 'projects'] as const;

/**
 * The slice of the homepage's messages the site header reads (the header
 * itself and the shared "Book a call"), with the rest of `home` left out.
 */
export function pickSiteChromeMessages({ home }: AbstractIntlMessages): AbstractIntlMessages {
  const { header, shared } = home as AbstractIntlMessages;
  const { callCta } = shared as AbstractIntlMessages;
  return { home: { header, shared: { callCta } } };
}

/**
 * Return a copy of `messages` holding only the given top-level namespaces.
 * Missing namespaces are skipped rather than thrown on, so a typo shows up as
 * next-intl's own MISSING_MESSAGE error at the call site, not as a crash here.
 */
export function pickMessages(messages: AbstractIntlMessages, namespaces: readonly string[]): AbstractIntlMessages {
  return Object.fromEntries(namespaces.filter(ns => ns in messages).map(ns => [ns, messages[ns]]));
}
