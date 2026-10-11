import type { gsap } from '../../global/gsap';

/**
 * Teardown bookkeeping for the Work Wall engine: DOM listeners, observers and
 * GSAP animations registered here all go in one `disposeAll()`.
 */
export class Disposables {
  protected readonly cleanups: Array<() => void> = [];
  private readonly animations: Array<gsap.core.Animation> = [];

  /** addEventListener with the handler bound to `this`, removed on dispose. */
  protected listen<K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    type: K,
    handler: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions
  ): void {
    const bound = handler.bind(this) as EventListener;
    el.addEventListener(type, bound, options);
    this.cleanups.push(() => el.removeEventListener(type, bound, options));
  }

  /** Keeps a handle for dispose; finished animations are dropped as new ones arrive. */
  protected track<T extends gsap.core.Animation>(animation: T): T {
    const running = this.animations.filter(a => a.progress() < 1);
    this.animations.length = 0;
    this.animations.push(...running, animation);
    return animation;
  }

  protected disposeAll(): void {
    this.animations.forEach(animation => animation.kill());
    this.cleanups.forEach(fn => fn());
  }
}
