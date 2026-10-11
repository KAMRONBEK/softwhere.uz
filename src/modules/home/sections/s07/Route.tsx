'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '../../global/gsap';
import { NEXT_ORDER_NUMBER, ORDER_NUMBER, itemPrice, sizeExtra } from './data';
import { useDemo } from './context';
import { CafeGlyph, CheckIcon } from './icons';
import { phaseAt, summarize, type ChatState } from './machine';
import css from './stage.module.css';

/**
 * The dashed route between the customer's chat and the café's screen, in
 * phone units (the camera's em). `side`: desktop, the tablet stands to the
 * right of the phone and the route ends on its New column. `below`: phones,
 * the phone steps back and the order card rises underneath it. Points are
 * hand-placed on the receipt bubble and the order slot of each layout (see
 * board.module.css / admin.module.css for the boxes).
 */
const ROUTES = {
  side: { viewBox: '0 0 51 48', d: 'M21.3 40.2C25.6 40.2 21.6 23.6 25.5 23.6' },
  below: { viewBox: '0 0 23 48', d: 'M16.2 27.4C23 27.6 23.4 34.6 19.2 37.5' },
} as const;
export type RouteLayout = keyof typeof ROUTES;

/** Length of the bright streak that runs ahead of the packet (phone units). */
const COMET = 3.2;
/** How much of the route stays drawn between trips (desktop keeps the link). */
const REST_OPACITY: Record<RouteLayout, number> = { side: 0.4, below: 0 };
/** How far the ticket lifts off the glass toward the camera mid-flight (phone units). */
const LIFT: Record<RouteLayout, number> = { side: 7, below: 3 };
/** It always rides a little above both screens, so neither device's edge can cover it. */
const HOVER = 1.4;
/** Bank: a share of the route's heading, capped (degrees). */
const BANK = { share: 0.22, max: 16 };

interface Trip {
  key: string;
  /** 1: chat → café, -1: café → chat. */
  direction: 1 | -1;
  delay: number;
  duration: number;
}

function tripFor(state: ChatState, layout: RouteLayout): Trip | null {
  if (state.phase === 'kitchen-new') return { key: `${state.run}:order`, direction: 1, delay: 0.5, duration: 1 };
  if (state.phase === 'ready-typing') return { key: `${state.run}:ready`, direction: -1, delay: 0.05, duration: 0.85 };
  if (layout === 'side' && state.phase === 'mini' && state.miniStatus === 'sending') {
    return { key: `${state.run}:mini`, direction: 1, delay: 0.1, duration: 0.8 };
  }
  return null;
}

interface PacketLabel {
  title: string;
  sub: string;
  isCheck: boolean;
}

function packetLabel(state: ChatState, { currency, copy }: Pick<ReturnType<typeof useDemo>, 'currency' | 'copy'>): PacketLabel {
  const index = phaseAt(state.phase);
  if (index >= phaseAt('mini')) {
    const total = state.placed ? summarize(state.placed, currency, copy).total : '';
    return { title: `#${NEXT_ORDER_NUMBER}`, sub: copy.admin.paid(total), isCheck: false };
  }
  if (index >= phaseAt('ready-typing')) return { title: copy.admin.packetReady, sub: `#${ORDER_NUMBER}`, isCheck: true };
  const total = copy.price(itemPrice(state.item, currency) + sizeExtra(state.size, currency));
  return { title: `#${ORDER_NUMBER}`, sub: copy.admin.paid(total), isCheck: false };
}

/**
 * Plays one trip per hand-off: the order ticket lifts off the phone's glass
 * toward the camera, banks along the route and settles into the café's
 * screen (transforms only), with a short bright streak on the path. Nothing
 * runs under reduced motion; the café's screen simply shows the new state.
 */
export default function Route({ layout }: { layout: RouteLayout }) {
  const { state, currency, copy, isReduced } = useDemo();
  const lineRef = useRef<SVGPathElement>(null);
  const cometRef = useRef<SVGPathElement>(null);
  const haloRef = useRef<SVGPathElement>(null);
  const packetRef = useRef<HTMLSpanElement>(null);
  const trip = isReduced ? null : tripFor(state, layout);
  const label = packetLabel(state, { currency, copy });
  const route = ROUTES[layout];

  useGSAP(
    () => {
      const line = lineRef.current;
      const comet = cometRef.current;
      const halo = haloRef.current;
      const packet = packetRef.current;
      const box = packet?.parentElement;
      if (!trip || !line || !comet || !halo || !packet || !box) return;

      const unit = Number.parseFloat(getComputedStyle(box).fontSize) || 16;
      const length = line.getTotalLength();
      const progress = { t: 0 };
      const streaks = [comet, halo];
      gsap.killTweensOf([packet, line, ...streaks]);
      gsap.set(streaks, { attr: { 'stroke-dasharray': `${COMET} ${length + COMET}` } });

      const place = () => {
        const along = trip.direction === 1 ? progress.t : 1 - progress.t;
        const at = along * length;
        const point = line.getPointAtLength(at);
        const ahead = line.getPointAtLength(Math.min(length, at + 0.4));
        const behind = line.getPointAtLength(Math.max(0, at - 0.4));
        const heading = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;
        const arc = Math.sin(progress.t * Math.PI);
        gsap.set(packet, {
          x: point.x * unit,
          y: point.y * unit,
          z: (HOVER + arc * LIFT[layout]) * unit,
          rotation: gsap.utils.clamp(-BANK.max, BANK.max, heading * BANK.share * trip.direction) * arc,
          rotationX: arc * 14,
        });
        // The streak trails the packet: behind it in the direction of travel.
        const offset = trip.direction === 1 ? COMET - at : -at;
        for (const streak of streaks) streak.style.strokeDashoffset = String(offset);
      };

      gsap.set(packet, { xPercent: -50, yPercent: -50, scale: 0.3, autoAlpha: 0 });
      place();
      gsap
        .timeline({ delay: trip.delay })
        .to(line, { opacity: 1, duration: 0.35, ease: 'power1.out' }, 0)
        .to(streaks, { opacity: 1, duration: 0.2 }, 0)
        .to(packet, { autoAlpha: 1, scale: 1, duration: 0.35, ease: 'back.out(2.2)' }, 0)
        .to(progress, { t: 1, duration: trip.duration, ease: 'power2.inOut', onUpdate: place }, 0.08)
        .to(packet, { autoAlpha: 0, scale: 0.55, duration: 0.24, ease: 'power2.in' }, '>-0.14')
        .to(streaks, { opacity: 0, duration: 0.3 }, '<')
        .to(line, { opacity: REST_OPACITY[layout], duration: 0.6, ease: 'power1.inOut' }, '<');
    },
    { dependencies: [trip?.key ?? null, layout] }
  );

  return (
    <>
      <svg className={css.route} viewBox={route.viewBox} aria-hidden='true' focusable='false'>
        <path ref={lineRef} className={css.routeLine} d={route.d} />
        <path ref={haloRef} className={css.routeHalo} d={route.d} />
        <path ref={cometRef} className={css.routeComet} d={route.d} />
      </svg>
      <span ref={packetRef} className={css.packet} aria-hidden='true'>
        <span className={css.packetBadge}>{label.isCheck ? <CheckIcon className={css.packetIcon} /> : <CafeGlyph />}</span>
        <span className={css.packetText}>
          <span className={css.packetTitle}>{label.title}</span>
          <span className={css.packetSub}>{label.sub}</span>
        </span>
      </span>
    </>
  );
}
