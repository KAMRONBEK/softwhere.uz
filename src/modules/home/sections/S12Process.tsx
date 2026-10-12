'use client';

import { useLabDevice, useMediaQuery } from '../device/useDeviceTier';
import type { LabSectionProps } from '../types';
import ProcessHorizontal from './s12/Horizontal';
import ProcessVertical from './s12/Vertical';

/**
 * 16 · Process — "Idea to launch, week by week". The heading's full stop is
 * where the line starts. It draws itself through Discover → Design → Build →
 * Launch → Grow, changing shape per stage (a magnifier, a phone, a square wave
 * of sprints, a take-off, a rising line of iterations). The stage words stand
 * on the line, the deliverables hang off it as flags the pen switches on, and
 * a week counter rolls with it.
 *
 * - Desktop (≥ 960px): sticky stage, vertical scroll scrubs a horizontal track
 *   that follows the pen; the stage bar doubles as navigation.
 * - Phones: the same route runs down a gutter, natural scroll, the pen held at
 *   ~62% of the screen; a small HUD at the bottom rolls the week and stage.
 * - Reduced motion / low tier: the vertical layout with the whole route drawn
 *   and every word and flag visible. Nothing moves.
 *
 * Height (registry minHeight): --lab-h-process in sections/heights.css. The
 * horizontal track's clamp(max(320svh, 2780px), …, 380svh) on desktop with
 * motion; the column's content height (fitted per locale) everywhere else.
 */
const WIDE_QUERY = '(min-width: 960px)';

export default function S12Process({ meta }: LabSectionProps) {
  const { tier, reducedMotion } = useLabDevice();
  const isWide = useMediaQuery(WIDE_QUERY);
  const isStatic = reducedMotion || tier === 'low';

  if (!isStatic && isWide) return <ProcessHorizontal meta={meta} />;
  return <ProcessVertical meta={meta} isStatic={isStatic} />;
}
