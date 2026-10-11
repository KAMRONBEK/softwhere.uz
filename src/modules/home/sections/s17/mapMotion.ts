'use client';

import { useEffect, type RefObject } from 'react';
import { gsap, useGSAP } from '../../global/gsap';
import { DOCS } from './data';
import { pipelineTiming, type Pipeline } from './machine';
import { MAP_W, POINTS, SCATTER } from './points';

/** Pointer lean (map units): how far the pointer reaches, how hard near dots lean toward it, and the glow radius. */
const LEAN_RADIUS = 70;
const LEAN_PULL = 0.2;
const GLOW_RADIUS = 30;
/** Share of the remaining distance a leaning dot covers per frame. */
const LEAN_EASE = 0.18;
const SETTLED = 0.04;

/** A dot's offset from its indexed slot to its place in the unsorted cloud (map units). */
function scatterOffset(dot: SVGCircleElement): { x: number; y: number } {
  const index = Number(dot.dataset.i);
  const point = POINTS[index];
  const spot = SCATTER[index];
  return point && spot ? { x: spot.x - point.x, y: spot.y - point.y } : { x: 0, y: 0 };
}

/**
 * The snippets' journey through the pipeline (GSAP, transforms and opacity
 * on the dots, reverted at each change of pipeline):
 * - reading: each file's snippets burst from its icon into an unsorted cloud
 *   over the whole map, file after file;
 * - read: they wait in that cloud;
 * - indexing: they pull together into their topic clusters (their slots).
 * Ready (and idle) is the plain markup: every dot in its slot.
 */
export function useSnippetFlight(
  svgRef: RefObject<SVGSVGElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  pipeline: Pipeline,
  isEnabled: boolean,
  isTouch: boolean,
  run: number
): void {
  useGSAP(
    () => {
      const svg = svgRef.current;
      const stage = stageRef.current;
      if (!isEnabled || !svg || !stage) return;
      if (pipeline !== 'reading' && pipeline !== 'read' && pipeline !== 'indexing') return;
      const dots = Array.from(svg.querySelectorAll<SVGCircleElement>('[data-i]'));
      const pace = pipelineTiming(isTouch);

      if (pipeline === 'read') {
        dots.forEach(dot => gsap.set(dot, { ...scatterOffset(dot), opacity: 1 }));
        return;
      }

      if (pipeline === 'indexing') {
        const total = pace.index / 1000;
        gsap.fromTo(
          dots,
          { x: i => scatterOffset(dots[i]).x, y: i => scatterOffset(dots[i]).y, opacity: 1 },
          { x: 0, y: 0, duration: total * 0.55, ease: 'power3.inOut', stagger: { amount: total * 0.3, from: 'random' } }
        );
        return;
      }

      const box = svg.getBoundingClientRect();
      const total = pace.read / 1000;
      if (!box.width) {
        dots.forEach(dot => gsap.set(dot, { ...scatterOffset(dot), opacity: 1 }));
        return;
      }
      const k = MAP_W / box.width;
      DOCS.forEach((doc, index) => {
        const icon = stage.querySelector(`[data-doc-card='${doc.id}'] [data-doc-icon]`)?.getBoundingClientRect();
        const own = dots.filter(dot => dot.dataset.docDot === doc.id);
        // The file's icon, in map units (off the map's left edge when the files are hidden).
        const fromX = icon?.width ? (icon.left + icon.width / 2 - box.left) * k : -40;
        const fromY = icon?.width ? (icon.top + icon.height / 2 - box.top) * k : 0;
        gsap.fromTo(
          own,
          {
            x: i => fromX - Number(own[i].getAttribute('cx')),
            y: i => fromY - Number(own[i].getAttribute('cy')),
            opacity: 0,
          },
          {
            x: i => scatterOffset(own[i]).x,
            y: i => scatterOffset(own[i]).y,
            opacity: 1,
            duration: total * 0.45,
            ease: 'power3.out',
            delay: index * total * 0.08,
            stagger: { amount: total * 0.14, from: 'random' },
          }
        );
      });
    },
    { dependencies: [pipeline, isEnabled, isTouch, run], scope: svgRef, revertOnUpdate: true }
  );
}

interface Lean {
  x: number;
  y: number;
  isNear: boolean;
}

/**
 * Desktop pointer over the indexed map: the snippets near it lean toward it
 * and the nearest glow, like the index noticing you. One rAF loop that runs
 * only while something moves; it writes the dots' cx/cy (the flights own
 * their transforms) and a data-near flag, never React state.
 */
export function useMapLean(boxRef: RefObject<HTMLDivElement | null>, svgRef: RefObject<SVGSVGElement | null>, isEnabled: boolean): void {
  useEffect(() => {
    const box = boxRef.current;
    const svg = svgRef.current;
    if (!isEnabled || !box || !svg) return;
    const dots = Array.from(svg.querySelectorAll<SVGCircleElement>('[data-i]'));
    const base = dots.map(dot => POINTS[Number(dot.dataset.i)] ?? { x: 0, y: 0 });
    const leans: Lean[] = dots.map(() => ({ x: 0, y: 0, isNear: false }));
    let pointer: { x: number; y: number } | null = null;
    let frame = 0;

    const tick = () => {
      frame = 0;
      let isMoving = false;
      dots.forEach((dot, i) => {
        const at = base[i];
        const lean = leans[i];
        let tx = 0;
        let ty = 0;
        let isNear = false;
        if (pointer) {
          const dx = pointer.x - at.x;
          const dy = pointer.y - at.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LEAN_RADIUS * LEAN_RADIUS) {
            const falloff = 1 - Math.sqrt(d2) / LEAN_RADIUS;
            tx = dx * LEAN_PULL * falloff;
            ty = dy * LEAN_PULL * falloff;
            isNear = d2 < GLOW_RADIUS * GLOW_RADIUS;
          }
        }
        if (isNear !== lean.isNear) {
          lean.isNear = isNear;
          if (isNear) dot.setAttribute('data-near', 'true');
          else dot.removeAttribute('data-near');
        }
        if (Math.abs(tx - lean.x) < SETTLED && Math.abs(ty - lean.y) < SETTLED) {
          if (lean.x === tx && lean.y === ty) return;
          lean.x = tx;
          lean.y = ty;
        } else {
          lean.x += (tx - lean.x) * LEAN_EASE;
          lean.y += (ty - lean.y) * LEAN_EASE;
          isMoving = true;
        }
        dot.setAttribute('cx', String(at.x + lean.x));
        dot.setAttribute('cy', String(at.y + lean.y));
      });
      if (isMoving) frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const rect = box.getBoundingClientRect();
      if (!rect.width) return;
      const k = MAP_W / rect.width;
      pointer = { x: (event.clientX - rect.left) * k, y: (event.clientY - rect.top) * k };
      wake();
    };
    const onLeave = () => {
      pointer = null;
      wake();
    };

    box.addEventListener('pointermove', onMove, { passive: true });
    box.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerleave', onLeave);
      dots.forEach((dot, i) => {
        dot.setAttribute('cx', String(base[i].x));
        dot.setAttribute('cy', String(base[i].y));
        dot.removeAttribute('data-near');
      });
    };
  }, [boxRef, svgRef, isEnabled]);
}
