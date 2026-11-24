import { MARKS } from '@/modules/home/logos/marks';
import type { ServiceSlug } from '@/shared/data/services';
import css from './HalftoneGlyph.module.css';

export type GlyphName = ServiceSlug | 'crm' | 'ai' | 'mark';

/** Monoline shapes in the mark's own stroke (about a twelfth of the 240 box). */
const GLYPHS: Record<Exclude<GlyphName, 'mark'>, string> = {
  'web-development':
    'M40 34H200A22 22 0 0 1 222 56V184A22 22 0 0 1 200 206H40A22 22 0 0 1 18 184V56A22 22 0 0 1 40 34ZM18 84H222M112 116L178 142L148 151L138 181ZM136 138L148 143',
  'mobile-apps': 'M92 16H148A28 28 0 0 1 176 44V196A28 28 0 0 1 148 224H92A28 28 0 0 1 64 196V44A28 28 0 0 1 92 16ZM108 188H132',
  'telegram-bots':
    'M52 34H188A32 32 0 0 1 220 66V140A32 32 0 0 1 188 172H122L74 216V172H52A32 32 0 0 1 20 140V66A32 32 0 0 1 52 34ZM88 92V114M152 92V114',
  crm: 'M28 24H98V126H28ZM28 172H98V216H28ZM146 24H216V68H146ZM146 114H216V216H146Z',
  ai: 'M64 18H140L186 64V196A24 24 0 0 1 162 222H64A24 24 0 0 1 40 196V42A24 24 0 0 1 64 18ZM84 104H120M84 150H142',
};

interface HalftoneGlyphProps {
  name: GlyphName;
  className?: string;
}

/** A line figure printed in the hero mark's dots (S01Hero .still). Decoration only. */
export function HalftoneGlyph({ name, className }: HalftoneGlyphProps) {
  return (
    <span className={className ? `${css.glyph} ${className}` : css.glyph} data-glyph={name} aria-hidden='true'>
      {name === 'mark' ? (
        <svg viewBox='0 0 64 64' focusable='false'>
          <path d={MARKS.original.d} transform={MARKS.original.transform} fill='currentColor' />
        </svg>
      ) : (
        <svg viewBox='0 0 240 240' focusable='false'>
          <path d={GLYPHS[name]} fill='none' stroke='currentColor' strokeWidth='20' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      )}
    </span>
  );
}
