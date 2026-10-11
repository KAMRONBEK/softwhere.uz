/**
 * Story amounts → inline transform/opacity for every animated preview part.
 *
 * Each key names a set of elements (`data-fx="<key>"`, one per preview layer).
 * The engine writes these strings straight onto those elements, never onto a
 * shared ancestor: a custom property set on the stage would restyle the whole
 * subtree on every scroll frame.
 */
import { phase } from './timeline';
import type { Amounts } from './story';

export interface FxStyle {
  opacity?: string;
  transform?: string;
}

export interface FxInput {
  amounts: Amounts;
  /** Max of the scripted and the visitor's hover. */
  hover: number;
  press: number;
  /** Switch position, 0 = off, 1 = on. */
  chk: number;
  /** px the knob travels from off to on. */
  knobTravel: number;
  /** Light sweep across the finished product, 0..1. */
  sheen: number;
}

export const FX_KEYS = [
  'mainSurface',
  'mainWire',
  'mainSheen',
  'cardWire',
  'mediaWire',
  'titleSkel',
  'subSkel',
  'title',
  'sub',
  'btn',
  'btnWire',
  'btnFill',
  'btnGlow',
  'btnSheen',
  'btnContent',
  'btnIcon',
  'toggleWire',
  'toggleLabel',
  'switch',
  'switchOn',
  'knob',
  'chartWire',
  'chartHead',
  'barText',
] as const;

export type FxKey = (typeof FX_KEYS)[number];

const o = (value: number): string => (value <= 0.001 ? '0' : value >= 0.999 ? '1' : value.toFixed(3));
const px = (value: number): string => `${value.toFixed(2)}px`;

export function fxAt({ amounts: a, hover, press, chk, knobTravel, sheen }: FxInput): Record<FxKey, FxStyle> {
  const sub = phase(a.title, 0.35, 1);
  const isSweeping = sheen > 0 && sheen < 1;
  return {
    mainSurface: { opacity: o(a.main), transform: `scale(${(0.97 + a.main * 0.03).toFixed(4)})` },
    mainWire: { opacity: o(1 - a.main) },
    mainSheen: { opacity: isSweeping ? '1' : '0', transform: `translate3d(${(-100 + sheen * 320).toFixed(2)}%, 0, 0) skewX(-16deg)` },
    cardWire: { opacity: o(1 - a.card) },
    mediaWire: { opacity: o(1 - a.media) },
    titleSkel: { opacity: o(1 - a.title) },
    subSkel: { opacity: o(1 - sub) },
    title: { opacity: o(a.title), transform: `translate3d(0, ${px((1 - a.title) * 8)}, 0)` },
    sub: { opacity: o(sub), transform: `translate3d(0, ${px((1 - sub) * 6)}, 0)` },
    btn: { transform: `translate3d(0, ${px(hover * -2)}, 0) scale(${(1 - press * 0.05).toFixed(4)})` },
    btnWire: { opacity: o(1 - a.btn) },
    btnFill: { opacity: o(a.btn) },
    btnGlow: { opacity: o(hover) },
    btnSheen: { transform: `translate3d(${(-120 + hover * 440).toFixed(1)}%, 0, 0) skewX(-14deg)` },
    btnContent: { opacity: o(a.btnLabel) },
    btnIcon: { transform: `translate3d(${px(hover * 2)}, 0, 0)` },
    toggleWire: { opacity: o(1 - a.toggle) },
    toggleLabel: { opacity: o(a.toggleLabel) },
    switch: { opacity: o(a.toggle), transform: `scale(${(0.85 + a.toggle * 0.15).toFixed(4)})` },
    switchOn: { opacity: o(chk) },
    knob: { transform: `translate3d(${px(chk * knobTravel)}, 0, 0)` },
    chartWire: { opacity: o(1 - a.chartTitle) },
    chartHead: { opacity: o(a.chartTitle) },
    barText: { opacity: o(a.chartData) },
  };
}
