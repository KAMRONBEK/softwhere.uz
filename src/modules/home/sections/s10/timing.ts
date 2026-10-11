/**
 * Count timing shared by the dust numeral and the unit chart, so each dot
 * lights at the moment the number reaches it.
 */

/** Delay from a (re-)form to the first count step, s. */
export const COUNT_DELAY = 0.22;
/** The same after a click/tap burst (the swarm flies out first), s. */
export const BURST_COUNT_DELAY = 0.4;

/** How long counting from 0 up to `value` takes, s. */
export function countDuration(value: number): number {
  return 1.15 + 0.3 * Math.log10(value + 1);
}

/** The displayed count at progress p (0..1) of the count. */
export function countEase(p: number): number {
  return 1 - (1 - p) ** 4;
}

/** Seconds after the count starts at which the displayed number first reaches k (1..value). */
export function reachesAt(k: number, value: number): number {
  const q = Math.min(1, Math.max(0, (k - 0.5) / value));
  return countDuration(value) * (1 - (1 - q) ** 0.25);
}

/**
 * Flight time of the spark that carries count step `i` from the numeral to its
 * dot, s. The dot lights when the spark lands, so both sides use this.
 * Deterministic jitter keeps a stream of sparks from flying in lockstep.
 */
export function courierFlight(i: number): number {
  const jitter = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  return 0.55 + 0.2 * jitter;
}
