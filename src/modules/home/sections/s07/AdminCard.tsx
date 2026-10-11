'use client';

import { ORDER_NUMBER, itemPrice, sizeExtra } from './data';
import { targetProps, useDemo } from './context';
import { adminStatus, stageFocus } from './machine';
import css from './admin.module.css';

/**
 * Phones: the café's order screen as a compact card. It rises below the
 * phone (the phone steps back) while the order is on the café's side, then
 * tucks away, so it never covers the chat. "Mark ready" makes the bot
 * message the customer, closing the loop. (Desktop shows CafeBoard.)
 */
export default function AdminCard() {
  const ctx = useDemo();
  const { state, currency, tap, copy } = ctx;
  const A = copy.admin;
  const status = adminStatus(state.phase);
  const { isAdmin } = stageFocus(state.phase);
  const total = copy.price(itemPrice(state.item, currency) + sizeExtra(state.size, currency));
  const statusLabel = status === 'ready' ? A.status.ready : status === 'preparing' ? A.status.preparing : A.status.new;

  return (
    <aside
      className={css.card}
      data-admin={isAdmin ? 'true' : undefined}
      data-status={status}
      aria-label={A.title}
      aria-hidden={!isAdmin}
      inert={!isAdmin}
    >
      <div className={css.head}>
        <span className={css.title}>{A.title}</span>
        <span className={css.live}>
          <i aria-hidden='true' />
          {A.live}
        </span>
      </div>

      <div className={css.order} data-fresh={status === 'new' ? 'true' : undefined} key={`order-${state.run}`}>
        {status === 'new' && (
          <span className={css.incoming} aria-hidden='true'>
            {A.incoming}
          </span>
        )}
        <div className={css.orderTop}>
          <span className={css.number}>#{ORDER_NUMBER}</span>
          <span className={css.source}>{A.botSource}</span>
          <span className={css.status} data-status={status}>
            {statusLabel}
          </span>
        </div>
        <p className={css.item}>{copy.orderLine(state.item, state.size)}</p>
        <p className={css.meta}>
          <span>{A.paid(total)}</span>
          <span>{A.pickup(copy.time(state.time).pickup)}</span>
        </p>
        <button
          type='button'
          className={css.ready}
          disabled={state.phase !== 'await-ready'}
          data-done={status === 'ready' ? 'true' : undefined}
          onClick={() => tap('ready')}
          {...targetProps('ready', ctx)}
        >
          {status === 'ready' ? A.status.ready : A.markReady}
        </button>
      </div>

      <div className={css.previous} aria-hidden='true'>
        <span className={css.number}>{A.previous}</span>
        <span className={css.prevItem}>{copy.previousOrder}</span>
        <span className={css.prevStatus}>{A.previousStatus}</span>
      </div>
    </aside>
  );
}
