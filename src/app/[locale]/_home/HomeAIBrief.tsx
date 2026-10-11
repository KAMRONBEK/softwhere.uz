'use client';

import { NextIntlClientProvider, useLocale, useTimeZone, type AbstractIntlMessages, type Locale } from 'next-intl';
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import type { AIBriefExperienceProps } from '@/modules/estimator/components/brief/AIBriefExperience';
import { pickAiBriefMessages } from '@/modules/estimator/components/brief/messages';

type BriefComponent = LazyExoticComponent<ComponentType<AIBriefExperienceProps>>;

/**
 * The brief's code and its copy (`aiBrief` + the estimator slice, picked from
 * the locale's site messages), loaded together the first time the homepage's
 * AI section mounts. Neither is in the homepage's HTML or first JS.
 */
function lazyBrief(locale: Locale): BriefComponent {
  return lazy(async () => {
    const [{ default: Experience }, site] = await Promise.all([
      import('@/modules/estimator/components/brief/AIBriefExperience'),
      import(`../../../messages/${locale}.json`) as Promise<{ default: AbstractIntlMessages }>,
    ]);
    const messages = pickAiBriefMessages(site.default);
    function BriefWithMessages(props: AIBriefExperienceProps) {
      const timeZone = useTimeZone();
      // A nested provider replaces its parent's messages: the brief reads only these.
      return (
        <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={messages}>
          <Experience {...props} />
        </NextIntlClientProvider>
      );
    }
    return { default: BriefWithMessages };
  });
}

/** One lazy component per locale, created once at module level: React.lazy must keep its identity. */
const BRIEFS: Readonly<Record<Locale, BriefComponent>> = { en: lazyBrief('en'), ru: lazyBrief('ru'), uz: lazyBrief('uz') };

/**
 * The real AI brief in the homepage's 'ai-demo' slot (compact). A client
 * component of the app layer, so the brief (another module) stays out of the
 * homepage's eager bundle: the slot renders only when section 12 mounts.
 */
export default function HomeAIBrief(props: AIBriefExperienceProps) {
  const Brief = BRIEFS[useLocale()];
  return (
    <Suspense fallback={null}>
      <Brief {...props} />
    </Suspense>
  );
}
