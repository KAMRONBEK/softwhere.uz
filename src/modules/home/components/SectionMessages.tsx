'use client';

import { NextIntlClientProvider, useLocale, useMessages, useTimeZone, type AbstractIntlMessages } from 'next-intl';
import { use, useMemo, type ComponentType, type ReactNode } from 'react';
import { loadHomePart, type HomeLocale, type HomeMessagePart, type Messages } from '@/messages/home';
import type { LabSectionProps, SectionId } from '../types';

const LOCALES: readonly HomeLocale[] = ['en', 'ru', 'uz'];

function toLocale(value: string | undefined): HomeLocale {
  return LOCALES.find(locale => locale === value) ?? 'uz';
}

/** One request per part and locale for the page's life (the import is cached by the bundler too). */
const loads = new Map<string, Promise<Messages>>();
/** A failed chunk request (a flaky mobile network) is tried once more after this pause. */
const RETRY_MS = 800;

function loadPart(part: HomeMessagePart, locale: HomeLocale): Promise<Messages> {
  const key = `${locale}:${part}`;
  const cached = loads.get(key);
  if (cached) return cached;
  const load = loadHomePart(part, locale)
    .catch(() => new Promise<void>(resolve => setTimeout(resolve, RETRY_MS)).then(() => loadHomePart(part, locale)))
    .catch((error: unknown) => {
      // Forget the failure, so the section's next mount asks again; its error boundary shows the fallback meanwhile.
      loads.delete(key);
      throw error;
    });
  loads.set(key, load);
  return load;
}

/**
 * Starts loading a section's copy alongside its code (the registry's
 * next/dynamic loaders call it), so the two arrive together. The locale is
 * read from <html lang>, which the locale layout sets; on the server it is a
 * no-op and SectionMessages loads the part itself.
 */
export function preloadSectionMessages(part: SectionId): Promise<unknown> {
  if (typeof document === 'undefined') return Promise.resolve();
  return loadPart(part, toLocale(document.documentElement.lang)).catch(() => undefined);
}

/**
 * Gives a section its full `home.<part>` copy. The page's own provider only
 * carries what the static fallbacks render (sections/eagerMessages.ts); this
 * nested provider adds the section's part on top of everything the parent
 * has (a nested provider replaces its parent's messages, hence the merge).
 * Suspends while the part loads: the section's next/dynamic `loading` (its
 * static stand-in) shows meanwhile.
 */
function SectionMessages({ part, children }: { part: SectionId; children: ReactNode }) {
  const locale = useLocale();
  const timeZone = useTimeZone();
  const parent = useMessages();
  const own = use(loadPart(part, toLocale(locale)));
  const messages = useMemo<AbstractIntlMessages>(() => {
    const home = (parent.home ?? {}) as AbstractIntlMessages;
    return { ...parent, home: { ...home, [part]: own } };
  }, [parent, own, part]);
  return (
    <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

/** A section component wrapped in its copy's provider, for next/dynamic: `import('./S02').then(withSectionMessages('manifesto'))`. */
export function withSectionMessages(part: SectionId) {
  return function wrap(mod: { default: ComponentType<LabSectionProps> }): { default: ComponentType<LabSectionProps> } {
    const Section = mod.default;
    function SectionWithMessages(props: LabSectionProps) {
      return (
        <SectionMessages part={part}>
          <Section {...props} />
        </SectionMessages>
      );
    }
    return { default: SectionWithMessages };
  };
}
