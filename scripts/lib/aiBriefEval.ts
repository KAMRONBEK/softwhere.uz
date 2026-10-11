/**
 * AI brief eval — case format, automated checks, variance and comparison
 * maths. Pure (no network, no files) so `tests/ai-brief/consistency.ts` can
 * cover it; the CLI in `scripts/eval-ai-brief.ts` does the I/O.
 */
import { estimateCostUsd, providerOfModel } from '../../src/core/ai';
import { FEATURES, INTEGRATIONS } from '../../src/modules/estimator/data/catalog';
import { BRIEF_PARTS, DEFAULT_UI_LANGUAGES, type BriefLocale } from '../../src/modules/estimator/ai-brief/constants';
import { checkBriefConsistency, type ConsistencyReport } from '../../src/modules/estimator/ai-brief/consistency';
import { pricedScopeOf, type PricedScope } from '../../src/modules/estimator/ai-brief/digest';
import { buildEstimate, engineSize, mapScopeToInputs } from '../../src/modules/estimator/ai-brief/mapping';
import type { BriefAttemptLog, BriefPart, BriefRun } from '../../src/modules/estimator/ai-brief/orchestrator';
import { assessBigIdea } from '../../src/modules/estimator/ai-brief/bigIdea';
import { isPricedEstimate, type AiBrief } from '../../src/modules/estimator/ai-brief/types';

/* ------------------------------------------------------------------ */
/* Case format                                                         */
/* ------------------------------------------------------------------ */

/** A ref id, or a list meaning "any of these". `type:subtype` / `type:*` match the main product or an extra product. */
export type RefSpec = string | string[];

/** A request that must land somewhere: priced as one of `refs`, or named in the not-priced list (`unpriced` regex). */
export interface MustLand {
  label: string;
  refs?: string[];
  unpriced?: string;
}

export interface CaseExpect {
  /** ok | rejected | declined_policy | error (one or any of). */
  status: string | string[];
  /** Allowed rejection reasons when rejected. */
  rejection?: string[];
  /** Policy topics, any of, when declined. */
  policyTopics?: string[];
  /** Product family (estimator project type), any of. */
  productTypes?: string[];
  subtypes?: string[];
  /** Language of the visible text (default: the page locale). */
  language?: BriefLocale;
  /** Priced in the MVP or later. */
  mustInclude?: RefSpec[];
  /** Priced in the MVP. */
  mustIncludeMvp?: RefSpec[];
  /** Priced nowhere. */
  mustNotInclude?: string[];
  /** Not in the MVP (later is fine). */
  mustNotIncludeMvp?: string[];
  mustLand?: MustLand[];
  /** Legacy (round 1) — kept so old cases read the same. */
  integrationsAny?: string[];
  notIntegrations?: string[];
  flagsAny?: string[];
  maxMvpRefs?: number;
  minUnpriced?: number;
  /** Engine config the brief must be priced with. */
  languages?: number;
  platforms?: string[];
  /** Extra product types that must not be added. */
  extraTypesNot?: string[];
  pii?: string[];
  mustKeepInScrubbed?: string[];
  mustNotContain?: string[];
}

export interface EvalCase {
  id: string;
  locale: BriefLocale;
  category: string;
  /** Sets the case belongs to (`round1`, `us`, `uz-colloquial`, `ru`, `tricky`) — select with --tags. */
  tags?: string[];
  idea: string;
  expect: CaseExpect;
}

export interface Check {
  name: string;
  ok: boolean;
  detail?: string;
  /** Reported but never counted as a failure (quality signals that need a human look). */
  warn?: boolean;
}

/** What the checks read from a run — a live `BriefRun` or one reloaded from its JSON. */
export type RunView = Pick<BriefRun, 'outcome' | 'scope' | 'priced' | 'scrubbedIdea' | 'attempts'> & Partial<Pick<BriefRun, 'guard'>>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function letterShares(text: string): { latin: number; cyrillic: number } {
  const latin = (text.match(/\p{Script=Latin}/gu) ?? []).length;
  const cyrillic = (text.match(/\p{Script=Cyrillic}/gu) ?? []).length;
  const total = latin + cyrillic || 1;
  return { latin: latin / total, cyrillic: cyrillic / total };
}

export function visibleTexts(brief: AiBrief): string[] {
  const b = brief;
  return [
    b.title,
    b.summary,
    ...b.roles,
    ...b.audience.flatMap(a => [a.segment, a.need]),
    ...b.features.map(f => f.note),
    ...b.integrations.map(i => i.note),
    b.narrative.buildFirst.what,
    b.narrative.buildFirst.why,
    ...b.narrative.canWait.flatMap(c => [c.item, c.reason]),
    ...b.narrative.risks.flatMap(r => [r.title, r.detail, r.mitigation]),
    ...b.narrative.questions,
    ...b.narrative.assumptions,
    ...b.estimate.phases.flatMap(p => [p.title, p.goal, ...p.deliverables]),
    ...b.screens.flatMap(sc => [sc.name, sc.purpose, ...sc.blocks.flatMap(bl => [bl.label, ...bl.items])]),
  ].filter(Boolean);
}

const RAW_ID = new RegExp(
  `(?<![\\p{L}\\p{N}_])(?:${[...FEATURES, ...INTEGRATIONS]
    .map(x => x.id)
    .filter(id => id.includes('_'))
    .join('|')})(?![\\p{L}\\p{N}_])`,
  'iu'
);
const UZ_ONLY = ['payme', 'click', 'uzum_bank', 'paynet', 'nasiya', 'soliq_ofd', 'eskiz_sms', 'myid', 'oneid', 'didox', 'eimzo'];

/** Russian words that a literate Uzbek brief should not use (the audit's terminology finding). */
const UZ_LOANWORDS =
  /(?<!\p{L})(?:sklad|vilka|platye|zakaz|dostavka|oplata|skidka|zayavka|spisok|otch[eyo]t|nastroyk|polzovatel|sotrudnik|rabotnik|prilojeniya|prixod|rasxod|ostatka|nakladnoy)\p{L}*/iu;

/** The priced scope of a run (rebuilt from the scope for runs saved before it was logged). */
export function pricedOf(run: RunView, locale: BriefLocale): PricedScope | null {
  if (run.priced) return run.priced;
  return run.scope ? pricedScopeOf(run.scope, mapScopeToInputs(run.scope, locale), locale) : null;
}

/** Does a priced scope satisfy one ref spec? `priced` is the set to look in (MVP or MVP + later). */
function satisfies(spec: RefSpec, refs: Set<string>, products: string[]): boolean {
  const options = Array.isArray(spec) ? spec : [spec];
  return options.some(ref => {
    if (!ref.includes(':')) return refs.has(ref);
    const [type, subtype] = ref.split(':');
    return products.some(p => p === ref || (subtype === '*' && p.startsWith(`${type}:`)));
  });
}

const specLabel = (spec: RefSpec) => (Array.isArray(spec) ? spec.join('|') : spec);

/**
 * The headline numbers must be exactly what the engine computes from the
 * priced scope. A discovery-call brief must carry no number at all, and the
 * deterministic big-idea verdict must agree that it is one.
 */
function priceMatchesEngine(run: RunView): Check {
  if (run.outcome.status !== 'ok' || !run.scope) return { name: 'price = engine(scope)', ok: true };
  const b = run.outcome.brief;
  const again = buildEstimate(run.scope, mapScopeToInputs(run.scope, b.locale), b.locale);
  if (!isPricedEstimate(b.estimate)) {
    const verdict = assessBigIdea(run.scrubbedIdea, engineSize(mapScopeToInputs(run.scope, b.locale)));
    const numbers = /"(?:price|hours|weeks|min|max)"/.test(JSON.stringify(b.estimate));
    return {
      name: 'discovery: no numbers, verdict agrees',
      ok: verdict.isBig && !numbers,
      detail: `${verdict.signals.join('; ') || 'not a big idea'}${numbers ? ' · numbers in the estimate' : ''}`,
    };
  }
  const same =
    JSON.stringify([again.mvp.price, again.mvp.weeks, again.fullVision?.price, again.fullVision?.weeks]) ===
    JSON.stringify([b.estimate.mvp.price, b.estimate.mvp.weeks, b.estimate.fullVision?.price, b.estimate.fullVision?.weeks]);
  return { name: 'price = engine(scope)', ok: same, detail: same ? undefined : JSON.stringify(again.mvp.price) };
}

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

function outcomeChecks(c: CaseExpect, run: RunView): Check[] {
  const checks: Check[] = [];
  const expected = Array.isArray(c.status) ? c.status : [c.status];
  const { outcome } = run;
  checks.push({
    name: 'status',
    ok: expected.includes(outcome.status),
    detail: `got ${outcome.status}${outcome.status === 'error' ? `:${outcome.code}` : ''}`,
  });
  if (c.rejection && outcome.status === 'rejected') {
    checks.push({ name: `rejection ${c.rejection.join('|')}`, ok: c.rejection.includes(outcome.reason), detail: outcome.reason });
  }
  if (c.policyTopics && outcome.status === 'declined_policy') {
    checks.push({
      name: `policy topic ${c.policyTopics.join('|')}`,
      ok: outcome.topics.some(t => c.policyTopics!.includes(t)),
      detail: outcome.topics.join(','),
    });
  }
  const output = JSON.stringify(outcome);
  for (const pii of c.pii ?? [])
    checks.push({ name: `pii scrubbed: ${pii}`, ok: !run.scrubbedIdea.includes(pii) && !output.includes(pii) });
  for (const keep of c.mustKeepInScrubbed ?? []) checks.push({ name: `kept in scrubbed: ${keep}`, ok: run.scrubbedIdea.includes(keep) });
  for (const banned of c.mustNotContain ?? []) checks.push({ name: `not in output: ${banned}`, ok: !output.includes(banned) });
  return checks;
}

function scopeChecks(c: CaseExpect, brief: AiBrief, priced: PricedScope): Check[] {
  const checks: Check[] = [];
  const { config } = brief.estimate;
  const product = `${config.projectType}:${config.subtype}`;
  const products = [product, ...priced.extraRefs];
  const mvp = new Set(priced.mvpRefs);
  const all = new Set([...priced.mvpRefs, ...priced.laterRefs]);
  const integrations = new Set(brief.integrations.map(i => i.id));

  if (c.productTypes) checks.push({ name: 'product type', ok: c.productTypes.includes(config.projectType), detail: product });
  if (c.subtypes) checks.push({ name: `subtype ${c.subtypes.join('|')}`, ok: c.subtypes.includes(config.subtype), detail: product });
  for (const spec of c.mustInclude ?? []) {
    checks.push({ name: `priced: ${specLabel(spec)}`, ok: satisfies(spec, all, products), detail: `mvp+later: ${[...all].join(',')}` });
  }
  for (const spec of c.mustIncludeMvp ?? []) {
    checks.push({ name: `in MVP: ${specLabel(spec)}`, ok: satisfies(spec, mvp, [product]), detail: `mvp: ${[...mvp].join(',')}` });
  }
  for (const ref of c.mustNotInclude ?? []) checks.push({ name: `not priced: ${ref}`, ok: !satisfies(ref, all, products) });
  for (const ref of c.mustNotIncludeMvp ?? []) checks.push({ name: `not in MVP: ${ref}`, ok: !mvp.has(ref) });
  for (const land of c.mustLand ?? []) {
    const pricedHit = (land.refs ?? []).some(r => all.has(r));
    const unpricedHit = land.unpriced ? priced.unpriced.some(u => new RegExp(land.unpriced!, 'iu').test(u)) : false;
    checks.push({ name: `lands: ${land.label}`, ok: pricedHit || unpricedHit, detail: `unpriced: ${priced.unpriced.join(' | ') || '—'}` });
  }
  if (c.integrationsAny) {
    checks.push({
      name: `integrations any of ${c.integrationsAny.join('/')}`,
      ok: c.integrationsAny.some(id => integrations.has(id)),
      detail: [...integrations].join(','),
    });
  }
  for (const id of c.notIntegrations ?? []) checks.push({ name: `no integration ${id}`, ok: !integrations.has(id) });
  if (c.flagsAny)
    checks.push({
      name: `flags any of ${c.flagsAny.join('/')}`,
      ok: c.flagsAny.some(f => brief.complexityFlags.includes(f as never)),
      detail: brief.complexityFlags.join(','),
    });
  if (c.maxMvpRefs !== undefined)
    checks.push({ name: `MVP refs ≤ ${c.maxMvpRefs}`, ok: mvp.size <= c.maxMvpRefs, detail: String(mvp.size) });
  if (c.minUnpriced !== undefined)
    checks.push({
      name: `unpriced ≥ ${c.minUnpriced}`,
      ok: priced.unpriced.length >= c.minUnpriced,
      detail: String(priced.unpriced.length),
    });
  if (c.languages !== undefined)
    checks.push({ name: `languages = ${c.languages}`, ok: config.languages === c.languages, detail: String(config.languages) });
  if (c.platforms) {
    const same = [...c.platforms].sort().join(',') === [...config.platforms].sort().join(',');
    checks.push({ name: `platforms = ${c.platforms.join('+')}`, ok: same, detail: config.platforms.join('+') });
  }
  for (const type of c.extraTypesNot ?? [])
    checks.push({
      name: `no extra ${type} product`,
      ok: !priced.extraRefs.some(r => r.startsWith(`${type}:`)),
      detail: priced.extraRefs.join(','),
    });
  return checks;
}

function textChecks(locale: BriefLocale, brief: AiBrief): Check[] {
  const checks: Check[] = [];
  const texts = visibleTexts(brief);
  const shares = letterShares(texts.join(' '));
  const languageOk = locale === 'ru' ? shares.cyrillic > 0.6 : shares.cyrillic < (locale === 'uz' ? 0.03 : 0.005);
  checks.push({ name: `language ${locale}`, ok: languageOk, detail: `cyrillic share ${(shares.cyrillic * 100).toFixed(1)}%` });
  if (locale === 'uz') {
    const loans = texts.map(t => t.match(UZ_LOANWORDS)?.[0]).filter(Boolean);
    checks.push({ name: 'uz: no Russian loanwords', ok: loans.length === 0, detail: loans.slice(0, 5).join(', '), warn: true });
  }
  const rawIds = texts.filter(t => RAW_ID.test(t));
  checks.push({ name: 'no raw catalog ids in text', ok: rawIds.length === 0, detail: rawIds.slice(0, 3).join(' | ') });
  const slots = texts.filter(t => /\[[^\]]{1,40}\]/.test(t));
  checks.push({ name: 'no [placeholders] in text', ok: slots.length === 0, detail: slots.slice(0, 3).join(' | ') });
  return checks;
}

function structureChecks(run: RunView, brief: AiBrief, priced: PricedScope | null): Check[] {
  const b = brief;
  const checks: Check[] = [];
  checks.push({ name: 'screens 3-8', ok: b.screens.length >= 3 && b.screens.length <= 8, detail: String(b.screens.length) });
  const frames = priced?.frames;
  const offFrame = b.screens.filter(sc => frames && !(sc.phase === 'mvp' ? frames.mvp : frames.later).includes(sc.device));
  checks.push({ name: 'screens use the priced frames', ok: offFrame.length === 0, detail: offFrame.map(sc => sc.name).join(', ') });
  checks.push({
    name: 'questions 3-5',
    ok: b.narrative.questions.length >= 3 && b.narrative.questions.length <= 5,
    detail: String(b.narrative.questions.length),
  });
  checks.push({ name: 'risks ≥ 2', ok: b.narrative.risks.length >= 2, detail: String(b.narrative.risks.length) });
  const emptyPhase = b.estimate.phases.filter(p => !p.title || !p.goal || p.deliverables.length === 0);
  checks.push({ name: 'phases complete', ok: emptyPhase.length === 0, detail: emptyPhase.map(p => p.id).join(',') });
  const leaks = run.attempts
    .filter(a => a.usable)
    .flatMap(a => a.parseIssues ?? [])
    .filter(i => i.includes('stating a price'));
  checks.push({ name: 'no price/duration/% in prose', ok: leaks.length === 0, detail: leaks.join(' | ') });
  checks.push(priceMatchesEngine(run));
  // Founder rule 2026-10-10: the page shows a price range and weeks, never an hour count (a saved run from before then fails this).
  checks.push({ name: 'no hours in the estimate payload', ok: !/"hours"\s*:/.test(JSON.stringify(b.estimate)) });
  if (run.scope) {
    // A request mapped to an id the product type cannot price silently becomes "not priced".
    const { notOffered } = mapScopeToInputs(run.scope, b.locale);
    checks.push({ name: 'scope ids offered for the product', ok: notOffered.length === 0, detail: notOffered.join(',') });
  }
  if (b.locale === 'en') {
    const uz = b.integrations.map(i => i.id).filter(id => UZ_ONLY.includes(id));
    checks.push({ name: 'en: no Uzbekistan-only integrations', ok: uz.length === 0, detail: uz.join(',') });
  } else {
    // Founder rule (2026-10-10, round 4): a uz/ru brief always prices an Uzbek + Russian interface.
    const { languages } = b.estimate.config;
    checks.push({
      name: 'uz/ru: Uzbek + Russian interface priced',
      ok: languages >= DEFAULT_UI_LANGUAGES[b.locale],
      detail: String(languages),
    });
  }
  return checks;
}

function consistencyCheck(report: ConsistencyReport | null): Check[] {
  if (!report) return [];
  const errors = report.violations.filter(v => v.severity === 'error');
  const warns = report.violations.filter(v => v.severity === 'warn');
  const brief = (vs: typeof errors) =>
    vs
      .slice(0, 4)
      .map(v => `${v.kind} @${v.where} [${v.subject}]`)
      .join('; ');
  return [
    { name: 'consistency: no errors', ok: errors.length === 0, detail: `${errors.length}: ${brief(errors)}` },
    { name: 'consistency: no warnings', ok: warns.length === 0, detail: `${warns.length}: ${brief(warns)}`, warn: true },
  ];
}

export interface CaseChecks {
  checks: Check[];
  consistency: ConsistencyReport | null;
}

export function checksFor(c: EvalCase, run: RunView): CaseChecks {
  const checks = outcomeChecks(c.expect, run);
  if (run.outcome.status !== 'ok') return { checks, consistency: null };
  const brief = run.outcome.brief;
  const priced = pricedOf(run, brief.locale);
  const consistency = priced ? checkBriefConsistency(brief, priced, run.scrubbedIdea ?? c.idea) : null;
  return {
    checks: [
      ...checks,
      ...(priced ? scopeChecks(c.expect, brief, priced) : []),
      ...textChecks(c.expect.language ?? c.locale, brief),
      ...structureChecks(run, brief, priced),
      ...consistencyCheck(consistency),
    ],
    consistency,
  };
}

/* ------------------------------------------------------------------ */
/* Result rows, variance and comparison                                */
/* ------------------------------------------------------------------ */

export interface CaseResult {
  id: string;
  variant: string;
  repeat: number;
  locale: BriefLocale;
  category: string;
  status: string;
  product: string | null;
  model: string | null;
  ms: number;
  /** Time spent per call (sum of its attempts). Narrative and screens run in parallel. */
  partMs: Record<BriefPart, number>;
  /** Estimated cost; DeepSeek at the rate of the hour each call ran (off-peak = half). */
  costUsd: number;
  /** The same at peak prices (DeepSeek's upper bound; equals costUsd for Kimi). Runs since 2026-10-11. */
  costUsdPeak?: number;
  costByProviderPeak?: Record<string, number>;
  /** Helper calls' time: the sample content (sum of attempts) and the Uzbek copy-edit (slowest chunk). */
  auxMs?: AuxMs;
  /** Model calls of the run: answered, unusable (no valid JSON / failed validation), errors, truncated. */
  calls?: CallStats;
  cachedTokens?: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  failedChecks: string[];
  warnings: string[];
  consistency: { errors: number; warnings: number; kinds: string[]; coverage: number | null } | null;
  /** The same checks on the brief before the request-path guard dropped contradicting copy (runs since round 2 iter 1). */
  consistencyBefore?: { errors: number; warnings: number; kinds: string[] } | null;
  /** Texts the guard dropped (or had to keep) in this brief. */
  guardRemoved?: number;
  mvpPrice: { min: number; max: number } | null;
  mvpWeeks: { min: number; max: number } | null;
  /** A discovery-call brief: a plan without a price (`bigIdea.ts`). */
  discovery?: boolean;
  mvpRefs: string[];
  laterRefs: string[];
  screens: number;
  price: string | null;
  weeks: string | null;
}

export function partMs(attempts: BriefAttemptLog[]): Record<BriefPart, number> {
  const sum = (part: BriefPart) => attempts.filter(a => a.part === part).reduce((s, a) => s + a.ms, 0);
  return Object.fromEntries(BRIEF_PARTS.map(part => [part, sum(part)])) as Record<BriefPart, number>;
}

export interface AuxMs {
  samples: number;
  /** The copy-edit chunks run in parallel: the slowest attempt (0 = no copy-edit). */
  polishMax: number;
}

export function auxMs(attempts: BriefAttemptLog[]): AuxMs {
  const samples = attempts.filter(a => a.part === 'samples').reduce((s, a) => s + a.ms, 0);
  const polish = attempts.filter(a => a.part.startsWith('polish')).map(a => a.ms);
  return { samples, polishMax: Math.max(0, ...polish) };
}

export interface CallStats {
  /** Attempts sent to a model (deadline skips excluded). */
  calls: number;
  /** Answered, but not usable: invalid JSON or a failed validator. */
  unusable: number;
  /** No answer: HTTP error, timeout, empty response. */
  errors: number;
  /** Answers cut at the completion cap (finish_reason 'length'). */
  truncated: number;
  /** Per part: '<part>: <error or parse issue>' for every failed attempt. */
  failures: string[];
}

export function callStats(attempts: BriefAttemptLog[]): CallStats {
  const sent = attempts.filter(a => !(a.error ?? '').startsWith('skipped'));
  const failed = sent.filter(a => !a.ok || a.usable === false);
  return {
    calls: sent.length,
    unusable: sent.filter(a => a.ok && a.usable === false).length,
    errors: sent.filter(a => !a.ok).length,
    truncated: sent.filter(a => a.finishReason === 'length').length,
    failures: failed.map(a => `${a.part}: ${a.ok ? `unusable (${(a.parseIssues ?? []).slice(0, 2).join('; ')})` : a.error}`),
  };
}

/** The run's estimated cost at peak prices (no `at`: DeepSeek's upper bound). */
export function peakCostUsd(attempts: BriefAttemptLog[]): number {
  return attempts.reduce((sum, a) => sum + estimateCostUsd(a.model, a.usage), 0);
}

export function costByProviderPeak(attempts: BriefAttemptLog[]): Record<string, number> {
  return attempts.reduce<Record<string, number>>((acc, a) => {
    const provider = providerOfModel(a.model) ?? 'kimi';
    return { ...acc, [provider]: (acc[provider] ?? 0) + estimateCostUsd(a.model, a.usage) };
  }, {});
}

/** The calls after the scope run in parallel: their wall clock is the slowest one. */
const PARALLEL_PARTS = BRIEF_PARTS.filter(p => p !== 'scope');
const parallelValues = (ms: Partial<Record<BriefPart, number>>) => PARALLEL_PARTS.map(p => ms[p] ?? 0);

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

const mean = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0);
const round = (value: number, digits = 3) => Number(value.toFixed(digits));

/** Coefficient of variation (std / mean); 0 for fewer than two values. */
export function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  if (m === 0) return 0;
  const variance = mean(values.map(v => (v - m) ** 2));
  return Math.sqrt(variance) / m;
}

/** Mean pairwise Jaccard similarity of sets (1 = identical every time). */
export function meanJaccard(sets: string[][]): number {
  if (sets.length < 2) return 1;
  const scores: number[] = [];
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const a = new Set(sets[i]);
      const b = new Set(sets[j]);
      const union = new Set([...a, ...b]);
      const inter = [...a].filter(x => b.has(x)).length;
      scores.push(union.size === 0 ? 1 : inter / union.size);
    }
  }
  return mean(scores);
}

const tally = (values: string[]) => values.reduce<Record<string, number>>((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {});

export interface CaseVariance {
  id: string;
  variant: string;
  runs: number;
  statuses: Record<string, number>;
  products: Record<string, number>;
  /** MVP price midpoint across ok runs. */
  mvpPrice: { min: number; max: number; mean: number; cv: number } | null;
  mvpWeeksMid: { min: number; max: number } | null;
  screens: { min: number; max: number };
  mvpRefs: { jaccard: number; always: string[]; sometimes: Record<string, number> };
  consistencyErrors: number[];
  failedChecks: Record<string, number>;
}

export function caseVariance(rows: CaseResult[]): CaseVariance {
  const ok = rows.filter(r => r.status === 'ok');
  const mids = ok.filter(r => r.mvpPrice).map(r => (r.mvpPrice!.min + r.mvpPrice!.max) / 2);
  const weekMids = ok.filter(r => r.mvpWeeks).map(r => (r.mvpWeeks!.min + r.mvpWeeks!.max) / 2);
  const refSets = ok.map(r => r.mvpRefs);
  const counts = tally(refSets.flat());
  const always = Object.keys(counts)
    .filter(ref => counts[ref] === ok.length)
    .sort();
  const sometimes = Object.fromEntries(Object.entries(counts).filter(([, n]) => n < ok.length));
  const failed = tally(rows.flatMap(r => r.failedChecks.map(f => f.replace(/ \(.*$/s, ''))));
  return {
    id: rows[0].id,
    variant: rows[0].variant,
    runs: rows.length,
    statuses: tally(rows.map(r => r.status)),
    products: tally(rows.map(r => r.product ?? '—')),
    mvpPrice: mids.length
      ? { min: Math.min(...mids), max: Math.max(...mids), mean: Math.round(mean(mids)), cv: round(coefficientOfVariation(mids)) }
      : null,
    mvpWeeksMid: weekMids.length ? { min: Math.min(...weekMids), max: Math.max(...weekMids) } : null,
    screens: { min: ok.length ? Math.min(...ok.map(r => r.screens)) : 0, max: Math.max(0, ...ok.map(r => r.screens)) },
    mvpRefs: { jaccard: round(meanJaccard(refSets)), always, sometimes },
    consistencyErrors: ok.map(r => r.consistency?.errors ?? 0),
    failedChecks: failed,
  };
}

export interface VariantSummary {
  variant: string;
  briefs: number;
  statusCounts: Record<string, number>;
  casesWithFailedChecks: number;
  failedCheckRate: Record<string, number>;
  consistency: {
    errorsPerBrief: number;
    warningsPerBrief: number;
    briefsWithErrors: number;
    byKind: Record<string, number>;
    coverageMean: number | null;
    /** The model's own consistency, before the request-path guard (null for runs that predate it). */
    beforeGuard: { errorsPerBrief: number; briefsWithErrors: number; byKind: Record<string, number> } | null;
    guardRemovedPerBrief: number | null;
  };
  latencyMs: { mean: number; p50: number; p90: number; max: number };
  partMsP50: Record<BriefPart, number>;
  partMsP90: Record<BriefPart, number>;
  /** Helper calls (runs that recorded them): p50 of the samples call and of the slowest copy-edit chunk. */
  auxMsP50: { samples: number; polishMax: number } | null;
  /** Model-call reliability over every attempt (runs that recorded it). */
  calls: { total: number; unusable: number; errors: number; truncated: number; unusableRate: number; errorRate: number } | null;
  /** Median wall clock of the parallel calls after the scope (the slowest of them). */
  afterScopeMsP50: number;
  /** Median of sum − max over the parallel calls: what running them in parallel saves. */
  parallelSavingMsP50: number;
  /** perBriefPeak: DeepSeek at peak prices (null for runs that predate it). */
  costUsd: { total: number; perBrief: number; perBriefPeak: number | null };
  /** Only with --repeat ≥ 2. */
  stability: { priceCvMean: number; mvpRefsJaccardMean: number; productFlips: string[]; statusFlips: string[] } | null;
}

export function summarizeVariant(variant: string, rows: CaseResult[]): VariantSummary {
  const ok = rows.filter(r => r.status === 'ok');
  const withConsistency = ok.filter(r => r.consistency);
  const latencies = rows.filter(r => r.ms > 0).map(r => r.ms);
  const total = rows.reduce((s, r) => s + r.costUsd, 0);
  const byCase = new Map<string, CaseResult[]>();
  for (const r of rows) byCase.set(r.id, [...(byCase.get(r.id) ?? []), r]);
  const repeated = [...byCase.values()].filter(rs => rs.length > 1).map(caseVariance);
  const coverages = withConsistency.map(r => r.consistency!.coverage).filter((c): c is number => c !== null);
  const guarded = ok.filter(r => r.consistencyBefore);
  const partPercentile = (p: number) =>
    Object.fromEntries(
      BRIEF_PARTS.map(part => [
        part,
        percentile(
          ok.map(r => r.partMs[part] ?? 0),
          p
        ),
      ])
    ) as Record<BriefPart, number>;
  const withAux = rows.filter(r => r.auxMs);
  const withCalls = rows.filter(r => r.calls);
  const callSum = (key: 'calls' | 'unusable' | 'errors' | 'truncated') => withCalls.reduce((sum, r) => sum + r.calls![key], 0);
  const withPeak = rows.filter(r => r.costUsdPeak !== undefined);
  return {
    variant,
    briefs: rows.length,
    statusCounts: tally(rows.map(r => r.status)),
    casesWithFailedChecks: new Set(rows.filter(r => r.failedChecks.length).map(r => r.id)).size,
    failedCheckRate: Object.fromEntries(
      Object.entries(tally(rows.flatMap(r => r.failedChecks.map(f => f.replace(/ \(.*$/s, ''))))).map(([k, n]) => [
        k,
        round(n / rows.length),
      ])
    ),
    consistency: {
      errorsPerBrief: round(mean(withConsistency.map(r => r.consistency!.errors))),
      warningsPerBrief: round(mean(withConsistency.map(r => r.consistency!.warnings))),
      briefsWithErrors: withConsistency.filter(r => r.consistency!.errors > 0).length,
      byKind: tally(withConsistency.flatMap(r => r.consistency!.kinds)),
      coverageMean: coverages.length ? round(mean(coverages)) : null,
      beforeGuard: guarded.length
        ? {
            errorsPerBrief: round(mean(guarded.map(r => r.consistencyBefore!.errors))),
            briefsWithErrors: guarded.filter(r => r.consistencyBefore!.errors > 0).length,
            byKind: tally(guarded.flatMap(r => r.consistencyBefore!.kinds)),
          }
        : null,
      guardRemovedPerBrief: guarded.length ? round(mean(guarded.map(r => r.guardRemoved ?? 0))) : null,
    },
    latencyMs: {
      mean: Math.round(mean(latencies)),
      p50: percentile(latencies, 50),
      p90: percentile(latencies, 90),
      max: Math.max(0, ...latencies),
    },
    partMsP50: partPercentile(50),
    partMsP90: partPercentile(90),
    auxMsP50: withAux.length
      ? {
          samples: percentile(
            withAux.map(r => r.auxMs!.samples).filter(ms => ms > 0),
            50
          ),
          polishMax: percentile(
            withAux.map(r => r.auxMs!.polishMax).filter(ms => ms > 0),
            50
          ),
        }
      : null,
    calls: withCalls.length
      ? {
          total: callSum('calls'),
          unusable: callSum('unusable'),
          errors: callSum('errors'),
          truncated: callSum('truncated'),
          unusableRate: round(callSum('unusable') / (callSum('calls') || 1)),
          errorRate: round(callSum('errors') / (callSum('calls') || 1)),
        }
      : null,
    afterScopeMsP50: percentile(
      ok.map(r => Math.max(...parallelValues(r.partMs))),
      50
    ),
    parallelSavingMsP50: percentile(
      ok.map(r => {
        const values = parallelValues(r.partMs);
        return values.reduce((sum, v) => sum + v, 0) - Math.max(...values);
      }),
      50
    ),
    costUsd: {
      total: round(total, 4),
      perBrief: round(total / (rows.length || 1), 4),
      perBriefPeak: withPeak.length ? round(withPeak.reduce((sum, r) => sum + r.costUsdPeak!, 0) / withPeak.length, 4) : null,
    },
    stability: repeated.length
      ? {
          priceCvMean: round(mean(repeated.filter(v => v.mvpPrice).map(v => v.mvpPrice!.cv))),
          mvpRefsJaccardMean: round(mean(repeated.map(v => v.mvpRefs.jaccard))),
          productFlips: repeated.filter(v => Object.keys(v.products).length > 1).map(v => v.id),
          statusFlips: repeated.filter(v => Object.keys(v.statuses).length > 1).map(v => v.id),
        }
      : null,
  };
}

/** One line per variant for the console comparison table. */
export function comparisonTable(summaries: VariantSummary[]): string {
  const head = [
    'variant',
    'briefs',
    'ok',
    'failCases',
    'consErr/brief',
    'briefsWithErr',
    'p50 s',
    'p90 s',
    'scope p50 s',
    'unusable%',
    'errors%',
    '$/brief',
    '$peak/brief',
    'priceCV',
    'refsJacc',
  ];
  const rows = summaries.map(s => [
    s.variant,
    String(s.briefs),
    String(s.statusCounts.ok ?? 0),
    String(s.casesWithFailedChecks),
    s.consistency.errorsPerBrief.toFixed(2),
    String(s.consistency.briefsWithErrors),
    (s.latencyMs.p50 / 1000).toFixed(1),
    (s.latencyMs.p90 / 1000).toFixed(1),
    (s.partMsP50.scope / 1000).toFixed(1),
    s.calls ? (s.calls.unusableRate * 100).toFixed(1) : '—',
    s.calls ? (s.calls.errorRate * 100).toFixed(1) : '—',
    s.costUsd.perBrief.toFixed(4),
    s.costUsd.perBriefPeak === null ? '—' : s.costUsd.perBriefPeak.toFixed(4),
    s.stability ? s.stability.priceCvMean.toFixed(3) : '—',
    s.stability ? s.stability.mvpRefsJaccardMean.toFixed(2) : '—',
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
  return [head, ...rows].map(r => r.map((cell, i) => cell.padEnd(widths[i])).join('  ')).join('\n');
}
