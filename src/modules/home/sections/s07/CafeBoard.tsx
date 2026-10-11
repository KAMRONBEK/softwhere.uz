'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { gsap } from '../../global/gsap';
import { DEMO_TIME, MENU, ORDER_NUMBER, PREVIOUS_ORDER, itemPrice, sizeExtra, type Currency } from './data';
import { targetProps, useDemo } from './context';
import { CheckIcon } from './icons';
import { adminStatus, stageFocus, summarize, type ChatState } from './machine';
import type { S07Copy } from './useCopy';
import css from './board.module.css';

const COLUMNS = ['new', 'preparing', 'ready'] as const;
type Column = (typeof COLUMNS)[number];

interface Ticket {
  key: string;
  number: string;
  source: string;
  items: string;
  meta: string;
  column: Column;
  kind: 'bot' | 'mini' | 'old';
}

/** Newest first; each ticket's column is derived from the demo's phase. */
function boardTickets(state: ChatState, currency: Currency, copy: S07Copy): Ticket[] {
  const A = copy.admin;
  const tickets: Ticket[] = [];
  if (state.placed && state.miniStatus !== 'sending') {
    const mini = summarize(state.placed, currency, copy);
    tickets.push({
      key: `mini-${state.run}`,
      number: A.miniNumber,
      source: A.miniSource,
      items: mini.items,
      meta: A.paid(mini.total),
      column: 'new',
      kind: 'mini',
    });
  }
  const status = adminStatus(state.phase);
  if (status !== 'hidden') {
    const total = copy.price(itemPrice(state.item, currency) + sizeExtra(state.size, currency));
    tickets.push({
      key: `order-${state.run}`,
      number: `#${ORDER_NUMBER}`,
      source: A.botSource,
      items: copy.orderLine(state.item, state.size),
      meta: `${total} · ${copy.time(state.time).pickup}`,
      column: status,
      kind: 'bot',
    });
  }
  tickets.push({
    key: 'old',
    number: A.previous,
    source: A.botSource,
    items: copy.previousOrder,
    meta: A.previousStatus,
    column: 'ready',
    kind: 'old',
  });
  return tickets;
}

/** Takings so far today: the earlier order plus every order that has landed on the board. */
function todayTotal(state: ChatState, currency: Currency): number {
  let total = itemPrice(PREVIOUS_ORDER.item, currency) + sizeExtra(PREVIOUS_ORDER.size, currency);
  if (adminStatus(state.phase) !== 'hidden') total += itemPrice(state.item, currency) + sizeExtra(state.size, currency);
  const placed = state.miniStatus !== 'sending' ? state.placed : null;
  if (placed) total += MENU.reduce((sum, item) => sum + placed[item.id] * itemPrice(item.id, currency), 0);
  return total;
}

/** Seconds until a new ticket lands (the bot order rides the route first). */
const LAND_DELAY = { bot: 1.45, mini: 0.15 };

/**
 * The "Today" takings roll up as each order lands: GSAP writes the digits
 * (no React render per frame) and the pill pops once.
 */
function useTakings(
  valueRef: RefObject<HTMLElement | null>,
  pillRef: RefObject<HTMLElement | null>,
  total: number,
  price: (amount: number) => string,
  delay: number,
  isReduced: boolean
): void {
  const shown = useRef<number | null>(null);
  useLayoutEffect(() => {
    const value = valueRef.current;
    const pill = pillRef.current;
    if (!value || !pill) return;
    const from = shown.current;
    shown.current = total;
    if (from === null || isReduced || total <= from) {
      value.textContent = price(total);
      return;
    }
    const counter = { n: from };
    const tween = gsap.to(counter, {
      n: total,
      duration: 0.9,
      delay,
      ease: 'power2.out',
      onUpdate: () => {
        value.textContent = price(counter.n);
      },
    });
    const pop = gsap.fromTo(pill, { scale: 1 }, { scale: 1.12, duration: 0.18, delay, ease: 'power2.out', yoyo: true, repeat: 1 });
    return () => {
      tween.kill();
      pop.kill();
      gsap.set(pill, { scale: 1 });
      value.textContent = price(total);
    };
  }, [valueRef, pillRef, total, price, delay, isReduced]);
}

/**
 * FLIP for tickets changing column: every ticket lives in one grid, so React
 * keeps the element and only its grid cell changes; the jump is measured in
 * layout space (offsetLeft/Top, immune to the set's 3D tilt) and played back
 * as a transform with a small lift.
 */
function useTicketFlip(gridRef: RefObject<HTMLDivElement | null>, layoutKey: string, isReduced: boolean): void {
  const last = useRef(new Map<string, { x: number; y: number }>());
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const next = new Map<string, { x: number; y: number }>();
    for (const el of grid.querySelectorAll<HTMLElement>('[data-ticket]')) {
      const id = el.dataset.ticket ?? '';
      const pos = { x: el.offsetLeft, y: el.offsetTop };
      next.set(id, pos);
      const prev = last.current.get(id);
      if (!prev || isReduced || (prev.x === pos.x && prev.y === pos.y)) continue;
      const isColumnChange = prev.x !== pos.x;
      el.dataset.moving = 'true';
      gsap
        .timeline({ onComplete: () => el.removeAttribute('data-moving') })
        .fromTo(
          el,
          { x: prev.x - pos.x, y: prev.y - pos.y },
          { x: 0, y: 0, duration: isColumnChange ? 0.85 : 0.6, ease: 'power3.inOut' },
          0
        )
        .fromTo(
          el,
          { scale: 1, rotation: 0 },
          {
            keyframes: [
              { scale: isColumnChange ? 1.07 : 1.02, rotation: isColumnChange ? -2.5 : 0, duration: 0.35, ease: 'power2.out' },
              { scale: 1, rotation: 0, duration: 0.45, ease: 'power2.inOut' },
            ],
          },
          0
        );
    }
    last.current = next;
  }, [gridRef, layoutKey, isReduced]);
}

/**
 * Desktop satellite: the café's order screen as a landscape tablet beside the
 * phone. It idles ("Waiting for orders") until the first order is paid, then
 * wakes as the order rides the route into the New column; the ticket moves
 * to Preparing and, on "Mark ready", to Ready. The Mini App order lands in
 * New at the end.
 */
export default function CafeBoard() {
  const ctx = useDemo();
  const { state, currency, tap, isReduced, copy } = ctx;
  const A = copy.admin;
  const { isSplit } = stageFocus(state.phase);
  const gridRef = useRef<HTMLDivElement>(null);
  const takingsRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const tickets = boardTickets(state, currency, copy);
  const landDelay = state.phase === 'mini' ? LAND_DELAY.mini : LAND_DELAY.bot;
  useTakings(takingsRef, pillRef, todayTotal(state, currency), copy.price, landDelay, isReduced);
  const layoutKey = tickets.map(ticket => `${ticket.key}:${ticket.column}`).join('|');
  useTicketFlip(gridRef, layoutKey, isReduced);

  const placed = COLUMNS.map(column => tickets.filter(ticket => ticket.column === column));
  const rowOf = new Map<string, number>();
  placed.forEach(list => list.forEach((ticket, index) => rowOf.set(ticket.key, index + 2)));

  return (
    <aside className={css.tablet} data-awake={isSplit ? 'true' : undefined} aria-label={A.boardLabel}>
      <span className={css.slab} aria-hidden='true' />
      <span className={css.lens} aria-hidden='true' />
      <div className={css.screen}>
        <div className={css.head}>
          <span className={css.title}>
            {A.title}
            <span className={css.cafe}>{A.boardCafe}</span>
          </span>
          <span className={css.today} ref={pillRef}>
            {A.today}
            <b ref={takingsRef} />
          </span>
          <span className={css.live}>
            <i aria-hidden='true' />
            {A.live}
          </span>
          <span className={css.clock} aria-hidden='true'>
            {DEMO_TIME}
          </span>
        </div>

        <div className={css.grid} ref={gridRef}>
          {COLUMNS.map((column, index) => (
            <span key={`lane-${column}`} className={css.lane} style={{ gridColumn: index + 1 }} aria-hidden='true' />
          ))}
          {COLUMNS.map((column, index) => (
            <span
              key={`head-${column}`}
              className={css.colHead}
              style={{ gridColumn: index + 1, ['--land' as string]: `${landDelay}s` }}
              data-column={column}
              data-count={placed[index].length > 0 ? 'true' : undefined}
            >
              {A.columns[column]}
              <b>{placed[index].length}</b>
            </span>
          ))}
          {placed[0].length === 0 && (
            <span className={css.waiting} style={{ gridColumn: 1, gridRow: 2 }}>
              {A.waiting}
            </span>
          )}
          {tickets.map(ticket => {
            const isFresh = ticket.kind === 'bot' && ticket.column === 'new';
            const isPreparing = ticket.kind === 'bot' && ticket.column === 'preparing';
            return (
              <div
                key={ticket.key}
                className={css.ticket}
                style={{ gridColumn: COLUMNS.indexOf(ticket.column) + 1, gridRow: rowOf.get(ticket.key) }}
                data-ticket={ticket.key}
                data-kind={ticket.kind}
                data-column={ticket.column}
                data-fresh={isFresh ? 'true' : undefined}
              >
                {isFresh && (
                  <span className={css.incoming} aria-hidden='true'>
                    {A.incoming}
                  </span>
                )}
                <span className={css.ticketTop}>
                  <span className={css.number}>{ticket.number}</span>
                  <span className={css.source}>{ticket.source}</span>
                  {ticket.column === 'ready' && ticket.kind !== 'old' && <CheckIcon className={css.readyIcon} />}
                </span>
                <span className={css.items}>{ticket.items}</span>
                <span className={css.meta}>{ticket.meta}</span>
                {isPreparing && (
                  <button
                    type='button'
                    className={css.ready}
                    disabled={state.phase !== 'await-ready'}
                    onClick={() => tap('ready')}
                    {...targetProps('ready', ctx)}
                  >
                    {A.markReady}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <span className={css.glass} aria-hidden='true' />
    </aside>
  );
}
