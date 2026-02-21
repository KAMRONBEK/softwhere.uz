/**
 * Content quality assessment and sanitization for AI-generated blog posts.
 * Shared between generate-post.ts and regenerate-posts.ts.
 */

/** Appended to every content generation prompt to maintain output quality. */
export const QUALITY_RULES = `
CRITICAL OUTPUT QUALITY (you MUST follow these throughout the ENTIRE article):
- Every sentence MUST end with proper punctuation (. ? !).
- Every heading MUST be on its own line with a blank line before and after it.
- Markdown tables MUST use proper | col1 | col2 | format with a |---|---| separator row.
- Code blocks MUST use triple backticks with a language identifier.
- NEVER place random closing parentheses ) at the end of lines.
- The LAST section of the article MUST be as polished and well-formatted as the FIRST.
- Complete every thought. No sentence fragments or trailing artifacts.
- Do NOT let quality or formatting degrade as the article gets longer.`;

/**
 * Post-process AI output: fix whitespace, orphaned parentheses, etc.
 */
export function sanitizeContent(text: string): string {
  let result = text
    .replace(/[\\\s]+$/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/^(#{1,6}\s.*)\n{3,}/gm, '$1\n\n')
    .replace(/ {3,}/g, ' ')
    .trim();

  result = result
    .split('\n')
    .map(line => {
      const t = line.trimEnd();
      if (!t || t.startsWith('#') || t.startsWith('|') || t.startsWith('```') || t.startsWith('![')) return line;
      const opens = (t.match(/\(/g) || []).length;
      const closes = (t.match(/\)/g) || []).length;
      if (closes > opens && /\)\s*$/.test(t)) {
        return t.replace(/\)\s*$/, '.');
      }
      return line;
    })
    .join('\n');

  return result;
}

export interface QualityReport {
  pass: boolean;
  score: number;
  issues: string[];
}

/**
 * Assess AI-generated content for quality degradation indicators.
 * Returns { pass, score, issues } — pass=false means content should be retried.
 */
export function assessContentQuality(content: string, minWords = 800): QualityReport {
  const issues: string[] = [];
  const words = content.split(/\s+/).filter(Boolean);

  if (words.length < minWords) {
    issues.push(`Too short: ${words.length} words (min ${minWords})`);
  }

  const lines = content.split('\n').filter(l => l.trim().length > 0);

  const isProseeLine = (l: string) => {
    const t = l.trim();
    return (
      t.length > 40 &&
      !t.startsWith('#') &&
      !t.startsWith('-') &&
      !t.startsWith('*') &&
      !t.startsWith('|') &&
      !t.startsWith('```') &&
      !t.startsWith('![') &&
      !t.startsWith('>') &&
      !/^\d+[.)]\s/.test(t)
    );
  };

  const proseLines = lines.filter(isProseeLine);
  if (proseLines.length < 5) {
    return { pass: false, score: 0, issues: ['Too few prose paragraphs'] };
  }

  const endsProperly = (l: string) => /[.!?:;"')\]]$/.test(l.trim());
  const punctRatio = proseLines.filter(endsProperly).length / proseLines.length;

  if (punctRatio < 0.5) {
    issues.push(`Low punctuation: ${(punctRatio * 100).toFixed(0)}% of lines end properly`);
  }

  // Detect quality degradation between first and second halves
  const mid = Math.floor(proseLines.length / 2);
  const firstPunct = proseLines.slice(0, mid).filter(endsProperly).length / mid;
  const secondLen = proseLines.length - mid;
  const secondPunct = proseLines.slice(mid).filter(endsProperly).length / Math.max(secondLen, 1);

  if (firstPunct > 0.6 && secondPunct < firstPunct * 0.5) {
    issues.push(`Quality drops: ${(firstPunct * 100).toFixed(0)}% → ${(secondPunct * 100).toFixed(0)}% punctuation`);
  }

  // Orphaned closing parentheses
  const orphans = lines.filter(l => {
    const t = l.trim();
    if (!t || t.startsWith('#') || t.startsWith('|') || t.startsWith('```')) return false;
    return (t.match(/\)/g) || []).length > (t.match(/\(/g) || []).length && /\)\s*$/.test(t);
  }).length;

  if (orphans > 5) {
    issues.push(`${orphans} lines with orphaned parentheses`);
  }

  const score = Math.max(0, 1 - issues.length * 0.3);
  return { pass: issues.length === 0, score, issues };
}
