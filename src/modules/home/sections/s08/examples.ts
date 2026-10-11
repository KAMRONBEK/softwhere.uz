/**
 * The scripted demo's three example briefs, in the visitor's language. The
 * structure (which blocks each wireframe has), the names, times and the
 * estimator's numbers are fixed here; every word comes from
 * `home.ai-demo.examples` (see data.ts for where the numbers come from).
 */
import type { useTranslations } from 'next-intl';
import type { DemoExample, Market } from './data';

export type AiDemoT = ReturnType<typeof useTranslations<'home.ai-demo'>>;

/** Estimator output per market (see data.ts's module comment). */
const NUMBERS = {
  barber: {
    intl: {
      weeks: { min: 7, max: 9 },
      price: { min: 3200, max: 15000 },
      engine:
        'mobile/booking, iOS+Android cross-platform, mvp, custom design, 2 languages, normal urgency, 12 screens; features otp_sms, push, reviews, admin_panel; integrations stripe',
    },
    uz: {
      weeks: { min: 7, max: 9 },
      price: { min: 3400, max: 5500 },
      engine:
        'mobile/booking, iOS+Android cross-platform, mvp, custom design, 2 languages, normal urgency, 12 screens; features otp_sms, push, reviews, admin_panel; integrations click, payme',
    },
  },
  bakery: {
    intl: {
      weeks: { min: 4, max: 6 },
      price: { min: 2100, max: 9500 },
      engine:
        'telegram/bot_miniapp, mvp, custom design, 2 languages, normal urgency, 10 screens; features catalog, cart_checkout, orders, admin_panel; integrations stripe, telegram_channel',
    },
    uz: {
      weeks: { min: 5, max: 6 },
      price: { min: 2200, max: 3500 },
      engine:
        'telegram/bot_miniapp, mvp, custom design, 2 languages, normal urgency, 10 screens; features catalog, cart_checkout, orders, admin_panel; integrations click, payme, telegram_channel',
    },
  },
  assistant: {
    intl: {
      weeks: { min: 4, max: 6 },
      price: { min: 2100, max: 9500 },
      engine: 'ai/rag, mvp, custom design, 2 languages, normal urgency; features file_upload, admin_panel; integrations telegram_channel',
    },
    uz: {
      weeks: { min: 4, max: 6 },
      price: { min: 2100, max: 3300 },
      engine: 'ai/rag, mvp, custom design, 2 languages, normal urgency; features file_upload, admin_panel; integrations telegram_channel',
    },
  },
} as const;

/** The payment buttons a market's checkout shows: Stripe's card and Apple Pay, or Click and Payme. */
function payOptions(market: Market, t: AiDemoT, isCardFirst: boolean): readonly [string, string] {
  if (market === 'uz') return ['Click', 'Payme'];
  return isCardFirst ? [t('wire.card'), 'Apple Pay'] : ['Apple Pay', t('wire.card')];
}

function barber(market: Market, t: AiDemoT): DemoExample {
  return {
    id: `barber-${market}`,
    chip: t('examples.barber.chip'),
    idea: t('examples.barber.idea'),
    kind: t('examples.barber.kind'),
    title: t('examples.barber.title'),
    platforms: t('examples.barber.platforms'),
    scope: [
      t('examples.barber.scope.login'),
      t('examples.barber.scope.profiles'),
      t('examples.barber.scope.booking'),
      t('examples.barber.scope.payments'),
      t('examples.barber.scope.reminders'),
      t('examples.barber.scope.admin'),
    ],
    screens: [
      {
        name: t('examples.barber.choose.name'),
        blocks: [
          { kind: 'header', label: t('examples.barber.choose.header') },
          { kind: 'search', label: t('examples.barber.choose.search') },
          {
            kind: 'filters',
            items: [
              t('examples.barber.choose.filters.haircut'),
              t('examples.barber.choose.filters.beard'),
              t('examples.barber.choose.filters.kids'),
            ],
          },
          {
            kind: 'barbers',
            items: ['Aziz', 'Timur', 'Bekzod', 'Jasur'],
            meta: [
              t('examples.barber.choose.slots.today1'),
              t('examples.barber.choose.slots.today2'),
              t('examples.barber.choose.slots.tomorrow'),
              t('examples.barber.choose.slots.saturday'),
            ],
          },
          {
            kind: 'nav-bar',
            items: [t('examples.barber.choose.nav.home'), t('examples.barber.choose.nav.visits'), t('examples.barber.choose.nav.profile')],
          },
        ],
      },
      {
        name: t('examples.barber.time.name'),
        blocks: [
          { kind: 'header', label: t('examples.barber.time.name') },
          { kind: 'profile', label: 'Aziz', items: [t('examples.barber.time.service')] },
          { kind: 'week' },
          { kind: 'slots', items: ['10:00', '11:30', '12:30', '14:00', '15:30', '17:00', '18:00', '18:45', '19:30'] },
          { kind: 'note', label: t('examples.barber.time.note') },
          { kind: 'button', label: t('examples.barber.time.button') },
        ],
      },
      {
        name: t('examples.barber.confirm.name'),
        blocks: [
          { kind: 'header', label: t('examples.barber.confirm.header') },
          { kind: 'profile', label: 'Aziz', items: [t('examples.barber.confirm.service'), t('examples.barber.confirm.when')] },
          { kind: 'form', items: [t('examples.barber.confirm.yourName'), t('examples.barber.confirm.phone')] },
          { kind: 'pay', items: payOptions(market, t, false) },
          { kind: 'note', label: t('examples.barber.confirm.note') },
          { kind: 'button', label: t('examples.barber.confirm.button') },
        ],
      },
    ],
    ...NUMBERS.barber[market],
  };
}

function bakery(market: Market, t: AiDemoT): DemoExample {
  return {
    id: `bakery-${market}`,
    chip: t('examples.bakery.chip'),
    idea: t('examples.bakery.idea'),
    kind: t('examples.bakery.kind'),
    title: t('examples.bakery.title'),
    platforms: t('examples.bakery.platforms'),
    scope: [
      t('examples.bakery.scope.catalog'),
      t('examples.bakery.scope.checkout'),
      t('examples.bakery.scope.status'),
      t('examples.bakery.scope.payments'),
      t('examples.bakery.scope.group'),
      t('examples.bakery.scope.admin'),
    ],
    screens: [
      {
        name: t('examples.bakery.chat.name'),
        blocks: [
          { kind: 'bot-header', label: t('examples.bakery.chat.bot') },
          {
            kind: 'chat',
            items: [
              t('examples.bakery.chat.fresh'),
              t('examples.bakery.chat.menuAsk'),
              t('examples.bakery.chat.tap'),
              t('examples.bakery.chat.pickup'),
              t('examples.bakery.chat.pickupYes'),
            ],
          },
          { kind: 'button', label: t('examples.bakery.chat.open') },
          {
            kind: 'keyboard',
            items: [t('examples.bakery.chat.keys.menu'), t('examples.bakery.chat.keys.orders'), t('examples.bakery.chat.keys.contacts')],
          },
        ],
      },
      {
        name: t('examples.bakery.menu.name'),
        blocks: [
          { kind: 'header', label: t('examples.bakery.menu.name') },
          {
            kind: 'tabs',
            items: [t('examples.bakery.menu.tabs.bread'), t('examples.bakery.menu.tabs.pastry'), t('examples.bakery.menu.tabs.cakes')],
          },
          {
            kind: 'card-grid',
            items: [
              t('examples.bakery.menu.items.non'),
              t('examples.bakery.menu.items.samsa'),
              t('examples.bakery.menu.items.croissant'),
              t('examples.bakery.menu.items.napoleon'),
            ],
          },
          { kind: 'button', label: t('examples.bakery.menu.cart') },
        ],
      },
      {
        name: t('examples.bakery.checkout.name'),
        blocks: [
          { kind: 'header', label: t('examples.bakery.checkout.header') },
          { kind: 'cart', items: [t('examples.bakery.checkout.lines.non'), t('examples.bakery.checkout.lines.samsa')] },
          { kind: 'form', items: [t('examples.bakery.checkout.address'), t('examples.bakery.checkout.time')] },
          { kind: 'pay', items: payOptions(market, t, true) },
          { kind: 'button', label: t('examples.bakery.checkout.button') },
        ],
      },
    ],
    ...NUMBERS.bakery[market],
  };
}

function assistant(market: Market, t: AiDemoT): DemoExample {
  return {
    id: 'assistant',
    chip: t('examples.assistant.chip'),
    idea: t('examples.assistant.idea'),
    kind: t('examples.assistant.kind'),
    title: t('examples.assistant.title'),
    platforms: t('examples.assistant.platforms'),
    scope: [
      t('examples.assistant.scope.answers'),
      t('examples.assistant.scope.upload'),
      t('examples.assistant.scope.handoff'),
      t('examples.assistant.scope.alerts'),
      t('examples.assistant.scope.admin'),
    ],
    screens: [
      {
        name: t('examples.assistant.chat.name'),
        blocks: [
          { kind: 'bot-header', label: t('examples.assistant.chat.bot') },
          {
            kind: 'chat',
            startsOut: true,
            items: [
              t('examples.assistant.chat.sunday'),
              t('examples.assistant.chat.sundayYes'),
              t('examples.assistant.chat.district'),
              t('examples.assistant.chat.districtYes'),
            ],
          },
          { kind: 'system', label: t('examples.assistant.chat.faq') },
          { kind: 'form', items: [t('examples.assistant.chat.message')] },
        ],
      },
      {
        name: t('examples.assistant.handoff.name'),
        blocks: [
          { kind: 'bot-header', label: t('examples.assistant.chat.bot') },
          { kind: 'chat', startsOut: true, items: [t('examples.assistant.handoff.invoice'), t('examples.assistant.handoff.connect')] },
          { kind: 'system', label: t('examples.assistant.handoff.joined') },
          { kind: 'chat', items: [t('examples.assistant.handoff.manager')] },
          { kind: 'form', items: [t('examples.assistant.chat.message')] },
        ],
      },
      {
        name: t('examples.assistant.kb.name'),
        blocks: [
          { kind: 'header', label: t('examples.assistant.kb.name') },
          { kind: 'upload', label: t('examples.assistant.kb.upload') },
          {
            kind: 'files',
            items: [
              t('examples.assistant.kb.files.prices'),
              t('examples.assistant.kb.files.faq'),
              t('examples.assistant.kb.files.delivery'),
              t('examples.assistant.kb.files.returns'),
            ],
          },
          {
            kind: 'nav-bar',
            items: [t('examples.assistant.kb.nav.chats'), t('examples.assistant.kb.nav.files'), t('examples.assistant.kb.nav.stats')],
          },
        ],
      },
    ],
    ...NUMBERS.assistant[market],
  };
}

/** The three examples for a market, in the visitor's language. */
export function getExamples(market: Market, t: AiDemoT): readonly DemoExample[] {
  return [barber(market, t), bakery(market, t), assistant(market, t)];
}
