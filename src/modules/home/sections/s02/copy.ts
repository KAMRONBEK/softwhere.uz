import type { Messages } from 'next-intl';
import { LAB_PROJECTS, type LabProject } from '../../media/portfolio';
import { splitWords } from '../../components/splitWords';

/**
 * Structure of 02 · Manifesto. The words live in
 * src/messages/home/manifesto/{en,ru,uz}.json; this file keeps the order, the
 * poster layout and which outcomes the portfolio backs. The statement is the
 * section; the numbers live in 14 · Numbers. The outcomes tape lists only the
 * kinds of product the portfolio really contains (two or more projects each),
 * so it stays true as projects are added or removed.
 */

export type StatementKey = 'easy' | 'hard' | 'payoff';

export interface StatementLine {
  key: StatementKey;
  /** Words of the line, in order. */
  words: readonly string[];
  /** Word indexes after which the line breaks on narrow screens. */
  narrowBreaks: readonly number[];
  /** Share of the column width the line is fitted to on wide screens. */
  wideShare: number;
  align: 'start' | 'end';
  /** The last, loudest line. */
  isPayoff?: boolean;
}

type StatementLayout = Omit<StatementLine, 'words' | 'narrowBreaks'>;

const STATEMENT_LAYOUT: readonly StatementLayout[] = [
  { key: 'easy', wideShare: 0.8, align: 'start' },
  { key: 'hard', wideShare: 0.8, align: 'end' },
  { key: 'payoff', wideShare: 1, align: 'start', isPayoff: true },
];

/** A dash stays at the end of a row (Russian typesetting: a row never starts with one). */
const DASH = /^[—–-]$/;

/**
 * Where a line breaks on narrow screens: the one break that keeps its two
 * rows closest in length (the earlier one on a tie), so every language gets a
 * balanced poster without per-locale tables.
 */
export function narrowBreaksFor(words: readonly string[]): number[] {
  let best = -1;
  let bestWidest = Infinity;
  for (let index = 0; index < words.length - 1; index++) {
    if (DASH.test(words[index + 1] ?? '')) continue;
    const first = words.slice(0, index + 1).join(' ').length;
    const second = words.slice(index + 1).join(' ').length;
    const widest = Math.max(first, second);
    if (widest < bestWidest) {
      best = index;
      bestWidest = widest;
    }
  }
  return best >= 0 ? [best] : [];
}

/** The statement's lines from their translated text (`statement.<key>`). */
export function buildStatement(textOf: (key: StatementKey) => string): StatementLine[] {
  return STATEMENT_LAYOUT.map(layout => {
    const words = splitWords(textOf(layout.key));
    return { ...layout, words, narrowBreaks: narrowBreaksFor(words) };
  });
}

/** What the studio builds (the wide tape), in order; labels are `services.<id>`. */
export const SERVICE_IDS = ['websites', 'mobileApps', 'telegramBots', 'miniApps', 'aiAgents', 'automation'] as const;

/** An outcome's label key: src/messages/home/manifesto/en.json `outcomes`. */
export type OutcomeId = keyof Messages['home']['manifesto']['outcomes'];

interface OutcomeRule {
  id: OutcomeId;
  /** Tested against the project's type and English description. */
  pattern: RegExp;
}

/** Outcomes a business buyer recognises, most asked-for first; labels are `outcomes.<id>`. */
const OUTCOME_RULES: readonly OutcomeRule[] = [
  { id: 'booking', pattern: /\bbook(ing|s)?\b/i },
  { id: 'stores', pattern: /e-commerce|storefront|online mall|multi-vendor marketplace/i },
  { id: 'taxi', pattern: /\btaxi\b|ride-hailing|chauffeur/i },
  { id: 'delivery', pattern: /\bdelivery\b/i },
  { id: 'tracking', pattern: /track (them|it) live|live tracking|live order status|live map/i },
  { id: 'admin', pattern: /admin dashboard|admin panel|operator panel|driver and admin/i },
  { id: 'messengers', pattern: /messenger/i },
  { id: 'signatures', pattern: /legally binding|E-IMZO/i },
  { id: 'payments', pattern: /in-app payments|Stripe payments|in-app purchases/i },
  { id: 'healthcare', pattern: /healthcare|urgent care|therapists|doctors/i },
];

const MIN_EVIDENCE = 2;

function outcomesIn(projects: readonly LabProject[]): OutcomeId[] {
  return OUTCOME_RULES.filter(
    rule => projects.filter(project => rule.pattern.test(`${project.type} ${project.description}`)).length >= MIN_EVIDENCE
  ).map(rule => rule.id);
}

/** What clients get (the thin tape): only outcomes the portfolio backs. */
export const OUTCOME_IDS = outcomesIn(LAB_PROJECTS);
