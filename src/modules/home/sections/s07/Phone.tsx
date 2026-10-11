'use client';

import type { Ref } from 'react';
import { ChatHeader, Composer, MessageList } from './ChatScreen';
import { DEMO_TIME } from './data';
import { useDemo } from './context';
import { StatusGlyphs } from './icons';
import { isConfirmBeat } from './machine';
import MiniApp from './MiniApp';
import PaySheet from './PaySheet';
import css from './phone.module.css';

// One instance per page (the section renders once), so a static id is safe
// and avoids useId mismatches when the shell's tree differs across SSR.
const PATTERN_ID = 's07-cafe-doodles';

/** Original café doodles for the chat wallpaper (one 140px tile). */
function Wallpaper() {
  return (
    <svg className={css.pattern} aria-hidden='true' focusable='false'>
      <defs>
        <pattern id={PATTERN_ID} width='140' height='140' patternUnits='userSpaceOnUse' patternTransform='rotate(-8)'>
          <g fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M14 26h22v8a11 11 0 01-22 0z M36 28h3a4 4 0 010 8h-3 M19 20c0-3 3-3 3-6 M27 20c0-3 3-3 3-6' />
            <ellipse cx='98' cy='22' rx='7' ry='10' transform='rotate(35 98 22)' />
            <path d='M93 15c3 3 6 10 9 14' />
            <path d='M64 64l3.2 6.6 7.2 1-5.2 5 1.3 7.2-6.5-3.4-6.5 3.4 1.3-7.2-5.2-5 7.2-1z' />
            <path d='M112 78c-8 0-14 5-16 12 6-2 10-2 16 0 6-2 10-2 16 0-2-7-8-12-16-12z M104 84l2 4 M112 82v6 M120 84l-2 4' />
            <path d='M22 100c3-4 9-4 9 1 0-5 6-5 9-1 3 5-9 13-9 13s-12-8-9-13z' />
            <circle cx='72' cy='118' r='3' />
            <circle cx='52' cy='30' r='2' />
            <path d='M84 112l10-10 M40 70h10' />
          </g>
        </pattern>
      </defs>
      <rect width='100%' height='100%' fill={`url(#${PATTERN_ID})`} />
    </svg>
  );
}

/**
 * A phone built in CSS: titanium frame with real thickness (stacked slabs in
 * 3D), side keys, a glass glare that tracks the tilt, and the chat inside.
 * When an order is confirmed a band of light sweeps across the glass.
 */
export default function Phone({ glareRef }: { glareRef: Ref<HTMLSpanElement> }) {
  const { state, isReduced, copy } = useDemo();
  // "Order confirmed": one bright sweep of light across the glass.
  const isSweeping = isConfirmBeat(state.phase) && !isReduced;
  return (
    <div className={css.phone} role='group' aria-label={copy.demoLabel}>
      <span className={css.slab} aria-hidden='true' />
      <span className={`${css.slab} ${css.slabBack}`} aria-hidden='true' />
      <span className={`${css.key} ${css.keyAction}`} aria-hidden='true' />
      <span className={`${css.key} ${css.keyVolUp}`} aria-hidden='true' />
      <span className={`${css.key} ${css.keyVolDown}`} aria-hidden='true' />
      <span className={`${css.key} ${css.keyPower}`} aria-hidden='true' />

      <div className={css.screen}>
        <div className={css.wallpaper} aria-hidden='true'>
          <Wallpaper />
        </div>
        <div className={css.top}>
          <div className={css.status} aria-hidden='true'>
            <span>{DEMO_TIME}</span>
            <StatusGlyphs />
          </div>
          <ChatHeader />
        </div>
        <MessageList />
        <Composer />
        <PaySheet />
        <MiniApp />
        <span className={css.island} aria-hidden='true' />
        <span className={css.glare} ref={glareRef} aria-hidden='true' />
        {isSweeping && <span className={css.sweep} key={state.run} aria-hidden='true' />}
        <span className={css.homeBar} aria-hidden='true' />
      </div>
    </div>
  );
}
