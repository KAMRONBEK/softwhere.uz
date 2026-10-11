'use client';

import { useRef, type RefObject } from 'react';
import { gsap, useGSAP } from '../../global/gsap';
import { question } from './data';
import { LockIcon } from './icons';
import { TIMING, type Turn } from './machine';
import css from './map.module.css';
import { ANCHORS, CLUSTERS, MAP_H, MAP_W, PROBE_WALK, QUERY_AT, toPercent, type ProbeStop } from './points';

interface Spot {
  x: number;
  y: number;
}

/** Where the probe enters the map: the box edge nearest the chat (it comes from the question), in map units. */
function entryPoint(box: DOMRect, chat: DOMRect | undefined, query: Spot): Spot {
  if (!chat?.width) return { x: MAP_W + 20, y: query.y };
  const cx = ((chat.left + chat.width / 2 - box.left) / box.width) * MAP_W;
  const cy = ((chat.top + chat.height / 2 - box.top) / box.height) * MAP_H;
  // Beside the map (desktop): its right edge; under it (phones): its bottom edge.
  if (cx > MAP_W) return { x: MAP_W + 20, y: Math.min(MAP_H - 20, Math.max(20, cy)) };
  return { x: Math.min(MAP_W - 20, Math.max(20, cx)), y: MAP_H + 20 };
}

/** The stops after the walk: the matches it locks on to, the HR lock that stops it, or nothing. */
function finale(turn: Turn): ProbeStop[] {
  const reply = question(turn.question).reply(turn.role);
  if (reply.outcome === 'blocked') {
    const hr = CLUSTERS.hr;
    const query = QUERY_AT[turn.question];
    // It reaches for the HR cluster and stops at the edge of its cloud.
    return [{ x: query.x + (hr.x - query.x) * 0.55, y: query.y + (hr.y - query.y) * 0.55, kind: 'lock' }];
  }
  if (reply.outcome === 'missing') return [];
  return reply.hits.map(hit => ({ ...ANCHORS[hit.anchor], kind: 'hit' as const }));
}

/**
 * A question entering the index: a pulse leaves the chat, enters the map,
 * hops through a few snippets that don't match (each flashes, then dims),
 * reaches the question's own spot and then, by outcome, touches the closest
 * snippets (they stay lit for the lines to lock on), bumps into the HR lock
 * and falls back, or circles an empty patch. Plays once inside the
 * searching beat (TIMING.search), transforms and opacity only; nothing
 * under reduced motion.
 */
export default function Probe({ turn, boxRef }: { turn: Turn; boxRef: RefObject<HTMLDivElement | null> }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const walk = PROBE_WALK[turn.question];
  const query = QUERY_AT[turn.question];
  const ends = finale(turn);
  const stops = [...walk, ...ends];

  useGSAP(
    () => {
      const root = rootRef.current;
      const box = boxRef.current;
      if (!root || !box) return;
      const rect = box.getBoundingClientRect();
      if (!rect.width) return;
      const probe = root.querySelector<HTMLElement>('[data-probe]');
      const marks = Array.from(root.querySelectorAll<HTMLElement>('[data-stop]'));
      const lock = root.querySelector<HTMLElement>('[data-lock]');
      if (!probe) return;
      const chat = box.closest('[role="group"]')?.querySelector<HTMLElement>('[data-rag-chat]')?.getBoundingClientRect();
      const px = (spot: Spot) => ({ x: (spot.x / MAP_W) * rect.width, y: (spot.y / MAP_H) * rect.height });

      const total = TIMING.search / 1000;
      const enter = total * 0.22;
      const hop = (total * 0.5) / Math.max(1, walk.length + 1);
      const tl = gsap.timeline();
      tl.set(probe, { ...px(entryPoint(rect, chat, query)), opacity: 0, scale: 0.6 });
      tl.to(probe, { opacity: 1, scale: 1, duration: 0.15 });
      walk.forEach((stop, index) => {
        tl.to(probe, { ...px(stop), duration: index === 0 ? enter : hop, ease: 'power2.inOut' });
        const mark = marks[index];
        if (mark) tl.fromTo(mark, { opacity: 1, scale: 0.5 }, { opacity: 0, scale: 1.8, duration: 0.45, ease: 'power2.out' }, '<+=0.1');
      });
      tl.to(probe, { ...px(query), duration: hop, ease: 'power2.inOut' }, walk.length ? '>-0.25' : '>');
      ends.forEach((stop, offset) => {
        const mark = marks[walk.length + offset];
        if (stop.kind === 'lock') {
          tl.to(probe, { ...px(stop), duration: hop * 0.9, ease: 'power2.in' });
          if (lock) tl.fromTo(lock, { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2)' }, '<+=0.15');
          tl.to(probe, { ...px(query), duration: hop, ease: 'power3.out' });
          return;
        }
        if (mark)
          tl.fromTo(
            mark,
            { opacity: 0, scale: 0.4 },
            { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2)' },
            offset === 0 ? '>' : '<+=0.08'
          );
      });
      // Nothing close: the probe circles its spot once.
      if (!ends.length)
        tl.to(probe, { keyframes: { x: [px(query).x + 14, px(query).x, px(query).x - 14, px(query).x] }, duration: hop * 1.4 });
    },
    { scope: rootRef, dependencies: [], revertOnUpdate: true }
  );

  return (
    <div ref={rootRef} className={css.probeLayer} aria-hidden='true'>
      {stops.map((stop, index) => (
        <span key={index} className={css.stop} data-stop={stop.kind} style={toPercent(stop.x, stop.y)} />
      ))}
      {ends.some(stop => stop.kind === 'lock') && (
        <span className={css.lockMark} data-lock='' style={toPercent(ends[0].x, ends[0].y)}>
          <LockIcon />
        </span>
      )}
      <span className={css.probe} data-probe='' />
    </div>
  );
}
