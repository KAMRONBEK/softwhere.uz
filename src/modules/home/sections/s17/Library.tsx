'use client';

import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { DOCS, question, type DocDef } from './data';
import { useRagDemo } from './context';
import { LockIcon } from './icons';
import css from './library.module.css';
import { statusAtLeast, type Pipeline, type Turn } from './machine';
import { ANCHORS } from './points';

interface DocView {
  isRetrieved: boolean;
  cites: number[];
  isFocused: boolean;
}

function docView(doc: DocDef, turn: Turn | null, focusCite: number | null): DocView {
  if (!turn || !statusAtLeast(turn.status, 'found')) return { isRetrieved: false, cites: [], isFocused: false };
  const reply = question(turn.question).reply(turn.role);
  const isRetrieved = reply.hits.some(hit => ANCHORS[hit.anchor].doc === doc.id);
  const isCiting = statusAtLeast(turn.status, 'streaming');
  const cites = isCiting ? reply.sources.flatMap((source, index) => (source.doc === doc.id ? [index + 1] : [])) : [];
  return { isRetrieved, cites, isFocused: cites.some(n => n === focusCite) };
}

function cardState(pipeline: Pipeline): 'waiting' | 'reading' | 'read' {
  if (pipeline === 'idle') return 'waiting';
  return pipeline === 'reading' ? 'reading' : 'read';
}

/**
 * The company's files, a strip across the top of the stage. While the demo
 * reads them each file's bar fills as it is cut into snippets; indexing then
 * pours those snippets down into the map. Afterwards a file lights up when a
 * question retrieves one of its snippets and carries the citation number
 * when the answer quotes it. The HR policy is locked for anyone not in HR.
 */
export default function Library() {
  const t = useTranslations('home.rag-build');
  const { state, shownTurn } = useRagDemo();
  const phase = cardState(state.pipeline);
  const focusCite = state.focus && shownTurn && state.focus.turn === shownTurn.key ? state.focus.cite : null;
  const isHrLocked = state.role !== 'hr';

  return (
    <div className={css.library} data-phase={phase}>
      <p className={css.head}>
        <span className={css.title}>{t('library.title')}</span>
        <span className={css.count}>{t('library.count', { count: DOCS.length })}</span>
      </p>
      <ol className={css.list}>
        {DOCS.map((doc, index) => {
          const view = docView(doc, shownTurn, focusCite);
          const isLocked = doc.isHrOnly && isHrLocked;
          return (
            <li
              key={doc.id}
              className={css.doc}
              style={{ '--i': index } as CSSProperties}
              data-doc-card={doc.id}
              data-retrieved={view.isRetrieved ? 'true' : undefined}
              data-cited={view.cites.length ? 'true' : undefined}
              data-focus={view.isFocused ? 'true' : undefined}
              data-locked={isLocked ? 'true' : undefined}
              data-hr={doc.isHrOnly ? 'true' : undefined}
            >
              <span className={css.icon} data-doc-icon='' data-kind={doc.kind} aria-hidden='true'>
                <span className={css.kind}>{doc.kind}</span>
                {doc.isHrOnly && (
                  <span className={css.iconLock}>
                    <LockIcon />
                  </span>
                )}
              </span>
              <span className={css.body}>
                <span className={css.name}>{t(`docs.${doc.id}`)}</span>
                <span className={css.meta}>
                  <span className={css.size}>{t(`units.${doc.size.unit}`, { count: doc.size.count })} · </span>
                  {phase === 'reading' ? t('library.reading') : t('library.passages', { count: doc.passages })}
                </span>
                <span className={css.bar} aria-hidden='true'>
                  <span className={css.barFill} />
                </span>
              </span>
              {doc.isHrOnly && (
                <span className={css.access}>
                  <LockIcon />
                  {t('library.hrOnly')}
                </span>
              )}
              {view.cites.length > 0 && (
                <span className={css.badge} aria-label={view.cites.map(n => t('library.cited', { n })).join(', ')}>
                  {view.cites.join(' ')}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
