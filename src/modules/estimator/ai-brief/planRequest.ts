import { createHash, randomUUID } from 'node:crypto';
import type { Range } from '@/modules/estimator/types';
import { BRIEF_LOCALES, MAX_IDEA_CHARS, type BriefLocale } from '@/modules/estimator/ai-brief/constants';
import { parseContact } from '@/modules/estimator/ai-brief/contact';
import type { BriefRun } from '@/modules/estimator/ai-brief/orchestrator';
import { openPlan, sealPlan, type SealedPlan } from '@/modules/estimator/ai-brief/requestToken';

/**
 * "Send request": a visitor's contact plus the sealed plan becomes a lead.
 * Storage and Telegram are injected, so the rules are testable: a request is
 * lost only when BOTH fail, and no price ever comes from the browser.
 */

export const PLAN_LEAD_SOURCE = 'ai-plan';
export const PLAN_SPAM_SOURCE = 'ai-plan:spam';
const MAX_NAME = 120;
const MAX_CONTACT = 120;
const MAX_COMMENT = 1000;
const MAX_SCOPE_ITEMS = 12;
const MAX_UNPRICED_CHARS = 400;
/** Telegram's limit is 4096 characters. */
const MAX_NOTICE_CHARS = 3800;
const NOTICE_IDEA_CHARS = 900;

/** Control, zero-width and bidi characters, plus Unicode line breaks. */
const UNSAFE_CHARS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;

/** Cut by characters, never inside an emoji. */
function cut(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).replace(/\p{Cs}$/u, '');
}

/** One safe line: a crafted name cannot forge another line of the owner's message. */
function cleanLine(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return cut(value.replace(UNSAFE_CHARS, ' ').replace(/\s+/g, ' ').trim(), max);
}

/* ------------------------------ the sealed plan ------------------------------ */

/** The token of a finished run; null when it delivered no brief or no secret is set (the lead then carries the idea only). */
export function planToken(
  run: BriefRun,
  locale: BriefLocale,
  secret: string | undefined,
  now: number,
  shownFrom: number | null = null
): string | null {
  if (run.outcome.status !== 'ok' || !run.quote) return null;
  const { brief } = run.outcome;
  const { estimate } = brief;
  const ids = (phase: 'mvp' | 'later') => [...brief.features, ...brief.integrations].filter(i => i.phase === phase).map(i => i.id);
  return sealPlan(
    {
      id: randomUUID(),
      issuedAt: now,
      locale,
      idea: run.scrubbedIdea,
      title: brief.title,
      product: `${estimate.config.projectType}/${estimate.config.subtype}`,
      mvp: ids('mvp'),
      later: ids('later'),
      unpriced: estimate.unpricedItems,
      discovery: estimate.mode === 'discovery' ? estimate.reasons : [],
      quote: run.quote,
      shownFrom,
    },
    secret
  );
}

/* ------------------------------ the request ------------------------------ */

export interface PlanRequest {
  name: string;
  contact: string;
  comment: string;
  locale: BriefLocale;
  idea: string;
  plan: SealedPlan | null;
  isSpam: boolean;
}

export type ParsedPlanRequest = { ok: true; value: PlanRequest } | { ok: false; field: 'body' | 'name' | 'contact' | 'idea' };

/** The validated request, or the field that is wrong. Any price or plan field in the body is ignored. */
export function parsePlanRequest(body: unknown, secret: string | undefined, now: number): ParsedPlanRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, field: 'body' };
  const raw = body as Record<string, unknown>;
  const name = cleanLine(raw.name, MAX_NAME);
  if (!name) return { ok: false, field: 'name' };
  const contact = parseContact(cleanLine(raw.contact, MAX_CONTACT));
  if (!contact) return { ok: false, field: 'contact' };
  const plan = openPlan(raw.token, secret, now);
  const idea = cleanLine(plan ? plan.idea : raw.idea, MAX_IDEA_CHARS);
  if (!idea) return { ok: false, field: 'idea' };
  const locale = BRIEF_LOCALES.find(l => l === raw.locale) ?? 'en';
  const isSpam = cleanLine(raw.website, 10) !== '';
  return { ok: true, value: { name, contact, comment: cleanLine(raw.comment, MAX_COMMENT), locale, idea, plan, isSpam } };
}

/** The same submission has the same id (a double click is one lead); a corrected name or a new comment is a new one. */
export function requestId({ name, contact, comment, plan, idea, isSpam }: PlanRequest, now: number): string {
  const day = new Date(now).toISOString().slice(0, 10);
  const hash = createHash('sha256')
    .update(JSON.stringify([plan ? plan.id : [day, idea], name, contact, comment, isSpam]))
    .digest('hex');
  // The uuid column's shape, marked as a version 8 (custom) uuid.
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/* ------------------------------ the owner's text ------------------------------ */

const money = ({ min, max }: Range) => `$${min.toLocaleString('en-US')}–${max.toLocaleString('en-US')}`;
const span = ({ min, max }: Range, unit: string) => `${min}–${max} ${unit}`;
const list = (items: string[]) =>
  items.slice(0, MAX_SCOPE_ITEMS).join(', ') + (items.length > MAX_SCOPE_ITEMS ? ` +${items.length - MAX_SCOPE_ITEMS} more` : '');

/** English, numbers first. The price is the engine's own, opened from the sealed plan. */
export function ownerLines(request: PlanRequest, ideaMax = MAX_IDEA_CHARS): string[] {
  const { plan, comment, locale } = request;
  const idea = `Idea: ${cut(request.idea, ideaMax)}${request.idea.length > ideaMax ? '… (cut)' : ''}`;
  const head = [comment ? `Comment: ${comment}` : '', `Page language: ${locale}`];
  if (!plan) return [...head, 'Plan: not attached (no valid code). Idea only, no engine price', idea].filter(Boolean);
  const line = (label: string, q: SealedPlan['quote']['mvp']) =>
    `${label}: local ${money(q.local)}, en page ${money(q.en)} · ${span(q.weeks, 'weeks')} · ${span(q.hours, 'h')}`;
  return [
    ...head,
    `Plan: ${cleanLine(plan.title, 200)} (${plan.product})`,
    plan.discovery.length > 0 ? `VERY LARGE IDEA, discovery call first: ${list(plan.discovery)}. Numbers below are rough` : '',
    plan.shownFrom ? `Visitor saw: from $${plan.shownFrom.toLocaleString('en-US')} (first version)` : 'Visitor saw no price',
    line('Engine price, first version (internal)', plan.quote.mvp),
    plan.quote.full ? line('With everything planned for later', plan.quote.full) : '',
    plan.unpriced.length > 0 ? `Not in the price: ${cleanLine(list(plan.unpriced), MAX_UNPRICED_CHARS)}` : '',
    `First version: ${list(plan.mvp)}`,
    plan.later.length > 0 ? `Later: ${list(plan.later)}` : '',
    idea,
  ].filter(Boolean);
}

/** Plain text (no parse_mode): nothing to escape, nothing a name can break. */
export function ownerNotice(request: PlanRequest, isStored: boolean, adminUrl: string): string {
  const lines = [
    'AI plan request from softwhere.uz',
    `Name: ${request.name}`,
    `Contact: ${request.contact}`,
    isStored ? `Admin: ${adminUrl}` : 'NOT SAVED in the admin (database error): keep this message',
    '',
    ...ownerLines(request, NOTICE_IDEA_CHARS),
  ];
  return cut(lines.join('\n'), MAX_NOTICE_CHARS);
}

/* ------------------------------ delivery ------------------------------ */

export interface RequestDeps {
  /** Inserts the lead unless its id exists. */
  store(lead: { id: string; name: string; phone: string; message: string; source: string }): Promise<{
    isNew: boolean;
    notified: 'pending' | 'sent' | 'failed';
  }>;
  notify(text: string): Promise<boolean>;
  markNotified(id: string, ok: boolean): Promise<void>;
  /** Runs after the answer went out. */
  later(task: () => Promise<void>): void;
  onStoreError(): void;
  adminUrl: string;
  now: number;
}

/** False only when neither the database nor Telegram took the request. */
export async function deliverRequest(request: PlanRequest, deps: RequestDeps): Promise<boolean> {
  const id = requestId(request, deps.now);
  const lead = {
    id,
    name: request.name,
    phone: request.contact,
    message: ownerLines(request).join('\n'),
    source: request.isSpam ? PLAN_SPAM_SOURCE : PLAN_LEAD_SOURCE,
  };
  let saved: Awaited<ReturnType<RequestDeps['store']>>;
  try {
    saved = await deps.store(lead);
  } catch {
    deps.onStoreError();
    // The database is down: Telegram is the only record, so wait for it.
    return deps.notify(ownerNotice(request, false, deps.adminUrl)).catch(() => false);
  }
  const needsNotice = saved.isNew || saved.notified === 'failed';
  if (request.isSpam || !needsNotice) return true;
  deps.later(async () => {
    const ok = await deps.notify(ownerNotice(request, true, deps.adminUrl)).catch(() => false);
    await deps.markNotified(id, ok).catch(() => {});
  });
  return true;
}
