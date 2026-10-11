import { Fragment, type ReactNode } from 'react';
import { K } from './engine';
import type { StatementLine } from './copy';
import { WORD_ATTR } from './kerning';
import css from './manifesto.module.css';

interface KineticLineProps {
  line: StatementLine;
  /** Echo copies that trail the line while scrolling (0 when static). */
  echoes: number;
}

/**
 * Renders the words of a line, splitting each word into letters with
 * `renderChar`, joined by spaces — or by a line break on narrow screens
 * where the line asks for one.
 */
function renderWords(line: StatementLine, renderChar: (ch: string, key: number) => ReactNode): ReactNode {
  return line.words.map((word, index) => {
    const isLast = index === line.words.length - 1;
    const breaksOnNarrow = line.narrowBreaks.includes(index);
    return (
      <Fragment key={index}>
        <span className={css.word} {...{ [WORD_ATTR]: word }}>
          {Array.from(word).map(renderChar)}
        </span>
        {!isLast &&
          (breaksOnNarrow ? (
            <>
              <span className={css.gap}> </span>
              <br className={css.narrowBreak} />
            </>
          ) : (
            ' '
          ))}
      </Fragment>
    );
  });
}

/**
 * One statement line, fitted to its share of the column (useFitLines). Every
 * letter is three stacked layers: the glyph (in flow, always the real letter
 * at first paint), the same letter at the contrasting weight (proximity and
 * the decode wave) and a flip slot that briefly shows a stand-in glyph while
 * the line decodes. The engine animates them; this only renders.
 */
export default function KineticLine({ line, echoes }: KineticLineProps) {
  const classes = [css.line, line.align === 'end' ? css.alignEnd : '', line.isPayoff ? css.payoff : ''].filter(Boolean).join(' ');
  return (
    <div
      className={classes}
      data-fit=''
      data-share={line.wideShare}
      data-align={line.align}
      {...(line.isPayoff ? { 'data-payoff': '' } : {})}
      {...{ [K.block]: '' }}
    >
      {Array.from({ length: echoes }, (_, index) => (
        <div key={index} className={css.echo} {...{ [K.ghost]: '' }}>
          {renderWords(line, (ch, key) => (
            <span key={key} className={css.echoChar}>
              {ch}
            </span>
          ))}
        </div>
      ))}
      {renderWords(line, (ch, key) => (
        <span key={key} className={css.char} {...{ [K.char]: ch }}>
          <span className={css.glyph} {...{ [K.glyph]: '' }}>
            {ch}
          </span>
          <span className={css.alt} {...{ [K.alt]: '' }}>
            {ch}
          </span>
          <span className={css.flip} {...{ [K.flip]: '' }} />
        </span>
      ))}
    </div>
  );
}
