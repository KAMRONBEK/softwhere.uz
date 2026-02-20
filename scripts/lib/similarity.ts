/**
 * Lightweight similarity detection utilities for blog posts.
 * No embeddings — uses Jaccard similarity for titles and word-overlap for content.
 */

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'vs', 'versus', 'what', 'how', 'why', 'when', 'where', 'which',
  'that', 'this', 'it', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'can', 'need', 'complete', 'guide', 'ultimate', 'best',
  'top', 'new', 'your', 'our', 'you', 'we', 'they', 'its', 'from', 'about',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// ---------------------------------------------------------------------------
// Jaccard similarity
// ---------------------------------------------------------------------------

export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  setA.forEach(w => { if (setB.has(w)) intersection++; });
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ---------------------------------------------------------------------------
// Title similarity
// ---------------------------------------------------------------------------

const TITLE_SIMILARITY_THRESHOLD = 0.85;

export function titleTokens(title: string): string[] {
  return tokenize(title);
}

export function areTitlesSimilar(titleA: string, titleB: string): boolean {
  return jaccardSimilarity(titleTokens(titleA), titleTokens(titleB)) >= TITLE_SIMILARITY_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Content fingerprint & similarity
// ---------------------------------------------------------------------------

const CONTENT_WORD_SAMPLE = 200;
const CONTENT_SIMILARITY_THRESHOLD = 0.90;

function stripMarkdownHeaders(content: string): string {
  return content.replace(/^#{1,6}\s+.*$/gm, '').trim();
}

export function contentWords(content: string): string[] {
  const stripped = stripMarkdownHeaders(content);
  return tokenize(stripped).slice(0, CONTENT_WORD_SAMPLE);
}

export function areContentsSimilar(contentA: string, contentB: string): boolean {
  const wordsA = contentWords(contentA);
  const wordsB = contentWords(contentB);
  return jaccardSimilarity(wordsA, wordsB) >= CONTENT_SIMILARITY_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Duplicate cover detection (exact URL match across groups)
// ---------------------------------------------------------------------------

interface PostRef {
  _id: string;
  generationGroupId: string;
  coverUrl: string;
}

export function findDuplicateCovers(posts: PostRef[]): Map<string, string[]> {
  const urlToGroups = new Map<string, Set<string>>();
  for (const p of posts) {
    if (!p.coverUrl) continue;
    const groups = urlToGroups.get(p.coverUrl) ?? new Set();
    groups.add(p.generationGroupId);
    urlToGroups.set(p.coverUrl, groups);
  }
  const duplicates = new Map<string, string[]>();
  urlToGroups.forEach((groups, url) => {
    if (groups.size > 1) duplicates.set(url, Array.from(groups));
  });
  return duplicates;
}

// ---------------------------------------------------------------------------
// Similar title clusters (within same locale)
// ---------------------------------------------------------------------------

interface TitleRef {
  _id: string;
  generationGroupId: string;
  title: string;
  locale: string;
}

export function findSimilarTitles(posts: TitleRef[]): Map<string, string[]> {
  const byLocale = new Map<string, TitleRef[]>();
  for (const p of posts) {
    const arr = byLocale.get(p.locale) ?? [];
    arr.push(p);
    byLocale.set(p.locale, arr);
  }

  const similarGroups = new Map<string, string[]>();

  byLocale.forEach(localePosts => {
    const visited = new Set<string>();
    for (let i = 0; i < localePosts.length; i++) {
      if (visited.has(localePosts[i]._id)) continue;
      const cluster: string[] = [localePosts[i].generationGroupId];
      for (let j = i + 1; j < localePosts.length; j++) {
        if (visited.has(localePosts[j]._id)) continue;
        if (localePosts[i].generationGroupId === localePosts[j].generationGroupId) continue;
        if (areTitlesSimilar(localePosts[i].title, localePosts[j].title)) {
          cluster.push(localePosts[j].generationGroupId);
          visited.add(localePosts[j]._id);
        }
      }
      if (cluster.length > 1) {
        for (const gid of cluster) {
          const existing = similarGroups.get(gid) ?? [];
          for (const other of cluster) {
            if (other !== gid && !existing.includes(other)) existing.push(other);
          }
          similarGroups.set(gid, existing);
        }
      }
    }
  });
  return similarGroups;
}

// ---------------------------------------------------------------------------
// Similar content clusters (within same locale)
// ---------------------------------------------------------------------------

interface ContentRef {
  _id: string;
  generationGroupId: string;
  content: string;
  locale: string;
}

export function findSimilarContent(posts: ContentRef[]): Map<string, string[]> {
  const byLocale = new Map<string, ContentRef[]>();
  for (const p of posts) {
    const arr = byLocale.get(p.locale) ?? [];
    arr.push(p);
    byLocale.set(p.locale, arr);
  }

  const similarGroups = new Map<string, string[]>();

  byLocale.forEach(localePosts => {
    const visited = new Set<string>();
    for (let i = 0; i < localePosts.length; i++) {
      if (visited.has(localePosts[i]._id)) continue;
      const cluster: string[] = [localePosts[i].generationGroupId];
      for (let j = i + 1; j < localePosts.length; j++) {
        if (visited.has(localePosts[j]._id)) continue;
        if (localePosts[i].generationGroupId === localePosts[j].generationGroupId) continue;
        if (areContentsSimilar(localePosts[i].content, localePosts[j].content)) {
          cluster.push(localePosts[j].generationGroupId);
          visited.add(localePosts[j]._id);
        }
      }
      if (cluster.length > 1) {
        for (const gid of cluster) {
          const existing = similarGroups.get(gid) ?? [];
          for (const other of cluster) {
            if (other !== gid && !existing.includes(other)) existing.push(other);
          }
          similarGroups.set(gid, existing);
        }
      }
    }
  });
  return similarGroups;
}
