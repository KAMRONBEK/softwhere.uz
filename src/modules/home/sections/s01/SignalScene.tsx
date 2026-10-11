'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  NormalBlending,
  Plane,
  Ray,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  type Group,
  type Mesh,
  type PerspectiveCamera,
  type Points,
} from 'three';
import type { LabTheme } from '../../theme/useLabTheme';
import type { DeviceTier } from '../../types';
import { bindWake, chargeAt, heldSeconds, type HeroInput } from './input';
import { layoutFor, PORTRAIT_ASPECT } from './layout';
import { buildRingGeometry, buildRingMaterial, paintRing } from './rings';
import { mulberry32, type MarkSample } from './sampleMark';
import { FRAGMENT_SHADER, RIPPLE_COUNT, RIPPLE_SPEED, TRAIL_LENGTH, VERTEX_SHADER } from './shaders';

/** Camera distance the scene is composed for (point sizes are exact here). */
export const CAMERA_Z = 10;
export const CAMERA_FOV = 35;

/** Share of particles that orbit the mark as loose dust instead of drawing it. */
export const DUST_FRACTION = 0.12;

/** How far the camera flies in during the intro (world units). */
const DOLLY = 4.6;
/** Starfield depth range in world units (near, far) and its overscan past the frame edge. */
const STAR_NEAR = 3.2;
const STAR_FAR = -30;
const STAR_OVERSCAN = 1.08;
const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360);

const INTRO_SECONDS = 2.8;
const MORPH_SECONDS = 1.9;
/** The scroll dissolve starts this far into the hero (stage heights), and runs over Layout.span. */
const DISSOLVE_FROM = 0.015;
/** Seconds a trail sample / ripple keeps moving particles (matches the shader's cut-offs). */
const TRAIL_LIFE = 2.8;
const RIPPLE_LIFE = 3;
/** Long enough that slow devices still finish the intro on time, short enough to survive a pause. */
const MAX_DELTA = 0.1;
const TRAIL_MIN_STEP = 0.006;
const TRAIL_MIN_INTERVAL = 0.022;
const MAX_WIND_SPEED = 5;
const BREATH = 0.0065;
/** Ink coverage assumed until the first sample arrives (sets dot spacing). */
const DEFAULT_COVERAGE = 0.3;
/**
 * Beside the copy (landscape), a mark that fills its square edge to edge
 * would run under the headline: a mark whose ink is wider than WIDE_INK of
 * its square shrinks until it is WIDE_INK_FIT wide. The chevron S fills its
 * box's height and 0.89 of its width, so it forms at ~0.67 of the layout
 * size there (about 360×405px at 1440×900, clear of the headline); portrait
 * keeps the full size, the copy being below it.
 */
const WIDE_INK = 0.7;
const WIDE_INK_FIT = 0.6;
const FIT_RATE = 4;
const EMPTY_AGE = 1000;
/** With nobody touching it, the mark sends one soft pulse from its accent after this long (s)… */
const IDLE_PULSE_AFTER = 5.5;
const IDLE_PULSE_STRENGTH = 0.4;
/**
 * The first time it idles, the mark shows what a press does instead: its
 * accent node charges for this long and fires (a little softer than a full
 * human charge), and the shockwave rolls through the headline.
 */
const DEMO_HOLD_S = 1.1;
const DEMO_GAIN = 1;
/**
 * …and once that has rung out, drops to ~30 fps (breathing only) until the
 * next input: each frame waits this long, then for the next display frame.
 */
const THROTTLE_AFTER = 8;
const THROTTLE_GAP_MS = 1000 / 30 - 1000 / 60;

/** Hold to charge: the well's reach (mark widths), how fast its core spins (rad/s at full charge), rise/fall rates. */
const GATHER_REACH = 0.2;
const GATHER_SPIN = 2.6;
const GATHER_RISE = 16;
const GATHER_FALL = 9;
/** Shockwave rings: half width in px, peak opacity (dark / light grounds), fade rate per second. */
const RING_HALF_PX = 7;
const RING_ALPHA = { dark: 0.5, light: 0.55 };
const RING_FADE = 1.15;
/** The charge ring closes from this radius (mark widths) to the core as the charge builds. */
const CHARGE_RING_FROM = 0.42;
const CHARGE_RING_TO = 0.06;

/** Point-size ceilings: px before DPR, and how much nearness may enlarge a point (dark / light). */
const POINT_CAP: Record<DeviceTier, { max: number; depthDark: number; depthLight: number }> = {
  high: { max: 64, depthDark: 6, depthLight: 2.5 },
  mid: { max: 40, depthDark: 4, depthLight: 2.2 },
  low: { max: 32, depthDark: 3, depthLight: 2 },
};

type Look = { shape: 0 | 1 | 2; alpha: number; spacing: number; twinkle: number };

/** Particle material per style family: light on dark, pigment or print on light. */
function lookFor(theme: LabTheme): Look {
  if (theme.scheme === 'dark') return { shape: 0, alpha: 0.5, spacing: 3.3, twinkle: 1 };
  if (theme.radius === '0px') return { shape: 2, alpha: 0.92, spacing: 1.25, twinkle: 0 };
  return { shape: 1, alpha: 0.7, spacing: 1.45, twinkle: 0 };
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const damp = (current: number, target: number, lambda: number, dt: number) => current + (target - current) * (1 - Math.exp(-lambda * dt));

interface Geometry {
  geometry: BufferGeometry;
  markCount: number;
}

/** Builds every attribute once per particle count; logo targets are filled in later. */
function buildGeometry(count: number): Geometry {
  const random = mulberry32(1337);
  const markCount = Math.round(count * (1 - DUST_FRACTION));
  const from = new Float32Array(count * 3);
  const to = new Float32Array(count * 3);
  const star = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  const toneFrom = new Float32Array(count * 2);
  const tone = new Float32Array(count * 2);

  for (let i = 0; i < count; i++) {
    // Starfield, view-normalised: x/y across the frame (a little beyond it),
    // z = depth from near to far. The shader maps it into world space.
    star[i * 3] = (random() * 2 - 1) * STAR_OVERSCAN;
    star[i * 3 + 1] = (random() * 2 - 1) * STAR_OVERSCAN;
    star[i * 3 + 2] = Math.pow(random(), 0.85);

    // Size: mostly fine grain with a few brighter motes.
    seed[i * 4] = 0.62 + Math.pow(random(), 2.4) * 0.95;
    seed[i * 4 + 1] = random();
    seed[i * 4 + 2] = random();

    if (i >= markCount) {
      // Dust: a loose halo that slowly orbits the mark.
      const r = 0.42 + Math.pow(random(), 1.8) * 0.42;
      const a = random() * Math.PI * 2;
      const x = Math.cos(a) * r * 1.1;
      const y = Math.sin(a) * r;
      const z = (random() - 0.5) * 0.4;
      from.set([x, y, z], i * 3);
      to.set([x, y, z], i * 3);
      seed[i * 4 + 3] = random() < 0.45 ? 2 : 1;
      toneFrom.set([0, 0.7], i * 2);
      tone.set([0, 0.7], i * 2);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(to, 3));
  geometry.setAttribute('aTo', new BufferAttribute(to, 3));
  geometry.setAttribute('aFrom', new BufferAttribute(from, 3));
  geometry.setAttribute('aStar', new BufferAttribute(star, 3));
  geometry.setAttribute('aSeed', new BufferAttribute(seed, 4));
  geometry.setAttribute('aToneFrom', new BufferAttribute(toneFrom, 2));
  geometry.setAttribute('aTone', new BufferAttribute(tone, 2));
  return { geometry, markCount };
}

function buildMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uMorph: { value: 1 },
      uDisperse: { value: 1 },
      uDissolve: { value: 0 },
      uWind: { value: new Vector2(0, 1) },
      uSweep: { value: new Vector2(0, 1) },
      uSize: { value: 3 },
      uDpr: { value: 1 },
      uCamDist: { value: CAMERA_Z },
      uMaxPoint: { value: 64 },
      uDepthCap: { value: 6 },
      uCurlOn: { value: 1 },
      uTrailOn: { value: 0 },
      uRippleOn: { value: 0 },
      uGatherOn: { value: 0 },
      uGather: { value: new Vector4() },
      uGatherSpin: { value: 0 },
      uAlpha: { value: 0.5 },
      uTwinkle: { value: 0 },
      uBreath: { value: BREATH },
      uScale: { value: 1 },
      uAspect: { value: 1 },
      uTanHalfFov: { value: TAN_HALF_FOV },
      uStarDepth: { value: new Vector3(CAMERA_Z - DOLLY, STAR_NEAR, STAR_FAR) },
      uLight: { value: 0 },
      uShape: { value: 0 },
      uPointer: { value: new Vector3() },
      uTrail: { value: new Float32Array(TRAIL_LENGTH * 4) },
      uTrailAge: { value: new Float32Array(TRAIL_LENGTH).fill(EMPTY_AGE) },
      uRipple: { value: new Float32Array(RIPPLE_COUNT * 4) },
      uInk: { value: new Color() },
      uAccent: { value: new Color() },
      uAccent2: { value: new Color() },
    },
  });
}

export interface SignalSceneProps {
  count: number;
  tier: DeviceTier;
  sample: MarkSample | null;
  theme: LabTheme;
  input: RefObject<HeroInput>;
  /** Reduced motion: render the finished mark once, no time, no input. */
  isStill: boolean;
  onReady: () => void;
  /** The scene fired a pulse of its own (the idle demo), at this NDC point and strength. */
  onScenePulse?: (pulse: { x: number; y: number; strength: number }) => void;
}

/**
 * The hero's particle cloud: forms the active logo mark out of a starfield,
 * breathes, parts around the pointer, ripples on click/tap, re-forms when the
 * logo changes and is stripped away on the wind as the hero scrolls out
 * (embers on dark grounds, pigment that washes out on light ones).
 */
export default function SignalScene({ count, tier, sample, theme, input, isStill, onReady, onScenePulse }: SignalSceneProps) {
  const groupRef = useRef<Group>(null);
  // Three objects are mutated through this ref (effects, frame loop), never
  // through the memoised values, which React treats as immutable.
  const pointsRef = useRef<Points<BufferGeometry, ShaderMaterial>>(null);
  const invalidate = useThree(state => state.invalidate);
  const frameloop = useThree(state => state.frameloop);
  const throttleRef = useRef<number | null>(null);

  const { geometry, markCount } = useMemo(() => buildGeometry(count), [count]);
  const material = useMemo(() => buildMaterial(), []);
  const look = useMemo(() => lookFor(theme), [theme]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  // One ring per ripple slot, plus the charge ring (last). Mutated through ringRefs only.
  const ringGeometry = useMemo(() => buildRingGeometry(), []);
  const ringMaterials = useMemo(() => Array.from({ length: RIPPLE_COUNT + 1 }, () => buildRingMaterial()), []);
  const ringRefs = useRef<Array<Mesh<BufferGeometry, ShaderMaterial> | null>>([]);
  useEffect(() => () => ringGeometry.dispose(), [ringGeometry]);
  useEffect(() => () => ringMaterials.forEach(ring => ring.dispose()), [ringMaterials]);

  // Per-frame simulation state (never React state).
  const sim = useRef({
    time: 0,
    intro: isStill ? 1 : 0,
    hasMark: false,
    hasSignalledReady: false,
    morph: 1,
    dissolve: 0,
    hover: 0,
    parallaxX: 0,
    parallaxY: 0,
    lastX: 0,
    lastY: 0,
    lastPushAt: -1,
    trailTimes: new Float64Array(TRAIL_LENGTH).fill(-EMPTY_AGE),
    trailHead: 0,
    rippleTimes: new Float64Array(RIPPLE_COUNT).fill(-EMPTY_AGE),
    rippleStrength: new Float32Array(RIPPLE_COUNT),
    rippleHead: 0,
    lastInputAt: 0,
    serial: 0,
    hasIdlePulsed: false,
    hasDemoed: false,
    demoAt: -1,
    accentX: 0,
    accentY: 0,
    coverage: DEFAULT_COVERAGE,
    inkWidth: 0,
    fit: 1,
    gather: 0,
    spin: 0,
    gatherX: 0,
    gatherY: 0,
  });
  const scratch = useMemo(
    () => ({
      ray: new Ray(),
      plane: new Plane(new Vector3(0, 0, 1), 0),
      hit: new Vector3(),
      inverse: new Matrix4(),
      screen: new Vector3(),
    }),
    []
  );

  // Theme → uniforms.
  useEffect(() => {
    const target = pointsRef.current?.material;
    if (!target) return;
    const u = target.uniforms;
    (u.uInk.value as Color).set(theme.colors.fg);
    (u.uAccent.value as Color).set(theme.colors.accent);
    (u.uAccent2.value as Color).set(theme.colors.accent2);
    u.uShape.value = look.shape;
    u.uAlpha.value = look.alpha;
    u.uTwinkle.value = isStill ? 0 : look.twinkle;
    u.uLight.value = theme.scheme === 'light' ? 1 : 0;
    target.blending = theme.blending === 'additive' ? AdditiveBlending : NormalBlending;
    target.needsUpdate = true;
    for (const ring of ringRefs.current) if (ring) paintRing(ring.material, theme.colors.accent, theme.blending === 'additive');
    invalidate();
  }, [theme, look, material, ringMaterials, isStill, invalidate]);

  // New logo sample → targets. The first fill forms from the starfield; later ones morph.
  useEffect(() => {
    const points = pointsRef.current;
    if (!sample || sample.count !== markCount || !points) return;
    const target = points.geometry;
    const s = sim.current;
    const aTo = target.getAttribute('aTo') as BufferAttribute;
    const aFrom = target.getAttribute('aFrom') as BufferAttribute;
    const aTone = target.getAttribute('aTone') as BufferAttribute;
    const aToneFrom = target.getAttribute('aToneFrom') as BufferAttribute;
    const to = aTo.array as Float32Array;
    const from = aFrom.array as Float32Array;
    const tone = aTone.array as Float32Array;
    const toneFrom = aToneFrom.array as Float32Array;
    const shouldMorph = s.hasMark && !isStill;

    from.set(shouldMorph ? to.subarray(0, markCount * 3) : sample.positions, 0);
    toneFrom.set(shouldMorph ? tone.subarray(0, markCount * 2) : sample.tones, 0);
    to.set(sample.positions, 0);
    tone.set(sample.tones, 0);
    [s.accentX, s.accentY] = sample.accentCenter;
    s.coverage = sample.coverage;
    s.inkWidth = sample.inkWidth;
    for (const attribute of [aTo, aFrom, aTone, aToneFrom]) attribute.needsUpdate = true;
    target.getAttribute('position').needsUpdate = true;

    if (shouldMorph) {
      s.morph = 0;
      // A pulse from the centre sells the re-formation.
      const slot = s.rippleHead++ % RIPPLE_COUNT;
      s.rippleTimes[slot] = s.time;
      s.rippleStrength[slot] = 0.8;
      (points.material.uniforms.uRipple.value as Float32Array).set([0, 0, 0, 0], slot * 4);
    } else {
      s.morph = 1;
    }
    s.hasMark = true;
    invalidate();
  }, [sample, markCount, geometry, isStill, invalidate]);

  // The canvas runs on demand: the frame loop below asks for the next frame
  // itself (every display frame while something moves, ~30 fps once idle),
  // and any input wakes it at once through `input.wake`.
  useEffect(() => {
    const clearThrottle = () => {
      if (throttleRef.current !== null) window.clearTimeout(throttleRef.current);
      throttleRef.current = null;
    };
    const unbind = bindWake(input.current, () => {
      clearThrottle();
      invalidate();
    });
    return () => {
      unbind();
      clearThrottle();
    };
  }, [input, invalidate]);
  // Back on screen (LazyCanvas: 'never' → 'demand'): restart the self-driving loop.
  useEffect(() => {
    if (frameloop === 'demand') invalidate();
  }, [frameloop, invalidate]);

  useFrame((state, rawDelta) => {
    const group = groupRef.current;
    const points = pointsRef.current;
    if (!group || !points) return;
    const camera = state.camera as PerspectiveCamera;
    const s = sim.current;
    const u = points.material.uniforms;
    const io = input.current;
    const dt = isStill ? 0 : Math.min(rawDelta, MAX_DELTA);
    s.time += dt;
    if (io.serial !== s.serial) {
      s.serial = io.serial;
      s.lastInputAt = s.time;
      s.hasIdlePulsed = false;
    }

    // Layout: where the mark sits and how big, in world units at z = 0.
    const { width, height } = state.size;
    const aspect = width / Math.max(1, height);
    const worldH = 2 * CAMERA_Z * TAN_HALF_FOV;
    const worldW = worldH * aspect;
    const layout = layoutFor(width, height);
    const fitTarget = aspect >= PORTRAIT_ASPECT && s.inkWidth > WIDE_INK ? WIDE_INK_FIT / s.inkWidth : 1;
    s.fit = isStill ? fitTarget : damp(s.fit, fitTarget, FIT_RATE, dt);
    const markWorld = layout.size(worldW, worldH) * s.fit;
    const markPx = (markWorld / worldH) * height;

    // Intro (stars → mark), logo morph, scroll dissolve (mark → wind).
    if (s.hasMark && !isStill) s.intro = Math.min(1, s.intro + dt / INTRO_SECONDS);
    if (s.hasMark) s.morph = isStill ? 1 : Math.min(1, s.morph + dt / MORPH_SECONDS);
    const dissolveTarget = isStill ? 0 : clamp01((io.scroll - DISSOLVE_FROM) / layout.span);
    s.dissolve = Math.abs(dissolveTarget - s.dissolve) < 1e-4 ? dissolveTarget : damp(s.dissolve, dissolveTarget, 9, dt);
    const introLeft = s.hasMark ? Math.pow(1 - s.intro, 3) : 1;
    const dissolve = smooth(s.dissolve);

    // Pointer / tilt parallax.
    const tilt = io.tilt;
    const aimX = tilt ? tilt.x : io.isActive ? io.x : 0;
    const aimY = tilt ? tilt.y : io.isActive ? io.y : 0;
    s.parallaxX = damp(s.parallaxX, aimX, 2.6, dt);
    s.parallaxY = damp(s.parallaxY, aimY, 2.6, dt);
    const breath = 1 + Math.sin(s.time * 0.9) * 0.012;

    // While the stage is sticky the mark follows the page (fully on phones, so
    // it never slides over the copy below it); afterwards the stage itself scrolls.
    const lift = isStill ? 0 : Math.min(Math.max(0, io.scroll), io.sticky) * layout.follow * worldH;
    group.position.set(worldW * layout.x, worldH * layout.y + lift, 0);
    group.scale.setScalar(markWorld * breath);
    group.rotation.set(-s.parallaxY * 0.16, s.parallaxX * 0.26 + dissolve * 0.25, introLeft * -0.35);
    camera.position.z = CAMERA_Z - DOLLY * introLeft * 0.75;
    group.updateMatrixWorld();

    // Pointer → mark-local coordinates (ray onto the mark's plane).
    s.hover = damp(s.hover, io.isActive && !isStill ? 1 : 0, 6, dt);
    const { ray, plane, hit, inverse } = scratch;
    ray.origin.setFromMatrixPosition(camera.matrixWorld);
    ray.direction.set(io.x, io.y, 0.5).unproject(camera).sub(ray.origin).normalize();
    inverse.copy(group.matrixWorld).invert();
    ray.applyMatrix4(inverse);
    const hasHit = ray.intersectPlane(plane, hit) !== null;
    if (hasHit) (u.uPointer.value as Vector3).set(hit.x, hit.y, s.hover * (1 - s.gather));

    // Hold to charge: the well follows the pointer while held and stays put as
    // it lets go. The idle demo charges the accent node the same way.
    const isHolding = io.hold !== null && !isStill;
    // A real press takes over from the demo; scrolling away calls it off (the charge just fades).
    if (isHolding || io.scroll > DISSOLVE_FROM) s.demoAt = -1;
    const isDemoing = s.demoAt >= 0;
    const charge = isHolding ? chargeAt(heldSeconds(io)) : isDemoing ? chargeAt(s.time - s.demoAt) : 0;
    if (isHolding && hasHit) {
      const isFresh = s.gather < 1e-3;
      s.gatherX = isFresh ? hit.x : damp(s.gatherX, hit.x, 18, dt);
      s.gatherY = isFresh ? hit.y : damp(s.gatherY, hit.y, 18, dt);
    } else if (isDemoing) {
      s.gatherX = s.accentX;
      s.gatherY = s.accentY;
    }
    s.gather = damp(s.gather, charge, charge > s.gather ? GATHER_RISE : GATHER_FALL, dt);
    if (!isHolding && !isDemoing && s.gather < 1e-3) s.gather = 0;
    s.spin = s.gather > 0 ? s.spin + dt * GATHER_SPIN * (0.4 + s.gather) : 0;

    // Wind trail: a new sample whenever the pointer has travelled far enough.
    const trail = u.uTrail.value as Float32Array;
    if (hasHit && io.isActive && !isStill) {
      const elapsed = s.time - s.lastPushAt;
      const step = Math.hypot(hit.x - s.lastX, hit.y - s.lastY);
      if (s.lastPushAt < 0 || elapsed > 0.5) {
        s.lastX = hit.x;
        s.lastY = hit.y;
        s.lastPushAt = s.time;
      } else if (step > TRAIL_MIN_STEP && elapsed > TRAIL_MIN_INTERVAL) {
        const speed = Math.min(MAX_WIND_SPEED, step / elapsed);
        const slot = s.trailHead++ % TRAIL_LENGTH;
        trail.set([hit.x, hit.y, ((hit.x - s.lastX) / step) * speed, ((hit.y - s.lastY) / step) * speed], slot * 4);
        s.trailTimes[slot] = s.time;
        s.lastX = hit.x;
        s.lastY = hit.y;
        s.lastPushAt = s.time;
      }
    } else {
      s.lastPushAt = -1;
    }
    const ages = u.uTrailAge.value as Float32Array;
    let isTrailLive = false;
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      ages[i] = s.time - s.trailTimes[i];
      if (ages[i] < TRAIL_LIFE) isTrailLive = true;
    }

    // Pulses → ripples (converted at the pointer's plane position).
    while (io.pulses.length > 0) {
      const pulse = io.pulses.shift();
      if (!pulse || isStill) continue;
      ray.origin.setFromMatrixPosition(camera.matrixWorld);
      ray.direction.set(pulse.x, pulse.y, 0.5).unproject(camera).sub(ray.origin).normalize();
      ray.applyMatrix4(inverse);
      if (!ray.intersectPlane(plane, hit)) continue;
      const slot = s.rippleHead++ % RIPPLE_COUNT;
      s.rippleTimes[slot] = s.time;
      s.rippleStrength[slot] = pulse.strength;
      (u.uRipple.value as Float32Array).set([hit.x, hit.y, 0, 0], slot * 4);
    }

    // The demo's charge is full: fire it from the accent node and tell the DOM where (NDC).
    if (isDemoing && s.time - s.demoAt >= DEMO_HOLD_S) {
      s.demoAt = -1;
      const strength = 1 + chargeAt(DEMO_HOLD_S) * DEMO_GAIN;
      const slot = s.rippleHead++ % RIPPLE_COUNT;
      s.rippleTimes[slot] = s.time;
      s.rippleStrength[slot] = strength;
      (u.uRipple.value as Float32Array).set([s.accentX, s.accentY, 0, 0], slot * 4);
      const { screen } = scratch;
      screen.set(s.accentX, s.accentY, 0).applyMatrix4(group.matrixWorld).project(camera);
      onScenePulse?.({ x: screen.x, y: screen.y, strength });
    }

    // Idle: the first time, the demo above; after that one soft heartbeat from
    // the accent invites a touch. Once it has rung out the scene drops to
    // ~30 fps (breathing only) until the next input.
    const idleFor = s.time - s.lastInputAt;
    const isSettled =
      s.hasMark &&
      s.intro >= 1 &&
      s.morph >= 1 &&
      s.dissolve === 0 &&
      io.scroll <= DISSOLVE_FROM &&
      s.gather === 0 &&
      !isHolding &&
      s.demoAt < 0;
    if (!isStill && isSettled && !s.hasIdlePulsed && idleFor > IDLE_PULSE_AFTER) {
      s.hasIdlePulsed = true;
      if (!s.hasDemoed) {
        s.hasDemoed = true;
        s.demoAt = s.time;
      } else {
        const slot = s.rippleHead++ % RIPPLE_COUNT;
        s.rippleTimes[slot] = s.time;
        s.rippleStrength[slot] = IDLE_PULSE_STRENGTH;
        (u.uRipple.value as Float32Array).set([s.accentX, s.accentY, 0, 0], slot * 4);
      }
    }
    const ripples = u.uRipple.value as Float32Array;
    const ringPeak = theme.scheme === 'light' ? RING_ALPHA.light : RING_ALPHA.dark;
    const ringHalf = RING_HALF_PX / Math.max(1, markPx);
    let isRippleLive = false;
    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const age = s.time - s.rippleTimes[i];
      const strength = age < RIPPLE_LIFE ? s.rippleStrength[i] : 0;
      ripples[i * 4 + 2] = age;
      ripples[i * 4 + 3] = strength;
      if (strength > 0) isRippleLive = true;
      // Its ring rides the band of particles the ripple is pushing, then runs on past the mark.
      const ring = ringRefs.current[i];
      if (!ring) continue;
      ring.visible = strength > 0 && !isStill;
      if (!ring.visible) continue;
      const ru = ring.material.uniforms;
      (ru.uCenter.value as Vector2).set(ripples[i * 4], ripples[i * 4 + 1]);
      ru.uRadius.value = age * RIPPLE_SPEED;
      ru.uHalfWidth.value = ringHalf * (0.8 + Math.min(strength, 2.6) * 0.2);
      ru.uAlpha.value =
        ringPeak * Math.min(1, strength) * Math.exp(-age * RING_FADE) * smooth(clamp01(age / 0.08)) * (1 - age / RIPPLE_LIFE);
    }
    // The charge ring closes in on the well as it fills, and opens back out as it lets go.
    const chargeRing = ringRefs.current[RIPPLE_COUNT];
    if (chargeRing) {
      chargeRing.visible = s.gather > 0.02;
      const cu = chargeRing.material.uniforms;
      (cu.uCenter.value as Vector2).set(s.gatherX, s.gatherY);
      cu.uRadius.value = CHARGE_RING_FROM + (CHARGE_RING_TO - CHARGE_RING_FROM) * s.gather;
      cu.uHalfWidth.value = ringHalf * 0.8;
      cu.uAlpha.value = ringPeak * smooth(clamp01((s.gather - 0.02) / 0.3)) * (0.82 + 0.18 * Math.sin(s.time * 14));
    }

    const cap = POINT_CAP[tier];
    u.uTime.value = s.time;
    u.uMorph.value = s.morph;
    u.uDisperse.value = s.hasMark ? introLeft : 1;
    u.uDissolve.value = dissolve;
    (u.uWind.value as Vector2).set(layout.wind[0], layout.wind[1]);
    (u.uSweep.value as Vector2).set(layout.sweep[0], layout.sweep[1]);
    u.uCurlOn.value = !s.hasMark || introLeft > 0 || s.morph < 1 || dissolve > 0 ? 1 : 0;
    u.uTrailOn.value = isTrailLive ? 1 : 0;
    u.uRippleOn.value = isRippleLive ? 1 : 0;
    u.uGatherOn.value = s.gather > 0 ? 1 : 0;
    (u.uGather.value as Vector4).set(s.gatherX, s.gatherY, s.gather, GATHER_REACH);
    u.uGatherSpin.value = s.spin;
    u.uDpr.value = state.viewport.dpr;
    u.uScale.value = markWorld;
    u.uAspect.value = aspect;
    u.uSize.value = Math.max(1.4, markPx * Math.sqrt(s.coverage / Math.max(1, markCount)) * look.spacing);
    u.uMaxPoint.value = cap.max;
    u.uDepthCap.value = theme.scheme === 'light' ? cap.depthLight : cap.depthDark;
    u.uBreath.value = isStill ? 0 : BREATH;

    if (s.hasMark && !s.hasSignalledReady) {
      s.hasSignalledReady = true;
      onReady();
    }

    // Ask for the next frame: now while anything moves, a tick later when idle.
    // Nothing to show before the first sample (its effect asks for a frame).
    if (isStill || !s.hasMark || state.frameloop !== 'demand') return;
    const isHoverSettled = Math.abs(s.hover - (io.isActive ? 1 : 0)) < 0.01;
    const isThrottled = isSettled && idleFor > THROTTLE_AFTER && !isRippleLive && !isTrailLive && isHoverSettled;
    if (!isThrottled) invalidate();
    else if (throttleRef.current === null) {
      throttleRef.current = window.setTimeout(() => {
        throttleRef.current = null;
        invalidate();
      }, THROTTLE_GAP_MS);
    }
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
      {ringMaterials.map((ringMaterial, index) => (
        <mesh
          key={index}
          ref={(mesh: Mesh<BufferGeometry, ShaderMaterial> | null) => {
            ringRefs.current[index] = mesh;
          }}
          geometry={ringGeometry}
          material={ringMaterial}
          visible={false}
          frustumCulled={false}
          renderOrder={1}
        />
      ))}
    </group>
  );
}
