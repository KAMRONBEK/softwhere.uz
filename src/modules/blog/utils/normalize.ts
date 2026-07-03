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
