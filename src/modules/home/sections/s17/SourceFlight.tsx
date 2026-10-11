'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, type RefObject } from 'react';
import { gsap } from '../../global/gsap';
import { answerSegments, question } from './data';
import { answerText } from './i18n';
import { useRagDemo } from './context';
import css from './flight.module.css';
import { TIMING, lastTurn } from './machine';
import { ANCHORS, MAP_H, MAP_W } from './points';

/** How long a source chip takes from its dot on the map to its number in the answer. */
const FLIGHT_S = 0.75;
/** How high the arc lifts above the higher of its two ends, in px. */
const ARC_LIFT = 70;

interface Point {
  x: number;
  y: number;
}

function centre(rect: DOMRect, origin: DOMRect): Point {
  return { x: rect.left + rect.width / 2 - origin.left, y: rect.top + rect.height / 2 - origin.top };
}

/** The cite's centre, held inside the visible part of the log when it is scrolled out of view. */
function citeTarget(cite: HTMLElement, origin: DOMRect): Point {
  const point = centre(cite.getBoundingClientRect(), origin);
  const log = cite.closest<HTMLElement>('[role="tabpanel"]')?.getBoundingClientRect();
  if (!log) return point;
  const top = log.top - origin.top + 12;
  const bottom = log.bottom - origin.top - 12;
  return { x: point.x, y: Math.min(Math.max(point.y, top), bottom) };
}

/** A point on the quadratic curve from a to b that bulges upward. */
function arcPoint(a: Point, b: Point, t: number): Point {
  const control = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - ARC_LIFT };
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
  };
}

/**
 * When an answer streams, each source it quotes flies as a small numbered
 * chip from its dot on the map to its number in the answer, landing as the
 * number appears, so the map and the chat read as one machine. The target is
 * re-read every frame (the log glides while the answer streams). Transforms
 * only, on a layer above the stage; nothing under reduced motion.
 */
export default function SourceFlight({ stageRef }: { stageRef: RefObject<HTMLElement | null> }) {
  const t = useTranslations('home.rag-build');
  const { state, isReduced } = useRagDemo();
  const layerRef = useRef<HTMLDivElement>(null);
  const turn = lastTurn(state);
  const flightKey = turn?.status === 'streaming' && state.tab === 'chat' ? `${state.run}-${turn.key}` : null;

  useEffect(() => {
    const layer = layerRef.current;
    const stage = stageRef.current;
    if (!flightKey || !turn || isReduced || !layer || !stage) return;
    const reply = question(turn.question).reply(turn.role);
    const box = stage.querySelector<HTMLElement>('[data-map-box]');
    // No map on screen (a phone scene that hides it): nothing to fly from.
    if (!box || !box.getBoundingClientRect().width || reply.sources.length === 0) return;
    const segments = answerSegments(answerText(t, reply));
    const tweens: gsap.core.Tween[] = [];
    const chips: HTMLElement[] = [];

    reply.sources.forEach((source, index) => {
      const n = index + 1;
      const token = segments.findIndex(segment => segment.kind === 'cite' && segment.n === n);
      const cite = stage.querySelector<HTMLElement>(`[data-cite-key='${turn.key}-${n}']`);
      if (token < 0 || !cite) return;
      const anchor = ANCHORS[source.anchor];
      const chip = document.createElement('span');
      chip.className = css.chip;
      cite.removeAttribute('data-landed');
      if (reply.outcome === 'missing') chip.dataset.low = 'true';
      chip.textContent = String(n);
      layer.appendChild(chip);
      chips.push(chip);

      // Land as the number streams in (the CSS stagger is TIMING.word per token).
      const landAt = (token * TIMING.word + 140) / 1000;
      const progress = { t: 0 };
      const render = () => {
        const origin = stage.getBoundingClientRect();
        const map = box.getBoundingClientRect();
        const from = {
          x: map.left - origin.left + (anchor.x / MAP_W) * map.width,
          y: map.top - origin.top + (anchor.y / MAP_H) * map.height,
        };
        const point = arcPoint(from, citeTarget(cite, origin), progress.t);
        const scale = 0.7 + Math.sin(progress.t * Math.PI) * 0.45;
        chip.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%) scale(${scale})`;
      };
      render();
      tweens.push(
        gsap.to(progress, {
          t: 1,
          duration: FLIGHT_S,
          delay: Math.max(0, landAt - FLIGHT_S),
          ease: 'power2.inOut',
          onStart: () => chip.setAttribute('data-flying', 'true'),
          onUpdate: render,
          onComplete: () => {
            chip.remove();
            // The number takes the hit (a CSS keyframe on the cite, so its own transition never fights it).
            cite.setAttribute('data-landed', 'true');
          },
        })
      );
    });

    return () => {
      tweens.forEach(tween => tween.kill());
      chips.forEach(chip => chip.remove());
    };
    // The turn object changes identity on every state update; the flight belongs to its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightKey, isReduced, stageRef]);

  return <div ref={layerRef} className={css.layer} aria-hidden='true' />;
}
