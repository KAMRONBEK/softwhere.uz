'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useLabLogo } from '../../logos';
import fx from './cssDevices.module.css';
import { DEVICE_APPS, LAPTOP_SITE, SCREENS_PER_APP } from './data';
import { currentApp, isPhoneFacing, lerp, screenState, smooth, smoothstep, type DevicesRuntime } from './story';

/**
 * The device theatre without WebGL (low tier, no WebGL, or before the
 * canvas mounts): CSS 3D frames around the same real screens, driven by the
 * same Story, so the dolly, the turns between apps and the in-app screen
 * changes all still happen.
 */

interface CssPose {
  /** Centre as a fraction of the stage. */
  x: number;
  y: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
}

interface CssLayout {
  phoneHeight: number;
  laptopWidth: number;
  laptop: { x: number; y: number };
  intro: CssPose;
  apps: CssPose;
}

/** Phone body width / height. */
const PHONE_ASPECT = 0.48;
/** Matches the WebGL framing: portrait copy needs this much room under the phone. */
const TALL_COPY_PX = 424;
const TALL_TOP_PX = 58;

/**
 * The phone is laid out at its largest size (the apps pose) and scaled down
 * for the intro, so the screens are rasterised sharp where they matter.
 */
function layoutFor(width: number, height: number): CssLayout {
  if (width / Math.max(1, height) < 0.9) {
    const introHeight = Math.min(height * 0.3, 300);
    const share = Math.min(0.5, Math.max(0.3, (height - TALL_COPY_PX - TALL_TOP_PX) / height));
    const phoneHeight = share * height;
    return {
      phoneHeight,
      laptopWidth: width * 0.84,
      laptop: { x: 0.46, y: 0.66 },
      intro: { x: 0.76, y: 0.74, rx: 4, ry: -24, rz: 2, scale: (0.9 * introHeight) / phoneHeight },
      apps: { x: 0.5, y: TALL_TOP_PX / height + share / 2, rx: 0, ry: 8, rz: 0, scale: 1 },
    };
  }
  const introHeight = Math.min(height * 0.46, 430);
  const share = Math.min(0.76, (0.3 * width) / height / PHONE_ASPECT);
  const phoneHeight = share * height;
  return {
    phoneHeight,
    laptopWidth: Math.min(width * 0.4, 620),
    laptop: { x: 0.64, y: 0.56 },
    intro: { x: 0.85, y: 0.62, rx: 4, ry: -26, rz: 2, scale: introHeight / phoneHeight },
    apps: { x: 0.31, y: 0.5, rx: 0, ry: 10, rz: 0, scale: 1 },
  };
}

function lerpPose(a: CssPose, b: CssPose, t: number): CssPose {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    rx: lerp(a.rx, b.rx, t),
    ry: lerp(a.ry, b.ry, t),
    rz: lerp(a.rz, b.rz, t),
    scale: lerp(a.scale, b.scale, t),
  };
}

interface Refs {
  phone: HTMLDivElement | null;
  laptop: HTMLDivElement | null;
  lid: HTMLDivElement | null;
  display: HTMLDivElement | null;
  shade: HTMLSpanElement | null;
  tap: HTMLSpanElement | null;
  screens: Array<HTMLImageElement | null>;
}

/** Position every screen for this story frame: the two in play push or fade, the rest hide. */
function placeScreens(refs: Refs, appIndex: number, from: number, to: number, mix: number): void {
  const app = DEVICE_APPS[appIndex];
  if (!app) return;
  const isPush = app.transition === 'push';
  if (refs.display && refs.display.dataset.app !== String(appIndex)) {
    refs.display.dataset.app = String(appIndex);
    refs.display.style.background = app.fill;
  }
  refs.screens.forEach((image, flat) => {
    if (!image) return;
    const isCurrent = Math.floor(flat / SCREENS_PER_APP) === appIndex;
    const local = flat % SCREENS_PER_APP;
    const isFrom = isCurrent && local === from;
    const isTo = isCurrent && local === to && to !== from;
    if (!isFrom && !isTo) {
      image.style.opacity = '0';
      return;
    }
    image.style.zIndex = isTo ? '3' : '1';
    if (isPush) {
      image.style.opacity = '1';
      image.style.transform = isTo ? `translateX(${((1 - mix) * 100).toFixed(2)}%)` : `translateX(${(-mix * 30).toFixed(2)}%)`;
    } else {
      image.style.opacity = isTo ? mix.toFixed(3) : '1';
      image.style.transform = isTo ? `scale(${(0.98 + 0.02 * mix).toFixed(4)})` : 'none';
    }
  });
  if (refs.shade) refs.shade.style.opacity = isPush ? (mix * 0.3).toFixed(3) : '0';
}

interface CssDevicesProps {
  runtime: DevicesRuntime;
}

export default function CssDevices({ runtime }: CssDevicesProps) {
  const { Mark } = useLabLogo();
  const boxRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Refs>({ phone: null, laptop: null, lid: null, display: null, shade: null, tap: null, screens: [] });
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize(previous => (previous.width === width && previous.height === height ? previous : { width, height }));
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!size.width) return;
    const layout = layoutFor(size.width, size.height);
    const apply = () => {
      const story = runtime.story;
      const els = refs.current;
      const face = story.face; // already eased by the timeline
      const pose = lerpPose(layout.intro, layout.apps, face);
      const phase = story.app - Math.floor(story.app);
      const spin = (story.app - Math.round(story.app)) * 360;
      const grabTurn = (runtime.grab.offset * 180) / Math.PI;
      const lift = 1 + Math.sin(Math.PI * phase) * 0.06 + Math.abs(Math.sin(runtime.grab.offset / 2)) * 0.04;
      if (els.phone) {
        const width = layout.phoneHeight * PHONE_ASPECT;
        const x = pose.x * size.width - width / 2;
        const y = pose.y * size.height - layout.phoneHeight / 2;
        const scale = pose.scale * lift;
        els.phone.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotateX(${pose.rx.toFixed(2)}deg) rotateY(${(pose.ry + spin + grabTurn).toFixed(2)}deg) rotateZ(${pose.rz.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        runtime.grabTargets.place(
          {
            x: pose.x * size.width - (width * scale) / 2,
            y: pose.y * size.height - (layout.phoneHeight * scale) / 2,
            width: width * scale,
            height: layout.phoneHeight * scale,
            isOn: true,
            isFacing: isPhoneFacing(story),
          },
          !runtime.grab.hasGrabbed
        );
      }

      const appIndex = currentApp(story, DEVICE_APPS.length);
      const { from, to, mix } = screenState(story, appIndex, SCREENS_PER_APP);
      placeScreens(els, appIndex, from, to, mix);
      const leaving = DEVICE_APPS[appIndex]?.screens[from];
      if (els.tap && leaving) {
        const tap = from < SCREENS_PER_APP - 1 ? story.tap : 0;
        const isOn = tap > 0 && tap < 1;
        const spot = `${leaving.tap[0]},${leaving.tap[1]}`;
        if (els.tap.dataset.spot !== spot) {
          els.tap.dataset.spot = spot;
          els.tap.style.left = `${(leaving.tap[0] * 100).toFixed(1)}%`;
          els.tap.style.top = `${(leaving.tap[1] * 100).toFixed(1)}%`;
        }
        els.tap.style.opacity = isOn ? (smoothstep(0, 0.18, tap) * (1 - smoothstep(0.55, 1, tap)) * 0.6).toFixed(3) : '0';
        els.tap.style.transform = `translate(-50%, -50%) scale(${(0.6 + 0.6 * smoothstep(0, 0.6, tap)).toFixed(3)})`;
      }

      const away = 1 - story.laptop;
      const boot = smooth(story.boot);
      if (els.laptop) {
        const x = layout.laptop.x * size.width - layout.laptopWidth / 2 + away * size.width * 0.12;
        const y = layout.laptop.y * size.height - layout.laptopWidth * 0.36 + away * size.height * 0.6 + (1 - boot) * 30;
        els.laptop.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(1 - away * 0.25).toFixed(3)})`;
        els.laptop.style.opacity = String(1 - smoothstep(0.4, 1, away));
      }
      if (els.lid) els.lid.style.transform = `rotateX(${(-88 * (1 - smooth(story.boot * 1.25))).toFixed(2)}deg)`;
    };
    runtime.listeners.add(apply);
    apply();
    return () => {
      runtime.listeners.delete(apply);
    };
  }, [runtime, size]);

  const layout = size.width ? layoutFor(size.width, size.height) : null;
  const vars = {
    '--phone-h': `${layout?.phoneHeight ?? 300}px`,
    '--laptop-w': `${layout?.laptopWidth ?? 600}px`,
  } as CSSProperties;

  return (
    <div ref={boxRef} className={fx.scene} style={vars} aria-hidden='true'>
      <div
        ref={node => {
          refs.current.laptop = node;
        }}
        className={fx.laptop}
      >
        <div
          ref={node => {
            refs.current.lid = node;
          }}
          className={fx.lid}
        >
          <div className={fx.lidScreen}>
            <div className={fx.chrome}>
              <span className={fx.url}>{LAPTOP_SITE.url}</span>
            </div>
            <div className={fx.page}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size still inside a CSS frame */}
              <img className={fx.site} src={LAPTOP_SITE.src} alt='' decoding='async' />
            </div>
          </div>
        </div>
        <div className={fx.base} />
      </div>

      <div
        ref={node => {
          refs.current.phone = node;
        }}
        className={fx.phone}
      >
        <div className={fx.back}>
          <span className={fx.island}>
            <i />
            <i />
            <i />
          </span>
          <Mark className={fx.backMark} />
        </div>
        <div className={fx.front}>
          <div
            ref={node => {
              refs.current.display = node;
            }}
            className={fx.display}
          >
            {DEVICE_APPS.flatMap((app, appIndex) =>
              app.screens.map((screen, local) => (
                // eslint-disable-next-line @next/next/no-img-element -- a fixed-size still inside a CSS frame
                <img
                  key={screen.src}
                  ref={node => {
                    refs.current.screens[appIndex * SCREENS_PER_APP + local] = node;
                  }}
                  className={fx.screen}
                  src={screen.src}
                  alt=''
                  decoding='async'
                />
              ))
            )}
            <span
              ref={node => {
                refs.current.shade = node;
              }}
              className={fx.shade}
            />
            <span
              ref={node => {
                refs.current.tap = node;
              }}
              className={fx.tap}
            />
            <span className={fx.hole} />
          </div>
          <div className={fx.glass} />
        </div>
      </div>
    </div>
  );
}
