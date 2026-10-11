'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, type CSSProperties, type FocusEvent, type PointerEvent, type RefObject } from 'react';
import { QUESTIONS, ROLE_IDS, TOTAL_PASSAGES, DOCS, answerSegments, percent, type RoleId, type TabId } from './data';
import css from './chat.module.css';
import { useRagDemo } from './context';
import { AssistantIcon, LockIcon, SearchIcon, ShieldIcon } from './icons';
import { answerText, foundLine, replyOf } from './i18n';
import Insights from './Insights';
import MiniMap from './MiniMap';
import { isBusy, lastTurn, statusAtLeast, turns, type Entry, type Turn } from './machine';

const TABS: readonly TabId[] = ['chat', 'insights'];
/** Static ids (the section is on the page once): useId would differ if the tree above hydrates unevenly. */
const ID = 'rag-build-assistant';

/**
 * Pointing at a citation (its chip or its source row) lights its file, dot
 * and line: hover with a mouse, keyboard focus, or a tap (a second tap
 * clears it). Focus from a tap is ignored, or Android's focus-then-click
 * would toggle it straight back off.
 */
function useCiteTarget(turnKey: number, n: number) {
  const { state, focusCite, isTouch } = useRagDemo();
  const isFocused = state.focus?.turn === turnKey && state.focus.cite === n;
  const focus = { turn: turnKey, cite: n };
  return {
    isFocused,
    props: {
      'data-focus': isFocused ? 'true' : undefined,
      'aria-pressed': isFocused,
      onPointerEnter: (event: PointerEvent) => event.pointerType === 'mouse' && focusCite(focus),
      onPointerLeave: (event: PointerEvent) => event.pointerType === 'mouse' && focusCite(null),
      onFocus: (event: FocusEvent<HTMLElement>) => event.currentTarget.matches(':focus-visible') && focusCite(focus),
      onBlur: () => focusCite(null),
      onClick: () => focusCite(isFocused && isTouch ? null : focus),
    },
  };
}

/** A numbered citation inside the answer. */
function Cite({ turn, n }: { turn: Turn; n: number }) {
  const t = useTranslations('home.rag-build');
  const { props } = useCiteTarget(turn.key, n);
  const source = replyOf(turn).sources[n - 1];
  if (!source) return null;
  return (
    <button
      type='button'
      className={css.cite}
      aria-label={t('chat.citeLabel', { n, doc: t(`docs.${source.doc}`) })}
      data-cite-key={`${turn.key}-${n}`}
      {...props}
    >
      {n}
    </button>
  );
}

/** A row under the answer: which file, where in it, the quoted passage and its match score. */
function SourceRow({ turn, n, isLow }: { turn: Turn; n: number; isLow: boolean }) {
  const t = useTranslations('home.rag-build');
  const tShared = useTranslations('home.shared');
  const { props } = useCiteTarget(turn.key, n);
  const reply = replyOf(turn);
  const source = reply.sources[n - 1];
  const score = reply.hits.find(hit => hit.anchor === source.anchor)?.score ?? 0;
  return (
    <button type='button' className={css.source} data-low={isLow ? 'true' : undefined} {...props}>
      <span className={css.sourceNum}>{n}</span>
      <span className={css.sourceDoc}>
        {t(`docs.${source.doc}`)} · {t(`sources.${source.anchor}.where`)}
      </span>
      <span className={css.sourceScore}>{t('chat.match', { score: percent(score) })}</span>
      <span className={css.sourceQuote}>
        {tShared('quoteOpen')}
        {t(`sources.${source.anchor}.quote`)}
        {tShared('quoteClose')}
      </span>
    </button>
  );
}

function Answer({ turn }: { turn: Turn }) {
  const t = useTranslations('home.rag-build');
  const reply = replyOf(turn);
  const segments = answerSegments(answerText(t, reply));
  const isStreaming = turn.status === 'streaming';
  const isDone = turn.status === 'done';
  const BadgeIcon = reply.outcome === 'blocked' ? LockIcon : SearchIcon;
  return (
    <div className={css.answer} data-streaming={isStreaming ? 'true' : undefined} data-outcome={reply.outcome}>
      <p className={css.answerText}>
        {segments.map((segment, index) => (
          <span key={index} className={css.token} style={{ '--t': index } as CSSProperties}>
            {segment.kind === 'word' ? (
              segment.text
            ) : (
              <>
                <Cite turn={turn} n={segment.n} />
                {segment.after}
              </>
            )}{' '}
          </span>
        ))}
      </p>
      {isDone && reply.badge && (
        <p className={css.badge} data-outcome={reply.outcome}>
          <BadgeIcon />
          {t(`badges.${reply.badge}`)}
        </p>
      )}
      {isDone && reply.sources.length > 0 && (
        <div className={css.sources}>
          <p className={css.sourcesTitle}>{reply.outcome === 'missing' ? t('chat.closest') : t('chat.sources')}</p>
          <ol className={css.sourceList}>
            {reply.sources.map((source, index) => (
              <li key={source.anchor} style={{ '--k': index } as CSSProperties}>
                <SourceRow turn={turn} n={index + 1} isLow={reply.outcome === 'missing'} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  const t = useTranslations('home.rag-build');
  const reply = replyOf(turn);
  const isFound = statusAtLeast(turn.status, 'found');
  return (
    <li className={css.turn} data-entry=''>
      <div className={css.user}>
        <p className={css.userText}>{t(`questions.${turn.question}.text`)}</p>
        <span className={css.as}>{t('chat.asWho', { role: t(`roles.${turn.role}`) })}</span>
      </div>
      {statusAtLeast(turn.status, 'searching') && (
        <div className={css.bot}>
          <div className={css.statusRow}>
            <p className={css.status} data-found={isFound ? 'true' : undefined} data-outcome={isFound ? reply.outcome : undefined}>
              <SearchIcon />
              <span>{isFound ? foundLine(t, reply) : t('chat.searching', { count: TOTAL_PASSAGES })}</span>
            </p>
            <MiniMap turn={turn} />
          </div>
          {statusAtLeast(turn.status, 'streaming') && <Answer turn={turn} />}
        </div>
      )}
    </li>
  );
}

function EntryView({ entry }: { entry: Entry }) {
  const t = useTranslations('home.rag-build');
  if (entry.kind === 'role') {
    return (
      <li className={css.note} data-entry=''>
        <ShieldIcon />
        {t(`chat.roleNote.${entry.role}`)}
      </li>
    );
  }
  return <TurnView turn={entry} />;
}

/**
 * Keeps the newest exchange in view inside the log (never the page): the
 * question at the top once the answer outgrows the box, else its end. On
 * touch the log doesn't scroll by hand (a swipe on it scrolls the page), so
 * a finished answer shows its end: the sources. Never moves while a pointer
 * is down on the log.
 */
function useFollowLatest(
  logRef: RefObject<HTMLDivElement | null>,
  followKey: string,
  isReduced: boolean,
  isTouch: boolean,
  isDone: boolean
) {
  const isHeldRef = useRef(false);
  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const hold = () => (isHeldRef.current = true);
    const release = () => (isHeldRef.current = false);
    log.addEventListener('pointerdown', hold, { passive: true });
    window.addEventListener('pointerup', release, { passive: true });
    window.addEventListener('pointercancel', release, { passive: true });
    return () => {
      log.removeEventListener('pointerdown', hold);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [logRef]);

  useEffect(() => {
    const log = logRef.current;
    const entries = log?.querySelectorAll<HTMLElement>('[data-entry]');
    const latest = entries?.[entries.length - 1];
    if (!log || !latest || isHeldRef.current) return;
    const top = latest.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop - 10;
    const bottom = top + latest.offsetHeight + 22 - log.clientHeight;
    const target = Math.max(0, isTouch && isDone ? bottom : Math.min(top, bottom));
    log.scrollTo({ top: target, behavior: isReduced ? 'auto' : 'smooth' });
  }, [logRef, followKey, isReduced, isTouch, isDone]);
}

/** Phones: the chips scroll sideways; bring the one the autopilot is about to press into view. */
function useChipInView(chipsRef: RefObject<HTMLDivElement | null>, target: string | null, isReduced: boolean) {
  useEffect(() => {
    const row = chipsRef.current;
    const chip = target ? row?.querySelector<HTMLElement>(`[data-chip='${target}']`) : null;
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    const left = chip.offsetLeft - 14;
    const right = chip.offsetLeft + chip.offsetWidth + 22 - row.clientWidth;
    if (row.scrollLeft <= left && row.scrollLeft >= right) return;
    row.scrollTo({ left: row.scrollLeft > left ? left : right, behavior: isReduced ? 'auto' : 'smooth' });
  }, [chipsRef, target, isReduced]);
}

/**
 * The staff chat: who you're signed in as, the conversation, and the
 * questions to try. A second tab shows the insights a team lead would see.
 */
export default function Assistant() {
  const t = useTranslations('home.rag-build');
  const { state, dispatch, hintTarget, isReduced, isTouch } = useRagDemo();
  const logRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const isReady = state.pipeline === 'ready';
  const isLocked = !isReady || isBusy(state);
  const latest = lastTurn(state);
  const followKey = `${state.run}:${state.log.length}:${latest?.status ?? ''}:${state.tab}`;
  useFollowLatest(logRef, followKey, isReduced, isTouch, latest?.status === 'done');
  const askedCount = turns(state).filter(turn => turn.status === 'done').length;
  const isLive = !state.hasInteracted;
  useChipInView(chipsRef, state.ghost ?? hintTarget, isReduced);
  // Touch: the log is not a nested scroller, so no Lenis opt-out (a swipe on it scrolls the page).
  const scrollBox = isTouch ? {} : { 'data-lenis-prevent': '' };

  const setRole = (role: RoleId) => dispatch({ type: 'ROLE', role, by: 'user' });
  const setTab = (tab: TabId) => dispatch({ type: 'TAB', tab, by: 'user' });
  const ask = (id: (typeof QUESTIONS)[number]['id']) => {
    if (!isLocked) dispatch({ type: 'ASK', question: id, by: 'user', isInstant: isReduced });
  };

  return (
    <div className={css.chat} data-touch={isTouch ? 'true' : undefined}>
      <header className={css.head}>
        <span className={css.avatar} aria-hidden='true'>
          <AssistantIcon />
        </span>
        <span className={css.titles}>
          <span className={css.name}>{t('chat.title')}</span>
          <span className={css.subtitle}>{t('chat.subtitle')}</span>
        </span>
        <span className={css.tabs} role='tablist' aria-label={t('chat.title')}>
          {TABS.map(tab => (
            <button
              key={tab}
              type='button'
              role='tab'
              id={`${ID}-tab-${tab}`}
              aria-controls={`${ID}-panel-${tab}`}
              className={css.tab}
              aria-selected={state.tab === tab}
              onClick={() => setTab(tab)}
              data-hint={hintTarget === `tab-${tab}` ? 'true' : undefined}
              data-cursor={t('cursor.open')}
            >
              {t(`chat.tabs.${tab}`)}
              {tab === 'insights' && (
                <span className={css.tabCount} data-empty={askedCount === 0 ? 'true' : undefined}>
                  {askedCount}
                </span>
              )}
            </button>
          ))}
        </span>
      </header>

      <div className={css.roleBar}>
        <span className={css.roleLabel}>{t('chat.signedInAs')}</span>
        <span className={css.segment} role='group' aria-label={t('chat.signedInAs')}>
          {ROLE_IDS.map(role => (
            <button key={role} type='button' className={css.segmentButton} aria-pressed={state.role === role} onClick={() => setRole(role)}>
              {t(`roles.${role}`)}
            </button>
          ))}
        </span>
      </div>

      <div
        className={css.log}
        ref={logRef}
        id={`${ID}-panel-chat`}
        role='tabpanel'
        aria-labelledby={`${ID}-tab-chat`}
        hidden={state.tab !== 'chat'}
        aria-live='polite'
        {...scrollBox}
      >
        <ol className={css.entries}>
          <li className={css.greeting} data-entry=''>
            <span className={css.botMark} aria-hidden='true'>
              <AssistantIcon />
            </span>
            <p>
              {isReady
                ? t('chat.greeting', { count: DOCS.length })
                : state.pipeline === 'indexing'
                  ? t('chat.indexing', { count: TOTAL_PASSAGES })
                  : t('chat.reading', { count: DOCS.length })}
            </p>
            {!isReady && (
              <span className={css.typingDots} aria-hidden='true'>
                <i />
                <i />
                <i />
              </span>
            )}
          </li>
          {state.log.map(entry => (
            <EntryView key={`${state.run}-${entry.key}`} entry={entry} />
          ))}
        </ol>
      </div>
      <div
        className={css.insightsPane}
        id={`${ID}-panel-insights`}
        role='tabpanel'
        aria-labelledby={`${ID}-tab-insights`}
        hidden={state.tab !== 'insights'}
        {...scrollBox}
      >
        <Insights />
      </div>

      <footer className={css.foot}>
        <p className={css.tryLabel} data-live={isLive ? 'true' : undefined}>
          {isLive && <span className={css.liveDot} aria-hidden='true' />}
          {isLive ? (isTouch ? t('hintTouch') : t('hintPointer')) : t('chat.tryAsking')}
        </p>
        <div className={css.chips} ref={chipsRef}>
          {QUESTIONS.map(q => (
            <button
              key={q.id}
              type='button'
              className={css.chip}
              aria-disabled={isLocked}
              onClick={() => ask(q.id)}
              data-hint={hintTarget === q.id ? 'true' : undefined}
              data-ghost={state.ghost === q.id ? 'true' : undefined}
              data-chip={q.id}
              data-cursor={t('cursor.ask')}
            >
              {t(`questions.${q.id}.chip`)}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
