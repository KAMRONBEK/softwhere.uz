'use client';

import { useLocale, useTranslations } from 'next-intl';
import { createContext, useContext, useMemo } from 'react';
import { useProjectDescriber } from '../../media/useProjectDescriber';
import {
  BAKERY_HOURS,
  CHECK_ROW_IDS,
  NAV_IDS,
  ORDER_ITEM_IDS,
  PRODUCTS,
  SCORES,
  SWATCH_IDS,
  VITAL_IDS,
  WEB_EXAMPLES,
  WEB_PROJECT_COUNT,
  clockForLocale,
  formatHour,
  type SiteCopy,
  type StepId,
  type WidthMode,
} from './data';

/**
 * 09 · Website's words for the route locale (`home.web-build`), resolved
 * once in the section root and served through CopyContext. The example
 * site's times follow the locale's clock (12-hour in English).
 */
export function useS16Copy() {
  const t = useTranslations('home.web-build');
  const locale = useLocale();
  const describer = useProjectDescriber();
  return useMemo(() => {
    const clock = clockForLocale(locale);
    const hour = (value: number) => formatHour(value, clock);
    const hours = `${hour(BAKERY_HOURS.open)}–${hour(BAKERY_HOURS.close)}`;
    const domain = t('domain');
    const examples = WEB_EXAMPLES.map(project => describer.describe(project));
    const exampleList =
      examples.length < 2
        ? examples.join('')
        : t('listAnd', { rest: examples.slice(0, -1).join(', '), last: examples[examples.length - 1] });
    const site: SiteCopy = {
      brand: t('site.brand'),
      specialBefore: t('site.specialBefore', { time: hour(BAKERY_HOURS.specialBefore) }),
      specialAfter: t('site.specialAfter', { time: hour(BAKERY_HOURS.specialAfter) }),
      nav: NAV_IDS.map(id => t(`site.nav.${id}`)),
      navCta: t('site.navCta'),
      navCtaShort: t('site.navCtaShort'),
      heroTitle: t('site.heroTitle'),
      heroText: t('site.heroText'),
      ctaPrimary: t('site.ctaPrimary'),
      ctaSecondary: t('site.ctaSecondary'),
      freshTitle: t('site.freshTitle'),
      products: PRODUCTS.map(product => ({
        id: product.id,
        name: t(`site.products.${product.id}`),
        note: t('site.outAt', { time: hour(product.outAt) }),
      })),
      footer: t('site.footer', { hours }),
      hours,
      wire: {
        special: t('wireLabels.special'),
        logo: t('wireLabels.logo'),
        nav: t('wireLabels.nav'),
        order: t('wireLabels.order'),
        title: t('wireLabels.title'),
        text: t('wireLabels.text'),
        actions: t('wireLabels.actions'),
        photo: t('wireLabels.photo'),
        fresh: t('wireLabels.fresh'),
        footer: t('wireLabels.footer'),
      },
    };
    const address: Record<StepId, string> = {
      wire: t('address.wire'),
      design: t('address.design'),
      code: t('address.code', { domain }),
      checks: t('address.code', { domain }),
      content: t('address.content', { domain }),
      launch: domain,
    };
    return {
      site,
      step: (id: StepId) => ({
        term: t(`steps.${id}.term`),
        when: t(`steps.${id}.when`),
        text: t(`steps.${id}.text`),
        get: t(`steps.${id}.get`),
      }),
      lead: t('lead'),
      leadStill: t('leadStill'),
      stepsLabel: t('stepsLabel'),
      stepAction: (term: string, when: string) => t('stepAction', { term, when }),
      getLabel: t('getLabel'),
      timeline: t('timeline'),
      deliverTitle: t('deliverTitle'),
      deliver: [t('deliver.site'), t('deliver.admin'), t('deliver.analytics'), t('deliver.ownership'), t('deliver.fixes')],
      proof:
        examples.length > 0
          ? t('proof', { count: WEB_PROJECT_COUNT, examples: exampleList })
          : t('proofShort', { count: WEB_PROJECT_COUNT }),
      next: t('next'),
      cta: t('cta'),
      footnote: t('footnote'),
      demoLabel: t('demoLabel'),
      exampleTag: t('exampleTag'),
      cursorShow: t('cursor.show'),
      toolbar: {
        label: t('toolbar.label'),
        widthLabel: t('toolbar.widthLabel'),
        modes: {
          desktop: t('toolbar.modes.desktop'),
          tablet: t('toolbar.modes.tablet'),
          phone: t('toolbar.modes.phone'),
        } satisfies Record<WidthMode, string>,
        dark: t('toolbar.dark'),
      },
      address,
      live: t('live'),
      panels: {
        wire: { title: t('panels.wire.title'), text: t('panels.wire.text') },
        design: {
          title: t('panels.design.title'),
          colours: t('panels.design.colours'),
          swatches: SWATCH_IDS.map(id => ({ id, name: t(`panels.design.swatches.${id}`) })),
          type: t('panels.design.type'),
          headings: t('panels.design.headings'),
          body: t('panels.design.body'),
          shape: t('panels.design.shape'),
          note: t('panels.design.note'),
        },
        code: {
          layout: {
            desktop: t('panels.code.layout.desktop'),
            tablet: t('panels.code.layout.tablet'),
            phone: t('panels.code.layout.phone'),
          } satisfies Record<WidthMode, string>,
          chip: t('panels.code.chip'),
        },
        checks: {
          title: t('panels.checks.title'),
          device: t('panels.checks.device'),
          scores: SCORES.map(score => {
            const label = t(`panels.checks.scores.${score.id}`);
            return { ...score, label, srLabel: t('panels.checks.scoreOf', { label, value: score.value }) };
          }),
          vitalsTitle: t('panels.checks.vitalsTitle'),
          vitals: VITAL_IDS.map(id => ({ id, label: t(`panels.checks.vitals.${id}.label`), value: t(`panels.checks.vitals.${id}.value`) })),
          good: t('panels.checks.good'),
          rows: CHECK_ROW_IDS.map(id => t(`panels.checks.rows.${id}`)),
        },
        content: {
          title: t('panels.content.title'),
          field: t('panels.content.field'),
          publish: t('panels.content.publish'),
          publishing: t('panels.content.publishing'),
          published: t('panels.content.published'),
          draft: t('panels.content.draft'),
          hoursLabel: t('panels.content.hoursLabel'),
          photoLabel: t('panels.content.photoLabel'),
        },
        launch: {
          title: t('panels.launch.title'),
          deployed: t('panels.launch.deployed'),
          now: t('panels.launch.now'),
          today: t('panels.launch.today'),
          orders: t('panels.launch.orders'),
          conversion: t('panels.launch.conversion'),
          toast: (item: string) => t('panels.launch.toast', { item }),
          items: ORDER_ITEM_IDS.map(id => t(`panels.launch.items.${id}`)),
          /** "4.2%" / "4,2%": one decimal, the locale's separator (no Intl: Node and browsers disagree on uz). */
          percent: (value: number) => `${value.toFixed(1).replace('.', locale === 'en' ? '.' : ',')}%`,
        },
      },
    };
  }, [t, locale, describer]);
}

export type S16Copy = ReturnType<typeof useS16Copy>;

export const CopyContext = createContext<S16Copy | null>(null);

/** The section's words inside the demo (the section root serves them). */
export function useCopy(): S16Copy {
  const copy = useContext(CopyContext);
  if (!copy) throw new Error('09 · Website: useCopy must be used inside the section’s CopyContext');
  return copy;
}
