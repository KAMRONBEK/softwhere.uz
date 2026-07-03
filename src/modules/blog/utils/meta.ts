/**
 * Boundary-aware meta-description clamp shared by the generator (persisting)
 * and the SEO lib (rendering). A raw `.slice(0, 160)` cut descriptions
 * mid-word in the SERP snippet ("...tezkor sayt usulla") — clamp on the last
 * sentence end when one lands past ~120 chars, else the last word boundary.
 */
export function clampMeta(text: string, max = 160): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const clipped = t.slice(0, max - 3); // leave room for the ellipsis
  const lastSentenceEnd = Math.max(clipped.lastIndexOf('. '), clipped.lastIndexOf('! '), clipped.lastIndexOf('? '));
  if (lastSentenceEnd > 120) return clipped.slice(0, lastSentenceEnd + 1).trim();
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 100 ? clipped.slice(0, lastSpace) : clipped).trim()}…`;
}
