import type { JsonSchemaSpec } from '@/core/ai';
import { FEATURES, INTEGRATIONS, SERVICES, TECH } from '@/modules/estimator/data/catalog';
import {
  BLOCK_KINDS,
  CLARITY,
  COMPLEXITY_FLAGS,
  DEVICES,
  PHASES,
  POLICY_STATUSES,
  POLICY_TOPICS,
  REJECTIONS,
} from '@/modules/estimator/ai-brief/constants';

/**
 * Strict MFJS json_schema contracts for the brief's calls (explicit
 * `type` on every property, every property required, no oneOf/format/min/max).
 * Every catalog choice is an `enum`, so the model can only pick ids the
 * estimator engine knows how to price, and every narrative claim about a
 * phase must name a ref from the same closed set. Parsing lives in
 * `parseScope.ts`, `parseNarrative.ts` and `screens.ts`. Both wireframe halves
 * share `SCREENS_JSON_SCHEMA`.
 */

/** `type:subtype` ids, e.g. 'mobile:delivery' — one enum keeps the pair valid. */
export const PRODUCT_IDS: string[] = SERVICES.flatMap(s => s.subtypes.map(st => `${s.id}:${st.id}`));

/** 'core' = the primary product's base build; 'unpriced' = outside the estimate. */
export const CORE_REF = 'core';
export const UNPRICED_REF = 'unpriced';
export const REF_IDS: string[] = [CORE_REF, UNPRICED_REF, ...FEATURES.map(f => f.id), ...INTEGRATIONS.map(i => i.id), ...PRODUCT_IDS];

type Schema = Record<string, unknown>;
const str = (description?: string): Schema => ({ type: 'string', ...(description && { description }) });
const int = (description: string): Schema => ({ type: 'integer', description });
const bool = (description: string): Schema => ({ type: 'boolean', description });
const oneOf = (values: readonly string[], description?: string): Schema => ({
  type: 'string',
  enum: [...values],
  ...(description && { description }),
});
const arr = (items: Schema, description?: string): Schema => ({ type: 'array', items, ...(description && { description }) });
const obj = (properties: Record<string, Schema>, description?: string): Schema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
  ...(description && { description }),
});

const scopeItem = (ids: string[]) =>
  obj({ id: oneOf(ids), phase: oneOf(PHASES), note: str('Why this item, in the page language, max 8 words') });

/**
 * Field order is the order the model writes in: every scope decision first,
 * then the visible prose written FROM those decisions. With the summary and
 * the assumptions first (round 1–2), the model described the idea and then
 * scoped it — and the summary promised what `unpricedItems` excluded.
 */
export const SCOPE_JSON_SCHEMA: JsonSchemaSpec = {
  name: 'project_scope',
  schema: obj({
    isProjectIdea: bool('false for greetings, spam, random text, abuse, or no inferable product'),
    rejection: oneOf(REJECTIONS),
    policy: obj({
      status: oneOf(POLICY_STATUSES),
      topics: arr(oneOf(POLICY_TOPICS)),
      note: str('One calm sentence when status is ask/decline, else empty'),
    }),
    product: oneOf(PRODUCT_IDS, 'Primary deliverable to build first'),
    platforms: arr(oneOf(['ios', 'android']), 'Mobile only; empty otherwise'),
    approach: oneOf(['cross', 'native']),
    hasDesigns: bool('true only if the idea says designs already exist'),
    uiLanguages: int('Number of interface languages, 1-3'),
    urgency: oneOf(['flexible', 'normal', 'rush']),
    features: arr(scopeItem(FEATURES.map(f => f.id))),
    integrations: arr(scopeItem(INTEGRATIONS.map(i => i.id))),
    extraDeliverables: arr(obj({ product: oneOf(PRODUCT_IDS), reason: str('One sentence to the reader') })),
    unpricedItems: arr(str()),
    complexityFlags: arr(oneOf(COMPLEXITY_FLAGS)),
    stack: arr(oneOf(TECH.map(t => t.id))),
    clarity: oneOf(CLARITY),
    title: str('Working product name, max 6 words'),
    summary: str('2 sentences: what the scoped product does and for whom; never an unpriced item'),
    audience: arr(obj({ segment: str(), need: str() })),
    roles: arr(str(), 'MVP user roles, main user first, 1-4 short labels'),
    assumptions: arr(str(), '2-4, each consistent with every choice above'),
  }),
};

const refItem = (description: string) => oneOf(REF_IDS, description);

/** Call 2 — what to build first, what can wait, the phases. */
export const PLAN_JSON_SCHEMA: JsonSchemaSpec = {
  name: 'project_plan',
  schema: obj({
    buildFirst: obj({ what: str(), why: str() }),
    canWait: arr(obj({ item: str(), reason: str(), ref: refItem('A LATER ref, an EXTRA product ref, or "unpriced"') })),
    phases: arr(
      obj({
        id: oneOf(['mvp', 'growth']),
        title: str(),
        goal: str(),
        deliverables: arr(obj({ text: str(), ref: refItem('mvp: "core" or an MVP ref; growth: a LATER or EXTRA ref') })),
      })
    ),
  }),
};

/** Call 3 — risks and discovery questions. */
export const RISKS_JSON_SCHEMA: JsonSchemaSpec = {
  name: 'project_risks',
  schema: obj({
    risks: arr(obj({ title: str(), detail: str(), mitigation: str() })),
    questions: arr(str()),
  }),
};

export const SCREENS_JSON_SCHEMA: JsonSchemaSpec = {
  name: 'wireframe_screens',
  schema: obj({
    screens: arr(
      obj({
        name: str(),
        purpose: str(),
        device: oneOf(DEVICES),
        phase: oneOf(PHASES),
        blocks: arr(obj({ kind: oneOf(BLOCK_KINDS), label: str(), items: arr(str()) })),
      })
    ),
  }),
};

/** Sample content both wireframe halves share (written in parallel with the scope). */
export const SAMPLES_JSON_SCHEMA: JsonSchemaSpec = {
  name: 'wireframe_samples',
  schema: obj({ samples: arr(str('2-6 words: an item with its price, a place, a plan or category name')) }),
};

/** Uzbek copy-edit: short find → replace spans (a whole rewritten string took 3× the output time). */
export const POLISH_JSON_SCHEMA: JsonSchemaSpec = {
  name: 'uzbek_copy_edit',
  schema: obj({
    fixes: arr(
      obj({
        id: int('The number of the string'),
        find: str('The wrong words, copied exactly from that string'),
        replace: str('The corrected words'),
      })
    ),
  }),
};
