/**
 * Estimator logic suite — no browser, no server, no network.
 *
 *   yarn test:estimator:logic
 *
 * Everything the estimator promises that can be checked without rendering:
 * catalogue integrity, translation coverage, the pricing formula's invariants,
 * and — the reason this file exists — that navigating the wizard back and forth
 * cannot change the price. Each group maps to a way the calculator was observed
 * to misbehave in front of real clients.
 */
import {
  FEATURES,
  FEATURE_CATEGORIES,
  INTEGRATIONS,
  INTEGRATION_GROUPS,
  SERVICES,
  TECH,
  TECH_GROUPS,
  featuresFor,
  getService,
  getSubtype,
  integrationsFor,
  techFor,
} from '../../src/modules/estimator/data/catalog';
import type { EstimatorInput, ProjectType, Tier, Urgency } from '../../src/modules/estimator/types';
import { calculateEstimate, clampAiRange, marginalCost } from '../../src/modules/estimator/utils/estimator';
import { sanitizeEstimatorInput } from '../../src/modules/estimator/utils/sanitize';
import {
  initialInput,
  normalizeInput,
  selectProjectType,
  selectSubtype,
  setAutoTech,
  setDesign,
  setLanguages,
  setScreens,
  setTier,
  setUrgency,
  toggleFeature,
  toggleIntegration,
  togglePlatform,
  toggleTech,
} from '../../src/modules/estimator/utils/wizardState';
import en from '../../src/messages/en.json';
import ru from '../../src/messages/ru.json';
import uz from '../../src/messages/uz.json';
import { Suite, range, usd } from './harness';

const s = new Suite('estimator-logic');

const TYPES: ProjectType[] = SERVICES.map(service => service.id);
const TIERS: Tier[] = ['mvp', 'standard', 'enterprise'];
const URGENCIES: Urgency[] = ['flexible', 'normal', 'rush'];

/** Every (type, subtype) pair in the catalogue, as a fresh wizard state. */
const ALL_CONFIGS: { label: string; input: EstimatorInput }[] = TYPES.flatMap(type =>
  getService(type).subtypes.map(subtype => ({
    label: `${type}/${subtype.id}`,
    input: selectSubtype(initialInput(type), subtype.id),
  }))
);

const cost = (input: EstimatorInput) => calculateEstimate(input).cost;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ------------------------------------------------------------------ */
/* 1. Catalogue integrity                                             */
/* ------------------------------------------------------------------ */

s.group('catalogue');

{
  const ids = <T extends { id: string }>(list: readonly T[]) => list.map(x => x.id);
  const dupes = (list: string[]) => list.filter((id, i) => list.indexOf(id) !== i);

  s.eq('feature ids are unique', dupes(ids(FEATURES)), []);
  s.eq('integration ids are unique', dupes(ids(INTEGRATIONS)), []);
  s.eq('tech ids are unique', dupes(ids(TECH)), []);
  s.eq(
    'subtype ids are unique within a service',
    SERVICES.flatMap(service => dupes(ids(service.subtypes)).map(id => `${service.id}/${id}`)),
    []
  );

  // A pre-ticked feature that the service does not offer would be selected,
  // invisible in the Features step, and skipped by the formula.
  const orphanPopulars = SERVICES.flatMap(service =>
    service.subtypes.flatMap(subtype =>
      subtype.popular
        .filter(id => {
          const feature = FEATURES.find(f => f.id === id);
          return !feature || !feature.types.includes(service.id);
        })
        .map(id => `${service.id}/${subtype.id} → ${id}`)
    )
  );
  s.eq('every pre-selected "popular" feature is offered for its service', orphanPopulars, []);

  const badScreens = SERVICES.flatMap(service =>
    service.subtypes
      .filter(st => (st.maxScreens === 0 ? st.defaultScreens !== 0 : st.defaultScreens < 1 || st.defaultScreens > st.maxScreens))
      .map(st => `${service.id}/${st.id}: default ${st.defaultScreens} vs max ${st.maxScreens}`)
  );
  s.eq('defaultScreens sits inside [1, maxScreens]', badScreens, []);

  const emptySteps = TYPES.flatMap(type => {
    const problems: string[] = [];
    if (featuresFor(type).length === 0) problems.push(`${type}: no features`);
    if (integrationsFor(type).length === 0) problems.push(`${type}: no integrations`);
    if (techFor(type).length === 0) problems.push(`${type}: no technologies`);
    return problems;
  });
  s.eq('no service renders an empty step', emptySteps, []);
}

/* ------------------------------------------------------------------ */
/* 2. Translations — ids double as i18n keys                          */
/* ------------------------------------------------------------------ */

s.group('translations');

{
  const bundles: [string, Record<string, unknown>][] = [
    ['en', (en as Record<string, Record<string, unknown>>).estimator],
    ['ru', (ru as Record<string, Record<string, unknown>>).estimator],
    ['uz', (uz as Record<string, Record<string, unknown>>).estimator],
  ];

  const expected = [
    ...SERVICES.flatMap(service => service.subtypes.map(st => `subtype.${st.id}`)),
    ...FEATURES.map(f => `feature.${f.id}`),
    ...INTEGRATIONS.map(i => `integration.${i.id}`),
    ...FEATURE_CATEGORIES.map(c => `category.${c}`),
    ...INTEGRATION_GROUPS.map(g => `intGroup.${g}`),
    ...TECH_GROUPS.map(g => `techGroup.${g}`),
  ];

  for (const [locale, bundle] of bundles) {
    const missing = expected.filter(key => {
      const [head, tail] = key.split('.');
      const group = bundle?.[head] as Record<string, unknown> | undefined;
      const value = group?.[tail];
      return typeof value !== 'string' || value.trim() === '';
    });
    s.eq(`${locale}: every catalogue id has a translation`, missing, []);
  }

  // The three bundles must stay in lockstep or a locale silently falls back.
  const keysOf = (bundle: Record<string, unknown>): string[] =>
    Object.entries(bundle ?? {}).flatMap(([key, value]) =>
      value && typeof value === 'object' ? Object.keys(value as object).map(sub => `${key}.${sub}`) : [key]
    );
  const enKeys = keysOf(bundles[0][1]);
  for (const [locale, bundle] of bundles.slice(1)) {
    const localeKeys = new Set(keysOf(bundle));
    s.eq(
      `${locale}: no key missing vs en`,
      enKeys.filter(k => !localeKeys.has(k)),
      []
    );
  }
}

/* ------------------------------------------------------------------ */
/* 3. Formula sanity for every catalogue configuration                */
/* ------------------------------------------------------------------ */

s.group('formula sanity');

for (const { label, input } of ALL_CONFIGS) {
  const e = calculateEstimate(input);
  const def = getSubtype(input.projectType, input.subtype);
  const finite = [e.cost.min, e.cost.max, e.hours.min, e.hours.max, e.weeks.min, e.weeks.max, e.supportMonthly, e.midCost].every(
    n => Number.isFinite(n) && n > 0
  );
  s.ok(`${label}: every number is finite and positive`, finite, JSON.stringify(e));
  s.ok(`${label}: cost.min < cost.max`, e.cost.min < e.cost.max, range(e.cost));
  s.ok(`${label}: hours.min <= hours.max`, e.hours.min <= e.hours.max, `${e.hours.min}–${e.hours.max}h`);
  s.ok(`${label}: weeks.min < weeks.max`, e.weeks.min < e.weeks.max, `${e.weeks.min}–${e.weeks.max}w`);
  s.ok(`${label}: cost.min respects the subtype floor`, e.cost.min >= def.minPrice, `${usd(e.cost.min)} < floor ${usd(def.minPrice)}`);
  s.ok(
    `${label}: every selected feature is priced`,
    input.features.every(id => e.breakdown.some(line => line.id === id)),
    `selected ${input.features.join(',')} / priced ${e.breakdown.map(b => b.id).join(',')}`
  );
}

/* ------------------------------------------------------------------ */
/* 4. Monotonicity — more scope never costs less                      */
/* ------------------------------------------------------------------ */

s.group('monotonicity');

for (const { label, input } of ALL_CONFIGS) {
  const base = cost(input);

  const cheaperFeature = featuresFor(input.projectType)
    .filter(f => !input.features.includes(f.id))
    .find(f => {
      const next = cost(toggleFeature(input, f.id));
      return next.min < base.min || next.max < base.max;
    });
  s.ok(`${label}: no feature makes the project cheaper`, !cheaperFeature, `adding ${cheaperFeature?.id} lowered ${range(base)}`);

  const cheaperIntegration = integrationsFor(input.projectType).find(i => {
    const next = cost(toggleIntegration(input, i.id));
    return next.min < base.min || next.max < base.max;
  });
  s.ok(
    `${label}: no integration makes the project cheaper`,
    !cheaperIntegration,
    `adding ${cheaperIntegration?.id} lowered ${range(base)}`
  );

  // Tier, languages and design all scale scope upward.
  const byTier = TIERS.map(tier => cost(setTier(input, tier)));
  s.ok(
    `${label}: mvp <= standard <= enterprise`,
    byTier[0].min <= byTier[1].min && byTier[1].min <= byTier[2].min,
    byTier.map(range).join(' | ')
  );

  const byLanguages = [1, 2, 3].map(n => cost(setLanguages(input, n)));
  s.ok(
    `${label}: more languages never costs less`,
    byLanguages[0].min <= byLanguages[1].min && byLanguages[1].min <= byLanguages[2].min,
    byLanguages.map(range).join(' | ')
  );

  const byDesign = (['ready', 'template', 'custom'] as const).map(d => cost(setDesign(input, d)));
  s.ok(
    `${label}: ready <= template <= custom design`,
    byDesign[0].min <= byDesign[1].min && byDesign[1].min <= byDesign[2].min,
    byDesign.map(range).join(' | ')
  );

  const def = getSubtype(input.projectType, input.subtype);
  if (def.maxScreens > 0) {
    let previous = -Infinity;
    let regression = '';
    for (let n = Math.max(1, def.includedScreens); n <= def.maxScreens; n++) {
      const value = cost(setScreens(input, n)).min;
      if (value < previous) regression = `${n} screens: ${usd(value)} < ${usd(previous)}`;
      previous = value;
    }
    s.ok(`${label}: dragging the screens slider up never lowers the price`, regression === '', regression);
  }
}

/* ------------------------------------------------------------------ */
/* 5. Timeline — the calendar has to behave like a calendar           */
/* ------------------------------------------------------------------ */

s.group('timeline');

{
  // A step-function velocity used to make the schedule jump DOWN when scope
  // crossed a band edge: 120 h took 4 weeks, 121 h took 3. Sweep effort
  // continuously — screens on the biggest subtype crosses every band.
  for (const [type, subtypeId] of [
    ['web', 'crm'],
    ['mobile', 'ecommerce'],
    ['telegram', 'miniapp'],
  ] as const) {
    const sweep = selectSubtype(initialInput(type), subtypeId);
    const def = getSubtype(type, subtypeId);
    let inversion = '';
    let previousWeeks = 0;
    for (let screens = Math.max(1, def.includedScreens); screens <= def.maxScreens; screens++) {
      for (const tier of TIERS) {
        const weeks = calculateEstimate(setTier(setScreens(sweep, screens), tier)).weeks.min;
        if (weeks < previousWeeks) inversion = `${type}/${subtypeId} ${screens} screens (${tier}): ${weeks}w after ${previousWeeks}w`;
        previousWeeks = weeks;
      }
      previousWeeks = calculateEstimate(setScreens(sweep, screens)).weeks.min;
    }
    s.ok(`${type}/${subtypeId}: adding scope never shortens the timeline`, inversion === '', inversion);
  }

  // The reported flow: drop a platform and the project gets cheaper — it must
  // not simultaneously get longer.
  const both = initialInput('mobile');
  const single = togglePlatform(both, 'ios');
  const bothEstimate = calculateEstimate(both);
  const singleEstimate = calculateEstimate(single);
  s.ok(
    'dropping a platform never lengthens the timeline',
    singleEstimate.weeks.min <= bothEstimate.weeks.min && singleEstimate.weeks.max <= bothEstimate.weeks.max,
    `${singleEstimate.weeks.min}–${singleEstimate.weeks.max}w vs ${bothEstimate.weeks.min}–${bothEstimate.weeks.max}w`
  );
}

for (const { label, input } of ALL_CONFIGS) {
  const byUrgency = URGENCIES.map(u => calculateEstimate(setUrgency(input, u)));
  const [flexible, normal, rush] = byUrgency;
  s.ok(
    `${label}: rush <= normal <= flexible weeks`,
    rush.weeks.min <= normal.weeks.min && normal.weeks.min <= flexible.weeks.min,
    `${rush.weeks.min} / ${normal.weeks.min} / ${flexible.weeks.min}`
  );
  s.ok(
    `${label}: rush costs more than normal`,
    rush.cost.min >= normal.cost.min && normal.cost.min >= flexible.cost.min,
    `${usd(rush.cost.min)} / ${usd(normal.cost.min)} / ${usd(flexible.cost.min)}`
  );
  // Paying the rush premium must buy actual calendar wherever there is any to buy.
  if (normal.weeks.min > 1) {
    s.ok(
      `${label}: rush is strictly faster when the schedule allows`,
      rush.weeks.min < normal.weeks.min,
      `${rush.weeks.min}w vs ${normal.weeks.min}w`
    );
  }
  // Urgency is a delivery premium, not a permanently pricier product.
  s.eq(`${label}: urgency does not change the support retainer`, rush.supportMonthly, normal.supportMonthly);
  // A deadline preference must not appear to hire people.
  s.eq(`${label}: urgency does not change the suggested team`, rush.team, normal.team);
}

/* ------------------------------------------------------------------ */
/* 6. Wizard navigation — the reported bug                            */
/* ------------------------------------------------------------------ */

s.group('navigation: A → B → A returns to A');

for (const type of TYPES) {
  const subtypes = getService(type).subtypes.map(st => st.id);
  const start = initialInput(type);

  for (const first of subtypes) {
    const a = selectSubtype(start, first);
    const priceA = cost(a);
    for (const second of subtypes) {
      if (second === first) continue;
      const roundTrip = selectSubtype(selectSubtype(a, second), first);
      s.ok(
        `${type}: ${first} → ${second} → ${first} keeps the price`,
        same(cost(roundTrip), priceA),
        `${range(priceA)} became ${range(cost(roundTrip))} (features ${a.features.length} → ${roundTrip.features.length})`
      );
    }
  }

  // Browsing the whole subtype list and coming back is the comparison
  // shopper's natural path — and the one that used to inflate the quote.
  const first = subtypes[0];
  const browsed = subtypes.reduce((acc, id) => selectSubtype(acc, id), selectSubtype(start, first));
  const back = selectSubtype(browsed, first);
  s.ok(
    `${type}: browsing every subtype and returning keeps the price`,
    same(cost(back), cost(selectSubtype(start, first))),
    `${range(cost(selectSubtype(start, first)))} became ${range(cost(back))}`
  );
}

for (const type of TYPES) {
  for (const other of TYPES) {
    if (other === type) continue;
    const start = initialInput(type);
    const roundTrip = selectProjectType(selectProjectType(start, other), type);
    s.ok(
      `${type} → ${other} → ${type} keeps the price`,
      same(cost(roundTrip), cost(start)),
      `${range(cost(start))} became ${range(cost(roundTrip))}`
    );
  }
}

s.group('navigation: nothing is silently destroyed');

{
  // A fully configured project, then a detour through another service.
  const configured = setUrgency(
    setLanguages(setDesign(setTier(toggleIntegration(initialInput('mobile'), 'payme'), 'enterprise'), 'template'), 3),
    'rush'
  );
  const detour = selectProjectType(selectProjectType(configured, 'web'), 'mobile');

  s.eq('tier survives a project-type detour', detour.tier, configured.tier);
  s.eq('design survives a project-type detour', detour.design, configured.design);
  s.eq('languages survive a project-type detour', detour.languages, configured.languages);
  s.eq('urgency survives a project-type detour', detour.urgency, configured.urgency);
  s.eq('integrations survive a project-type detour', detour.integrations, configured.integrations);

  // Re-tapping the already-selected card must be inert.
  const twice = selectSubtype(configured, configured.subtype);
  s.ok('re-selecting the current subtype changes nothing', same(twice, configured), JSON.stringify({ before: configured, after: twice }));
  const sameType = selectProjectType(configured, configured.projectType);
  s.ok('re-selecting the current project type changes nothing', same(sameType, configured), 'input changed');

  // Untick a recommended feature, wander off, come back: it may be re-seeded,
  // but the *user's own* additions must never disappear.
  const withExtra = toggleFeature(configured, 'chat');
  const wandered = selectSubtype(selectSubtype(withExtra, 'delivery'), configured.subtype);
  s.ok('a feature the user added survives subtype browsing', wandered.features.includes('chat'), wandered.features.join(','));

  // A screen count the user set is a fact about their project.
  const resized = setScreens(configured, 30);
  const afterSwitch = selectSubtype(resized, 'delivery');
  s.eq('a screen count the user set survives a subtype change', afterSwitch.screens, 30);
  const untouched = selectSubtype(configured, 'delivery');
  s.eq('an untouched screen count is re-seeded from the new subtype', untouched.screens, getSubtype('mobile', 'delivery').defaultScreens);
}

s.group('navigation: state stays valid');

{
  // Walk a long, adversarial click path and assert the invariants at each step.
  let input = initialInput('mobile');
  const path: string[] = [];
  const visit = (step: string) => {
    path.push(step);
    const problems: string[] = [];
    const service = getService(input.projectType);
    const validFeatures = new Set(featuresFor(input.projectType).map(f => f.id));
    const validIntegrations = new Set(integrationsFor(input.projectType).map(i => i.id));
    const validTech = new Set(techFor(input.projectType).map(t => t.id));
    const def = getSubtype(input.projectType, input.subtype);

    if (!service.subtypes.some(st => st.id === input.subtype)) problems.push('subtype not in service');
    if (input.features.some(id => !validFeatures.has(id))) problems.push('feature not offered for this service');
    if (input.integrations.some(id => !validIntegrations.has(id))) problems.push('integration not offered');
    if (input.techStack.some(id => !validTech.has(id))) problems.push('technology not offered');
    if (input.projectType === 'mobile' ? input.platforms.length === 0 : input.platforms.length > 0)
      problems.push('platforms wrong for service');
    if (def.maxScreens === 0 ? input.screens !== 0 : input.screens < 1 || input.screens > def.maxScreens)
      problems.push('screens out of bounds');
    if (input.autoTech !== (input.techStack.length === 0)) problems.push('autoTech contradicts the stack');
    if (input.languages < 1 || input.languages > 3) problems.push('languages out of bounds');

    // Everything the sidebar counts must be something the formula charges for.
    const priced = new Set(calculateEstimate(input).breakdown.map(line => line.id));
    if (input.features.some(id => !priced.has(id))) problems.push('a counted feature is not priced');
    if (input.integrations.some(id => !priced.has(id))) problems.push('a counted integration is not priced');

    s.ok(`valid after: ${step}`, problems.length === 0, `${problems.join('; ')}\npath: ${path.join(' → ')}`);
  };

  visit('initial');
  input = togglePlatform(input, 'ios');
  visit('drop iOS');
  input = togglePlatform(input, 'android');
  visit('try to drop the last platform');
  input = toggleTech(input, 'flutter');
  visit('pick Flutter');
  input = toggleIntegration(input, 'payme');
  visit('add Payme');
  input = toggleFeature(input, 'chat');
  visit('add chat');
  input = selectSubtype(input, 'delivery');
  visit('subtype → delivery');
  input = selectProjectType(input, 'telegram');
  visit('service → telegram');
  input = selectSubtype(input, 'info_bot');
  visit('subtype → info bot');
  input = selectProjectType(input, 'desktop');
  visit('service → desktop');
  input = toggleTech(input, 'electron');
  visit('pick Electron');
  input = setAutoTech(input);
  visit('back to "agency picks"');
  input = selectProjectType(input, 'mobile');
  visit('service → mobile');
}

s.group('navigation: the last platform cannot be turned off');

{
  const mobile = initialInput('mobile');
  const single = togglePlatform(mobile, 'ios');
  s.eq('dropping one platform leaves the other', single.platforms, ['android']);
  s.eq('dropping the last platform is refused', togglePlatform(single, 'android').platforms, ['android']);
  s.ok('one platform costs less than two', cost(single).min < cost(mobile).min, `${range(cost(single))} vs ${range(cost(mobile))}`);
}

/* ------------------------------------------------------------------ */
/* 7. Client and server must price the same input identically         */
/* ------------------------------------------------------------------ */

s.group('client/server parity');

for (const { label, input } of ALL_CONFIGS) {
  // What the browser holds, round-tripped through the API's validation.
  const overWire = sanitizeEstimatorInput(JSON.parse(JSON.stringify(input)));
  s.ok(`${label}: survives the API sanitizer`, overWire !== null, 'sanitizer returned null');
  if (overWire) {
    s.ok(
      `${label}: sanitizer does not alter a wizard state`,
      same(overWire, input),
      `${JSON.stringify(input)}\n→ ${JSON.stringify(overWire)}`
    );
    s.ok(
      `${label}: the API would quote the same price`,
      same(cost(overWire), cost(input)),
      `${range(cost(input))} vs ${range(cost(overWire))}`
    );
  }
}

{
  // Hostile / stale payloads must degrade, never throw and never out-price.
  const junk: unknown[] = [
    null,
    'nope',
    42,
    {},
    { projectType: 'mobile' },
    { projectType: 'nope', subtype: 'ecommerce' },
    {
      projectType: 'mobile',
      subtype: 'not-a-subtype',
      screens: -5,
      languages: 99,
      features: ['made-up', 'catalog'],
      platforms: ['windows'],
    },
    { projectType: 'telegram', subtype: 'info_bot', screens: 40, features: ['courier_tracking'], integrations: ['payme', 'payme'] },
    { projectType: 'web', subtype: 'landing', techStack: ['swift'], autoTech: false, description: 'x'.repeat(5000) },
  ];
  for (const payload of junk) {
    const label = JSON.stringify(payload)?.slice(0, 60) ?? String(payload);
    const result = sanitizeEstimatorInput(payload);
    if (result === null) {
      s.ok(`rejects ${label}`, true);
      continue;
    }
    const normalized = normalizeInput(result);
    s.ok(
      `${label}: sanitized output is already canonical`,
      same(result, normalized),
      `${JSON.stringify(result)}\n→ ${JSON.stringify(normalized)}`
    );
    const e = calculateEstimate(result);
    s.ok(`${label}: still prices sanely`, e.cost.min > 0 && e.cost.min < e.cost.max, range(e.cost));
  }
}

/* ------------------------------------------------------------------ */
/* 8. Chip price hints must match what the chip actually does         */
/* ------------------------------------------------------------------ */

s.group('price hints');

for (const { label, input } of ALL_CONFIGS.filter((_, i) => i % 3 === 0)) {
  for (const feature of featuresFor(input.projectType).slice(0, 8)) {
    const hint = marginalCost(input, 'features', feature.id);
    const before = calculateEstimate(input).midCost;
    const after = calculateEstimate(toggleFeature(input, feature.id)).midCost;
    const actual = input.features.includes(feature.id) ? before - after : after - before;
    s.ok(
      `${label}/${feature.id}: the hint equals the real change`,
      Math.abs(hint - actual) < 0.5,
      `hint ${usd(hint)} vs actual ${usd(actual)}`
    );
    s.ok(`${label}/${feature.id}: the hint is positive`, hint > 0, `${usd(hint)}`);
  }
  for (const integration of integrationsFor(input.projectType).slice(0, 5)) {
    const hint = marginalCost(input, 'integrations', integration.id);
    s.ok(`${label}/${integration.id}: integration hint is positive`, hint > 0, `${usd(hint)}`);
  }
}

/* ------------------------------------------------------------------ */
/* 9. The AI "second opinion" may not contradict the number above it  */
/* ------------------------------------------------------------------ */

s.group('ai clamp');

{
  const formula = calculateEstimate(initialInput('mobile'));
  const wild = [
    { costMin: 1, costMax: 2, weeksMin: 1, weeksMax: 1 },
    { costMin: 9_999_999, costMax: 99_999_999, weeksMin: 200, weeksMax: 300 },
    { costMin: formula.cost.max, costMax: formula.cost.min, weeksMin: 9, weeksMax: 2 },
    { costMin: formula.cost.min, costMax: formula.cost.min, weeksMin: 4, weeksMax: 4 },
  ];
  for (const ai of wild) {
    const clamped = clampAiRange(ai, formula);
    const tag = JSON.stringify(ai).slice(0, 48);
    s.ok(`${tag}: min < max`, clamped.cost.min < clamped.cost.max, range(clamped.cost));
    s.ok(`${tag}: weeks min < max`, clamped.weeks.min < clamped.weeks.max, `${clamped.weeks.min}–${clamped.weeks.max}`);
    s.ok(
      `${tag}: overlaps the formula range on screen`,
      clamped.cost.min <= formula.cost.max && clamped.cost.max >= formula.cost.min,
      `${range(clamped.cost)} vs formula ${range(formula.cost)}`
    );
  }
}

/* ------------------------------------------------------------------ */
/* 10. Reference scenarios stay inside their market bands             */
/* ------------------------------------------------------------------ */

s.group('market calibration');

{
  // Guards against a refactor quietly re-pricing the product. Bands are the
  // Tashkent-market targets from scripts/estimator-calibration.ts, widened to
  // the tolerance that script already treats as "sensibly near".
  const BANDS: { label: string; input: EstimatorInput; min: number; max: number }[] = [
    { label: 'landing', input: selectSubtype(initialInput('web'), 'landing'), min: 250, max: 900 },
    { label: 'corporate (standard)', input: setTier(selectSubtype(initialInput('web'), 'corporate'), 'standard'), min: 700, max: 2000 },
    { label: 'web shop', input: selectSubtype(initialInput('web'), 'ecommerce'), min: 1000, max: 4000 },
    { label: 'telegram order bot', input: selectSubtype(initialInput('telegram'), 'order_bot'), min: 350, max: 1000 },
    { label: 'mobile e-commerce MVP', input: selectSubtype(initialInput('mobile'), 'ecommerce'), min: 3000, max: 9000 },
    { label: 'custom CRM (standard)', input: setTier(selectSubtype(initialInput('web'), 'crm'), 'standard'), min: 4500, max: 11000 },
    { label: 'AI chatbot', input: selectSubtype(initialInput('ai'), 'chatbot'), min: 700, max: 1600 },
  ];
  for (const band of BANDS) {
    const c = cost(band.input);
    s.ok(`${band.label} lands in ${usd(band.min)}–${usd(band.max)}`, c.min >= band.min && c.max <= band.max, range(c));
  }
}

process.exit(s.report());
