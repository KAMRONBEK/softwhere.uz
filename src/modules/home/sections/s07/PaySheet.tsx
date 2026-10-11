'use client';

import { CARD_LAST4, SMS_CODE_LENGTH, itemPrice, sizeExtra } from './data';
import { targetProps, useDemo } from './context';
import { CheckIcon, LockIcon } from './icons';
import { CODE_DIGIT_MS, CODE_START_MS, phaseAt } from './machine';
import css from './sheets.module.css';

const BURST = Array.from({ length: 10 }, (_, i) => i);

/** Bottom-sheet checkout: card, SMS code (uz/ru), processing, paid. */
export default function PaySheet() {
  const ctx = useDemo();
  const { state, currency, needsCode, tap, copy } = ctx;
  const P = copy.pay;
  const cardNumber = `•••• ${CARD_LAST4}`;
  const index = phaseAt(state.phase);
  const isOpen = index >= phaseAt('pay-card') && index <= phaseAt('pay-done');
  const total = copy.price(itemPrice(state.item, currency) + sizeExtra(state.size, currency));
  const step = isOpen ? state.phase : 'pay-card';
  const isDone = step === 'pay-done';
  const isBusy = step === 'pay-processing';
  // The SMS code autofills digit by digit in CSS during 'pay-code'.
  const isCodeFilled = isOpen && index > phaseAt('pay-code');

  return (
    <div className={css.layer} data-open={isOpen ? 'true' : undefined} inert={!isOpen}>
      <div className={css.scrim} />
      <div className={css.sheet} role='dialog' aria-label={P.title}>
        <span className={css.handle} aria-hidden='true' />
        <div className={css.payHead}>
          <span className={css.payTitle}>{P.title}</span>
          <span className={css.payMerchant}>
            {copy.cafe} · {P.order}
          </span>
        </div>
        <div className={css.amountWrap} data-done={isDone ? 'true' : undefined}>
          <p className={css.amount}>{total}</p>
          <div className={css.success} aria-hidden='true'>
            <svg className={css.successRing} viewBox='0 0 52 52'>
              <circle cx='26' cy='26' r='23' />
              <path d='M15 27l7.5 7.5L37.5 19' />
            </svg>
            {BURST.map(i => (
              <i key={i} className={css.spark} style={{ ['--a' as string]: `${i * 36}deg` }} />
            ))}
          </div>
        </div>

        <div className={css.bankCard} aria-label={`${P.cardLabel} ${cardNumber}`}>
          <span className={css.chip} aria-hidden='true' />
          <span className={css.cardLabel}>{P.cardLabel}</span>
          <span className={css.cardNumber}>{cardNumber}</span>
          <span className={css.cardHolder}>{P.cardHolder}</span>
          <svg className={css.contactless} viewBox='0 0 24 24' aria-hidden='true' focusable='false'>
            <path d='M8 7.5a6.5 6.5 0 010 9M11.5 5a10 10 0 010 14M15 2.8a13.2 13.2 0 010 18.4' />
          </svg>
        </div>

        {needsCode && (
          <div className={css.code} data-active={step === 'pay-code' ? 'true' : undefined}>
            <span className={css.codeLabel}>
              {P.codeLabel}
              <span>{P.codeSentTo}</span>
            </span>
            <span className={css.codeBoxes} aria-hidden='true'>
              {Array.from({ length: SMS_CODE_LENGTH }, (_, i) => (
                <span
                  key={i}
                  className={css.codeBox}
                  data-filled={isCodeFilled ? 'true' : undefined}
                  style={{ ['--d' as string]: `${CODE_START_MS + i * CODE_DIGIT_MS}ms` }}
                />
              ))}
            </span>
          </div>
        )}

        <button
          type='button'
          className={css.payButton}
          data-state={isDone ? 'done' : isBusy ? 'busy' : undefined}
          disabled={step !== 'pay-card'}
          onClick={() => tap('confirm')}
          {...targetProps('confirm', ctx)}
        >
          <span className={css.payLabel}>{P.button(total)}</span>
          <span className={css.payBusy} aria-hidden={!isBusy}>
            <span className={css.spinner} />
            {P.processing}
          </span>
          <span className={css.payDone} aria-hidden={!isDone}>
            <CheckIcon />
            {P.done}
          </span>
        </button>
        <p className={css.secure}>
          <LockIcon />
          {P.secure}
        </p>
      </div>
    </div>
  );
}
