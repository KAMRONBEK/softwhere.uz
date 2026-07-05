/**
 * Deterministic post-generation content normalizers applied by the pipeline
 * before persisting. Free, instant, no LLM judgment involved.
 */

/**
 * Rewrite locale-relative internal links the models sometimes emit without a
 * leading slash: from /{locale}/blog/<slug> a `](uz/estimator)` link resolves
 * to /uz/blog/<slug>/uz/estimator and 404s. `](/uz/estimator)` is what was
 * meant every time.
 */
export function normalizeInternalLinks(content: string): string {
  return content.replace(/\]\((en|ru|uz)([/#])/g, '](/$1$2');
}

const CHART_TYPES = new Set(['bar', 'horizontalBar', 'line', 'pie', 'doughnut', 'radar']);

/**
 * Convert fenced ```chart blocks (plain Chart.js v2 JSON emitted by the
 * writer) into QuickChart image markdown. The model previously had to
 * URL-encode a config into a link itself — fiddly enough that no live post
 * ever contained a chart. Now the model writes readable JSON and this
 * transformer builds the URL deterministically; malformed blocks are dropped
 * rather than shipped broken.
 */
export function renderChartBlocks(content: string): string {
  return content.replace(/```chart[^\S\n]*\n([\s\S]*?)```/g, (_match, body: string) => {
    try {
      const cfg = JSON.parse(body);
      if (!cfg || typeof cfg !== 'object' || !CHART_TYPES.has(cfg.type) || !cfg.data) return '';
      const caption = typeof cfg.caption === 'string' ? cfg.caption.trim() : '';
      delete cfg.caption; // our extension, not part of Chart.js
      // encodeURIComponent leaves ( ) ' ! * raw — a ')' in a label ("Cost
      // (USD)") would terminate the markdown link early. Escape them too.
      const encoded = encodeURIComponent(JSON.stringify(cfg)).replace(/[()'!*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
      const url = `https://quickchart.io/chart?w=800&h=450&bkg=white&c=${encoded}`;
      return `![${caption.replace(/[[\]]/g, '')}](${url})`;
    } catch {
      return ''; // unparseable config — drop the block entirely
    }
  });
}

// Everything that shows up where an Uzbek apostrophe belongs: straight quote,
// curly quotes, backtick, acute accent, and the (correct) modifier letters.
const OKINA = 'ʻ'; // ʻ — part of the letters oʻ/gʻ
const TUTUQ = 'ʼ'; // ʼ — tutuq belgisi (sunʼiy, maʼlumot)

// Segments that must never be rewritten: fenced/inline code, markdown link
// targets, and bare URLs (an apostrophe in a query string is data, not text).
const PROTECTED_SEGMENTS = /(```[\s\S]*?```|`[^`\n]*`|\]\([^)]*\)|https?:\/\/[^\s)]+)/g;

/**
 * Normalize Uzbek Latin apostrophes to the standard letters. Models emit a
 * random mix of U+0027/U+2018/U+2019 (sometimes within one document), which
 * fragments exact-match search ("toʻliq" ≠ "to'liq" ≠ "to‘liq") and reads as
 * unpolished. Position decides the letter: after o/g it is the oʻ/gʻ letter
 * (U+02BB); between letters elsewhere it is the tutuq belgisi (U+02BC).
 * Quote characters not adjacent to letters are left alone.
 */
export function normalizeUzbekApostrophes(text: string): string {
  return text
    .split(PROTECTED_SEGMENTS)
    .map((part, i) => {
      if (i % 2 === 1) return part; // protected segment — leave untouched
      return part.replace(/([oOgG])['‘’`´ʼ]/g, `$1${OKINA}`).replace(/(\p{L})['‘’`´](?=\p{L})/gu, `$1${TUTUQ}`);
    })
    .join('');
}

/**
 * Some drafts arrive with the ENTIRE post wrapped in one ```markdown … ```
 * (or a bare ``` … ```) fence, which renders the whole article as a literal
 * code block instead of prose (a live UZ post shipped this way, 2026-07). Strip
 * that single document-level wrapper. A post with its OWN inner code fences is
 * left untouched unless the wrapper is an explicit `markdown`/`md` fence, since
 * removing a bare outer ``` could unbalance an inner block.
 */
export function unwrapDocumentFence(content: string): string {
  const trimmed = content.trim();
  const m = /^```([a-zA-Z0-9+-]*)[^\S\n]*\r?\n([\s\S]*?)\r?\n```$/.exec(trimmed);
  if (!m) return content;
  const lang = m[1].toLowerCase();
  const inner = m[2];
  const isMarkdownWrapper = lang === 'markdown' || lang === 'md' || lang === 'mdx';
  // A bare/other-language fence is only safe to unwrap when the body has no
  // fence of its own — otherwise the trailing ``` we removed may belong to it.
  if (!isMarkdownWrapper && (lang !== '' || /^```/m.test(inner))) return content;
  return inner.trim();
}

/**
 * Remove a stray leading thematic break / hallucinated-frontmatter line (`---`,
 * `***`, or `___`) some drafts emit directly above the H1. It renders as a
 * spurious <hr> and, by displacing the leading `# Title`, defeats the reader
 * page's duplicate-H1 stripper. Only the very first line is touched, so real
 * in-body dividers are left alone.
 */
export function stripLeadingThematicBreak(content: string): string {
  return content.replace(/^﻿?[^\S\n]*(?:-{3,}|\*{3,}|_{3,})[^\S\n]*\r?\n+(?=\s*#)/, '');
}

/**
 * Strip a site-name suffix ("… | SoftWhere.uz Blog") a model baked into a
 * title. The app appends its own " | SoftWhere.uz Blog", so a stored suffix
 * doubles it in the <title>. Anchored to the end and case-insensitive.
 */
export function stripSiteNameSuffix(title: string): string {
  return title.replace(/\s*[|｜–—-]\s*softwhere\.?\s*uz\b.*$/i, '').trim();
}
