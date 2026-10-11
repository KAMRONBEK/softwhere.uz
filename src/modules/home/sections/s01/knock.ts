import { gsap } from '../../global/gsap';
import type { HeroPulse } from './input';

/** Lift at the pulse's origin per unit of strength (px), and how fast it fades with travel time (per second). */
const KNOCK_PX = 12;
const KNOCK_DECAY = 0.9;
/** No letter jumps further than this, however hard the pulse. */
const KNOCK_MAX_PX = 22;
/** Letters further than this many seconds of travel, or lifted less than this, are left alone. */
const KNOCK_REACH_S = 2.4;
const KNOCK_MIN_PX = 0.8;
/** Share of the lift that also pushes a letter away from the pulse, and the lean that goes with it. */
const KNOCK_RADIAL = 0.3;
const KNOCK_SKEW_DEG_PER_PX = -0.25;

/**
 * The headline feels the shockwave: as the ring (expanding at `speedPx`
 * px/s, the particles' own ring speed) passes each letter, the letter hops
 * up and a little away from the pulse, then settles on a spring, so the wave
 * visibly travels through the line without letters colliding. Transforms only
 * (x, y, skewX: the scroll-out drift owns xPercent/yPercent/rotation); a
 * newer pulse takes over a letter mid-hop (overwrite: 'auto').
 */
export function knockLetters(letters: readonly HTMLElement[], pulse: HeroPulse, speedPx: number): void {
  if (speedPx <= 0) return;
  // Read every box first, then schedule: no layout reads between writes.
  const hits = letters.map(letter => {
    const box = letter.getBoundingClientRect();
    return { letter, dx: box.left + box.width / 2 - pulse.clientX, dy: box.top + box.height / 2 - pulse.clientY, isEmpty: box.width === 0 };
  });
  for (const { letter, dx, dy, isEmpty } of hits) {
    if (isEmpty) continue;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const delay = distance / speedPx;
    const push = Math.min(KNOCK_MAX_PX, KNOCK_PX * pulse.strength * Math.exp(-delay * KNOCK_DECAY));
    if (delay > KNOCK_REACH_S || push < KNOCK_MIN_PX) continue;
    const ux = dx / distance;
    gsap
      .timeline({ delay })
      .to(letter, {
        x: ux * push * KNOCK_RADIAL,
        y: -push,
        skewX: ux * push * KNOCK_SKEW_DEG_PER_PX,
        duration: 0.14,
        ease: 'power3.out',
        overwrite: 'auto',
      })
      .to(letter, { x: 0, y: 0, skewX: 0, duration: 1.1, ease: 'elastic.out(1, 0.35)' });
  }
}
