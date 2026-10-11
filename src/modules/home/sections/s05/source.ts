/**
 * The TSX the editor types, and a tiny hand-written tokenizer for it.
 *
 * Pure data and string work (no DOM): the section renders `tokens` once and
 * the engine reveals them character by character.
 */

export type TokenKind = 'kw' | 'bool' | 'str' | 'tag' | 'attr' | 'fn' | 'prop' | 'punct' | 'id' | 'text' | 'ws';

export interface Token {
  kind: TokenKind;
  text: string;
}

/**
 * Strings that appear both in the typed code and in the rendered preview, in
 * the visitor's language (`home.code-to-ui.ui`). Keep `button` and `toggle`
 * within 36 characters and `chartTitle` within 28, so every line fits MAX_COLS.
 */
export interface UiText {
  button: string;
  toggle: string;
  chartTitle: string;
}

export interface SourceOptions {
  uiText: UiText;
  /** Key the snippet loads the card's app by: its kind ('ride-hailing'), never its name. */
  appKey: string;
  /** Initial `dark` state: true on the dark styles, so code and preview agree. */
  startsDark: boolean;
}

/** Longest line the snippet may have: it must fit a 390px phone at 11px Martian Mono. */
export const MAX_COLS = 44;

/**
 * Real, valid TSX for the preview's Showcase screen, in the order the preview
 * builds: card, button, dark-mode switch, chart. The first lines (imports and
 * state) are already in the file when the section opens; the JSX is typed.
 */
export function buildSource({ uiText, appKey, startsDark }: SourceOptions): string[] {
  return [
    "import { useState } from 'react';",
    "import { Button, Card, Toggle } from './ui';",
    "import { Bars } from './charts';",
    "import { getApp, platforms } from './data';",
    '',
    'export default function Showcase() {',
    `  const app = getApp('${appKey}');`,
    `  const [dark, setDark] = useState(${startsDark});`,
    '  const [playing, play] = useState(false);',
    '',
    '  return (',
    '    <main data-dark={dark}>',
    '      <Card',
    '        title={app.kind}',
    '        video={app.video}',
    '        playing={playing}',
    '      />',
    '      <Button onClick={() => play(true)}>',
    `        ${uiText.button}`,
    '      </Button>',
    '      <Toggle on={dark} onChange={setDark}>',
    `        ${uiText.toggle}`,
    '      </Toggle>',
    '      <Bars',
    `        title="${uiText.chartTitle}"`,
    '        data={platforms}',
    '      />',
    '    </main>',
    '  );',
    '}',
  ];
}

const KEYWORDS = new Set(['import', 'from', 'export', 'default', 'function', 'const', 'return']);
const LITERALS = new Set(['true', 'false', 'null', 'undefined']);
const IDENT_START = /[A-Za-z_$]/;
const IDENT = /[A-Za-z0-9_$]/;
const TAG_IDENT = /[A-Za-z0-9_$.-]/;
const PUNCT_2 = ['=>', '</', '/>', '==', '&&', '||', '?.'];

type Mode = { kind: 'js' } | { kind: 'expr'; depth: number } | { kind: 'tag'; isClosing: boolean; hasName: boolean } | { kind: 'children' };

/**
 * Lexes the whole snippet (JSX state carries across lines) and returns the
 * tokens per line. Covers exactly what the snippet uses: keywords, strings,
 * JSX tags/attributes/text and `{expressions}`; no regex literals or generics.
 */
export function tokenize(lines: readonly string[]): Token[][] {
  const stack: Mode[] = [{ kind: 'js' }];
  const top = () => stack[stack.length - 1];
  const result: Token[][] = [];

  for (const line of lines) {
    const out: Token[] = [];
    const push = (kind: TokenKind, text: string) => {
      const last = out[out.length - 1];
      if (last && last.kind === kind && (kind === 'ws' || kind === 'punct')) last.text += text;
      else out.push({ kind, text });
    };
    let i = 0;
    while (i < line.length) {
      const ch = line[i];
      const mode = top();

      if (ch === ' ' || ch === '\t') {
        let j = i;
        while (j < line.length && (line[j] === ' ' || line[j] === '\t')) j++;
        push('ws', line.slice(i, j));
        i = j;
        continue;
      }

      if (mode.kind === 'children' && ch !== '<' && ch !== '{') {
        let j = i;
        while (j < line.length && line[j] !== '<' && line[j] !== '{') j++;
        const text = line.slice(i, j);
        const trimmed = text.trimEnd();
        push('text', trimmed);
        if (trimmed.length < text.length) push('ws', text.slice(trimmed.length));
        i = j;
        continue;
      }

      if (ch === "'" || ch === '"' || ch === '`') {
        let j = i + 1;
        while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
        push('str', line.slice(i, Math.min(j + 1, line.length)));
        i = j + 1;
        continue;
      }

      if (mode.kind === 'tag') {
        if (line.startsWith('/>', i)) {
          push('punct', '/>');
          stack.pop();
          i += 2;
          continue;
        }
        if (ch === '>') {
          push('punct', '>');
          stack.pop();
          if (mode.isClosing) {
            if (top().kind === 'children') stack.pop();
          } else {
            stack.push({ kind: 'children' });
          }
          i += 1;
          continue;
        }
        if (ch === '{') {
          push('punct', '{');
          stack.push({ kind: 'expr', depth: 0 });
          i += 1;
          continue;
        }
        if (IDENT_START.test(ch)) {
          let j = i;
          while (j < line.length && TAG_IDENT.test(line[j])) j++;
          push(mode.hasName ? 'attr' : 'tag', line.slice(i, j));
          mode.hasName = true;
          i = j;
          continue;
        }
        push('punct', ch);
        i += 1;
        continue;
      }

      // js, expr and children (only '<' or '{' reach here in children)
      if (ch === '<' && (line[i + 1] === '/' || IDENT_START.test(line[i + 1] ?? ''))) {
        const isClosing = line[i + 1] === '/';
        push('punct', isClosing ? '</' : '<');
        stack.push({ kind: 'tag', isClosing, hasName: false });
        i += isClosing ? 2 : 1;
        continue;
      }
      if (ch === '{') {
        push('punct', '{');
        if (mode.kind === 'expr') mode.depth += 1;
        else if (mode.kind === 'children') stack.push({ kind: 'expr', depth: 0 });
        i += 1;
        continue;
      }
      if (ch === '}') {
        push('punct', '}');
        if (mode.kind === 'expr') {
          if (mode.depth === 0) stack.pop();
          else mode.depth -= 1;
        }
        i += 1;
        continue;
      }
      if (IDENT_START.test(ch)) {
        let j = i;
        while (j < line.length && IDENT.test(line[j])) j++;
        const word = line.slice(i, j);
        const prev = line[i - 1];
        const next = line.slice(j).trimStart()[0];
        let kind: TokenKind = 'id';
        if (KEYWORDS.has(word)) kind = 'kw';
        else if (LITERALS.has(word)) kind = 'bool';
        else if (next === '(') kind = 'fn';
        else if (prev === '.') kind = 'prop';
        push(kind, word);
        i = j;
        continue;
      }
      const two = line.slice(i, i + 2);
      if (PUNCT_2.includes(two)) {
        push('punct', two);
        i += 2;
        continue;
      }
      push('punct', ch);
      i += 1;
    }
    result.push(out);
  }
  return result;
}
