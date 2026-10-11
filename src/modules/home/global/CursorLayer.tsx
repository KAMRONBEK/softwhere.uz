'use client';

import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';
import { useIsTouch, useReducedMotion } from '../device/useDeviceTier';

/** The engine, trail and hit testing: a chunk of their own, never loaded on touch or under reduced motion. */
const Cursor = dynamic(() => import('./CursorLayer.view'), { ssr: false });

const noSubscribe = () => () => undefined;

/**
 * Global custom cursor for the lab (desktop). LabShell mounts it once, above
 * every section.
 *
 * - The precise point is the hardware cursor, restyled as the style's dot
 *   (CursorLayer.native.ts): zero latency, and it keeps moving while a 3D
 *   section mounts. Everything else is decoration around it.
 * - Four focus brackets spring after it (each corner a little softer than the
 *   last, so the reticle flexes in motion). After two seconds without
 *   movement they fold into the point and fade, so a parked mouse never sits
 *   over content.
 * - On links and buttons the brackets lock on outside the element, the
 *   hardware dot steps aside so it never covers the label, and a design-tool
 *   size chip ("182 × 52") slides out under the selection.
 * - Sections opt in with data attributes, no imports needed:
 *     data-cursor="Drag"     → an accent badge with this label; the first word
 *                              picks a glyph (Drag → chevrons, Pull → a hand
 *                              that closes on press, Open → ↗, Play, Tap,
 *                              Show, Recount, Pulse, Type); override with
 *                              data-cursor-icon="<glyph>|none"
 *     data-magnetic          → the element is pulled toward the pointer (CTAs);
 *                              it goes through the CSS `translate` property,
 *                              so it composes with the element's transforms
 *     data-cursor-hide       → the layer hides and the element keeps its own
 *                              CSS cursor (native text fields do the same)
 *   Over selectable text the cursor becomes a caret sized to the font, which
 *   blinks once the mouse is parked.
 * - A tapered 2D-canvas trail with a hairline core: additive light on the
 *   dark styles, accent ink on the light ones. Density and DPR by device tier;
 *   none on low.
 * - Not mounted on touch devices or under reduced motion (the system cursor
 *   stays); on hybrid laptops it steps aside as soon as a finger or pen is used.
 */
export default function CursorLayer() {
  // False while hydrating (the media queries still report their server values then),
  // so a phone never starts loading the cursor chunk before its query is known.
  const isClient = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false
  );
  const isTouch = useIsTouch();
  const reducedMotion = useReducedMotion();
  return isClient && !isTouch && !reducedMotion ? <Cursor /> : null;
}
