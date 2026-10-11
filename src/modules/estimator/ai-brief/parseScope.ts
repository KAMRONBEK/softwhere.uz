import { FEATURE_BY_ID, INTEGRATION_BY_ID, TECH_BY_ID } from '@/modules/estimator/data/catalog';
import type { MobileApproach, Platform, ProjectType, Urgency } from '@/modules/estimator/types';
import {
  CAPS,
  CLARITY,
  COMPLEXITY_FLAGS,
  ENFORCE_POLICY_DECLINE,
  PHASES,
  POLICY_STATUSES,
  POLICY_TOPICS,
  REJECTIONS,
} from '@/modules/estimator/ai-brief/constants';
import {
  asList,
  asObject,
  clip,
  extractJson,
  intIn,
  label,
  labelList,
  pick,
  prose,
  proseList,
  type TextContext,
} from '@/modules/estimator/ai-brief/parse';
import { PRODUCT_IDS } from '@/modules/estimator/ai-brief/schema';
import type { BriefScope, Parsed, ProductRef, ScopeItem } from '@/modules/estimator/ai-brief/types';

/**
 * Call 1 parser: normalizes the scope answer into a `BriefScope` — drops
 * unknown catalog ids, dedupes, caps lists (MVP items first, so a long answer
 * can never lose an MVP item to the cap), repairs and guards every visible
 * string.
 */

const PRODUCT_SET = new Set(PRODUCT_IDS);
const FALLBACK_PRODUCT: ProductRef = { projectType: 'other', subtype: 'custom_project' };

function parseProduct(value: unknown, field: string, issues: string[]): ProductRef | null {
  if (typeof value !== 'string' || !PRODUCT_SET.has(value)) {
    issues.push(`${field}: unknown product ${JSON.stringify(value)}`);
    return null;
  }
  const [projectType, subtype] = value.split(':');
  return { projectType: projectType as ProjectType, subtype };
}

function parseScopeItems(
  value: unknown,
  known: Map<string, unknown>,
  cap: number,
  field: string,
  issues: string[],
  ctx: TextContext
): ScopeItem[] {
  const byId = new Map<string, ScopeItem>();
  for (const entry of asList(value)) {
    const raw = asObject(entry);
    const id = typeof raw.id === 'string' ? raw.id : '';
    if (!known.has(id)) {
      issues.push(`${field}: dropped unknown id ${JSON.stringify(raw.id)}`);
      continue;
    }
    const phase = pick(raw.phase, PHASES, 'mvp', `${field}.${id}.phase`, issues);
    const existing = byId.get(id);
    // Listed twice: the MVP placement wins (it is the one that gets priced first).
    if (existing && (existing.phase === 'mvp' || phase === 'later')) continue;
    byId.set(id, { id, phase, note: label(raw.note, CAPS.shortText, ctx) });
  }
  const items = Array.from(byId.values());
  const ordered = [...items.filter(i => i.phase === 'mvp'), ...items.filter(i => i.phase === 'later')];
  if (ordered.length > cap) {
    issues.push(
      `${field}: capped ${ordered.length} → ${cap}, dropped ${ordered
        .slice(cap)
        .map(i => `${i.id}(${i.phase})`)
        .join(', ')}`
    );
  }
  return ordered.slice(0, cap);
}

function parseExtras(value: unknown, main: ProductRef | null, issues: string[], ctx: TextContext): BriefScope['extraDeliverables'] {
  const mainKey = main ? `${main.projectType}:${main.subtype}` : '';
  const extras: BriefScope['extraDeliverables'] = [];
  for (const entry of asList(value)) {
    const e = asObject(entry);
    const ref = parseProduct(e.product, 'extraDeliverables', issues);
    const key = ref ? `${ref.projectType}:${ref.subtype}` : '';
    if (!ref || key === mainKey || extras.some(x => `${x.projectType}:${x.subtype}` === key)) continue;
    extras.push({ ...ref, reason: prose(e.reason, CAPS.sentence, 'extraDeliverables.reason', issues, ctx) });
  }
  return extras.slice(0, CAPS.extras);
}

function oneOfList<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  return Array.from(new Set(asList(value).filter((v): v is T => (allowed as readonly unknown[]).includes(v))));
}

/**
 * Normalize a scope answer. Returns null only when the answer is not a JSON
 * object at all; otherwise `usable` says whether it is complete enough to act
 * on (an incomplete one gives the next model in the chain a turn).
 */
export function parseScopeJson(text: string, ctx: TextContext): Parsed<BriefScope> | null {
  const raw = extractJson(text);
  if (!raw) return null;
  const issues: string[] = [];
  const product = parseProduct(raw.product, 'product', issues);
  const policyRaw = asObject(raw.policy);

  const scope: BriefScope = {
    isProjectIdea: raw.isProjectIdea === true,
    rejection: pick(raw.rejection, REJECTIONS, 'none', 'rejection', issues),
    policy: {
      status: pick(policyRaw.status, POLICY_STATUSES, 'ok', 'policy.status', issues),
      topics: oneOfList(policyRaw.topics, POLICY_TOPICS),
      note: label(policyRaw.note, CAPS.sentence, ctx),
    },
    title: label(raw.title, CAPS.title, ctx),
    summary: prose(raw.summary, CAPS.summary, 'summary', issues, ctx),
    clarity: pick(raw.clarity, CLARITY, 'clear', 'clarity', issues),
    audience: asList(raw.audience)
      .map(v => asObject(v))
      .map(a => ({ segment: label(a.segment, CAPS.label, ctx), need: prose(a.need, CAPS.sentence, 'audience.need', issues, ctx) }))
      .filter(a => a.segment)
      .slice(0, CAPS.audience),
    roles: labelList(raw.roles, CAPS.roles, 40, ctx),
    product: product ?? FALLBACK_PRODUCT,
    platforms: oneOfList<Platform>(raw.platforms, ['ios', 'android']),
    approach: pick<MobileApproach>(raw.approach, ['cross', 'native'], 'cross', 'approach', issues),
    hasDesigns: raw.hasDesigns === true,
    uiLanguages: intIn(raw.uiLanguages, 1, 3, 0),
    urgency: pick<Urgency>(raw.urgency, ['flexible', 'normal', 'rush'], 'normal', 'urgency', issues),
    features: parseScopeItems(raw.features, FEATURE_BY_ID, CAPS.features, 'features', issues, ctx),
    integrations: parseScopeItems(raw.integrations, INTEGRATION_BY_ID, CAPS.integrations, 'integrations', issues, ctx),
    extraDeliverables: parseExtras(raw.extraDeliverables, product, issues, ctx),
    unpricedItems: labelList(raw.unpricedItems, CAPS.unpriced, CAPS.shortText, ctx),
    complexityFlags: oneOfList(raw.complexityFlags, COMPLEXITY_FLAGS),
    stack: Array.from(new Set(asList(raw.stack).filter((t): t is string => typeof t === 'string' && TECH_BY_ID.has(t)))).slice(
      0,
      CAPS.stack
    ),
    assumptions: proseList(raw.assumptions, CAPS.assumptions, CAPS.sentence, 'assumptions', issues, ctx),
  };
  scope.title = scope.title || clip(scope.summary, CAPS.title);

  return { value: scope, issues, usable: isUsable(scope, !!product, issues) };
}

/** Is the policy verdict a complete answer on its own (no brief follows)? */
export function isPolicyDecline(scope: BriefScope): boolean {
  return ENFORCE_POLICY_DECLINE && scope.policy.status === 'decline';
}

/**
 * Complete enough to act on? Rejections and policy declines are complete
 * answers by definition — the 2026-10 audit found the microloan decline
 * failing as "missing questions" and reaching the visitor as a generic error.
 */
function isUsable(scope: BriefScope, hasValidProduct: boolean, issues: string[]): boolean {
  if (isRejected(scope) || isPolicyDecline(scope)) return true;
  const missing: string[] = [];
  if (!hasValidProduct) missing.push('product');
  if (!scope.title || !scope.summary) missing.push('title/summary');
  if (missing.length) issues.push(`unusable: missing ${missing.join(', ')}`);
  return missing.length === 0;
}

/**
 * The model said "not a project" (or flagged it). A vague-but-scoped idea is
 * still a project: the prompt asks for vague one-liners to be scoped with
 * assumptions, so a complete scope outranks a stray 'too_vague'.
 */
export function isRejected(scope: BriefScope): boolean {
  if (!scope.isProjectIdea) return true;
  if (scope.rejection === 'abusive' || scope.rejection === 'not_software') return true;
  return scope.rejection === 'too_vague' && scope.features.length === 0;
}

/** Rejection reason to report (normalizes contradictory flags). */
export function rejectionReason(scope: BriefScope): 'not_software' | 'abusive' | 'too_vague' {
  return scope.rejection === 'none' ? 'not_software' : scope.rejection;
}
