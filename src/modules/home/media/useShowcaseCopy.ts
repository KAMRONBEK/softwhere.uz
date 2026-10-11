import { useMessages } from 'next-intl';
import { useMemo } from 'react';
import type { ShowcaseApp, ShowcaseAppId, ShowcaseScreen } from './showcase';

interface ScreenCopy {
  caption: string;
  alt: string;
}

type ShowcaseMessages = Readonly<Record<ShowcaseAppId, { descriptor: string; screens: Readonly<Record<string, ScreenCopy>> }>>;

export interface ShowcaseCopy {
  /** "a messenger app" (en) / "мессенджер" (ru) / "messenjer" (uz). */
  descriptor: (appId: ShowcaseAppId) => string;
  /** The screen's caption in the page locale. */
  caption: (app: Pick<ShowcaseApp, 'id'>, screen: ShowcaseScreen) => string;
  /** The screen's alt text in the page locale. */
  alt: (app: Pick<ShowcaseApp, 'id'>, screen: ShowcaseScreen) => string;
}

/** Localized copy for media/showcase.ts (home.shared.showcase). */
export function useShowcaseCopy(): ShowcaseCopy {
  // The whole table at once (next-intl's t.raw only takes leaf keys); its shape is en.json's, typed above.
  const messages = (useMessages() as unknown as { home: { shared: { showcase: ShowcaseMessages } } }).home.shared.showcase;
  return useMemo(
    () => ({
      descriptor: appId => messages[appId]?.descriptor ?? appId,
      caption: (app, screen) => messages[app.id]?.screens[screen.id]?.caption ?? '',
      alt: (app, screen) => messages[app.id]?.screens[screen.id]?.alt ?? '',
    }),
    [messages]
  );
}
