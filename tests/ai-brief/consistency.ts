/**
 * AI brief CONSISTENCY checker + eval-harness maths — no network, no model.
 *
 *   npx tsx tests/ai-brief/consistency.ts
 *
 * Covers `src/modules/estimator/ai-brief/consistency.ts` (wireframes, MVP
 * narrative and assumptions against the priced scope; framing leaks) on
 * hand-built briefs and on a real round-1 brief, and the pure parts of
 * `scripts/lib/aiBriefEval.ts` (expectation tags, variance, summaries).
 */
import type { BlockKind, Device } from '../../src/modules/estimator/ai-brief/constants';
import {
  checkBriefConsistency,
  claimedLanguages,
  clauses,
  normalizeToken,
  tokenize,
  tokensMatch,
  type ConsistencyKind,
  type ConsistencyReport,
} from '../../src/modules/estimator/ai-brief/consistency';
import type { PricedScope } from '../../src/modules/estimator/ai-brief/digest';
import type { AiBrief, WireframeScreen } from '../../src/modules/estimator/ai-brief/types';
import {
  caseVariance,
  checksFor,
  coefficientOfVariation,
  meanJaccard,
  summarizeVariant,
  type CaseResult,
  type EvalCase,
  type RunView,
} from '../../scripts/lib/aiBriefEval';
import { Suite } from '../estimator/harness';

const s = new Suite('ai-brief-consistency');

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

type BlockSpec = [BlockKind, string, string[]?];

function screen(
  name: string,
  blocks: BlockSpec[],
  opts: { phase?: 'mvp' | 'later'; device?: Device; purpose?: string } = {}
): WireframeScreen {
  return {
    name,
    purpose: opts.purpose ?? '',
    device: opts.device ?? 'phone',
    phase: opts.phase ?? 'mvp',
    blocks: blocks.map(([kind, label, items]) => ({ kind, label, items: items ?? [] })),
  };
}

interface BriefPatch {
  locale?: AiBrief['locale'];
  title?: string;
  roles?: string[];
  screens?: WireframeScreen[];
  assumptions?: string[];
  buildFirst?: string;
  canWait?: AiBrief['narrative']['canWait'];
  integrations?: AiBrief['integrations'];
  config?: Partial<AiBrief['estimate']['config']>;
  mvpDeliverables?: string[];
}

function brief(p: BriefPatch = {}): AiBrief {
  const locale = p.locale ?? 'en';
  const price = { currency: 'USD' as const, min: 1000, max: 2000, basis: 'en_dual_rate' as const };
  return {
    version: 1,
    locale,
    model: 'kimi-k3',
    models: { scope: 'kimi-k3', narrative: 'kimi-k3', screens: 'kimi-k3' },
    title: p.title ?? 'Bakery Ordering App',
    summary: 'An app for a bakery.',
    audience: [],
    roles: p.roles ?? ['Customer', 'Admin'],
    features: [],
    integrations: p.integrations ?? [],
    stack: [],
    complexityFlags: [],
    screens: p.screens ?? [],
    estimate: {
      mode: 'priced',
      basis: 'en_dual_rate',
      confidence: 'medium',
      config: {
        projectType: 'mobile',
        subtype: 'ecommerce',
        platforms: ['ios', 'android'],
        approach: 'cross',
        tier: 'mvp',
        design: 'custom',
        languages: 1,
        urgency: 'normal',
        screens: 12,
        ...p.config,
      },
      mvp: { price, weeks: { min: 4, max: 6 }, team: [], drivers: [] },
      fullVision: null,
      extras: [],
      phases: [{ id: 'mvp', title: 'MVP', goal: '', deliverables: p.mvpDeliverables ?? [], weeks: { min: 4, max: 6 } }],
      unpricedItems: [],
      adjustments: [],
    },
    narrative: {
      buildFirst: { what: p.buildFirst ?? '', why: '' },
      canWait: p.canWait ?? [],
      risks: [],
      questions: [],
      assumptions: p.assumptions ?? [],
    },
    policy: { status: 'ok', topics: [], note: '' },
  };
}

function priced(p: Partial<PricedScope> = {}): PricedScope {
  return {
    product: { projectType: 'mobile', subtype: 'ecommerce' },
    mvpRefs: ['auth_basic', 'catalog', 'cart_checkout', 'orders', 'admin_panel', 'stripe'],
    laterRefs: ['reviews', 'promo'],
    extraRefs: [],
    hasGrowth: true,
    unpriced: [],
    frames: { primary: 'phone', mvp: ['phone', 'browser'], later: ['phone', 'browser'] },
    ...p,
  };
}

const kinds = (r: ConsistencyReport) => r.violations.map(v => v.kind);
const has = (r: ConsistencyReport, kind: ConsistencyKind, subject?: string) =>
  r.violations.some(v => v.kind === kind && (!subject || v.subject === subject));
const dump = (r: ConsistencyReport) => r.violations.map(v => `${v.kind} @${v.where} [${v.subject}]`).join('\n') || '(none)';

/* ------------------------------------------------------------------ */
/* 1. Tokens                                                           */
/* ------------------------------------------------------------------ */

s.group('tokens');
{
  s.eq(
    'normalize: lowercase, plural s, apostrophe, ё',
    [normalizeToken('Flags'), normalizeToken("To'lov"), normalizeToken('ещё')],
    ['flag', 'tolov', 'еще']
  );
  s.eq('tokenize drops stopwords, short words and bare numbers', tokenize('Sync with the 30 SharePoint folders via API'), [
    'sharepoint',
    'folder',
  ]);
  s.ok(
    'tokenize keeps short brands and alphanumerics',
    tokenize('IFTA and 1C via SDK').join(',') === 'ifta,1c,sdk',
    tokenize('IFTA and 1C via SDK').join(',')
  );
  s.ok('inflection: extracted ~ extraction', tokensMatch('extracted', 'extraction'));
  s.ok('inflection: турникетами ~ турникет', tokensMatch('турникетами', 'турникет'));
  s.ok('prefix: flag ~ flagging', tokensMatch('flag', 'flagging'));
  s.ok('different words: contract ≠ control', !tokensMatch('contract', 'control'));
  s.eq('clauses split on ; , and "but"', clauses('Cash at the desk, online payment later; no SMS but email'), [
    'Cash at the desk',
    'online payment later',
    'no SMS',
    'email',
  ]);
}

/* ------------------------------------------------------------------ */
/* 2. Wireframes                                                       */
/* ------------------------------------------------------------------ */

s.group('wireframes — MVP screens against the priced scope');
{
  const clean = checkBriefConsistency(
    brief({
      screens: [
        screen('Menu', [
          ['header', 'Fresh cakes'],
          ['search', 'Find a cake'],
          ['card-grid', 'Today', ['Honey cake', 'Napoleon']],
          ['button', 'Add to cart'],
        ]),
        screen('Cart', [
          ['cart', 'Your order', ['Honey cake × 1']],
          ['checkout', 'Pay', ['Card (Stripe)', 'Apple Pay']],
        ]),
        screen('Sign in', [
          ['form', 'Sign in', ['Email', 'Password']],
          ['button', 'Log in'],
        ]),
      ],
    }),
    priced()
  );
  s.eq('generic UI + priced cart, checkout and login → no violations', dump(clean), '(none)');
  s.ok(
    'coverage counts what the MVP screens show',
    clean.coverage.shown.includes('cart_checkout') && clean.coverage.shown.includes('stripe'),
    JSON.stringify(clean.coverage)
  );

  const later = checkBriefConsistency(
    brief({
      screens: [
        screen('Cake page', [
          ['header', 'Honey cake'],
          ['list', 'Ratings', ['★ 4.8 from 120 buyers']],
          ['text', 'Use promo code CAKE10'],
        ]),
      ],
    }),
    priced()
  );
  s.ok(
    'a LATER feature on an MVP screen is an error',
    has(later, 'screen_later', 'reviews') && has(later, 'screen_later', 'promo'),
    dump(later)
  );
  s.ok('…with error severity', later.errors >= 2 && later.violations.every(v => v.severity === 'error'), dump(later));

  const laterScreen = checkBriefConsistency(
    brief({
      screens: [
        screen(
          'Reviews',
          [
            ['list', 'Customer ratings', ['★★★★★']],
            ['button', 'Write a review'],
          ],
          { phase: 'later' }
        ),
      ],
    }),
    priced()
  );
  s.eq('the one LATER screen may show LATER items', dump(laterScreen), '(none)');

  const nowhere = checkBriefConsistency(
    brief({
      screens: [
        screen('Track', [
          ['map', 'Courier on the map'],
          ['chat', 'Chat with the courier'],
        ]),
      ],
    }),
    priced()
  );
  s.ok(
    'a map or chat priced nowhere → warning (block kind counts)',
    has(nowhere, 'screen_not_in_scope', 'map') && has(nowhere, 'screen_not_in_scope', 'chat'),
    dump(nowhere)
  );
  s.ok('…and only a warning', nowhere.errors === 0 && nowhere.warnings >= 2, dump(nowhere));

  const brands = checkBriefConsistency(
    brief({ locale: 'uz', screens: [screen("To'lov", [['checkout', "To'lov usuli", ['Payme', 'Click', 'Uzum Bank']]])] }),
    priced({ mvpRefs: ['catalog', 'cart_checkout', 'orders', 'payme'], laterRefs: ['click'] })
  );
  s.ok('a payment brand priced only later → error', has(brands, 'screen_later', 'brand:click'), dump(brands));
  s.ok('a payment brand priced nowhere → warning', has(brands, 'screen_not_in_scope', 'brand:uzum'), dump(brands));
  s.ok('a priced brand is fine', !brands.violations.some(v => v.subject === 'brand:payme'), dump(brands));

  const cash = checkBriefConsistency(
    brief({
      screens: [
        screen('Order status', [
          ['text', 'Status: ready — pay at pickup'],
          ['button', 'Pay in cash at the counter'],
        ]),
      ],
    }),
    priced({ mvpRefs: ['catalog', 'orders'], laterRefs: ['stripe'] })
  );
  s.eq('cash / pay-at-pickup is not an online payment', dump(cash), '(none)');

  const deskScreen = checkBriefConsistency(
    brief({
      locale: 'ru',
      screens: [
        screen('Касса', [
          ['button', 'Принять оплату'],
          ['table', 'Сегодняшние оплаты', ['Услуга', 'Сумма']],
        ]),
      ],
    }),
    priced({ mvpRefs: ['auth_basic', 'admin_panel'], laterRefs: ['payme', 'click'] })
  );
  s.eq('a cash-desk screen records offline payments', dump(deskScreen), '(none)');

  const soon = checkBriefConsistency(
    brief({
      screens: [
        screen('Profile', [
          ['text', 'Loyalty points — coming soon'],
          ['button', 'Edit profile'],
        ]),
      ],
    }),
    priced()
  );
  s.eq('copy that openly defers ("coming soon") is not a promise', dump(soon), '(none)');

  const negated = checkBriefConsistency(
    brief({
      screens: [
        screen('Tracking link', [
          ['text', 'Open the link, no login needed'],
          ['button', 'Refresh'],
        ]),
      ],
    }),
    priced({ mvpRefs: ['orders'] })
  );
  s.eq('a negated mention ("no login needed") is not a promise', dump(negated), '(none)');
}

s.group('wireframes — words that only look like features');
{
  const r = checkBriefConsistency(
    brief({
      screens: [
        screen('Risk review', [
          ['text', 'Click any flag to see the playbook comparison'],
          ['list', 'Scanned documents', ['Contract A (scanned)']],
          ['table', 'Contracts', ['Payment terms', 'Renewal date']],
        ]),
      ],
    }),
    priced({ mvpRefs: ['file_upload', 'admin_panel'], laterRefs: [] })
  );
  s.eq('"click" in English, "scanned", "payment terms" are not features', dump(r), '(none)');
  const stickers = checkBriefConsistency(
    brief({ locale: 'ru', assumptions: ['Основной канал привлечения — сарафанное радио и офлайн-наклейки на бутылях'] }),
    priced({ laterRefs: ['offline'] })
  );
  s.eq('"офлайн-наклейки" are not offline mode', dump(stickers), '(none)');
  const postponed = checkBriefConsistency(
    brief({ locale: 'ru', assumptions: ['Турникетная интеграция откладывается на growth из-за неизвестного SDK'] }),
    priced({ unpriced: ['Интеграция с китайскими турникетами (SDK неизвестен)'] })
  );
  s.eq('"откладывается" defers', dump(postponed), '(none)');
}

s.group('wireframes — unpriced needs and product context');
{
  const extraction = checkBriefConsistency(
    brief({
      title: 'Contract Intelligence Platform',
      config: { projectType: 'web', subtype: 'saas', platforms: [] },
      screens: [
        screen('Contract review', [
          ['table', 'Extracted key terms', ['Term', 'Value', 'Source clause']],
          ['list', 'Playbook risk flags', ['Liability cap below threshold']],
          ['chat', 'AI assistant answers with citations'],
        ]),
      ],
    }),
    priced({
      product: { projectType: 'web', subtype: 'saas' },
      mvpRefs: ['auth_basic', 'file_upload', 'rag_kb', 'ai_chatbot', 'admin_panel'],
      laterRefs: ['dashboard'],
      unpriced: ['Contract clause extraction pipeline', 'Risk-flagging rules from internal playbook'],
    })
  );
  s.ok(
    'extraction table of an unpriced pipeline → screen_unpriced',
    has(extraction, 'screen_unpriced', 'Contract clause extraction pipeline'),
    dump(extraction)
  );
  s.ok(
    'risk flags of unpriced playbook rules → screen_unpriced',
    has(extraction, 'screen_unpriced', 'Risk-flagging rules from internal playbook'),
    dump(extraction)
  );
  s.ok('the priced AI chat with citations is fine', !extraction.violations.some(v => v.where.endsWith('› chat')), dump(extraction));

  const content = checkBriefConsistency(
    brief({
      screens: [
        screen('Watch', [
          ['video', 'Product demo video'],
          ['button', 'Join'],
        ]),
      ],
    }),
    priced({ unpriced: ['Product demo video production'] })
  );
  s.eq('content production is not software: showing the video is fine', dump(content), '(none)');

  const bot = (unpriced: string[]) =>
    checkBriefConsistency(
      brief({
        locale: 'ru',
        config: { projectType: 'telegram', subtype: 'support_bot', platforms: [] },
        screens: [
          screen(
            'Диалог',
            [
              ['chat', 'Диалог с ботом', ['Здравствуйте!', 'Проверить баланс']],
              ['button', 'Позвать оператора'],
            ],
            { device: 'chat' }
          ),
          screen(
            'Оператор',
            [
              ['header', 'Чат с оператором'],
              ['chat', 'Оператор отвечает'],
            ],
            { device: 'chat' }
          ),
        ],
      }),
      priced({
        product: { projectType: 'telegram', subtype: 'support_bot' },
        mvpRefs: ['ai_chatbot', 'bot_admin', 'custom_api'],
        laterRefs: [],
        unpriced,
      })
    );
  s.eq("a bot's chat frames need no priced chat feature", dump(bot([])), '(none)');
  const handoff = bot(['Чат в приложении']);
  s.ok('…but "chat" explicitly not priced (not offered for bots) is flagged', has(handoff, 'screen_unpriced', 'chat'), dump(handoff));
  s.ok('…on the text that names it, not on every bot message', !handoff.violations.some(v => v.where.includes('"Диалог"')), dump(handoff));

  const landing = checkBriefConsistency(
    brief({
      config: { projectType: 'web', subtype: 'landing', platforms: [] },
      screens: [
        screen('Landing', [
          ['card-grid', 'Key features', ['Automatic payment reminders', 'Export to accounting', 'Client portal login']],
          ['form', 'Join the waitlist', ['Work email']],
          ['button', 'Sign up for the waitlist'],
        ]),
      ],
    }),
    priced({ product: { projectType: 'web', subtype: 'landing' }, mvpRefs: ['analytics_setup'], laterRefs: ['cms'] })
  );
  s.eq("a landing page's marketing copy and waitlist form are not features", dump(landing), '(none)');
}

/* ------------------------------------------------------------------ */
/* 3. Narrative                                                        */
/* ------------------------------------------------------------------ */

s.group('narrative — MVP text');
{
  const r = checkBriefConsistency(
    brief({
      buildFirst: 'An ordering app with cart, Stripe checkout and customer ratings.',
      mvpDeliverables: ['Promo codes at checkout', 'Order history'],
    }),
    priced()
  );
  s.ok('buildFirst promising a LATER item → narrative_later', has(r, 'narrative_later', 'reviews'), dump(r));
  s.ok('an MVP deliverable naming a LATER item → narrative_later', has(r, 'narrative_later', 'promo'), dump(r));
  const deferred = checkBriefConsistency(brief({ buildFirst: 'Ordering and checkout first; ratings come later.' }), priced());
  s.eq('a sentence that defers is fine', dump(deferred), '(none)');
}

/* ------------------------------------------------------------------ */
/* 4. Assumptions                                                      */
/* ------------------------------------------------------------------ */

s.group('assumptions — against the priced scope');
{
  const check = (assumptions: string[], p: Partial<PricedScope> = {}, b: BriefPatch = {}) =>
    checkBriefConsistency(brief({ ...b, assumptions }), priced(p));

  const mailchimp = check(['Waitlist emails stored via Mailchimp'], { unpriced: ['Mailchimp audience sync'] });
  s.ok(
    'an unpriced integration stated as how it works → assumption_unpriced',
    has(mailchimp, 'assumption_unpriced', 'Mailchimp audience sync'),
    dump(mailchimp)
  );
  s.eq('…once (no extra warning for the same clause)', kinds(mailchimp), ['assumption_unpriced']);

  const quickbooks = check(['Invoices pushed to QuickBooks after delivery confirmation'], { unpriced: ['QuickBooks Online invoice sync'] });
  s.ok('"after delivery" is not a deferral', has(quickbooks, 'assumption_unpriced'), dump(quickbooks));

  const negates = check(['Booking is free at launch, no online payment']);
  s.ok(
    '"no online payment" while Stripe is in the MVP → assumption_negates_mvp',
    has(negates, 'assumption_negates_mvp', 'payment'),
    dump(negates)
  );
  s.eq(
    '"payment added later" while Stripe is LATER → fine',
    dump(check(['Payment added later, orders start unpaid'], { mvpRefs: ['catalog', 'orders'], laterRefs: ['stripe'] })),
    '(none)'
  );
  s.eq(
    '"provided by the client" is outside the build',
    dump(check(['Playbook provided by client as structured rules'], { unpriced: ['Risk-flagging rules from internal playbook'] })),
    '(none)'
  );
  const saas = { product: { projectType: 'web' as const, subtype: 'saas' }, mvpRefs: ['ai_chatbot', 'rag_kb'] };
  s.eq(
    'a product-kind "not" is not about the AI feature',
    dump(check(['Web platform, not a standalone AI backend'], saas, { config: { projectType: 'web', subtype: 'saas', platforms: [] } })),
    '(none)'
  );

  const uzNo = checkBriefConsistency(
    brief({ locale: 'uz', assumptions: ["To'lov bot orqali olinmaydi"] }),
    priced({ mvpRefs: ['orders', 'payme'] })
  );
  s.ok('Uzbek post-negation ("to\'lov … olinmaydi") is a negation', has(uzNo, 'assumption_negates_mvp', 'payment'), dump(uzNo));
  const enLater = check(['Payment added later, orders start unpaid']);
  s.ok('"payment added later" while Stripe is in the MVP → negates', has(enLater, 'assumption_negates_mvp', 'payment'), dump(enLater));
  s.eq('…reported once per clause', enLater.violations.filter(v => v.kind === 'assumption_negates_mvp').length, 1);
  s.eq(
    '"cash payments recorded by the driver" is not a negation',
    dump(check(['Оплата наличными фиксируется водителем вручную'], { mvpRefs: ['orders', 'payme'] }, { locale: 'ru' })),
    '(none)'
  );
  const uzFar = checkBriefConsistency(
    brief({ locale: 'uz', assumptions: ['1C sinxronizatsiya bir tomonlama emas'] }),
    priced({ mvpRefs: ['orders', 'onec'] })
  );
  s.eq('…but a negation three words away is about something else', dump(uzFar), '(none)');

  s.eq(
    'a contrast ("…, not subscriptions") is a classification',
    dump(check(['Class packs are prepaid credits, not subscriptions'], { mvpRefs: ['subscriptions', 'stripe'] })),
    '(none)'
  );
  s.eq(
    '"foizsiz" (interest-free) is not a negation',
    dump(
      checkBriefConsistency(
        brief({ locale: 'uz', assumptions: ["Nasiya foizsiz muddatli to'lov orqali"] }),
        priced({ mvpRefs: ['nasiya', 'payme'] })
      )
    ),
    '(none)'
  );
  s.eq(
    'named positively in another clause → not absent',
    dump(check(['SharePoint read access via OAuth; not custom SharePoint add-ins'], { mvpRefs: ['custom_api'] })),
    '(none)'
  );
  s.eq(
    'a negation about one party ("no payments from pet owners") is not absence',
    dump(check(['Public booking page per salon, no payments from pet owners'], { mvpRefs: ['subscriptions', 'stripe'] })),
    '(none)'
  );
  s.eq(
    'the specific concept wins ("SMS reminders added later" with email priced)',
    dump(check(['SMS reminders added later, email only in MVP'], { mvpRefs: ['email_service', 'stripe'] })),
    '(none)'
  );
  s.eq(
    '"cannot work without one" does not negate what precedes it',
    dump(check(['Accounts, payments and chat cannot work without one'], { mvpRefs: ['auth_basic', 'chat', 'stripe'] })),
    '(none)'
  );
  s.eq(
    'an assumption that says it is unpriced is honest',
    dump(check(['Web version listed as unpriced pending scope clarification'], { unpriced: ['Web version of the app'] })),
    '(none)'
  );
  const twilio = check(['SMS reminders sent via a US provider like Twilio'], {
    mvpRefs: ['custom_api', 'email_service'],
    unpriced: ['US SMS reminder provider (e.g. Twilio)'],
  });
  s.ok(
    'a brand stays distinctive even when another custom API is priced',
    has(twilio, 'assumption_unpriced', 'US SMS reminder provider (e.g. Twilio)'),
    dump(twilio)
  );
  const insurer = checkBriefConsistency(
    brief({
      screens: [
        screen('Intake', [
          ['form', 'Insurance details', ['Insurance provider', 'Member ID']],
          ['button', 'Submit'],
        ]),
      ],
    }),
    priced({ mvpRefs: ['custom_api', 'email_service', 'orders'], unpriced: ['US SMS reminder provider (e.g. Twilio)'] })
  );
  s.eq('…and a generic word ("provider") alone is not a match', dump(insurer), '(none)');
  const synced = checkBriefConsistency(
    brief({
      integrations: [
        { id: 'custom_api', phase: 'mvp', note: 'SharePoint sync with permission-aware access', labelKey: 'integration.custom_api' },
      ],
      screens: [
        screen('Library', [
          ['list', 'Synced from SharePoint', ['Legal/MSAs']],
          ['button', 'Reconnect SharePoint'],
        ]),
      ],
    }),
    priced({ mvpRefs: ['custom_api', 'rag_kb'], unpriced: ['SharePoint permission model mapping'] })
  );
  s.eq('a brand the priced custom API connects is not "unpriced"', dump(synced), '(none)');
  const later = check(['Customers earn loyalty points on every order'], { laterRefs: [] });
  s.ok(
    'a feature priced nowhere stated as fact → warning',
    has(later, 'assumption_not_in_scope', 'loyalty') && later.errors === 0,
    dump(later)
  );
  const laterRef = check(['Promo codes run every weekend'], {});
  s.ok(
    'a LATER feature stated as fact → assumption_later (warning)',
    has(laterRef, 'assumption_later', 'promo') && laterRef.errors === 0,
    dump(laterRef)
  );
}

s.group('assumptions — engine config claims');
{
  const cfg = (assumptions: string[], config: BriefPatch['config'], p: Partial<PricedScope> = {}) =>
    checkBriefConsistency(brief({ assumptions, config }), priced(p));
  s.eq('claimedLanguages: "One language, English"', claimedLanguages('One language, English'), 1);
  s.eq('claimedLanguages: "Interfeys o\'zbek va rus tillarida"', claimedLanguages("Interfeys o'zbek va rus tillarida"), 2);
  s.eq('claimedLanguages: "Контент создаётся на трёх языках"', claimedLanguages('Контент создаётся на трёх языках'), 3);
  s.eq('claimedLanguages: documents, not the interface → no claim', claimedLanguages('English-language contracts only'), null);

  s.ok(
    '"One language, English" while the engine priced 2 → assumption_config',
    has(cfg(['One language, English'], { languages: 2 }), 'assumption_config')
  );
  s.eq('"Interface in Uzbek and Russian" with 2 priced → fine', dump(cfg(['Interface in Uzbek and Russian'], { languages: 2 })), '(none)');
  s.eq(
    'an enumeration is one claim ("English, Russian and Uzbek interfaces")',
    dump(cfg(['English, Russian and Uzbek interfaces required'], { languages: 3 })),
    '(none)'
  );
  s.eq(
    '"English interface first; Arabic can be added later" with 1 → fine',
    dump(cfg(['English interface first; Arabic can be added later'], { languages: 1 })),
    '(none)'
  );
  s.ok('"iOS only" while both platforms are priced → assumption_config', has(cfg(['iOS only at launch'], {}), 'assumption_config'));
  s.eq('"iOS and Android from day one" with both → fine', dump(cfg(['iOS and Android from day one'], {})), '(none)');
  const web = { projectType: 'web' as const, subtype: 'ecommerce', platforms: [] };
  s.ok(
    '"one mobile app" for a web product → assumption_config',
    has(cfg(['One mobile app for customers'], web, { product: { projectType: 'web', subtype: 'ecommerce' } }), 'assumption_config')
  );
  s.eq(
    '"mobile app later" for a web product → fine (deferred)',
    dump(cfg(["Avval veb-do'kon quriladi, mobil ilova keyin"], web, { product: { projectType: 'web', subtype: 'ecommerce' } })),
    '(none)'
  );
}

/* ------------------------------------------------------------------ */
/* 5. Framing leaks                                                    */
/* ------------------------------------------------------------------ */

s.group('framing leaks');
{
  const leak = checkBriefConsistency(
    brief({
      canWait: [
        { item: 'IFTA reporting', reason: 'A separate problem the visitor himself flagged as later.', inEstimate: false },
        { item: 'QuickBooks sync', reason: 'Outside the priced scope for now.', inEstimate: false },
      ],
    }),
    priced()
  );
  s.ok(
    '"the visitor himself" → framing_leak error',
    leak.violations.some(v => v.kind === 'framing_leak' && v.severity === 'error' && /visitor/.test(v.subject)),
    dump(leak)
  );
  s.ok(
    '"priced scope" jargon → framing_leak warning',
    leak.violations.some(v => v.kind === 'framing_leak' && v.severity === 'warn'),
    dump(leak)
  );
  const visitors = checkBriefConsistency(
    brief({ canWait: [{ item: 'Museum tours', reason: 'Site visitors can book tours later.', inEstimate: false }] }),
    priced()
  );
  s.eq('"site visitors" as an audience is not a leak', dump(visitors), '(none)');
}

/* ------------------------------------------------------------------ */
/* 6. Harness maths (scripts/lib/aiBriefEval.ts)                       */
/* ------------------------------------------------------------------ */

s.group('harness — expectation tags');
{
  const b = brief({ assumptions: ['Waitlist emails stored via Mailchimp'] });
  const run: RunView = {
    outcome: { status: 'ok', brief: b },
    scope: null,
    priced: priced({ unpriced: ['Mailchimp audience sync'] }),
    scrubbedIdea: 'idea',
    attempts: [],
  };
  const c: EvalCase = {
    id: 'x',
    locale: 'en',
    category: 'test',
    idea: 'idea',
    expect: {
      status: 'ok',
      productTypes: ['mobile'],
      mustIncludeMvp: [['payme', 'stripe']],
      mustInclude: [['email_service', 'custom_api'], 'reviews'],
      mustNotInclude: ['payme'],
      mustNotIncludeMvp: ['reviews'],
      mustLand: [{ label: 'Mailchimp', refs: ['email_service'], unpriced: 'mailchimp' }],
    },
  };
  const { checks, consistency } = checksFor(c, run);
  const result = (name: string) => checks.find(ch => ch.name === name)?.ok;
  s.eq('any-of in the MVP', result('in MVP: payme|stripe'), true);
  s.eq('any-of priced anywhere (missing → fails)', result('priced: email_service|custom_api'), false);
  s.eq('a LATER ref counts as priced', result('priced: reviews'), true);
  s.eq('must not be priced', result('not priced: payme'), true);
  s.eq('LATER is not MVP', result('not in MVP: reviews'), true);
  s.eq('lands in the not-priced list', result('lands: Mailchimp'), true);
  s.eq('consistency errors fail the case', result('consistency: no errors'), false);
  s.ok('the consistency report is returned', !!consistency && consistency.errors === 1);
  s.ok(
    'warnings are marked as such',
    checks.filter(ch => ch.warn).every(ch => ch.name.includes('warnings') || ch.name.includes('loanwords'))
  );

  const declined = checksFor(
    { ...c, expect: { status: 'declined_policy', policyTopics: ['gambling'] } },
    { ...run, outcome: { status: 'declined_policy', topics: ['gambling', 'speculative_crypto'], note: '' } }
  );
  s.ok(
    'a decline checks status and topic only',
    declined.checks.every(ch => ch.ok) && declined.consistency === null,
    JSON.stringify(declined.checks)
  );
}

s.group('harness — variance and summaries');
{
  s.eq('CV of identical values is 0', coefficientOfVariation([100, 100, 100]), 0);
  s.ok('CV grows with spread', coefficientOfVariation([100, 200]) > coefficientOfVariation([100, 110]));
  s.eq(
    'Jaccard of identical sets is 1',
    meanJaccard([
      ['a', 'b'],
      ['b', 'a'],
    ]),
    1
  );
  s.eq('Jaccard of {a,b} vs {a} is 0.5', meanJaccard([['a', 'b'], ['a']]), 0.5);

  const row = (repeat: number, patch: Partial<CaseResult>): CaseResult => ({
    id: 'case',
    variant: 'a',
    repeat,
    locale: 'en',
    category: 't',
    status: 'ok',
    product: 'mobile:ecommerce',
    model: 'kimi-k3',
    ms: 40_000,
    partMs: { scope: 15_000, plan: 12_000, risks: 8_000, screensMain: 20_000, screensRest: 10_000 },
    costUsd: 0.07,
    promptTokens: 0,
    completionTokens: 0,
    reasoningTokens: 0,
    failedChecks: [],
    warnings: [],
    consistency: { errors: 0, warnings: 0, kinds: [], coverage: 1 },
    mvpPrice: { min: 1000, max: 2000 },
    mvpWeeks: { min: 4, max: 6 },
    mvpRefs: ['a', 'b'],
    laterRefs: [],
    screens: 5,
    price: null,
    weeks: null,
    ...patch,
  });
  const rows = [
    row(1, {}),
    row(2, {
      mvpPrice: { min: 1400, max: 2600 },
      mvpRefs: ['a', 'b', 'c'],
      screens: 6,
      consistency: { errors: 2, warnings: 0, kinds: ['screen_later', 'screen_later'], coverage: 0.5 },
    }),
    row(3, { product: 'web:ecommerce', failedChecks: ['product type (web:ecommerce)'] }),
  ];
  const v = caseVariance(rows);
  s.eq('price midpoint range', [v.mvpPrice?.min, v.mvpPrice?.max], [1500, 2000]);
  s.ok('price CV > 0', (v.mvpPrice?.cv ?? 0) > 0);
  s.eq('screens range', v.screens, { min: 5, max: 6 });
  s.eq('refs priced every time vs sometimes', [v.mvpRefs.always, v.mvpRefs.sometimes], [['a', 'b'], { c: 1 }]);
  s.eq('failed checks tallied without details', v.failedChecks, { 'product type': 1 });

  const summary = summarizeVariant('a', rows);
  s.eq('product flips detected', summary.stability?.productFlips, ['case']);
  s.eq('consistency errors per brief', summary.consistency.errorsPerBrief, 0.667);
  s.eq('after the scope = the slowest parallel call', summary.afterScopeMsP50, 20_000);
  s.eq('parallel saving = sum of the parallel calls − the slowest', summary.parallelSavingMsP50, 30_000);
  s.eq('no guard data on old rows', [summary.consistency.beforeGuard, summary.consistency.guardRemovedPerBrief], [null, null]);
  const guarded = summarizeVariant('g', [
    row(1, {
      consistencyBefore: { errors: 3, warnings: 0, kinds: ['summary_unpriced', 'screen_unpriced', 'screen_unpriced'] },
      guardRemoved: 4,
    }),
    row(2, { consistencyBefore: { errors: 0, warnings: 1, kinds: ['screen_not_in_scope'] }, guardRemoved: 0 }),
  ]);
  s.eq('errors before the guard per brief', guarded.consistency.beforeGuard?.errorsPerBrief, 1.5);
  s.eq('briefs with errors before the guard', guarded.consistency.beforeGuard?.briefsWithErrors, 1);
  s.eq('guard removals per brief', guarded.consistency.guardRemovedPerBrief, 2);
  s.eq('cost per brief', summary.costUsd.perBrief, 0.07);
}

process.exit(s.report());
