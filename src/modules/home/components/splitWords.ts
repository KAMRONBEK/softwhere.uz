/**
 * Breakable whitespace: every whitespace character except the no-break space
 * (U+00A0). The Russian copy glues each em dash to the word before it with a
 * no-break space ("Демо — легко."), so a dash never starts a line; JS's
 * `\s` matches U+00A0, so splitting on it would undo that.
 */
const BREAKABLE_SPACE = /[^\S ]+/;

/** Words of `text` split at breakable whitespace only (no-break spaces stay inside a word). */
export function splitWords(text: string): string[] {
  return text.split(BREAKABLE_SPACE).filter(Boolean);
}
