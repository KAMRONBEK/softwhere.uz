'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { gsap, useGSAP } from '../../global/gsap';
import { BOT_ITEMS, DEMO_TIME, SIZE_IDS, TIME_IDS, itemPrice, sizeExtra, type Currency } from './data';
import { targetProps, useDemo } from './context';
import {
  AppIcon,
  BackIcon,
  CafeGlyph,
  CheckIcon,
  ClipIcon,
  DotsIcon,
  DoubleCheckIcon,
  MenuIcon,
  MicIcon,
  SendIcon,
  SmileIcon,
} from './icons';
import { HELLO_LENGTH, TYPE_KEY_MS, TYPE_START_MS, isTyping, type ChatMessage } from './machine';
import type { S07Copy } from './useCopy';
import css from './chat.module.css';

/* ---------- chrome ---------- */

export function ChatHeader() {
  const { state, isReduced, copy } = useDemo();
  const C = copy.chat;
  const typing = isTyping(state.phase) && !isReduced;
  return (
    <div className={css.header}>
      <span className={css.headerBack} aria-hidden='true'>
        <BackIcon />
      </span>
      <span className={css.avatar} aria-hidden='true'>
        <CafeGlyph />
      </span>
      <span className={css.headerText}>
        <span className={css.headerTitle}>{copy.cafe}</span>
        <span className={css.headerSub} data-typing={typing ? 'true' : undefined}>
          {typing ? C.typing : C.subtitle}
        </span>
      </span>
      <span className={css.headerMore} aria-hidden='true'>
        <DotsIcon />
      </span>
    </div>
  );
}

/**
 * The composer types the opening line itself: one GSAP tween writes the
 * characters into a span (no React render per key), timed to match the
 * machine's compose phase.
 */
export function Composer() {
  const { state, copy } = useDemo();
  const C = copy.chat;
  const isComposing = state.phase === 'compose';
  const hello = C.hello;
  const typedRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const typed = typedRef.current;
      if (!isComposing || !typed) return;
      const progress = { n: 0 };
      typed.textContent = '';
      gsap.to(progress, {
        n: HELLO_LENGTH,
        duration: (HELLO_LENGTH * TYPE_KEY_MS) / 1000,
        delay: TYPE_START_MS / 1000,
        ease: 'none',
        // The localized line is spread over the same keystroke budget.
        onUpdate: () => {
          typed.textContent = hello.slice(0, Math.round((progress.n / HELLO_LENGTH) * hello.length));
        },
        onComplete: () => caretRef.current?.setAttribute('data-done', 'true'),
      });
    },
    { dependencies: [isComposing, state.run, hello], revertOnUpdate: true }
  );

  return (
    <div className={css.composer} aria-hidden='true'>
      <span className={css.menuPill}>
        <MenuIcon />
        {C.menuButton}
      </span>
      <span className={css.field}>
        <SmileIcon className={css.fieldIcon} />
        {isComposing ? (
          <span className={css.typed}>
            <span ref={typedRef} />
            <span className={css.caret} ref={caretRef} />
          </span>
        ) : (
          <span className={css.placeholder}>{C.inputPlaceholder}</span>
        )}
        {!isComposing && <ClipIcon className={css.fieldIcon} />}
      </span>
      <span className={css.sendSlot} data-active={isComposing ? 'true' : undefined}>
        <span className={css.sendBtn}>
          <SendIcon />
        </span>
        <span className={css.micBtn}>
          <MicIcon />
        </span>
      </span>
    </div>
  );
}

/* ---------- inline keyboards ---------- */

interface KeyDef {
  target: string;
  label: string;
  sub?: string;
  isWide?: boolean;
  hasAppIcon?: boolean;
  /** Restart is not a step of the script; it is handled here. */
  isRestart?: boolean;
}

function InlineKeyboard({ rows, message, isLive }: { rows: KeyDef[][]; message: ChatMessage; isLive: boolean }) {
  const ctx = useDemo();
  const { dispatch, tap, isReduced } = ctx;
  return (
    <div className={css.keyboard} role='group'>
      {rows.map((row, r) => (
        <div className={css.keyRow} key={r}>
          {row.map(key => {
            const value = key.target.split(':')[1] ?? key.target;
            const isChosen = message.chosen !== undefined && message.chosen === value;
            const onClick = key.isRestart
              ? () => dispatch({ type: 'RESTART', isAutopilot: false, isInstant: isReduced })
              : () => tap(key.target);
            return (
              <button
                key={key.target}
                type='button'
                className={css.key}
                disabled={!isLive}
                data-chosen={isChosen ? 'true' : undefined}
                data-dim={message.chosen !== undefined && !isChosen ? 'true' : undefined}
                onClick={onClick}
                {...targetProps(key.target, ctx)}
              >
                <span className={css.keyLabel}>{key.label}</span>
                {key.sub && <span className={css.keySub}>{key.sub}</span>}
                {key.hasAppIcon && <AppIcon className={css.keyApp} />}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ---------- bubbles ---------- */

function Meta({ isOut }: { isOut?: boolean }) {
  return (
    <span className={css.meta} aria-hidden='true'>
      {DEMO_TIME}
      {isOut && <DoubleCheckIcon className={css.ticks} />}
    </span>
  );
}

function Bubble({ from, children, wide }: { from: 'bot' | 'user'; children: ReactNode; wide?: boolean }) {
  return (
    <div className={css.bubble} data-from={from} data-wide={wide ? 'true' : undefined}>
      {children}
      <Meta isOut={from === 'user'} />
    </div>
  );
}

function CartCard() {
  const { state, currency, copy } = useDemo();
  const C = copy.chat;
  const total = copy.price(itemPrice(state.item, currency) + sizeExtra(state.size, currency));
  return (
    <div className={css.card}>
      <p className={css.cardTitle}>{C.cartTitle}</p>
      <p className={css.cardRow}>
        <span>{copy.orderLine(state.item, state.size)}</span>
        <span className={css.num}>{total}</span>
      </p>
      <p className={css.cardRow}>
        <span className={css.cardMuted}>{C.pickupLabel}</span>
        <span>{copy.time(state.time).pickup}</span>
      </p>
      <p className={`${css.cardRow} ${css.cardTotal}`}>
        <span>{C.totalLabel}</span>
        <span className={css.num}>{total}</span>
      </p>
    </div>
  );
}

function ReceiptCard() {
  const { state, currency, copy } = useDemo();
  const C = copy.chat;
  const total = copy.price(itemPrice(state.item, currency) + sizeExtra(state.size, currency));
  return (
    <div className={css.receipt}>
      <span className={css.receiptCheck} aria-hidden='true'>
        <CheckIcon />
      </span>
      <p className={css.receiptTitle}>{C.receiptTitle}</p>
      <p className={css.receiptLine}>{C.receiptPaid(total)}</p>
      <p className={css.receiptLine}>{C.receiptPickup(copy.time(state.time).pickup)}</p>
    </div>
  );
}

function itemKeys(currency: Currency, copy: S07Copy): KeyDef[][] {
  const keys = BOT_ITEMS.map(id => ({
    target: `item:${id}`,
    label: copy.item(id),
    sub: copy.price(itemPrice(id, currency)),
  }));
  return [keys.slice(0, 2), keys.slice(2, 4)];
}

function MessageView({ message }: { message: ChatMessage }) {
  const { state, currency, copy } = useDemo();
  const C = copy.chat;
  const total = copy.price(itemPrice(state.item, currency) + sizeExtra(state.size, currency));
  const isOpen = message.chosen === undefined;
  switch (message.kind) {
    case 'hello':
      return <Bubble from='user'>{C.hello}</Bubble>;
    case 'echo-item':
      return <Bubble from='user'>{copy.item(state.item)}</Bubble>;
    case 'echo-size':
      return <Bubble from='user'>{copy.size(state.size)}</Bubble>;
    case 'echo-time':
      return <Bubble from='user'>{copy.time(state.time).name}</Bubble>;
    case 'greet':
      return (
        <div className={css.withKeys}>
          <Bubble from='bot'>{C.greet}</Bubble>
          <InlineKeyboard rows={itemKeys(currency, copy)} message={message} isLive={isOpen && state.phase === 'await-item'} />
        </div>
      );
    case 'ask-size':
      return (
        <div className={css.withKeys}>
          <Bubble from='bot'>{C.askSize}</Bubble>
          <InlineKeyboard
            rows={[
              SIZE_IDS.map(id => {
                const extra = sizeExtra(id, currency);
                return { target: `size:${id}`, label: copy.size(id), sub: extra === 0 ? '' : `+${copy.price(extra)}` };
              }),
            ]}
            message={message}
            isLive={isOpen && state.phase === 'await-size'}
          />
        </div>
      );
    case 'ask-time': {
      const keys = TIME_IDS.map(id => ({ target: `time:${id}`, label: copy.time(id).name }));
      return (
        <div className={css.withKeys}>
          <Bubble from='bot'>{C.askTime}</Bubble>
          <InlineKeyboard rows={[[keys[0]], keys.slice(1)]} message={message} isLive={isOpen && state.phase === 'await-time'} />
        </div>
      );
    }
    case 'cart':
      return (
        <div className={css.withKeys} data-wide='true'>
          <Bubble from='bot' wide>
            <CartCard />
          </Bubble>
          <InlineKeyboard
            rows={[[{ target: 'pay', label: C.pay(total) }], [{ target: 'restart', label: C.startOver, isRestart: true }]]}
            message={message}
            isLive={isOpen && state.phase === 'await-pay'}
          />
        </div>
      );
    case 'receipt':
      return (
        <Bubble from='bot' wide>
          <ReceiptCard />
        </Bubble>
      );
    case 'ready':
      return <Bubble from='bot'>{C.ready(state.item)}</Bubble>;
    case 'menu':
      return (
        <div className={css.withKeys}>
          <Bubble from='bot'>{C.menuPrompt}</Bubble>
          <InlineKeyboard
            rows={[[{ target: 'open-mini', label: C.openMenu, hasAppIcon: true }]]}
            message={{ ...message, chosen: undefined }}
            isLive={state.phase === 'await-menu' || state.phase === 'done'}
          />
        </div>
      );
    default:
      return null;
  }
}

function TypingBubble() {
  return (
    <div className={css.bubble} data-from='bot' data-typing='true' aria-hidden='true'>
      <span className={css.dots}>
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

/**
 * The message list is laid out from the top (appending a message never moves
 * the ones already there, so no layout shift) and slid into place with a
 * transform: bottom-anchored like a real chat, older messages gliding up.
 */
export function MessageList() {
  const { state, isReduced, copy } = useDemo();
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hasPlaced = useRef(false);
  const showTyping = isTyping(state.phase) && !isReduced;

  useGSAP(
    () => {
      const viewport = viewportRef.current;
      const list = listRef.current;
      if (!viewport || !list) return;
      const y = viewport.clientHeight - list.offsetHeight;
      if (isReduced || !hasPlaced.current) gsap.set(list, { y });
      else gsap.to(list, { y, duration: 0.5, ease: 'power3.out', overwrite: true });
      hasPlaced.current = true;
    },
    { dependencies: [state.messages.length, showTyping, isReduced] }
  );

  // The phone unit follows the viewport size, and late web fonts reflow the
  // bubbles: re-anchor instantly when either box changes size (a new message
  // is animated by the effect above, so only re-anchor when nothing is moving).
  useEffect(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!viewport || !list) return;
    const observer = new ResizeObserver(() => {
      if (gsap.isTweening(list)) return;
      gsap.set(list, { y: viewport.clientHeight - list.offsetHeight });
    });
    observer.observe(viewport);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={css.viewport} ref={viewportRef}>
      <div className={css.list} ref={listRef}>
        {state.messages.length > 0 && (
          <p className={css.dayChip}>
            <span>{copy.chat.today}</span>
          </p>
        )}
        {state.messages.map(message => (
          <div
            key={message.id}
            className={css.row}
            data-from={message.kind === 'hello' || message.kind.startsWith('echo') ? 'user' : 'bot'}
          >
            <MessageView message={message} />
          </div>
        ))}
        {showTyping && (
          <div className={css.row} data-from='bot' key='typing'>
            <TypingBubble />
          </div>
        )}
      </div>
    </div>
  );
}
