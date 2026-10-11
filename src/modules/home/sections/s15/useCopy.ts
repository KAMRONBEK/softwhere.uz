'use client';

import { useTranslations } from 'next-intl';
import { createContext, useContext, useMemo } from 'react';
import {
  BETA_VERSION,
  TEST_DEVICES,
  WEEKLY_BUILD_VERSION,
  formatPrice,
  type ArtKind,
  type Currency,
  type NoteId,
  type StepId,
  type TabId,
  type TestDeviceId,
} from './data';

type TrackStepId = 'accepted' | 'cooking' | 'onTheWay' | 'delivered';
type FlowScreenId = 'home' | 'dish' | 'cart' | 'track';
type SwatchId = 'accent' | 'second' | 'ink' | 'paper';

/**
 * 08 · Mobile App's words for the route locale (`home.mobile-build`),
 * resolved once in the section root and served to the demo through
 * CopyContext, so a beat never re-reads messages. Helpers fold in the data
 * (ids, prices in the locale's currency, version numbers).
 */
export function useS15Copy(currency: Currency) {
  const t = useTranslations('home.mobile-build');
  return useMemo(() => {
    const appName = t('app.name');
    return {
      price: (amount: number) => formatPrice(amount, currency, t('units.soum')),
      step: (id: StepId) => ({
        title: t(`steps.${id}.title`),
        short: t(`steps.${id}.short`),
        when: t(`steps.${id}.when`),
        text: t(`steps.${id}.text`),
        get: t(`steps.${id}.get`),
      }),
      dish: (id: ArtKind) => ({ name: t(`dishes.${id}.name`), shop: t(`dishes.${id}.shop`) }),
      category: (id: ArtKind) => t(`categories.${id}`),
      note: (id: NoteId) => t(`notes.${id}`),
      stepsLabel: t('stepsLabel'),
      stepAction: (index: number, title: string) => t('stepAction', { number: index + 1, title }),
      getLabel: t('getLabel'),
      planLabel: t('planLabel'),
      weekTag: (week: number) => t('weekTag', { week }),
      hintTouch: t('hintTouch'),
      hintPointer: t('hintPointer'),
      demoLabel: t('demoLabel'),
      cursor: {
        show: t('cursor.show'),
        light: t('cursor.light'),
        dark: t('cursor.dark'),
        order: t('cursor.order'),
        add: t('cursor.add'),
        open: t('cursor.open'),
        get: t('cursor.get'),
      },
      app: {
        name: appName,
        category: t('app.category'),
        deliverTo: t('app.deliverTo'),
        address: t('app.address'),
        search: t('app.search'),
        promoTitle: t('app.promoTitle'),
        promoText: t('app.promoText'),
        popular: t('app.popular'),
        seeAll: t('app.seeAll'),
        add: (name: string) => t('app.add', { name }),
        cart: (count: number) => t('app.cart', { count }),
        themeToggle: (isDark: boolean) => (isDark ? t('app.toLight') : t('app.toDark')),
        tabsLabel: t('app.tabsLabel'),
        tab: (id: TabId) => t(`app.tabs.${id}`),
        toast: t('app.toast'),
        pushWhen: t('app.pushWhen'),
        pushText: t('app.pushText'),
        pushOpen: t('app.pushOpen'),
        trackTitle: t('app.trackTitle'),
        trackEta: t('app.trackEta'),
        trackStep: (id: TrackStepId) => t(`app.trackSteps.${id}`),
        orderLabel: t('app.orderLabel'),
        courier: t('app.courier'),
        courierRole: t('app.courierRole'),
      },
      scope: {
        board: t('scope.board'),
        scoped: t('scope.scoped'),
        title: t('scope.title'),
        v1: t('scope.v1'),
        later: t('scope.later'),
        laterTag: t('scope.laterTag'),
        signed: t('scope.signed'),
      },
      wire: { flow: t('wire.flow') },
      test: {
        build: t('test.build', { version: BETA_VERSION }),
        title: t('test.title'),
        crashFree: t('test.crashFree'),
        crashValue: t('test.crashValue'),
        passed: t('test.passed', { passed: TEST_DEVICES.length, total: TEST_DEVICES.length }),
        ready: t('test.ready'),
        device: (id: TestDeviceId) => t(`test.devices.${id}`),
      },
      store: {
        back: t('store.back'),
        get: t('store.get'),
        open: t('store.open'),
        installing: t('store.installing'),
        installLabel: t('store.installLabel', { app: appName }),
        meta: {
          status: t('store.meta.status'),
          age: t('store.meta.age'),
          category: t('store.meta.category'),
        },
        statusValue: t('store.statusValue'),
        categoryValue: t('store.categoryValue'),
        whatsNew: t('store.whatsNew'),
        version: t('store.version'),
        reviews: t('store.reviews'),
        reviewSlot: t('store.reviewSlot'),
        reviewSlotText: t('store.reviewSlotText'),
      },
      satellites: {
        flowTitle: t('satellites.flowTitle'),
        screen: (id: FlowScreenId) => t(`satellites.screens.${id}`),
        paletteTitle: t('satellites.paletteTitle'),
        swatch: (id: SwatchId) => t(`satellites.swatches.${id}`),
        headings: t('satellites.headings'),
        body: t('satellites.body'),
        themeLabel: t('satellites.themeLabel'),
        light: t('satellites.light'),
        dark: t('satellites.dark'),
        buildTitle: t('satellites.buildTitle', { version: WEEKLY_BUILD_VERSION }),
        sent: t('satellites.sent'),
        approved: t('satellites.approved'),
        live: t('satellites.live'),
      },
    };
  }, [t, currency]);
}

export type S15Copy = ReturnType<typeof useS15Copy>;

export const CopyContext = createContext<S15Copy | null>(null);

/** The section's words inside the demo (DemoProvider serves them). */
export function useCopy(): S15Copy {
  const copy = useContext(CopyContext);
  if (!copy) throw new Error('08 · Mobile App: useCopy must be used inside DemoProvider');
  return copy;
}
