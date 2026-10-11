import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import ui from './cards.module.css';
import css from './code.module.css';
import { CODE_FILE } from './data';
import site from './site.module.css';

function Kw({ children }: { children: ReactNode }) {
  return <span className={css.kw}>{children}</span>;
}

/**
 * The API route behind the tutor: an illustration of the RAG query on the
 * product's real stack (PostgreSQL + pgvector), not its actual source.
 */
export default function CodeCard({ mode }: { mode: 'wire' | 'final' }) {
  const t = useTranslations('home.assembly.site.code');
  return (
    <div className={`${ui.card} ${css.code}`}>
      <span className={css.codeHead}>
        <span className={site.dots} data-icon=''>
          <i />
          <i />
          <i />
        </span>
        <span data-t=''>{CODE_FILE}</span>
        <span className={css.live}>
          {mode === 'final' ? (
            <>
              <span className={css.liveIdle} data-live='idle'>
                {t('idle')}
              </span>
              <span className={css.liveOn} data-live='on'>
                <i />
                {t('live')}
              </span>
            </>
          ) : (
            <span data-t=''>{t('live')}</span>
          )}
        </span>
      </span>
      <code className={css.pre}>
        <span className={css.line} data-line='' data-t=''>
          <span className={css.cm}>{'// POST /api/tutor'}</span>
        </span>
        <span className={css.line} data-line='' data-t=''>
          <Kw>const</Kw> q = <Kw>await</Kw> <span className={css.fn}>embed</span>(question);
        </span>
        <span className={css.line} data-line='' data-t=''>
          <Kw>const</Kw> hits = <Kw>await</Kw> <span className={css.fn}>sql</span>`
        </span>
        <span className={css.line} data-line='' data-t=''>
          {'  '}
          <Kw>select</Kw> text, page <Kw>from</Kw> chunks
        </span>
        <span className={css.line} data-line='' data-t=''>
          {'  '}
          <Kw>where</Kw> source_id = {'${id}'}
        </span>
        <span className={css.line} data-line='' data-t=''>
          {'  '}
          <Kw>order by</Kw> embedding <span className={css.op}>{'<=>'}</span> {'${q}'} <Kw>limit</Kw> 5`;
        </span>
        <span className={css.line} data-line='' data-t=''>
          <Kw>return</Kw> llm.<span className={css.fn}>stream</span>(question, hits);
        </span>
      </code>
    </div>
  );
}
