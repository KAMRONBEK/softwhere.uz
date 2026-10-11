'use client';

import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Vector3, type Camera, type Group } from 'three';
import type { LabTheme } from '../../theme/useLabTheme';
import type { DeviceTier } from '../../types';
import { ALL_SCREEN_SOURCES, LAPTOP_SITE, SCREENS_PER_APP } from './data';
import { Laptop } from './Laptop';
import { PHONE, Phone } from './Phone';
import { isPhoneFacing, lerp, smooth, smoothstep, type DevicesRuntime } from './story';
import { mixHex, ScreenLibrary } from './textures';

type Vec3 = readonly [number, number, number];

interface Pose {
  position: Vec3;
  rotation: Vec3;
}

interface CameraPose {
  position: Vec3;
  target: Vec3;
}

interface Layout {
  camIntro: CameraPose;
  camApps: CameraPose;
  phoneIntro: Pose;
  phoneApps: Pose;
  laptop: Pose;
}

/** Vertical field of view (degrees); S06Devices gives the Canvas camera the same value. */
const FOV = 30;
const HALF_FOV_TAN = Math.tan(((FOV / 2) * Math.PI) / 180);

/** Aspect ratios the intro compositions were framed at (1440×900, 390×844). */
const WIDE_ASPECT = 1.6;
const TALL_ASPECT = 0.462;
/** How much closer the portrait intro camera may come on wide portrait screens. */
const TALL_MIN_FIT = 0.75;
/** Depth the phone presents at during the apps. */
const PHONE_Z = 0.3;

/** Wide shot: laptop centre-right, phone in front of it at 3/4, copy on the left. */
const WIDE_INTRO = {
  camIntro: { position: [0, 0.55, 8.4], target: [-1.12, -0.1, 0] } as CameraPose,
  phoneIntro: { position: [1.38, -0.19, 0.95], rotation: [-0.06, -0.6, 0.035] } as Pose,
  laptop: { position: [0, -0.965, -0.55], rotation: [0, 0.32, 0] } as Pose,
};

/** Phone portrait: copy on top, devices below. */
const TALL_INTRO = {
  camIntro: { position: [0, 0.75, 14.2], target: [-0.22, 0.45, 0] } as CameraPose,
  // Tucked in front of the laptop's corner: a narrower group fills the width of a phone screen.
  phoneIntro: { position: [0.84, -0.14, 1.35], rotation: [-0.06, -0.5, 0.035] } as Pose,
  laptop: { position: [-0.14, -0.965, -0.6], rotation: [0, 0.24, 0] } as Pose,
};

const lerpVec = (a: Vec3, b: Vec3, t: number): [number, number, number] => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Space the DOM copy needs under the phone on portrait screens (px), and above it (the badge). */
const TALL_COPY_PX = 424;
const TALL_TOP_PX = 58;

/**
 * Where the phone stands while it runs the apps, as screen fractions, then
 * turned into a straight-on camera: the phone keeps its size and spot on
 * any screen (beside the copy on wide screens, above it on tall ones).
 */
function appsFraming(width: number, height: number, tall: number): { camera: CameraPose; phone: Pose } {
  const aspect = width / Math.max(1, height);
  const phoneAspect = PHONE.width / PHONE.height;
  const wideShare = Math.min(0.76, (0.3 * aspect) / phoneAspect);
  const tallShare = Math.min(0.5, Math.max(0.3, (height - TALL_COPY_PX - TALL_TOP_PX) / height));
  const share = lerp(wideShare, tallShare, tall);
  const centerX = lerp(0.31, 0.5, tall);
  const centerY = lerp(0.5, TALL_TOP_PX / height + tallShare / 2, tall);
  const distance = PHONE.height / (share * 2 * HALF_FOV_TAN);
  const visibleHeight = PHONE.height / share;
  const x = (centerX - 0.5) * visibleHeight * aspect;
  const y = (0.5 - centerY) * visibleHeight;
  const turn = Math.atan2(-x, distance) + lerp(0.08, 0.1, tall);
  return {
    camera: { position: [0, 0, PHONE_Z + distance], target: [0, 0, PHONE_Z] },
    phone: { position: [x, y, PHONE_Z], rotation: [-0.02, turn, 0] },
  };
}

function layoutFor(width: number, height: number): { layout: Layout; fit: number } {
  const aspect = width / Math.max(1, height);
  // Same switch point as the CSS (portrait ≤ 0.9 → copy below the devices).
  const tall = smoothstep(0.95, 0.85, aspect);
  // Narrower than the reference aspect: back the intro camera off so the composition keeps its width.
  // Wider portrait screens (tablets) come closer, so the devices do not float small under the copy.
  const fit = lerp(Math.max(1, WIDE_ASPECT / aspect), Math.max(TALL_MIN_FIT, TALL_ASPECT / aspect), tall);
  const pose = (a: Pose, b: Pose): Pose => ({
    position: lerpVec(a.position, b.position, tall),
    rotation: lerpVec(a.rotation, b.rotation, tall),
  });
  const apps = appsFraming(width, height, tall);
  return {
    layout: {
      camIntro: {
        position: lerpVec(WIDE_INTRO.camIntro.position, TALL_INTRO.camIntro.position, tall),
        target: lerpVec(WIDE_INTRO.camIntro.target, TALL_INTRO.camIntro.target, tall),
      },
      camApps: apps.camera,
      phoneIntro: pose(WIDE_INTRO.phoneIntro, TALL_INTRO.phoneIntro),
      phoneApps: apps.phone,
      laptop: pose(WIDE_INTRO.laptop, TALL_INTRO.laptop),
    },
    fit,
  };
}

/** Recomputed only when the canvas resizes, not every frame. */
class LayoutCache {
  private key = '';
  private value = layoutFor(1440, 900);

  get(width: number, height: number): { layout: Layout; fit: number } {
    const key = `${width}x${height}`;
    if (key !== this.key) {
      this.key = key;
      this.value = layoutFor(width, height);
    }
    return this.value;
  }
}

/** Damped spring for the pointer tilt (a touch of overshoot). */
class Spring {
  value = 0;
  private velocity = 0;
  step(target: number, dt: number, stiffness = 70, damping = 11): number {
    this.velocity += (target - this.value) * stiffness * dt;
    this.velocity *= Math.exp(-damping * dt);
    this.value += this.velocity * dt;
    return this.value;
  }

  isSettled(target: number): boolean {
    return Math.abs(target - this.value) < 1e-4 && Math.abs(this.velocity) < 1e-4;
  }
}

/** After this long without scroll, pointer or grab input the scene stops drawing (battery). */
const IDLE_MS = 7000;

/** The phone's corners in its own space, projected every frame to place the grab box. */
const PHONE_CORNERS: readonly Vec3[] = [-1, 1].flatMap(sx =>
  [-1, 1].flatMap(sy => [-1, 1].map(sz => [(sx * PHONE.width) / 2, (sy * PHONE.height) / 2, (sz * PHONE.depth) / 2] as Vec3))
);
const corner = new Vector3();

/** Screen-space box of the phone (px, canvas coordinates). */
function phoneBox(phone: Group, camera: Camera, width: number, height: number): { x: number; y: number; width: number; height: number } {
  phone.updateMatrixWorld();
  camera.updateMatrixWorld();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y, z] of PHONE_CORNERS) {
    corner.set(x, y, z).applyMatrix4(phone.matrixWorld).project(camera);
    const px = ((corner.x + 1) / 2) * width;
    const py = ((1 - corner.y) / 2) * height;
    minX = Math.min(minX, px);
    maxX = Math.max(maxX, px);
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

const FLOOR_Y = -1;
/** How far the phone lifts toward the camera mid-turn. */
const SPIN_LIFT = 0.22;

type IdleHandle = number;
const requestIdle = (callback: () => void): IdleHandle =>
  typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(callback, { timeout: 600 })
    : window.setTimeout(callback, 60);
const cancelIdle = (handle: IdleHandle): void =>
  typeof window.cancelIdleCallback === 'function' ? window.cancelIdleCallback(handle) : window.clearTimeout(handle);

/**
 * Lights and the studio environment (key softbox, a fill for the phone's
 * back, rim strips in the style's accents). Memoised: the cube map only
 * re-renders when the style or tier changes, never mid-scroll.
 */
const StudioLights = memo(function StudioLights({ theme, tier }: { theme: LabTheme; tier: DeviceTier }) {
  const isDark = theme.scheme === 'dark';
  const { colors } = theme;
  return (
    <>
      <ambientLight intensity={isDark ? 0.22 : 0.5} />
      <directionalLight position={[3, 5, 4]} intensity={isDark ? 1.3 : 1.7} />
      <directionalLight position={[-4, 2, -3]} intensity={isDark ? 1.4 : 0.9} color={colors.accent} />
      <Environment frames={1} resolution={tier === 'high' ? 256 : 128}>
        {/* Key softbox overhead; a fill high behind the camera lights the back mid-turn (kept out of the display's mirror angle). */}
        <Lightformer form='rect' intensity={isDark ? 2 : 2.6} color='#ffffff' scale={[10, 4, 1]} position={[0, 6, 2]} target={[0, 0, 0]} />
        <Lightformer
          form='rect'
          intensity={isDark ? 1.2 : 1.5}
          color='#ffffff'
          scale={[6, 2, 1]}
          position={[0, 6.5, 6]}
          target={[0, 0, 0]}
        />
        {/* Rim strips in the style's accents. */}
        <Lightformer
          form='rect'
          intensity={isDark ? 3.4 : 2}
          color={colors.accent}
          scale={[1.1, 9, 1]}
          position={[-6, 1, 1]}
          target={[0, 0, 0]}
        />
        <Lightformer
          form='rect'
          intensity={isDark ? 2.6 : 1.6}
          color={isDark ? colors.accent2 : mixHex(colors.accent, '#ffffff', 0.55)}
          scale={[1.1, 9, 1]}
          position={[6, 1, -0.5]}
          target={[0, 0, 0]}
        />
        <Lightformer form='ring' intensity={isDark ? 0.9 : 0.7} color='#ffffff' scale={1.5} position={[-4, 4, 4]} target={[0, 0, 0]} />
      </Environment>
    </>
  );
});

interface DevicesSceneProps {
  runtime: DevicesRuntime;
  theme: LabTheme;
  tier: DeviceTier;
  reducedMotion: boolean;
  /** Hidden DOM host of the panel's logo mark (debossed on the phone's back), and the logo id. */
  markHost: RefObject<HTMLElement | null>;
  logoId: number;
  /** The GPU dropped the context (memory pressure on phones): the section swaps to the CSS devices. */
  onContextLost: () => void;
}

export default function DevicesScene({ runtime, theme, tier, reducedMotion, markHost, logoId, onContextLost }: DevicesSceneProps) {
  const camera = useThree(state => state.camera);
  const gl = useThree(state => state.gl);
  const scene = useThree(state => state.scene);
  const invalidate = useThree(state => state.invalidate);
  const phoneRef = useRef<Group>(null);
  const laptopRef = useRef<Group>(null);
  const [hasShadow, setHasShadow] = useState(true);
  const springs = useMemo(() => ({ x: new Spring(), y: new Spring() }), []);
  const target = useMemo(() => new Vector3(), []);
  const [layoutCache] = useState(() => new LayoutCache());

  // Screens decode off the main thread; each is uploaded to the GPU in an idle slot, not mid-scroll.
  const [uploads] = useState(() => new Set<IdleHandle>());
  const [library] = useState(
    () =>
      new ScreenLibrary(
        texture => {
          const handle = requestIdle(() => {
            uploads.delete(handle);
            gl.initTexture(texture);
            runtime.notify();
          });
          uploads.add(handle);
        },
        tier === 'high' ? 8 : 4
      )
  );

  useEffect(() => {
    // The first app and the laptop's page first, the rest right after.
    library.load([...ALL_SCREEN_SOURCES.slice(0, SCREENS_PER_APP), LAPTOP_SITE.src, ...ALL_SCREEN_SOURCES.slice(SCREENS_PER_APP)]);
    return () => {
      uploads.forEach(cancelIdle);
      uploads.clear();
      library.dispose();
    };
  }, [library, uploads]);

  // A lost context would leave a blank (or white) canvas over the stage. The listener goes away before
  // R3F's own forced context loss on unmount, so only a real loss switches to the CSS devices.
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', onContextLost);
    return () => canvas.removeEventListener('webglcontextlost', onContextLost);
  }, [gl, onContextLost]);

  // Compile every shader while the section is still offscreen (LazyCanvas mounts ~1 viewport early).
  useEffect(() => {
    let isCurrent = true;
    const handle = requestIdle(() => {
      gl.compileAsync(scene, camera)
        .then(() => isCurrent && invalidate())
        .catch(() => undefined);
    });
    return () => {
      isCurrent = false;
      cancelIdle(handle);
    };
  }, [gl, scene, camera, invalidate]);

  useEffect(() => {
    const listener = () => invalidate();
    runtime.listeners.add(listener);
    runtime.wakers.add(listener);
    // Animate for a few seconds after mounting, then sleep until scroll or pointer input.
    runtime.wake();
    return () => {
      runtime.listeners.delete(listener);
      runtime.wakers.delete(listener);
    };
  }, [runtime, invalidate]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 1 / 30);
    const story = runtime.story;
    if (!reducedMotion) runtime.advance(dt);
    const { width, height } = state.size;
    const { layout, fit } = layoutCache.get(width, height);

    // Camera: wide → straight on the phone (and back for the outro).
    const dolly = story.dolly; // already eased by the timeline
    const introPos = layout.camIntro.position;
    const introTarget = layout.camIntro.target;
    const fitted: Vec3 = [
      introTarget[0] + (introPos[0] - introTarget[0]) * fit,
      introTarget[1] + (introPos[1] - introTarget[1]) * fit,
      introTarget[2] + (introPos[2] - introTarget[2]) * fit,
    ];
    const camPos = lerpVec(fitted, layout.camApps.position, dolly);
    const camTarget = lerpVec(introTarget, layout.camApps.target, dolly);
    camera.position.set(camPos[0], camPos[1], camPos[2]);
    target.set(camTarget[0], camTarget[1], camTarget[2]);
    camera.lookAt(target);

    // Pointer / touch tilt with spring easing; scroll speed nods the devices too.
    const pointer = runtime.pointer;
    runtime.decayVelocity(dt);
    const grab = runtime.grab;
    const tiltTargetX = (pointer.isActive ? pointer.y * 0.22 : 0) + runtime.velocity * 0.16;
    // While a hand turns the phone, the pointer tilt lets go of its yaw.
    const tiltTargetY = pointer.isActive && !grab.isDragging ? pointer.x * 0.34 : 0;
    const tiltX = reducedMotion ? 0 : springs.x.step(tiltTargetX, dt);
    const tiltY = reducedMotion ? 0 : springs.y.step(tiltTargetY, dt);
    const time = runtime.time;

    const phone = phoneRef.current;
    if (phone) {
      const face = story.face; // already eased by the timeline
      const position = lerpVec(layout.phoneIntro.position, layout.phoneApps.position, face);
      const rotation = lerpVec(layout.phoneIntro.rotation, layout.phoneApps.rotation, face);
      // Between two apps the phone makes one full turn, lifting toward the camera.
      const phase = story.app - Math.floor(story.app);
      const spin = (story.app - Math.round(story.app)) * Math.PI * 2;
      const lift = Math.sin(Math.PI * phase) * SPIN_LIFT;
      // Idle life: a slow float, and a little sway while it waits in the wide shot.
      const bob = Math.sin(time * 1.1) * 0.022;
      const sway = Math.sin(time * 0.6) * 0.06 * (1 - face);
      // A hand turn lifts the phone a little too, most at the half turn.
      const handLift = Math.abs(Math.sin(grab.offset / 2)) * SPIN_LIFT * 0.7;
      phone.position.set(position[0], position[1] + bob, position[2] + lift + handLift);
      phone.rotation.set(
        rotation[0] + tiltX,
        rotation[1] + spin + grab.offset + tiltY + sway,
        rotation[2] + Math.sin(Math.PI * phase) * 0.08
      );
      if (!reducedMotion) {
        runtime.grabTargets.place(
          { ...phoneBox(phone, camera, width, height), isOn: true, isFacing: isPhoneFacing(story) },
          !grab.hasGrabbed
        );
      }
    }

    const laptop = laptopRef.current;
    if (laptop) {
      const away = 1 - story.laptop;
      const [lx, ly, lz] = layout.laptop.position;
      laptop.visible = away < 0.995;
      // It sinks out (and later rises back) on the right, clear of the copy column on the left.
      laptop.position.set(lx + away * 1.1, ly - away * 3.2 - (1 - smooth(story.boot)) * 0.35, lz - away * 1.6);
      laptop.rotation.set(away * 0.35 + tiltX * 0.5, layout.laptop.rotation[1] + tiltY * 0.55 + Math.sin(time * 0.45 + 1) * 0.025, 0);
    }

    const wantsShadow = story.laptop > 0.02;
    if (wantsShadow !== hasShadow) setHasShadow(wantsShadow);

    // Keep drawing while anything moves or was touched recently; then sleep until the next input.
    const isSettled = springs.x.isSettled(tiltTargetX) && springs.y.isSettled(tiltTargetY);
    if (!reducedMotion && (!runtime.isIdle(IDLE_MS) || !isSettled)) invalidate();
  });

  const isDark = theme.scheme === 'dark';
  const { colors } = theme;
  return (
    <>
      <StudioLights theme={theme} tier={tier} />

      <Laptop ref={laptopRef} runtime={runtime} library={library} theme={theme} tier={tier} reducedMotion={reducedMotion} />
      <Phone ref={phoneRef} runtime={runtime} library={library} theme={theme} tier={tier} markHost={markHost} logoId={logoId} />

      {/* Always mounted (compiled up front); it only renders while the laptop is on the floor. */}
      {tier !== 'low' ? (
        <ContactShadows
          visible={hasShadow}
          position={[0, FLOOR_Y, 0]}
          scale={12}
          far={2.2}
          blur={2.4}
          resolution={tier === 'high' ? 512 : 256}
          opacity={isDark ? 0.75 : 0.42}
          color={isDark ? '#000000' : mixHex(colors.fg, colors.bg, 0.25)}
          frames={hasShadow ? (reducedMotion ? 1 : Infinity) : 0}
        />
      ) : null}
    </>
  );
}
