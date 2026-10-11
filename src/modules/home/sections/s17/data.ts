import { splitWords } from '../../components/splitWords';

/**
 * Section 10 · AI on your docs (rag-build): the demo's fixed data. Every word
 * a visitor reads lives in src/messages/home/rag-build/<locale>.json (read
 * with useTranslations('home.rag-build')); this file keeps the ids, the
 * numbers and the structure the components and the machine run on.
 *
 * Nothing here names a client or claims a number about SoftWhere. The company,
 * its five files, the snippets and the scores are a sample ("Your Logistics
 * Co.", like 07's "Your Café"). The one proof line describes a shipped project
 * without its name (founder's rule for the story sections), and it is true to
 * projects.ts: an AI study platform (PostgreSQL + pgvector, RAG) whose tutor
 * answers from the material you upload, in Uzbek, English and Russian.
 *
 * Plain words on screen: a passage is a "snippet" and a similarity score is a
 * "% match" (the code keeps the engineering names).
 *
 * The weeks are what the estimator (src/modules/estimator/utils/estimator.ts →
 * calculateEstimate) gives, computed 2026-10-11 (mvp, 2 languages, normal
 * urgency, custom design):
 * - 4–6 weeks: an assistant on your files (ai · rag, file_upload + admin_panel,
 *   telegram_channel). The same scope and result as 12 · ai-demo's "AI support
 *   assistant" example; a Telegram support bot with a RAG knowledge base, an
 *   admin and uploads gives 4–5.
 * - 7–9 weeks: the same with roles and reports, like this demo (web · saas,
 *   6 screens, rag_kb + roles + admin_panel + file_upload + reports_export).
 */

export type DocId = 'rates' | 'handbook' | 'customs' | 'warehouse' | 'hr';
export type ClusterId = 'rates' | 'customs' | 'fleet' | 'warehouse' | 'hr';
export type QuestionId = 'surcharge' | 'salary' | 'charity';
export type RoleId = 'dispatcher' | 'hr';
export type Outcome = 'answered' | 'blocked' | 'missing';
export type PartId = 'read' | 'index' | 'answer' | 'guard' | 'insights';
export type TabId = 'chat' | 'insights';
export type AnchorId = 'surcharge' | 'customsFee' | 'fuelCards' | 'payGrades' | 'payReview' | 'leave' | 'volume' | 'minLoad' | 'palletRate';
/** A quoted passage's anchor: its "where" and its quote are messages (`sources.<anchor>`). */
export type SourceAnchor = 'surcharge' | 'customsFee' | 'payGrades' | 'volume';
export type ReplyId = 'surcharge' | 'salaryBlocked' | 'salaryOpen' | 'charity';
export type BadgeId = 'hrOnly' | 'logged';

export interface DocDef {
  id: DocId;
  kind: 'PDF' | 'XLSX' | 'WIKI' | 'DOCX';
  /** Its length, shown as "3 sheets" / "64 pages" (`units.<unit>`). */
  size: { count: number; unit: 'sheets' | 'pages' };
  /** Snippets (passages) it is split into; each one is a dot on the map. */
  passages: number;
  /** Only the HR policy is restricted (HR managers only). */
  isHrOnly: boolean;
  /** How many of its passages land in each topic cluster (sums to `passages`). */
  spread: Partial<Record<ClusterId, number>>;
}

export const DOCS: readonly DocDef[] = [
  {
    id: 'rates',
    kind: 'XLSX',
    size: { count: 3, unit: 'sheets' },
    passages: 24,
    isHrOnly: false,
    spread: { rates: 20, customs: 2, warehouse: 2 },
  },
  {
    id: 'handbook',
    kind: 'PDF',
    size: { count: 64, unit: 'pages' },
    passages: 38,
    isHrOnly: false,
    spread: { fleet: 28, rates: 6, customs: 4 },
  },
  {
    id: 'customs',
    kind: 'WIKI',
    size: { count: 18, unit: 'pages' },
    passages: 26,
    isHrOnly: false,
    spread: { customs: 22, fleet: 4 },
  },
  {
    id: 'warehouse',
    kind: 'DOCX',
    size: { count: 22, unit: 'pages' },
    passages: 28,
    isHrOnly: false,
    spread: { warehouse: 24, fleet: 4 },
  },
  { id: 'hr', kind: 'PDF', size: { count: 40, unit: 'pages' }, passages: 32, isHrOnly: true, spread: { hr: 32 } },
];

export const TOTAL_PASSAGES = DOCS.reduce((sum, doc) => sum + doc.passages, 0);

export const CLUSTER_IDS: readonly ClusterId[] = ['rates', 'customs', 'fleet', 'warehouse', 'hr'];

export const ROLE_IDS: readonly RoleId[] = ['dispatcher', 'hr'];

export const PART_IDS: readonly PartId[] = ['read', 'index', 'answer', 'guard', 'insights'];

/** A passage the assistant quotes: [n] in the answer, a row under it, a lit card and dot. */
export interface SourceDef {
  anchor: SourceAnchor;
  doc: DocId;
}

/** One retrieved passage: its dot, its similarity score and, when quoted, its citation number. */
export interface HitDef {
  anchor: AnchorId;
  score: number;
  cite?: number;
}

export interface ReplyDef {
  /** Its answer text is `replies.<id>`: [1] in it renders as a numbered chip. */
  id: ReplyId;
  outcome: Outcome;
  hits: readonly HitDef[];
  sources: readonly SourceDef[];
  /** Badge under a guarded answer (`badges.<id>`). */
  badge?: BadgeId;
}

export interface QuestionDef {
  /** Its chip and full text are `questions.<id>.chip` / `.text`. */
  id: QuestionId;
  /** The topic the insights file it under (a cluster's label). */
  topic: ClusterId;
  /** The answer, which can depend on who asks (only the salary question does). */
  reply: (role: RoleId) => ReplyDef;
}

/** Below this cosine similarity, a passage is not an answer. */
export const THRESHOLD = 0.75;

/** A similarity score in plain words: 0.89 → "89%". */
export function percent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

const SURCHARGE: ReplyDef = {
  id: 'surcharge',
  outcome: 'answered',
  hits: [
    { anchor: 'surcharge', score: 0.89, cite: 1 },
    { anchor: 'customsFee', score: 0.84, cite: 2 },
    { anchor: 'fuelCards', score: 0.78 },
  ],
  sources: [
    { anchor: 'surcharge', doc: 'rates' },
    { anchor: 'customsFee', doc: 'customs' },
  ],
};

const SALARY_BLOCKED: ReplyDef = {
  id: 'salaryBlocked',
  outcome: 'blocked',
  hits: [
    { anchor: 'payGrades', score: 0.91 },
    { anchor: 'payReview', score: 0.83 },
    { anchor: 'leave', score: 0.8 },
  ],
  sources: [],
  badge: 'hrOnly',
};

const SALARY_OPEN: ReplyDef = {
  id: 'salaryOpen',
  outcome: 'answered',
  hits: [
    { anchor: 'payGrades', score: 0.91, cite: 1 },
    { anchor: 'payReview', score: 0.83 },
    { anchor: 'leave', score: 0.8 },
  ],
  sources: [{ anchor: 'payGrades', doc: 'hr' }],
};

const CHARITY: ReplyDef = {
  id: 'charity',
  outcome: 'missing',
  hits: [
    { anchor: 'volume', score: 0.41, cite: 1 },
    { anchor: 'minLoad', score: 0.38 },
    { anchor: 'palletRate', score: 0.36 },
  ],
  sources: [{ anchor: 'volume', doc: 'rates' }],
  badge: 'logged',
};

export const QUESTIONS: readonly QuestionDef[] = [
  { id: 'surcharge', topic: 'rates', reply: () => SURCHARGE },
  { id: 'salary', topic: 'hr', reply: role => (role === 'hr' ? SALARY_OPEN : SALARY_BLOCKED) },
  { id: 'charity', topic: 'rates', reply: () => CHARITY },
];

export function question(id: QuestionId): QuestionDef {
  return QUESTIONS.find(q => q.id === id) ?? QUESTIONS[0];
}

export function docById(id: DocId): DocDef {
  return DOCS.find(doc => doc.id === id) ?? DOCS[0];
}

/** The best match among a reply's retrieved passages. */
export function bestScore(reply: ReplyDef): number {
  return Math.max(0, ...reply.hits.map(hit => hit.score));
}

export type AnswerSegment = { kind: 'word'; text: string } | { kind: 'cite'; n: number; after: string };

/** "a b [1]. c" → words and citation chips, in order; punctuation after a chip ("[1].") rides with it. */
export function answerSegments(text: string): AnswerSegment[] {
  return splitWords(text).map(token => {
    const match = /^\[(\d)\](.*)$/.exec(token);
    return match ? { kind: 'cite', n: Number(match[1]), after: match[2] } : { kind: 'word', text: token };
  });
}

/** Typical first versions, from the estimator (see the header note); the scope line is `timeline.<id>`. */
export const TIMELINE: ReadonlyArray<{ id: 'assistant' | 'roles'; weeks: { min: number; max: number } }> = [
  { id: 'assistant', weeks: { min: 4, max: 6 } },
  { id: 'roles', weeks: { min: 7, max: 9 } },
];

/** "What you get", in order (`get.<id>`). */
export const GET_IDS = ['assistant', 'admin', 'roles', 'report'] as const;
