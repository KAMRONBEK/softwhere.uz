'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, type RefObject } from 'react';
import {
  CanvasTexture,
  LinearFilter,
  Mesh,
  NoBlending,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  Vector4,
  type WebGLRenderer,
} from 'three';
import { addDrop, baseRadiusFor, fullRadius, hasLiveDrops, isIdle, seconds, type LensController } from './controller';
import { bodyFrames, overlayMetrics, placeScene, type CodeCardLayout, type OverlayMetrics, type StageWindow } from './geometry';
import { drawOverlay } from './overlay';
import type { XRayPalette } from './palette';
import { shotSrc, type XRayScene } from './scenes';
import { MAX_BODIES, MAX_DROPS, XRAY_FRAGMENT, XRAY_VERTEX } from './shader';
import { buildTour, createHudState, hudBounds, stepTour, tourProgress, updateHud, type HudElements, type Tour } from './tour';

const TRANSITION_SECONDS = 1.15;
const AUTO_ADVANCE_QUIET_MS = 12000;
/** Seconds without input (lens settled, show finished) before the loop parks. */
const PARK_IDLE_SECONDS = 3.5;
/** Seconds the scanner and wobble take to calm down before parking. */
const CALM_SECONDS = 0.45;

interface XRayGLProps {
  scenes: readonly XRayScene[];
  index: number;
  controllerRef: RefObject<LensController | null>;
  palette: XRayPalette;
  isAdditive: boolean;
  reducedMotion: boolean;
  magnification: number;
  /** Desktop layout: devices right of the copy column. */
  isWide: boolean;
  /** Chromatic split at the lens rim, px (smaller on phones: it reads as blur there). */
  chroma: number;
  hudRef: RefObject<HudElements>;
  progressRef: RefObject<HTMLElement | null>;
  /** Autopilot finished a lap and nobody is interacting: show the next project. */
  onCycle: () => void;
  /** The first frame is on screen (the DOM still underneath can go). */
  onReady: (isReady: boolean) => void;
  /** Nothing moves any more: switch the canvas to render-on-demand. */
  onPark: () => void;
}

type Slot = 0 | 1;

interface Painted {
  texture: CanvasTexture;
  cards: CodeCardLayout[][];
  sizes: OverlayMetrics;
  /** Which scene, at which paint version (theme/size), this slot holds. */
  sceneIndex: number;
  version: number;
  width: number;
  height: number;
}

interface Runtime {
  material: ShaderMaterial;
  images: (Texture | null)[];
  isLoading: boolean[];
  canvases: [HTMLCanvasElement, HTMLCanvasElement];
  painted: [Painted | null, Painted | null];
  slot: Slot;
  displayIndex: number;
  requestedIndex: number;
  transition: { to: number; start: number; slot: Slot } | null;
  tour: Tour;
  hud: ReturnType<typeof createHudState>;
  lastFrame: number;
  lastProgress: number;
  isCompiled: boolean;
  isShown: boolean;
  /** 1 = alive (scanner, wobble), 0 = calm (about to park). */
  calm: number;
  isParkSent: boolean;
  /** Bumped on every theme/size repaint; a pre-painted slot from an older version is stale. */
  paintVersion: number;
  prepareTimer: number;
}

function hexToVec3(hex: string): Vector3 {
  const value = Number.parseInt(hex.slice(1), 16);
  return new Vector3(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/** Decodes off the main thread (img.decode), then uploads in its own frame so the hitch happens off-screen. */
async function loadTexture(src: string, gl: WebGLRenderer, isAlive: () => boolean): Promise<Texture | null> {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  try {
    await image.decode();
  } catch {
    return null;
  }
  if (!isAlive()) return null;
  const texture = new Texture(image);
  texture.flipY = false;
  texture.premultiplyAlpha = true;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  await nextFrame();
  if (!isAlive()) {
    texture.dispose();
    return null;
  }
  gl.initTexture(texture);
  return texture;
}

function createMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: XRAY_VERTEX,
    fragmentShader: XRAY_FRAGMENT,
    depthTest: false,
    depthWrite: false,
    // The shader writes premultiplied RGBA over a cleared, transparent canvas.
    blending: NoBlending,
    uniforms: {
      uImage: { value: null },
      uOverlay: { value: null },
      uImageB: { value: null },
      uOverlayB: { value: null },
      uMix: { value: 0 },
      uMixCenter: { value: new Vector2() },
      uRes: { value: new Vector2(1, 1) },
      uWindow: { value: new Vector4(0, 0, 1, 1) },
      uWindowB: { value: new Vector4(0, 0, 1, 1) },
      uSize: { value: new Vector2(1200, 800) },
      uTexel: { value: new Vector2(1 / 1800, 1 / 1200) },
      uLens: { value: new Vector3(0, 0, 100) },
      uLensVel: { value: new Vector2() },
      uMag: { value: 1 },
      uCross: { value: 1 },
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uChroma: { value: 6 },
      uDrops: { value: Array.from({ length: MAX_DROPS }, () => new Vector4()) },
      uBody: { value: Array.from({ length: MAX_BODIES }, () => new Vector4()) },
      uBodyRot: { value: Array.from({ length: MAX_BODIES }, () => new Vector3(1, 0, 0)) },
      uBodyB: { value: Array.from({ length: MAX_BODIES }, () => new Vector4()) },
      uBodyRotB: { value: Array.from({ length: MAX_BODIES }, () => new Vector3(1, 0, 0)) },
      uShade: { value: new Vector3(16, 30, 0.3) },
      uPaper: { value: new Vector3() },
      uInk: { value: new Vector3() },
      uEdge: { value: new Vector3() },
      uAccent: { value: new Vector3() },
      uAccent2: { value: new Vector3() },
      uShadow: { value: new Vector3() },
      uAdditive: { value: 1 },
      uFade: { value: new Vector2(0, 0) },
    },
  });
}

function writeBodies(scene: XRayScene, win: StageWindow, bodies: Vector4[], rots: Vector3[]): void {
  const frames = bodyFrames(scene, win);
  for (let i = 0; i < MAX_BODIES; i++) {
    const f = frames[i];
    if (f) {
      bodies[i].set(f.cx, f.cy, f.hw, f.hh);
      rots[i].set(f.cos, f.sin, f.radius);
    } else {
      bodies[i].set(0, 0, 0, 0);
    }
  }
}

type PaintFn = (r: Runtime, slot: Slot, sceneIndex: number) => Painted | null;

/**
 * Paints the next project's overlay into the free slot a moment after things
 * settle, so the switch itself (autopilot or the Next button) has nothing heavy
 * left to do.
 */
function schedulePrepare(r: Runtime, count: number, paint: () => PaintFn): void {
  window.clearTimeout(r.prepareTimer);
  if (count < 2) return;
  r.prepareTimer = window.setTimeout(() => {
    if (r.transition || r.requestedIndex !== r.displayIndex) return;
    const next = (r.displayIndex + 1) % count;
    const slot: Slot = r.slot === 0 ? 1 : 0;
    const held = r.painted[slot];
    if (held && held.sceneIndex === next && held.version === r.paintVersion) return;
    paint()(r, slot, next);
  }, 700);
}

/** The lens scene: one full-screen quad with the x-ray shader (see shader.ts). */
export default function XRayGL({
  scenes,
  index,
  controllerRef,
  palette,
  isAdditive,
  reducedMotion,
  magnification,
  isWide,
  chroma,
  hudRef,
  progressRef,
  onCycle,
  onReady,
  onPark,
}: XRayGLProps) {
  const size = useThree(state => state.size);
  const dpr = useThree(state => state.viewport.dpr);
  const invalidate = useThree(state => state.invalidate);
  const gl = useThree(state => state.gl);
  const scene3 = useThree(state => state.scene);
  const camera = useThree(state => state.camera);
  const meshRef = useRef<Mesh>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const callbacksRef = useRef({ onCycle, onReady, onPark });
  const indexRef = useRef(index);

  useEffect(() => {
    callbacksRef.current = { onCycle, onReady, onPark };
  }, [onCycle, onReady, onPark]);

  // Wake the renderer from input (matters in 'demand' mode: parked or reduced motion). A parked
  // loop resumes; if nothing ends up moving it parks again after a short calm-down.
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    const wake = () => {
      invalidate();
      controller.wake();
    };
    controller.requestFrame = wake;
    return () => {
      if (controller.requestFrame === wake) controller.requestFrame = () => undefined;
    };
  }, [controllerRef, invalidate]);

  /** Placement, overlay sizes and canvas resolution for a scene on the current stage. */
  const frameFor = (scene: XRayScene) => {
    const win = placeScene(size.width, size.height, scene, isWide);
    // Quantized so a window drag does not repaint the overlay on every pixel.
    const cssScale = Math.round(win.scale * 50) / 50;
    const sizes = overlayMetrics(cssScale, magnification, !isWide);
    const pixelScale = Math.min(2, Math.max(1, Math.round(dpr * cssScale * magnification * 4) / 4));
    return { win, sizes, pixelScale };
  };
  const frameForRef = useRef(frameFor);
  useEffect(() => {
    frameForRef.current = frameFor;
  });

  const paintSlot = (r: Runtime, slot: Slot, sceneIndex: number): Painted | null => {
    const scene = scenes[sceneIndex];
    if (!scene) return null;
    const { sizes, pixelScale } = frameForRef.current(scene);
    const canvas = r.canvases[slot];
    const { cards } = drawOverlay(canvas, scene, palette, sizes, pixelScale);
    const previous = r.painted[slot];
    let texture = previous?.texture;
    // A texture's storage is immutable once uploaded: a new canvas size needs a new texture.
    if (!texture || previous?.width !== canvas.width || previous?.height !== canvas.height) {
      previous?.texture.dispose();
      texture = new CanvasTexture(canvas);
      texture.flipY = false;
      texture.premultiplyAlpha = true;
      texture.minFilter = LinearFilter;
      texture.generateMipmaps = false;
    }
    texture.needsUpdate = true;
    gl.initTexture(texture);
    const painted: Painted = { texture, cards, sizes, sceneIndex, version: r.paintVersion, width: canvas.width, height: canvas.height };
    r.painted[slot] = painted;
    return painted;
  };
  const paintRef = useRef(paintSlot);
  useEffect(() => {
    paintRef.current = paintSlot;
  });

  // Runtime (material, textures, overlay canvases): created per mount, fully disposed on unmount.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    let isAlive = true;
    const alive = () => isAlive;
    const first = Math.min(Math.max(indexRef.current, 0), scenes.length - 1);
    const runtime: Runtime = {
      material: createMaterial(),
      images: scenes.map(() => null),
      isLoading: scenes.map(() => false),
      canvases: [document.createElement('canvas'), document.createElement('canvas')],
      painted: [null, null],
      slot: 0,
      displayIndex: first,
      requestedIndex: first,
      transition: null,
      tour: { stops: [], index: 0, since: 0 },
      hud: createHudState(),
      lastFrame: 0,
      lastProgress: -1,
      isCompiled: false,
      isShown: false,
      calm: 1,
      isParkSent: false,
      paintVersion: 0,
      prepareTimer: 0,
    };
    mesh.material = runtime.material;
    runtimeRef.current = runtime;

    // Shader compile off the main thread where KHR_parallel_shader_compile exists.
    gl.compileAsync(scene3, camera)
      .then(() => {
        if (!isAlive) return;
        runtime.isCompiled = true;
        invalidate();
      })
      .catch(() => {
        runtime.isCompiled = true;
      });

    // The shown project first, then the rest one by one.
    const order = [first, ...scenes.map((_, i) => i).filter(i => i !== first)];
    void (async () => {
      for (const i of order) {
        if (!isAlive) return;
        if (runtime.images[i] || runtime.isLoading[i]) continue;
        runtime.isLoading[i] = true;
        const texture = await loadTexture(shotSrc(scenes[i]), gl, alive);
        if (!isAlive) {
          texture?.dispose();
          return;
        }
        runtime.images[i] = texture;
        invalidate();
      }
    })();

    return () => {
      isAlive = false;
      window.clearTimeout(runtime.prepareTimer);
      callbacksRef.current.onReady(false);
      runtime.material.dispose();
      runtime.images.forEach(texture => texture?.dispose());
      runtime.painted.forEach(painted => painted?.texture.dispose());
      runtime.canvases.forEach(canvas => {
        canvas.width = 0;
        canvas.height = 0;
      });
      runtimeRef.current = null;
    };
  }, [scenes, gl, scene3, camera, invalidate]);

  useEffect(() => {
    indexRef.current = index;
    const runtime = runtimeRef.current;
    if (runtime) runtime.requestedIndex = Math.min(Math.max(index, 0), scenes.length - 1);
    invalidate();
  }, [index, scenes, invalidate]);

  // Theme → uniforms.
  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const u = runtime.material.uniforms;
    u.uPaper.value = hexToVec3(palette.paper);
    u.uInk.value = hexToVec3(palette.ink);
    u.uEdge.value = hexToVec3(palette.ink).lerp(hexToVec3(palette.accent), 0.3);
    u.uAccent.value = hexToVec3(palette.accent);
    u.uAccent2.value = hexToVec3(palette.accent2);
    u.uShadow.value = hexToVec3(palette.ink);
    u.uAdditive.value = isAdditive ? 1 : 0;
    u.uChroma.value = chroma;
    invalidate();
  }, [scenes, palette, isAdditive, chroma, invalidate]);

  // (Re)paint the displayed overlay on theme/size changes, and again once the fonts have loaded.
  const sizeKey = `${Math.round(size.width / 32)}x${Math.round(size.height / 32)}@${dpr}|${isWide}`;
  useEffect(() => {
    let isCurrent = true;
    const paint = () => {
      const runtime = runtimeRef.current;
      if (!runtime || !isCurrent) return;
      runtime.paintVersion += 1;
      paintRef.current(runtime, runtime.slot, runtime.displayIndex);
      const { transition } = runtime;
      if (transition) {
        const painted = paintRef.current(runtime, transition.slot, transition.to);
        if (painted) runtime.material.uniforms.uOverlayB.value = painted.texture;
      }
      runtime.tour.stops = [];
      runtime.hud.key = '';
      schedulePrepare(runtime, scenes.length, () => paintRef.current);
      invalidate();
    };
    // The first paint (2D draw + upload) gets its own frame, apart from the mount work.
    const raf = requestAnimationFrame(paint);
    const fonts = document.fonts;
    if (fonts) {
      Promise.all([fonts.load(`400 16px ${palette.mono}`), fonts.load(`600 16px ${palette.body}`)])
        .then(paint)
        .catch(() => undefined);
    }
    return () => {
      isCurrent = false;
      cancelAnimationFrame(raf);
    };
  }, [scenes, palette, sizeKey, invalidate]);

  useFrame(() => {
    const c = controllerRef.current;
    const r = runtimeRef.current;
    const mesh = meshRef.current;
    if (!c || !r || !mesh) return;
    const u = r.material.uniforms;
    const now = seconds(c);
    const nowMs = performance.now();
    const gap = Math.max(now - r.lastFrame, 0);
    // Frames stop offscreen and while parked: the tour clock pauses with them.
    if (r.lastFrame > 0 && gap > 0.25) r.tour.since += gap;
    const dt = Math.min(gap, 1 / 30);
    r.lastFrame = now;

    if (!r.isCompiled || !r.images[r.displayIndex] || !r.painted[r.slot]) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    if (!r.isShown) {
      r.isShown = true;
      callbacksRef.current.onReady(true);
    }
    c.width = size.width;
    c.height = size.height;
    c.baseRadius = baseRadiusFor(size.width, size.height, isWide);

    // Project transition: a liquid wipe that spreads from the lens.
    if (!r.transition && r.requestedIndex !== r.displayIndex) {
      const nextImage = r.images[r.requestedIndex];
      if (nextImage) {
        const slot: Slot = r.slot === 0 ? 1 : 0;
        const held = r.painted[slot];
        const isPrepared = held !== null && held.sceneIndex === r.requestedIndex && held.version === r.paintVersion;
        const nextPainted = isPrepared ? held : paintRef.current(r, slot, r.requestedIndex);
        if (nextPainted) {
          u.uImageB.value = nextImage;
          u.uOverlayB.value = nextPainted.texture;
          u.uMixCenter.value.set(c.pos[0], c.pos[1]);
          r.transition = { to: r.requestedIndex, start: now, slot };
          if (!reducedMotion) addDrop(c, c.pos[0], c.pos[1], 16);
        }
      }
    }
    if (r.transition) {
      const progress = reducedMotion ? 1 : Math.min(1, (now - r.transition.start) / TRANSITION_SECONDS);
      u.uMix.value = easeInOutCubic(progress);
      if (progress >= 1) {
        r.slot = r.transition.slot;
        r.displayIndex = r.transition.to;
        r.transition = null;
        u.uMix.value = 0;
        r.tour.stops = [];
        r.hud.key = '';
        r.lastProgress = -1;
        schedulePrepare(r, scenes.length, () => paintRef.current);
      }
    }
    if (r.transition) {
      const next = scenes[r.transition.to];
      if (next) {
        const winB = frameForRef.current(next).win;
        u.uWindowB.value.set(winB.ox, winB.oy, winB.sx, winB.sy);
        writeBodies(next, winB, u.uBodyB.value as Vector4[], u.uBodyRotB.value as Vector3[]);
      }
    }

    const scene = scenes[r.displayIndex];
    const image = r.images[r.displayIndex];
    const painted = r.painted[r.slot];
    if (!scene || !image || !painted) return;
    const { win } = frameForRef.current(scene);
    u.uImage.value = image;
    u.uOverlay.value = painted.texture;
    const imageData = image.image as { width?: number; height?: number } | null;
    u.uSize.value.set(scene.size[0], scene.size[1]);
    u.uTexel.value.set(1 / (imageData?.width ?? scene.size[0]), 1 / (imageData?.height ?? scene.size[1]));

    // Autopilot tour: one lap per project, then the show parks.
    if (r.tour.stops.length === 0) {
      r.tour = { stops: buildTour(scene, win, c.baseRadius, painted.sizes, painted.cards), index: 0, since: now };
      if (!c.isPlaced) {
        c.pos = [...r.tour.stops[0]];
        c.target = [...r.tour.stops[0]];
        c.isPlaced = true;
      }
    }
    const isShowOn = c.laps < scenes.length;
    const isAuto = !reducedMotion && !c.isRevealAll && isShowOn && isIdle(c, nowMs) && !r.transition;
    if (isAuto) {
      if (stepTour(r.tour, now)) {
        c.laps += 1;
        const quiet = c.lastInput === 0 || nowMs - c.lastInput > AUTO_ADVANCE_QUIET_MS;
        if (c.laps < scenes.length && scenes.length > 1 && quiet) callbacksRef.current.onCycle();
      }
      c.target = [...r.tour.stops[r.tour.index]];
    } else {
      r.tour.since = now;
    }

    // Lens motion: a soft glide on autopilot, a snappy liquid follow under the cursor or finger.
    if (reducedMotion) {
      c.pos = [...c.target];
      c.vel = [0, 0];
    } else {
      const k = isAuto ? 22 : c.isPressed ? 260 : 200;
      const damping = 2 * Math.sqrt(k) * (isAuto ? 1 : 0.78);
      for (let axis = 0; axis < 2; axis++) {
        const accel = k * (c.target[axis] - c.pos[axis]) - damping * c.vel[axis];
        c.vel[axis] += accel * dt;
        c.pos[axis] += c.vel[axis] * dt;
      }
    }
    const flowBlend = 1 - Math.exp(-dt * 10);
    c.flow = [c.flow[0] + (c.vel[0] - c.flow[0]) * flowBlend, c.flow[1] + (c.vel[1] - c.flow[1]) * flowBlend];

    const full = fullRadius(c);
    const radiusTarget = c.isRevealAll ? full : c.baseRadius * (c.isPressed ? 1.12 : 1);
    c.radius = reducedMotion ? radiusTarget : c.radius + (radiusTarget - c.radius) * (1 - Math.exp(-dt * (c.isRevealAll ? 3.2 : 9)));
    const intro = reducedMotion ? 1 : easeOutCubic(Math.min(Math.max(c.intro, 0), 1));
    const radius = full + (c.radius - full) * intro;
    // The loupe magnifies; a full reveal must line up with the surface exactly.
    const opened = Math.min(Math.max((radius - c.baseRadius * 1.3) / Math.max(full - c.baseRadius * 1.3, 1), 0), 1);
    u.uMag.value = magnification + (1 - magnification) * opened;
    u.uCross.value = 1 - opened;

    // Park when nothing moves: the show is over (or the visitor is idle), the lens has settled.
    const isSettled =
      Math.hypot(c.vel[0], c.vel[1]) < 1.5 &&
      Math.hypot(c.target[0] - c.pos[0], c.target[1] - c.pos[1]) < 0.75 &&
      Math.abs(c.radius - radiusTarget) < 0.5 &&
      intro > 0.999 &&
      !r.transition &&
      !hasLiveDrops(c, now);
    const sinceInput = c.lastInput === 0 ? Infinity : (nowMs - c.lastInput) / 1000;
    const shouldCalm = !reducedMotion && isSettled && !isAuto && !c.isPressed && sinceInput > PARK_IDLE_SECONDS;
    r.calm = shouldCalm ? Math.max(0, r.calm - dt / CALM_SECONDS) : Math.min(1, r.calm + dt / CALM_SECONDS);
    if (!shouldCalm) r.isParkSent = false;
    if (shouldCalm && r.calm <= 0 && !r.isParkSent) {
      r.isParkSent = true;
      callbacksRef.current.onPark();
    }
    u.uMotion.value = reducedMotion ? 0 : r.calm;

    u.uRes.value.set(size.width, size.height);
    u.uWindow.value.set(win.ox, win.oy, win.sx, win.sy);
    writeBodies(scene, win, u.uBody.value as Vector4[], u.uBodyRot.value as Vector3[]);
    const s = win.scale;
    if (isAdditive) u.uShade.value.set(6 * s, 56 * s, 0.075);
    else u.uShade.value.set(20 * s, 26 * s, 0.3);
    u.uFade.value.set(isWide ? 40 : 0, isWide ? 40 : 18);
    u.uLens.value.set(c.pos[0], c.pos[1], radius);
    u.uLensVel.value.set(c.flow[0], c.flow[1]);
    u.uTime.value = now;
    const drops = u.uDrops.value as Vector4[];
    for (let i = 0; i < MAX_DROPS; i++) {
      const o = i * 4;
      drops[i].set(c.drops[o], c.drops[o + 1], c.drops[o + 2], reducedMotion ? 0 : c.drops[o + 3]);
    }

    const hud = hudRef.current;
    const follow = reducedMotion ? 1 : 1 - Math.exp(-dt * 16);
    if (hud) {
      const shouldShow = radius < c.baseRadius * 1.6 && !r.transition;
      updateHud(hud, r.hud, scene, win, c.pos, radius, shouldShow, follow, hudBounds(size.width, size.height, isWide));
    }

    const progress = isAuto ? tourProgress(r.tour, now) : isShowOn ? r.lastProgress : 0;
    if (Math.abs(progress - r.lastProgress) > 0.002) {
      progressRef.current?.style.setProperty('transform', `scaleX(${Math.max(0, progress).toFixed(3)})`);
      r.lastProgress = progress;
    }
  });

  return (
    <mesh ref={meshRef} frustumCulled={false} visible={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
