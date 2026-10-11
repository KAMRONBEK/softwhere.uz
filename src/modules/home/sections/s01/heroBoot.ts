'use client';

/**
 * When the live hero (WebGL, ~1 MB of JS) may load: on the visitor's first
 * scroll, touch, pointer move or key press, or once the page has been idle
 * for a while after `load`. Until then the static HeroFallback is the hero,
 * so loading the page, and a lab test of it, never pays for three.js.
 */
const BOOT_EVENTS = ['scroll', 'touchstart', 'pointermove', 'keydown', 'wheel'] as const;
/** After `load`, how long a visitor who does nothing waits before the live hero loads. */
export const HERO_IDLE_BOOT_MS = 3000;
/** requestIdleCallback's deadline once that wait is over. */
const IDLE_TIMEOUT_MS = 1000;
/**
 * The headline's letter-by-letter entrance plays only when the live hero
 * arrives this soon after navigation; later, the static headline has been
 * on screen too long to hide it and resolve it again.
 */
const ENTRANCE_WINDOW_MS = 1500;

let bootedAt: number | null = null;

/** Calls `onBoot` once, on the first boot signal; returns a cancel function. */
export function onHeroBoot(onBoot: () => void): () => void {
  let isDone = false;
  let timer = 0;
  let idle = 0;
  const cleanup = () => {
    BOOT_EVENTS.forEach(type => window.removeEventListener(type, boot, true));
    window.removeEventListener('load', afterLoad);
    window.clearTimeout(timer);
    if (idle && 'cancelIdleCallback' in window) window.cancelIdleCallback(idle);
  };
  function boot() {
    if (isDone) return;
    isDone = true;
    bootedAt ??= performance.now();
    cleanup();
    onBoot();
  }
  function afterLoad() {
    timer = window.setTimeout(() => {
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(boot, { timeout: IDLE_TIMEOUT_MS });
      else boot();
    }, HERO_IDLE_BOOT_MS);
  }
  BOOT_EVENTS.forEach(type => window.addEventListener(type, boot, { capture: true, passive: true, once: true }));
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
  return () => {
    isDone = true;
    cleanup();
  };
}

/** True when the live hero booted early enough to play its entrance (see ENTRANCE_WINDOW_MS). */
export function shouldPlayHeroEntrance(): boolean {
  return bootedAt === null || bootedAt < ENTRANCE_WINDOW_MS;
}
