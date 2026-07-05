/**
 * Lightweight title-similarity used by topic selection to avoid regenerating a
 * post whose topic is already covered. No embeddings — Jaccard overlap of
 * content words (stop words and generic listicle filler removed) is enough to
 * catch "Build Your MVP in 90 Days" vs a near-identical existing title.
 *
 * The scheduled generator picks from a fixed topic pool; its old dedup only
 * compared the exact primaryKeyword of the 30 most-recent posts, so a topic
 * that fell outside that window (or whose stored keyword drifted) could be
 * re-selected — the source of the `-1` duplicate slugs shipped 2026-07-04.
 */

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'vs',
  'versus',
  'what',
  'how',
  'why',
  'when',
  'where',
  'which',
  'that',
  'this',
  'it',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'can',
  'need',
  'complete',
  'guide',
  'ultimate',
  'best',
  'top',
  'new',
  'your',
  'our',
  'you',
  'we',
  'they',
  'its',
  'from',
  'about',
]);

/** Lowercase, strip punctuation, drop short/stop words. */
export function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach(w => {
    if (setB.has(w)) intersection++;
  });
  return intersection / (setA.size + setB.size - intersection);
}

/**
 * Two titles are "the same topic" at ≥ 0.55 token overlap. Lower than an
 * exact-duplicate threshold on purpose: this gate is used to SKIP a candidate
 * topic, and the pool is large, so leaning toward variety costs nothing while a
 * near-miss duplicate is expensive to unwind after publish.
 */
export const TOPIC_OVERLAP_THRESHOLD = 0.55;

export function isSameTopicTitle(a: string, b: string, threshold = TOPIC_OVERLAP_THRESHOLD): boolean {
  return jaccardSimilarity(titleTokens(a), titleTokens(b)) >= threshold;
}
