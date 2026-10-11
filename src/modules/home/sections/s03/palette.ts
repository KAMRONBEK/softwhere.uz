import type { LabTheme } from '../../theme/useLabTheme';

/**
 * Colors for the "inside" layer, derived from the active style's tokens.
 * Dark styles get a raised-surface blueprint (bg2) with darker code cards;
 * light styles get the page ground with brighter cards, so ink reads like
 * pencil on paper and nothing relies on glow.
 */
export interface XRayPalette {
  isDark: boolean;
  /** The page itself (the stage is transparent around the devices). */
  page: string;
  paper: string;
  card: string;
  ink: string;
  muted: string;
  accent: string;
  accent2: string;
  onAccent: string;
  mono: string;
  body: string;
  /** Code-card corner radius in CSS px (the style's radius, capped). */
  radius: number;
}

export function paletteFromTheme(theme: LabTheme): XRayPalette {
  const { colors, scheme, fontFamily, radius } = theme;
  const isDark = scheme === 'dark';
  return {
    isDark,
    page: colors.bg,
    paper: isDark ? colors.bg2 : colors.bg,
    card: isDark ? colors.bg : colors.bg2,
    ink: colors.fg,
    muted: colors.muted,
    accent: colors.accent,
    accent2: colors.accent2,
    onAccent: colors.onAccent,
    mono: fontFamily.mono,
    body: fontFamily.body,
    radius: Math.min(Number.parseFloat(radius) || 0, 8),
  };
}

export function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

export type TokenKind = 'plain' | 'keyword' | 'tag' | 'attr' | 'string' | 'comment' | 'number';

export interface CodeToken {
  text: string;
  kind: TokenKind;
}

const TOKEN_RE =
  /(\/\/.*$)|('[^']*'|"[^"]*"|`[^`]*`?)|(<\/?[A-Z][\w.]*|\/>)|\b(const|let|await|async|return|new|import|from|export|function|if|SELECT|FROM|WHERE|ORDER|BY|LIMIT)\b|\b([a-zA-Z_]\w*)(?==[{"'])|\b(\d+)\b/g;
const GROUP_KINDS: TokenKind[] = ['comment', 'string', 'tag', 'keyword', 'attr', 'number'];

/** Tiny highlighter for the snippets (one line at a time). */
export function tokenizeLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) tokens.push({ text: line.slice(last, index), kind: 'plain' });
    const group = match.slice(1).findIndex(value => value !== undefined);
    tokens.push({ text: match[0], kind: GROUP_KINDS[group] ?? 'plain' });
    last = index + match[0].length;
  }
  if (last < line.length) tokens.push({ text: line.slice(last), kind: 'plain' });
  return tokens;
}

export function tokenColor(palette: XRayPalette, kind: TokenKind): string {
  switch (kind) {
    case 'keyword':
    case 'tag':
    case 'number':
      return palette.accent;
    case 'attr':
    case 'string':
      return palette.isDark ? palette.accent2 : palette.muted;
    case 'comment':
      return palette.muted;
    default:
      return palette.ink;
  }
}
