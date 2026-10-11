'use client';

import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import {
  STAGE_IDS,
  boardHeight,
  computeSlots,
  indexAtY,
  nextStage,
  stageAtX,
  stageOf,
  stageTotal,
  stepStage,
  type Board,
  type BoardAction,
  type BoardGeometry,
  type Slot,
} from './board';
import { DEALS, type DealId, type StageId } from './data';
import type { Demo } from './demo';
import type { CrmEngine } from './engine';
import { offsetWithin } from './engine';
import css from './pipeline.module.css';

/** Touch: hold this long to pick a card up (a quicker move is a scroll). */
const LONG_PRESS_MS = 240;
const TOUCH_SLOP_PX = 10;
const MOUSE_SLOP_PX = 4;
/** Autopilot: the board shows one move into "Quote sent" and one into "Won", then hands over. */
const AUTOPILOT: ReadonlyArray<{ id: DealId; to: StageId; delay: number }> = [
  { id: 'jasur', to: 'quote', delay: 1100 },
  { id: 'dilnoza', to: 'won', delay: 1500 },
];
const GHOST_PRESS_MS = 520;
const GHOST_CLEAR_MS = 900;
const HINT_CARD: DealId = 'bekzod';

interface DragState {
  id: DealId;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  isDragging: boolean;
  timer: number;
  el: HTMLElement;
}

interface PipelineProps {
  board: Board;
  dispatch: Dispatch<BoardAction>;
  demo: Demo;
  engineRef: RefObject<CrmEngine | null>;
  /** Latest slots, kept for an engine created after this measured. */
  slotsRef: RefObject<Map<DealId, Slot> | null>;
  isLive: boolean;
  isActive: boolean;
  isPlaying: boolean;
  isTouch: boolean;
  isReduced: boolean;
  onAnnounce: (message: string) => void;
}

function readPx(style: CSSStyleDeclaration, name: string, fallback: number): number {
  const value = parseFloat(style.getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

function measureGeometry(board: HTMLElement): BoardGeometry | null {
  const columns = Array.from(board.querySelectorAll<HTMLElement>('[data-column]'));
  const marker = board.querySelector<HTMLElement>('[data-slot-start]');
  if (columns.length !== STAGE_IDS.length || !marker) return null;
  const style = getComputedStyle(board);
  const entries = columns.map(column => {
    const stage = column.dataset.column as StageId;
    const inset = readPx(style, '--card-inset', 6);
    return [stage, { x: column.offsetLeft + inset, width: column.offsetWidth - inset * 2 }] as const;
  });
  return {
    columns: Object.fromEntries(entries) as BoardGeometry['columns'],
    top: offsetWithin(marker, board).y,
    cardHeight: readPx(style, '--card-h', 74),
    gap: readPx(style, '--card-gap', 8),
  };
}

function sameGeometry(a: BoardGeometry | null, b: BoardGeometry | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.top === b.top &&
    a.cardHeight === b.cardHeight &&
    a.gap === b.gap &&
    STAGE_IDS.every(stage => a.columns[stage].x === b.columns[stage].x && a.columns[stage].width === b.columns[stage].width)
  );
}

/**
 * The pipeline board: three stages, six deals. Cards are one flat list
 * positioned by the engine (so a card is the same element in every column
 * and moves by its CSS transition). Drag with a mouse, hold-and-drag on
 * touch (a quick swipe still scrolls the page), tap or Enter to move a card
 * on, arrow keys to move it between stages. Plays two moves by itself the
 * first time it comes on screen.
 */
export default function Pipeline({
  board,
  dispatch,
  demo,
  engineRef,
  slotsRef,
  isLive,
  isActive,
  isPlaying,
  isTouch,
  isReduced,
  onAnnounce,
}: PipelineProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [geometry, setGeometry] = useState<BoardGeometry | null>(null);
  const [overStage, setOverStage] = useState<StageId | null>(null);
  const [draggingId, setDraggingId] = useState<DealId | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [autoStep, setAutoStep] = useState(0);
  const [ghost, setGhost] = useState<{ id: DealId; isMoving: boolean } | null>(null);
  const { currency, clients, managers, money } = demo;
  const t = useTranslations('home.crm-build');

  // Geometry from the DOM: on mount, on resize, and when fonts/styles change the columns.
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const update = () => {
      const next = measureGeometry(el);
      setGeometry(prev => (sameGeometry(prev, next) ? prev : next));
    };
    update();
    // The board, a column head (its height sets where cards start) and the
    // window (short-screen container queries change --card-h).
    const observer = new ResizeObserver(update);
    observer.observe(el);
    const head = el.querySelector('[data-column] > :first-child');
    if (head) observer.observe(head);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  // Slots follow the board; the engine places (and animates) the cards.
  useLayoutEffect(() => {
    if (!geometry) return;
    const slots = computeSlots(board, geometry);
    slotsRef.current = slots;
    engineRef.current?.setSlots(slots);
  }, [board, geometry, engineRef, slotsRef]);

  const move = useCallback(
    (id: DealId, to: StageId, index?: number) => {
      if (stageOf(board, id) === to && index === undefined) return;
      dispatch({ type: 'MOVE', id, to, index });
      onAnnounce(t('pipeline.moved', { client: clients[id], stage: t(`stages.${to}`) }));
    },
    [board, dispatch, onAnnounce, clients, t]
  );

  // Autopilot: lift a card (a finger/cursor presses it), then move it.
  const isAutopilotOn = isActive && isLive && isPlaying && !hasInteracted && !isReduced;
  useEffect(() => {
    if (!isAutopilotOn || autoStep >= AUTOPILOT.length) return;
    const step = AUTOPILOT[autoStep];
    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => setGhost({ id: step.id, isMoving: false }), step.delay),
      window.setTimeout(() => {
        setGhost({ id: step.id, isMoving: true });
        move(step.id, step.to, 0);
      }, step.delay + GHOST_PRESS_MS),
      window.setTimeout(
        () => {
          setGhost(null);
          setAutoStep(n => n + 1);
        },
        step.delay + GHOST_PRESS_MS + GHOST_CLEAR_MS
      )
    );
    return () => timers.forEach(id => window.clearTimeout(id));
  }, [isAutopilotOn, autoStep, move]);

  // A stopped autopilot never leaves a lifted card behind.
  const shownGhost = isAutopilotOn ? ghost : null;

  const takeOver = useCallback(() => {
    setHasInteracted(true);
    setGhost(null);
  }, []);

  // Touch drags must not scroll the page: cancel touchmove while a card is held. The
  // (non-passive) listener sits on the cards only, so a swipe that starts anywhere else on
  // the board scrolls at once instead of waiting for the main thread.
  useEffect(() => {
    const cards = Array.from(boardRef.current?.querySelectorAll<HTMLElement>('[data-card]') ?? []);
    const onTouchMove = (event: TouchEvent) => {
      if (dragRef.current?.isDragging) event.preventDefault();
    };
    cards.forEach(card => card.addEventListener('touchmove', onTouchMove, { passive: false }));
    return () => cards.forEach(card => card.removeEventListener('touchmove', onTouchMove));
  }, []);

  const clearDrag = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    window.clearTimeout(drag.timer);
    dragRef.current = null;
    if (drag.isDragging) {
      engineRef.current?.endDrag();
      setDraggingId(null);
      setOverStage(null);
    }
  }, [engineRef]);

  // Leaving the board (scrolling into another chapter) drops whatever is held.
  useEffect(() => {
    if (isActive && isLive) return;
    const frame = requestAnimationFrame(clearDrag);
    return () => cancelAnimationFrame(frame);
  }, [isActive, isLive, clearDrag]);

  useEffect(() => () => clearDrag(), [clearDrag]);

  const startDrag = useCallback(
    (drag: DragState) => {
      drag.isDragging = true;
      try {
        drag.el.setPointerCapture(drag.pointerId);
      } catch {
        // The pointer may already be gone (released during the long press).
      }
      if (drag.pointerType !== 'mouse') navigator.vibrate?.(8);
      setDraggingId(drag.id);
      setOverStage(stageOf(board, drag.id));
      takeOver();
    },
    [board, takeOver]
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, id: DealId) => {
    if (!isLive || dragRef.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const drag: DragState = {
      id,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      isDragging: false,
      timer: 0,
      el: event.currentTarget,
    };
    dragRef.current = drag;
    if (event.pointerType !== 'mouse') {
      drag.timer = window.setTimeout(() => {
        if (dragRef.current === drag) startDrag(drag);
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.isDragging) {
      const distance = Math.hypot(dx, dy);
      if (drag.pointerType === 'mouse' && distance > MOUSE_SLOP_PX) startDrag(drag);
      else if (drag.pointerType !== 'mouse' && distance > TOUCH_SLOP_PX) clearDrag();
      if (!drag.isDragging) return;
    }
    engineRef.current?.dragTo(drag.id, dx, dy);
    const target = dropTarget(drag.id, dx, dy);
    if (target) setOverStage(prev => (prev === target.stage ? prev : target.stage));
  };

  const dropTarget = (id: DealId, dx: number, dy: number): { stage: StageId; index: number } | null => {
    const slot = slotsRef.current?.get(id);
    if (!geometry || !slot) return null;
    const centerX = slot.x + dx + slot.width / 2;
    const centerY = slot.y + dy + geometry.cardHeight / 2;
    const stage = stageAtX(geometry, centerX) ?? stageOf(board, id);
    const others = board[stage].filter(other => other !== id).length;
    return { stage, index: indexAtY(geometry, centerY, others) };
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.isDragging) {
      const target = dropTarget(drag.id, event.clientX - drag.startX, event.clientY - drag.startY);
      suppressClickRef.current = true;
      clearDrag();
      if (target) move(drag.id, target.stage, target.index);
      return;
    }
    clearDrag();
  };

  const onClick = (id: DealId) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (!isLive) return;
    takeOver();
    const next = nextStage(stageOf(board, id));
    if (next) move(id, next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, id: DealId) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    takeOver();
    const to = stepStage(stageOf(board, id), event.key === 'ArrowRight' ? 1 : -1);
    if (to !== stageOf(board, id)) move(id, to);
  };

  const layerHeight = geometry ? boardHeight(board, geometry) : undefined;
  const isHinting = hasInteracted === false && autoStep >= AUTOPILOT.length && isActive && isLive && !isReduced;

  return (
    <div className={css.pipeline}>
      <div className={css.head} data-chrome>
        <span className={css.title}>{t('pipeline.title')}</span>
        <span className={css.hint} id='crm-pipeline-hint'>
          {isHinting && <span className={css.yourTurn}>{t('pipeline.yourTurn')}</span>}
          {isTouch ? t('pipeline.hintTouch') : t('pipeline.hintPointer')}
        </span>
      </div>

      <div ref={boardRef} className={css.board} role='group' aria-label={t('pipeline.title')} data-dragging={draggingId ? '' : undefined}>
        {STAGE_IDS.map(stage => {
          const count = board[stage].length;
          const total = money.short(stageTotal(board, stage, currency));
          return (
            <div
              key={stage}
              className={css.column}
              role='group'
              aria-label={t('pipeline.columnLabel', { stage: t(`stages.${stage}`), count, total })}
              data-column={stage}
              data-chrome
              data-over={overStage === stage && draggingId ? '' : undefined}
              style={layerHeight ? { minHeight: layerHeight } : undefined}
            >
              <div className={css.columnHead}>
                <span className={css.stageRow} aria-hidden='true'>
                  <span className={css.dot} data-stage={stage} />
                  <span className={css.stageName}>{t(`stages.${stage}`)}</span>
                  <span className={css.count}>{count}</span>
                </span>
                <span key={total} className={css.total} aria-hidden='true'>
                  {total}
                </span>
              </div>
              <div data-slot-start />
            </div>
          );
        })}

        <div className={css.cards} data-cards>
          {DEALS.map(deal => {
            const stage = stageOf(board, deal.id);
            const next = nextStage(stage);
            const isGhost = shownGhost?.id === deal.id;
            return (
              <button
                key={deal.id}
                type='button'
                className={css.card}
                data-card={deal.id}
                data-cursor={t('cursor.drag')}
                data-stage={stage}
                data-dragging={draggingId === deal.id ? '' : undefined}
                data-lifted={isGhost ? '' : undefined}
                data-hint={isHinting && deal.id === HINT_CARD ? '' : undefined}
                aria-label={t('pipeline.cardLabel', { client: clients[deal.id], item: t(`deals.${deal.id}`), stage: t(`stages.${stage}`) })}
                aria-describedby='crm-pipeline-hint'
                title={next ? t('pipeline.cardAction', { next: t(`stages.${next}`) }) : t('pipeline.cardActionWon')}
                onPointerDown={event => onPointerDown(event, deal.id)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={clearDrag}
                onLostPointerCapture={event => {
                  if (dragRef.current?.isDragging && dragRef.current.pointerId === event.pointerId) clearDrag();
                }}
                onContextMenu={event => {
                  if (dragRef.current) event.preventDefault();
                }}
                onClick={() => onClick(deal.id)}
                onKeyDown={event => onKeyDown(event, deal.id)}
              >
                <span className={css.face}>
                  <span className={css.clientRow}>
                    <span className={css.client}>{clients[deal.id]}</span>
                    <span className={css.avatar} aria-hidden='true'>
                      {managers[deal.manager].initials}
                    </span>
                  </span>
                  <span className={css.item}>{t(`deals.${deal.id}`)}</span>
                  <span className={css.amount}>{money.short(deal.amount[currency])}</span>
                  {isGhost && (
                    <span
                      className={css.ghost}
                      data-pointer={isTouch ? 'touch' : 'mouse'}
                      data-moving={shownGhost?.isMoving ? '' : undefined}
                      aria-hidden='true'
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
