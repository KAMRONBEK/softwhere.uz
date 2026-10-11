import { INTEGRATIONS } from '@/modules/estimator/data/catalog';
import { CAPS } from '@/modules/estimator/ai-brief/constants';
import type { PricedScope } from '@/modules/estimator/ai-brief/digest';
import { refLabel } from '@/modules/estimator/ai-brief/labels';
import { asList, asObject, extractJson, label, prose, proseList, type TextContext } from '@/modules/estimator/ai-brief/parse';
import { CORE_REF, UNPRICED_REF } from '@/modules/estimator/ai-brief/schema';
import type { BriefNarrative, Parsed } from '@/modules/estimator/ai-brief/types';

/**
 * Parsers for the plan (call 2) and risks (call 3) answers, merged into the
 * brief's narrative. Both are written against the priced scope, and every
 * claim about WHEN something is built names the scope ref it is about:
 *  - an MVP deliverable must be the core build or an MVP-priced item;
 *  - a growth deliverable must be a later-priced item or an extra product;
 *  - a "can wait" item must be later-priced, an extra product, or explicitly
 *    'unpriced' (shown as outside the estimate) — never an MVP item.
 * Anything else is dropped: the audit found phases promising a whole mobile
 * app, a QuickBooks sync or a customer web app inside a "1–2 week" growth
 * phase that priced none of them.
 */

export interface NarrativeContext extends TextContext {
  priced: PricedScope;
}

type Phase = BriefNarrative['phases'][number];

/**
 * Setup work: the first lines to leave out of a five-line timeline (the
 * round-2 audit found booking, payments and the named integrations cut for
 * sign-up and profiles). Not 'core': the base build carries the product's own
 * workflows (attendance in a school CRM, a dispatch board).
 */
const SETUP_REFS: ReadonlySet<string> = new Set(['auth_basic', 'otp_sms', 'social_login', 'roles', 'profiles', 'analytics_setup']);
/** One-way messaging: after the product's own work and the systems it connects, before setup. */
const MESSAGING_REFS: ReadonlySet<string> = new Set(['email_service', 'telegram_channel', 'eskiz_sms', 'playmobile_sms', 'bot_broadcast']);
const INTEGRATION_IDS: ReadonlySet<string> = new Set(INTEGRATIONS.map(i => i.id));

interface Deliverable {
  text: string;
  ref: string;
}

/**
 * At most `cap` deliverables, chosen by what they are rather than by the
 * model's order (it lists every ref in catalog order — core, sign-up, roles,
 * profiles… — so cutting the head kept setup and dropped the client's
 * integrations and core flow in 82 of 108 round-2 briefs): the product's own
 * features and the systems it connects first, interleaved, then one-way
 * messaging, then setup. The kept lines stay in the model's order.
 */
export function pickDeliverables(items: Deliverable[], cap: number = CAPS.deliverables): Deliverable[] {
  if (items.length <= cap) return items;
  const indexed = items.map((d, i) => ({ ...d, i }));
  const features = indexed.filter(d => !SETUP_REFS.has(d.ref) && !MESSAGING_REFS.has(d.ref) && !INTEGRATION_IDS.has(d.ref));
  const systems = indexed.filter(d => INTEGRATION_IDS.has(d.ref) && !MESSAGING_REFS.has(d.ref));
  const order: typeof indexed = [];
  for (let k = 0; k < Math.max(features.length, systems.length); k++) {
    if (features[k]) order.push(features[k]);
    if (systems[k]) order.push(systems[k]);
  }
  order.push(...indexed.filter(d => MESSAGING_REFS.has(d.ref)), ...indexed.filter(d => SETUP_REFS.has(d.ref)));
  return order
    .slice(0, cap)
    .sort((a, b) => a.i - b.i)
    .map(({ text, ref }) => ({ text, ref }));
}

function parseDeliverables(value: unknown, allowed: Set<string>, field: string, issues: string[], ctx: TextContext): string[] {
  const kept: Deliverable[] = [];
  asList(value).forEach((entry, i) => {
    const d = asObject(entry);
    const ref = typeof d.ref === 'string' ? d.ref : '';
    const text = prose(d.text, CAPS.shortText, `${field}[${i}]`, issues, ctx);
    if (!text) return;
    if (!allowed.has(ref)) {
      issues.push(`${field}: dropped "${text}" (ref ${JSON.stringify(ref)} is not priced in this phase)`);
      return;
    }
    // One line per ref: "Sign-up with Google" after "Sign-up and login" repeats it (round 2).
    if (kept.some(k => k.text === text || (k.ref === ref && ref !== CORE_REF))) {
      issues.push(`${field}: dropped "${text}" (repeats ${ref})`);
      return;
    }
    kept.push({ text, ref });
  });
  const picked = pickDeliverables(kept);
  if (picked.length < kept.length) issues.push(`${field}: kept ${picked.length} of ${kept.length} deliverables (setup lines first to go)`);
  return picked.map(d => d.text);
}

function parsePhases(value: unknown, ctx: NarrativeContext, issues: string[]): Phase[] {
  const { priced } = ctx;
  const allowed = {
    mvp: new Set([CORE_REF, ...priced.mvpRefs]),
    growth: new Set([...priced.laterRefs, ...priced.extraRefs]),
  };
  const phases: Phase[] = [];
  for (const entry of asList(value)) {
    const p = asObject(entry);
    const id = p.id === 'mvp' || p.id === 'growth' ? p.id : null;
    if (!id || phases.some(x => x.id === id)) continue;
    if (id === 'growth' && !priced.hasGrowth) {
      issues.push('phases: dropped a growth phase (nothing is priced for growth)');
      continue;
    }
    phases.push({
      id,
      title: label(p.title, CAPS.label, ctx),
      goal: prose(p.goal, CAPS.sentence, `phases.${id}.goal`, issues, ctx),
      deliverables: parseDeliverables(p.deliverables, allowed[id], `phases.${id}.deliverables`, issues, ctx),
    });
  }

  // A priced growth phase always lists what it delivers: when every model
  // deliverable was dropped, fall back to the catalog labels of what is priced.
  return phases.map(p => {
    if (p.id !== 'growth' || p.deliverables.length > 0) return p;
    issues.push('phases.growth: deliverables rebuilt from the priced later scope');
    const refs = [...priced.laterRefs, ...priced.extraRefs].slice(0, CAPS.deliverables);
    return { ...p, deliverables: refs.map(ref => refLabel(ref, ctx.locale)) };
  });
}

function parseCanWait(value: unknown, ctx: NarrativeContext, issues: string[]): BriefNarrative['canWait'] {
  const { priced } = ctx;
  const inEstimate = new Set([...priced.laterRefs, ...priced.extraRefs]);
  const mvp = new Set([CORE_REF, ...priced.mvpRefs]);
  const items: BriefNarrative['canWait'] = [];
  asList(value).forEach((entry, i) => {
    const c = asObject(entry);
    const ref = typeof c.ref === 'string' ? c.ref : UNPRICED_REF;
    const item = label(c.item, CAPS.shortText, ctx);
    const reason = prose(c.reason, CAPS.sentence, `canWait[${i}].reason`, issues, ctx);
    if (!item || !reason) {
      if (item) issues.push(`canWait: dropped "${item}" (empty reason after guards)`);
      return;
    }
    if (mvp.has(ref)) {
      issues.push(`canWait: dropped "${item}" (ref ${ref} is in the MVP)`);
      return;
    }
    items.push({ item, reason, inEstimate: inEstimate.has(ref) });
  });
  return items.slice(0, CAPS.canWait);
}

function parseRisks(value: unknown, issues: string[], ctx: TextContext): BriefNarrative['risks'] {
  return asList(value)
    .map((v, i) => {
      const r = asObject(v);
      return {
        title: label(r.title, CAPS.label, ctx),
        detail: prose(r.detail, CAPS.sentence, `risks[${i}].detail`, issues, ctx),
        mitigation: prose(r.mitigation, CAPS.sentence, `risks[${i}].mitigation`, issues, ctx),
      };
    })
    .filter((r, i) => {
      const complete = !!(r.title && r.detail && r.mitigation);
      if (!complete && r.title) issues.push(`risks[${i}]: dropped "${r.title}" (empty field after guards)`);
      return complete;
    })
    .slice(0, CAPS.risks);
}

export type BriefPlan = Pick<BriefNarrative, 'buildFirst' | 'canWait' | 'phases'>;
export type BriefRisks = Pick<BriefNarrative, 'risks' | 'questions'>;

/** Call 2 (plan): build first, can wait, phases. Usable with both buildFirst parts and every priced phase. */
export function parsePlanJson(text: string, ctx: NarrativeContext): Parsed<BriefPlan> | null {
  const raw = extractJson(text);
  if (!raw) return null;
  const issues: string[] = [];
  const first = asObject(raw.buildFirst);
  const plan: BriefPlan = {
    buildFirst: {
      what: prose(first.what, Math.round(CAPS.sentence * 1.5), 'buildFirst.what', issues, ctx),
      why: prose(first.why, CAPS.sentence * 2, 'buildFirst.why', issues, ctx),
    },
    canWait: parseCanWait(raw.canWait, ctx, issues),
    phases: parsePhases(raw.phases, ctx, issues),
  };
  const missing: string[] = [];
  if (!plan.buildFirst.what || !plan.buildFirst.why) missing.push('buildFirst');
  const mvp = plan.phases.find(p => p.id === 'mvp');
  if (!mvp?.title || !mvp.deliverables.length) missing.push('mvp phase');
  if (ctx.priced.hasGrowth && !plan.phases.find(p => p.id === 'growth')?.title) missing.push('growth phase');
  if (missing.length) issues.push(`unusable: missing ${missing.join(', ')}`);
  return { value: plan, issues, usable: missing.length === 0 };
}

/** Call 3 (risks): usable with at least one complete risk and `CAPS.questionsMin` questions. */
export function parseRisksJson(text: string, ctx: TextContext): Parsed<BriefRisks> | null {
  const raw = extractJson(text);
  if (!raw) return null;
  const issues: string[] = [];
  const value: BriefRisks = {
    risks: parseRisks(raw.risks, issues, ctx),
    questions: proseList(raw.questions, CAPS.questionsMax, CAPS.sentence, 'questions', issues, ctx),
  };
  const missing: string[] = [];
  if (value.questions.length < CAPS.questionsMin) missing.push(`questions (${value.questions.length})`);
  if (value.risks.length === 0) missing.push('risks');
  if (missing.length) issues.push(`unusable: missing ${missing.join(', ')}`);
  return { value, issues, usable: missing.length === 0 };
}

/** A whole narrative object (plan + risks in one answer) — both parsers, both usability rules. */
export function parseNarrativeJson(text: string, ctx: NarrativeContext): Parsed<BriefNarrative> | null {
  const plan = parsePlanJson(text, ctx);
  const risks = parseRisksJson(text, ctx);
  if (!plan || !risks) return null;
  return {
    value: { ...plan.value, ...risks.value },
    issues: [...plan.issues, ...risks.issues],
    usable: plan.usable && risks.usable,
  };
}
