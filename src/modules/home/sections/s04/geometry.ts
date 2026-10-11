import { gsap } from '../../global/gsap';

/**
 * Where the composite sits on screen. While the site is being built it fits
 * the "build" box (the stage column on desktop, the space under the title on
 * phones); at launch it zooms to the "launch" box, which spans nearly the
 * whole viewport, so the finished site reads like a real one.
 *
 * The composite keeps its design size (page px) and is placed with one 2D
 * translate + scale on `.fit`, interpolated by the scroll progress. Plain 2D
 * on purpose: no will-change, so the browser re-rasterises the flat end state
 * at its final scale and the text stays crisp.
 */

interface Box {
  x: number;
  y: number;
  s: number;
}

interface StageFitOptions {
  sticky: HTMLElement;
  fit: HTMLElement;
  buildBox: HTMLElement;
  launchBox: HTMLElement;
  /** Upper bounds for the two scales (design px → screen px). */
  maxBuild: number;
  maxLaunch: number;
}

export interface StageFit {
  /** 0 = build box, 1 = launch box. Eased internally. */
  setZoom: (progress: number) => void;
  /** Current eased zoom (0..1), for damping tilt and lean. */
  readonly zoom: number;
  /** Re-measure (also runs on resize); returns a disposer for the observer. */
  observe: () => () => void;
}

const ZOOM_EASE = gsap.parseEase('power3.inOut');

function relativeRect(el: HTMLElement, origin: DOMRect): DOMRect {
  const rect = el.getBoundingClientRect();
  return new DOMRect(rect.left - origin.left, rect.top - origin.top, rect.width, rect.height);
}

function fitInto(rect: DOMRect, width: number, height: number, max: number): Box {
  const s = Math.max(0.05, Math.min(rect.width / width, rect.height / height, max));
  return { x: rect.x + (rect.width - width * s) / 2, y: rect.y + (rect.height - height * s) / 2, s };
}

export function createStageFit({ sticky, fit, buildBox, launchBox, maxBuild, maxLaunch }: StageFitOptions): StageFit {
  let build: Box = { x: 0, y: 0, s: 1 };
  let launch: Box = build;
  let progress = 0;
  let eased = 0;

  const render = () => {
    const x = build.x + (launch.x - build.x) * eased;
    const y = build.y + (launch.y - build.y) * eased;
    const s = build.s + (launch.s - build.s) * eased;
    fit.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(4)})`;
  };

  const measure = () => {
    const origin = sticky.getBoundingClientRect();
    const width = fit.offsetWidth;
    const height = fit.offsetHeight;
    if (!width || !height || !origin.width) return;
    build = fitInto(relativeRect(buildBox, origin), width, height, maxBuild);
    launch = fitInto(relativeRect(launchBox, origin), width, height, maxLaunch);
    render();
  };

  return {
    setZoom: next => {
      const clamped = Math.min(1, Math.max(0, next));
      if (clamped === progress) return;
      progress = clamped;
      eased = ZOOM_EASE(clamped);
      render();
    },
    get zoom() {
      return eased;
    },
    observe: () => {
      measure();
      const observer = new ResizeObserver(measure);
      [sticky, fit, buildBox, launchBox].forEach(el => observer.observe(el));
      return () => observer.disconnect();
    },
  };
}
