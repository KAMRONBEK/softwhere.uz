'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useInView } from '../../components/useInView';
import { DPR_CAPS } from '../../device/useDeviceTier';
import type { LabTheme } from '../../theme/useLabTheme';
import type { DeviceTier } from '../../types';
import { createFlowEngine, type FlowDensity, type FlowGeometry, type FlowGlyph, type FlowSignal } from './flowEngine';
import css from './aiDemo.module.css';

const DENSITY: Record<DeviceTier, FlowDensity> = {
  high: { maxNodes: 6, maxPulses: 90, rate: 1, hasGlow: true, maxFps: 60 },
  mid: { maxNodes: 5, maxPulses: 56, rate: 0.8, hasGlow: true, maxFps: 60 },
  low: { maxNodes: 4, maxPulses: 18, rate: 0.5, hasGlow: false, maxFps: 30 },
};
const SEED = 808;
const PAD = 24;
/** The plan counts as "beside" the graph when it starts right of it. */
const ROW_TOLERANCE = 4;

/** What the scripted demo (or the slot) can ask of the field. */
export interface FlowHandle {
  /** The idea's letters, measured in viewport px; the field converts them. */
  launch(glyphs: readonly { ch: string; x: number; y: number }[], font: string): void;
  wake(): void;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function relativeBox(el: Element, root: DOMRect): Box {
  const r = el.getBoundingClientRect();
  return { left: r.left - root.left, top: r.top - root.top, right: r.right - root.left, bottom: r.bottom - root.top };
}

function union(a: Box, b: Box): Box {
  return {
    left: Math.min(a.left, b.left),
    top: Math.min(a.top, b.top),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  };
}

/**
 * The canvas covers the idea (letters fly from it), the graph, and a strip of
 * the plan's edge (the feed wire plugs into it). Columns sit over the DOM
 * step labels, so the network and its captions always line up.
 */
export function computeFlowGeometry(
  root: HTMLElement,
  graphEl: HTMLElement,
  sourceEl: HTMLElement | null,
  sinkEl: HTMLElement | null
): { box: Box; geometry: FlowGeometry } | null {
  const rootRect = root.getBoundingClientRect();
  const plotEl = graphEl.querySelector('[data-plot]');
  const labels = graphEl.querySelectorAll('[data-step]');
  if (!plotEl || !labels.length || rootRect.width < 1) return null;

  const plot = relativeBox(plotEl, rootRect);
  let box = union(plot, relativeBox(graphEl, rootRect));
  if (sourceEl) box = union(box, relativeBox(sourceEl, rootRect));
  const sink = sinkEl ? relativeBox(sinkEl, rootRect) : null;
  const isRow = sink !== null && sink.left >= plot.right - ROW_TOLERANCE;
  if (sink) {
    box = union(
      box,
      isRow
        ? { left: sink.left - 2, right: sink.left + 20, top: sink.top, bottom: sink.bottom }
        : { left: sink.left, right: sink.right, top: sink.top - 4, bottom: sink.top + 20 }
    );
  }
  box = {
    left: Math.max(0, Math.floor(box.left - PAD)),
    top: Math.max(0, Math.floor(box.top - PAD)),
    right: Math.min(rootRect.width, Math.ceil(box.right + PAD)),
    bottom: Math.min(rootRect.height, Math.ceil(box.bottom + PAD)),
  };
  if (box.right - box.left < 4 || box.bottom - box.top < 4) return null;

  const local = (x: number, y: number) => ({ x: x - box.left, y: y - box.top });
  const midY = (plot.top + plot.bottom) / 2;
  const columns = Array.from(labels, label => {
    const r = relativeBox(label, rootRect);
    return (r.left + r.right) / 2 - box.left;
  });
  const output = local(plot.right, midY);
  let feed: FlowGeometry['feed'] = null;
  if (sink) {
    feed = isRow
      ? { ...local(sink.left, sink.top), axis: 'x' }
      : { x: Math.min(output.x, sink.right - 24 - box.left), y: sink.top - box.top, axis: 'y' };
  }

  return {
    box,
    geometry: {
      width: box.right - box.left,
      height: box.bottom - box.top,
      plot: { left: plot.left - box.left, top: plot.top - box.top, width: plot.right - plot.left, height: plot.bottom - plot.top },
      columns,
      output,
      feed,
    },
  };
}

interface FlowFieldProps {
  rootRef: RefObject<HTMLElement | null>;
  /** The graph band: a [data-plot] box and one [data-step] label per column. */
  graphRef: RefObject<HTMLElement | null>;
  /** Letters fly from here (the idea card). Optional. */
  sourceRef?: RefObject<HTMLElement | null>;
  /** The feed wire plugs into this (the plan card, or the injected brief). */
  sinkRef?: RefObject<HTMLElement | null>;
  signalRef: RefObject<FlowSignal>;
  handleRef?: RefObject<FlowHandle | null>;
  theme: LabTheme;
  tier: DeviceTier;
  /** Reduced motion: one composed frame, no loop. */
  isStill: boolean;
}

/**
 * The section's live layer: the plan pipeline on one 2D canvas above the
 * cards (pointer-events: none). Runs only while it is on screen and stops
 * once the plan has settled; rebuilt (same seed) on theme or tier change.
 */
export default function FlowField({ rootRef, graphRef, sourceRef, sinkRef, signalRef, handleRef, theme, tier, isStill }: FlowFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ReturnType<typeof createFlowEngine>>(null);
  const isInView = useInView(canvasRef);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    const graphEl = graphRef.current;
    if (!canvas || !root || !graphEl) return;

    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAPS[tier][1]);
    const engine = createFlowEngine({ canvas, signal: signalRef.current, density: DENSITY[tier], dpr, seed: SEED });
    if (!engine) return;
    engineRef.current = engine;
    const { fg, muted, accent, accent2 } = theme.colors;
    engine.setColors({ fg, muted, accent, accent2 }, theme.scheme === 'dark');

    const source = sourceRef?.current ?? null;
    const sink = sinkRef?.current ?? null;
    let box = { left: 0, top: 0 };
    const relayout = () => {
      const result = computeFlowGeometry(root, graphEl, source, sink);
      if (!result) return;
      box = result.box;
      canvas.style.transform = `translate3d(${result.box.left}px, ${result.box.top}px, 0)`;
      canvas.style.width = `${result.geometry.width}px`;
      canvas.style.height = `${result.geometry.height}px`;
      engine.layout(result.geometry);
      if (isStill) engine.drawStill();
    };
    relayout();

    if (handleRef) {
      handleRef.current = {
        launch(glyphs, font) {
          const rootRect = root.getBoundingClientRect();
          const dx = rootRect.left + box.left;
          const dy = rootRect.top + box.top;
          const local: FlowGlyph[] = glyphs.map(g => ({ ch: g.ch, x: g.x - dx, y: g.y - dy }));
          engine.launch(local, font);
        },
        wake: () => engine.wake(),
      };
    }

    const observer = new ResizeObserver(relayout);
    [root, graphEl, source, sink].forEach(el => el && observer.observe(el));

    return () => {
      observer.disconnect();
      if (handleRef) handleRef.current = null;
      engineRef.current = null;
      engine.destroy();
    };
  }, [rootRef, graphRef, sourceRef, sinkRef, signalRef, handleRef, theme, tier, isStill]);

  useEffect(() => {
    engineRef.current?.setActive(isInView && !isStill);
  }, [isInView, isStill, theme, tier]);

  return <canvas ref={canvasRef} className={css.field} aria-hidden='true' />;
}
