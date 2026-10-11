'use client';

import { CATEGORY_IDS, MENU, itemPrice, type MenuItem } from './data';
import { targetProps, useDemo } from './context';
import { CheckIcon, CloseIcon, DotsIcon, FoodArt, MinusIcon, PlusIcon } from './icons';
import css from './sheets.module.css';

function MenuCard({ item, index }: { item: MenuItem; index: number }) {
  const ctx = useDemo();
  const { state, currency, tap, dispatch, copy } = ctx;
  const M = copy.mini;
  const name = copy.item(item.id);
  const count = state.counts[item.id];
  const isBusy = state.miniStatus !== 'idle';
  return (
    <li className={css.menuCard} style={{ ['--i' as string]: index }}>
      <span className={css.menuArt}>
        <FoodArt kind={item.art} />
        {count > 0 && <span className={css.menuBadge}>{count}</span>}
      </span>
      <span className={css.menuName}>{name}</span>
      <span className={css.menuFoot}>
        <span className={css.menuPrice}>{copy.price(itemPrice(item.id, currency))}</span>
        <span className={css.stepper} data-count={count > 0 ? 'true' : undefined}>
          <button
            type='button'
            className={css.stepMinus}
            aria-label={M.remove(name)}
            tabIndex={count > 0 ? 0 : -1}
            disabled={isBusy || count === 0}
            onClick={() => dispatch({ type: 'MINI_ADD', id: item.id, delta: -1, source: 'user' })}
            data-cursor={copy.cursor.tap}
            data-cursor-icon='tap'
          >
            <MinusIcon />
          </button>
          <button
            type='button'
            className={css.stepPlus}
            aria-label={M.add(name)}
            disabled={isBusy}
            onClick={() => tap(`add:${item.id}`)}
            {...targetProps(`add:${item.id}`, ctx)}
          >
            <PlusIcon />
          </button>
        </span>
      </span>
    </li>
  );
}

/** Mini App sheet: the full menu as a storefront inside the chat. */
export default function MiniApp() {
  const ctx = useDemo();
  const { state, currency, dispatch, tap, copy } = ctx;
  const M = copy.mini;
  const isOpen = state.phase === 'mini';
  const count = Object.values(state.counts).reduce((sum, n) => sum + n, 0);
  const total = MENU.reduce((sum, item) => sum + state.counts[item.id] * itemPrice(item.id, currency), 0);
  const isMainVisible = count > 0 || state.miniStatus !== 'idle';
  const mainLabel = state.miniStatus === 'sending' ? M.sending : state.miniStatus === 'sent' ? M.sent : M.view(count, copy.price(total));

  return (
    <div className={css.miniLayer} data-open={isOpen ? 'true' : undefined} inert={!isOpen}>
      <div className={css.mini} role='dialog' aria-label={`${copy.cafe} ${M.subtitle}`}>
        <div className={css.miniBar}>
          <button
            type='button'
            className={css.miniClose}
            onClick={() => dispatch({ type: 'CLOSE_MINI', source: 'user' })}
            data-cursor={copy.cursor.tap}
            data-cursor-icon='tap'
          >
            <CloseIcon />
            {M.close}
          </button>
          <span className={css.miniTitle}>
            {copy.cafe}
            <span>{M.subtitle}</span>
          </span>
          <span className={css.miniMore} aria-hidden='true'>
            <DotsIcon />
          </span>
        </div>

        <div className={css.miniBody}>
          <p className={css.miniGreeting}>{M.greeting}</p>
          <p className={css.miniNote}>{M.note}</p>
          <ul className={css.chips} aria-hidden='true'>
            {CATEGORY_IDS.map((id, i) => (
              <li key={id} data-active={i === 0 ? 'true' : undefined}>
                {M.category(id)}
              </li>
            ))}
          </ul>
          <ul className={css.menuGrid}>
            {MENU.map((item, i) => (
              <MenuCard key={item.id} item={item} index={i} />
            ))}
          </ul>
        </div>

        <div className={css.mainButtonWrap} data-show={isMainVisible ? 'true' : undefined}>
          <button
            type='button'
            className={css.mainButton}
            data-state={state.miniStatus}
            disabled={state.miniStatus !== 'idle' || count === 0}
            onClick={() => tap('checkout')}
            {...targetProps('checkout', ctx)}
          >
            {state.miniStatus === 'sending' && <span className={css.spinner} aria-hidden='true' />}
            {state.miniStatus === 'sent' && <CheckIcon className={css.mainCheck} />}
            <span>{mainLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
