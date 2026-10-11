'use client';

import { useTranslations } from 'next-intl';
import { memo } from 'react';
import { EDITOR_FILES } from './content';
import type { Token } from './source';
import css from './editor.module.css';

const TOKEN_CLASS: Record<Token['kind'], string | undefined> = {
  kw: css.kw,
  bool: css.bool,
  str: css.str,
  tag: css.tag,
  attr: css.attr,
  fn: css.fn,
  prop: css.prop,
  punct: css.punct,
  id: css.id,
  text: css.text,
  ws: undefined,
};

interface EditorProps {
  tokens: readonly Token[][];
  /** The full source, for screen readers (the visible code is revealed by scroll). */
  source: string;
  /** Rows from here on are written during the story: they get the "added" gutter mark. */
  firstTypedLine: number;
}

/**
 * The code editor: tab strip, gutter, highlighted code, caret, status bar.
 * Static markup only; the engine reveals rows, moves the caret and updates
 * the Ln/Col readout through the data-* hooks below.
 */
function Editor({ tokens, source, firstTypedLine }: EditorProps) {
  const t = useTranslations('home.code-to-ui');
  return (
    <figure className={css.editor} data-editor=''>
      <div className={css.tabs} aria-hidden='true'>
        <span className={css.tabActive}>
          <svg className={css.fileIcon} viewBox='0 0 16 16' aria-hidden='true'>
            <circle cx='8' cy='8' r='1.6' />
            <ellipse cx='8' cy='8' rx='6.4' ry='2.5' />
            <ellipse cx='8' cy='8' rx='6.4' ry='2.5' transform='rotate(60 8 8)' />
            <ellipse cx='8' cy='8' rx='6.4' ry='2.5' transform='rotate(120 8 8)' />
          </svg>
          {EDITOR_FILES.active}
          <i className={css.dirty} />
        </span>
        {EDITOR_FILES.others.map(file => (
          <span key={file} className={css.tab}>
            {file}
          </span>
        ))}
      </div>

      <div className={css.viewport} data-viewport=''>
        <div className={css.lines} data-lines='' aria-hidden='true'>
          {tokens.map((line, i) => (
            <div key={i} className={css.row} data-row='' data-new={i >= firstTypedLine ? '' : undefined}>
              <span className={css.ln}>{i + 1}</span>
              <span className={css.code} data-code=''>
                {line.map((token, j) =>
                  token.kind === 'ws' ? (
                    token.text
                  ) : (
                    <span key={j} className={TOKEN_CLASS[token.kind]}>
                      {token.text}
                    </span>
                  )
                )}
              </span>
            </div>
          ))}
          <span className={css.caret} data-caret=''>
            <i className={css.trail} />
            <i className={css.bar} />
          </span>
        </div>
        <i className={css.scan} data-scan='' aria-hidden='true' />
        <span className={css.probe} data-probe='' aria-hidden='true'>
          0000000000
        </span>
      </div>

      <div className={css.status} aria-hidden='true'>
        <span className={css.state}>
          <i className={css.stateDot} />
          <span className={css.stateText}>
            <span className={css.idle}>{t('status.idle')}</span>
            <span className={css.typing}>{t('status.typing')}</span>
            <span className={css.compiled}>{t('status.done')}</span>
          </span>
        </span>
        <span className={css.lnCol} data-lncol=''>
          Ln 1, Col 1
        </span>
        <span className={css.lang}>{EDITOR_FILES.language}</span>
      </div>

      <figcaption className={css.srOnly}>
        {t('editorLabel')}
        <pre>{source}</pre>
      </figcaption>
    </figure>
  );
}

export default memo(Editor);
