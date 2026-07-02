/**
 * Deterministic post-generation quality checks shared by the CLI and the API
 * route. Two jobs:
 *  1. Slop lint — flag the highest-precision "AI tells" (from Wikipedia's
 *     "Signs of AI writing" + its Russian counterpart) so a revision call can
 *     fix them. Regex-based: free, instant, no LLM judgment involved.
 *  2. Link audit — every external URL in the body must come from the fact
 *     sheet (or be an internal/site link). A URL the pipeline didn't fetch or
 *     verify is treated as fabricated.
 */

export type Locale = 'en' | 'ru' | 'uz';

export interface LintIssue {
  type: 'slop' | 'structure' | 'link' | 'language';
  detail: string;
}

export interface LintOptions {
  locale: Locale;
  /** URLs the post is allowed to cite (fact sheet sources + image URLs). */
  allowedUrls: Iterable<string>;
}

// High-precision phrases only — anything with a real false-positive rate in
// tech writing (e.g. "robust", "crucial") stays out of the deterministic list
// and lives in the prompt's softer BANNED guidance instead.
const EN_BANNED: RegExp[] = [
  /\bdelve\b/i,
  /\btapestry\b/i,
  /\bstands as a testament\b/i,
  /\bplays? a (vital|pivotal|crucial) role\b/i,
  /\bin today'?s (fast-paced|digital|competitive|ever-changing|modern)\b/i,
  /\bnavigat\w+ the .{0,20}landscape\b/i,
  /\bunlock the (power|potential)\b/i,
  /\bunleash\w*\b/i,
  /\bgame-?changer\b/i,
  /\bit'?s worth noting\b/i,
  /\bin conclusion\b/i,
  /\bever-evolving\b/i,
  /\belevate your\b/i,
  /\bseamlessly\b/i,
];

const RU_BANNED: RegExp[] = [
  /важно отметить/i,
  /стоит отметить/i,
  /играет (ключевую|важную|решающую) роль/i,
  /в современном мире/i,
  /является неотъемлемой частью/i,
  /подч[её]ркивает (важность|значимость)/i,
  /в заключение/i,
  /^#{1,6}\s*Заключение\s*$/im,
];

/** "not just X, but Y" and variants — one per post is tolerable, more is a tell. */
const NEGATIVE_PARALLELISM = /\bnot (?:just|only|merely)\b[^.\n]{3,80}\bbut\b/gi;
const SENTENCE_OPENERS = /(?:^|\. )(Additionally|Moreover|Furthermore),/g;

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

function letterStats(text: string): { cyrillic: number; latin: number } {
  const cyrillic = countMatches(text, /[Ѐ-ӿ]/g);
  const latin = countMatches(text, /[a-zA-Z]/g);
  return { cyrillic, latin };
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}

/** All absolute http(s) URLs in the markdown body, excluding code blocks and
 *  inline code (example endpoints in code are not citations). */
function extractExternalUrls(content: string): string[] {
  const withoutCode = content.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return (withoutCode.match(/https?:\/\/[^\s)\]>"']+/g) ?? []).map(u => u.replace(/[.,;:!?]+$/, ''));
}

/** Hostname-based internal-site check (a substring test would let
 *  evil.com/?x=softwhere.uz through the fabricated-citation gate). */
function isOwnSiteUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'softwhere.uz' || host.endsWith('.softwhere.uz');
  } catch {
    return false;
  }
}

export function lintContent(content: string, opts: LintOptions): LintIssue[] {
  const issues: LintIssue[] = [];
  const words = content.split(/\s+/).filter(Boolean).length;

  // --- Slop patterns -------------------------------------------------------
  const banned = opts.locale === 'ru' ? RU_BANNED : EN_BANNED;
  for (const re of banned) {
    const m = content.match(re);
    if (m) issues.push({ type: 'slop', detail: `Banned phrase used: "${m[0]}"` });
  }

  if (opts.locale === 'en') {
    const parallelisms = countMatches(content, NEGATIVE_PARALLELISM);
    if (parallelisms > 1) {
      issues.push({ type: 'slop', detail: `"not just X, but Y" used ${parallelisms} times — keep at most one` });
    }
    const openers = countMatches(content, SENTENCE_OPENERS);
    if (openers > 2) {
      issues.push({ type: 'slop', detail: `Sentences opened with Additionally/Moreover/Furthermore ${openers} times — vary transitions` });
    }
  }

  // English only: Russian uses тире (—) as core punctuation ("X — это Y"),
  // so density there says nothing about slop.
  if (opts.locale === 'en') {
    const emDashes = countMatches(content, /—/g);
    if (words > 0 && emDashes / words > 5 / 1000) {
      issues.push({ type: 'slop', detail: `Em-dash overuse: ${emDashes} in ${words} words — cut to a handful` });
    }
  }

  // --- Language sanity -----------------------------------------------------
  const { cyrillic, latin } = letterStats(content);
  const letters = cyrillic + latin;
  if (letters > 200) {
    const cyrRatio = cyrillic / letters;
    if (opts.locale === 'ru' && cyrRatio < 0.5) {
      issues.push({ type: 'language', detail: `Post should be Russian but is only ${Math.round(cyrRatio * 100)}% Cyrillic` });
    }
    // Uzbek must be Latin script; heavy Cyrillic means the model drifted into
    // Russian or Uzbek Cyrillic.
    if (opts.locale === 'uz' && cyrRatio > 0.15) {
      issues.push({
        type: 'language',
        detail: `Uzbek post contains ${Math.round(cyrRatio * 100)}% Cyrillic — must be Uzbek in Latin script`,
      });
    }
    if (opts.locale === 'en' && cyrRatio > 0.05) {
      issues.push({ type: 'language', detail: `English post contains unexpected Cyrillic text` });
    }
  }

  // --- Structure -----------------------------------------------------------
  const firstLine = content.split('\n').find(l => l.trim().length > 0) ?? '';
  if (!firstLine.startsWith('# ')) {
    issues.push({ type: 'structure', detail: 'Post must start with a single H1 title line' });
  }

  if (opts.locale === 'en') {
    const headings = content.match(/^#{2,3}\s+(.+)$/gm) ?? [];
    const titleCased = headings.filter(h => {
      const text = h.replace(/^#{2,3}\s+/, '').replace(/[^\w\s'-]/g, '');
      const ws = text.split(/\s+/).filter(w => w.length > 3);
      if (ws.length < 4) return false;
      const caps = ws.filter(w => /^[A-Z]/.test(w)).length;
      return caps / ws.length > 0.7;
    });
    if (titleCased.length > 2) {
      issues.push({ type: 'slop', detail: `${titleCased.length} headings in Title Case — use sentence case` });
    }
  }

  // --- Link audit ----------------------------------------------------------
  const allowed = new Set([...opts.allowedUrls].map(normalizeUrl));
  const unapproved = new Set<string>();
  for (const url of extractExternalUrls(content)) {
    const norm = normalizeUrl(url);
    if (isOwnSiteUrl(url)) continue;
    // Prefix tolerance both ways: the URL regex stops at ')' so an allowed
    // URL containing parentheses extracts as a strict prefix of itself.
    const ok = [...allowed].some(a => norm === a || norm.startsWith(`${a}/`) || a.startsWith(norm));
    if (!ok) unapproved.add(url);
  }
  for (const url of unapproved) {
    issues.push({ type: 'link', detail: `External URL not in the verified source list (likely fabricated): ${url}` });
  }

  return issues;
}

/**
 * Turn lint issues into a surgical revision instruction. The revision call
 * must fix ONLY the flagged problems — a full rewrite would re-roll quality.
 */
export function buildRevisionInstruction(issues: LintIssue[]): string {
  const list = issues.map((i, n) => `${n + 1}. [${i.type}] ${i.detail}`).join('\n');
  return `The draft below failed an automated quality check. Fix ONLY the listed problems — do not restructure, shorten, or rewrite anything that was not flagged. For fabricated/unapproved URLs: remove the link (and the claim it supported, unless it can stand without a number). For banned phrases: reword that sentence naturally. Keep the same language as the draft.

PROBLEMS:
${list}

Output ONLY the corrected, complete Markdown post (starting with the H1). No commentary.`;
}
