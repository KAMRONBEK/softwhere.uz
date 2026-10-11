'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector4,
  type Mesh,
} from 'three';
import type { LabTheme } from '../../theme/useLabTheme';
import type { StyleId } from '../../types';
import {
  easeOutCubic,
  focalOf,
  freezeStill,
  GATE_COUNT,
  GATE_RADIUS,
  GATE_SPACING,
  seeded,
  setFrameRequest,
  SHUTTER,
  smoothstep,
  STAR_DEPTH,
  STAR_NEAR,
  TUNNEL_R_MAX,
  TUNNEL_R_MIN,
  type WarpEngine,
  type Zone,
} from './engine';
import { GATE_FRAGMENT, GATE_VERTEX, STREAK_FRAGMENT, STREAK_VERTEX } from './shaders';

/**
 * How the warp is inked per style. Dark styles get light: long-exposure
 * streaks that turn to the accent. Light styles get print: fewer, bolder
 * graphite strokes that taper like a poster's speed lines, with the accent
 * on only a few of them.
 */
interface Look {
  /** Streak opacity and width (CSS px). */
  alpha: number;
  width: number;
  /** Width left at a streak's tail (1 = none, smaller = a tapered wedge). */
  taper: number;
  /** Share of streaks that take an accent at warp. */
  accentShare: number;
  /** Streak opacity once the panel has landed. */
  calmAlpha: number;
  /** Share of the star budget drawn (light grounds read busier). */
  density: number;
  /** Streak length factor (long exposure). */
  shutter: number;
  gateAlpha: number;
  /** How completely the clear zones empty out. */
  zoneK: number;
  ring: number;
}

const LIGHT: Look = {
  alpha: 0.95,
  width: 1.5,
  taper: 0.55,
  accentShare: 0.72,
  calmAlpha: 0.5,
  density: 1,
  shutter: 1,
  gateAlpha: 0.5,
  zoneK: 0.94,
  ring: 0.9,
};
/** Concrete: black-ink speed lines on raw concrete, one in eight cobalt. */
const INK: Look = {
  alpha: 0.5,
  width: 2,
  taper: 0.16,
  accentShare: 0.13,
  calmAlpha: 0.6,
  density: 0.3,
  shutter: 0.8,
  gateAlpha: 0.36,
  zoneK: 1,
  ring: 0.8,
};
/** Silk: fine graphite threads, the odd jade or apricot one. */
const SILK: Look = {
  alpha: 0.42,
  width: 1.5,
  taper: 0.22,
  accentShare: 0.18,
  calmAlpha: 0.6,
  density: 0.38,
  shutter: 0.75,
  gateAlpha: 0.34,
  zoneK: 1,
  ring: 0.75,
};
const LOOKS: Record<StyleId, Look> = { A: LIGHT, B: INK, C: SILK, D: LIGHT };

/** Gate outline per style (see GATE_FRAGMENT). */
const GATE_SHAPE: Record<StyleId, number> = { A: 2, B: 1, C: 0, D: 3 };

function lookFor(theme: LabTheme): Look {
  return LOOKS[theme.styleId];
}

function buildStreakGeometry(count: number): InstancedBufferGeometry {
  const random = seeded(2026);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = random();
    seeds[i * 4 + 1] = random();
    seeds[i * 4 + 2] = random();
    // Mostly fine grain, a few bright motes.
    seeds[i * 4 + 3] = Math.pow(random(), 1.8);
  }
  const geometry = new InstancedBufferGeometry();
  // Two triangles; `corner` drives the quad in the vertex shader.
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(12), 3));
  geometry.setAttribute('corner', new BufferAttribute(new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]), 2));
  geometry.setIndex([0, 2, 1, 2, 3, 1]);
  geometry.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
  geometry.instanceCount = count;
  return geometry;
}

function sharedUniforms() {
  return {
    uF: { value: 1 },
    uAspect: { value: 1 },
    uCenter: { value: new Vector2() },
    uDepth: { value: STAR_DEPTH },
    uRes: { value: new Vector2(1, 1) },
    uDpr: { value: 1 },
    uSpin: { value: 0 },
    uZoneA: { value: new Vector4() },
    uZoneB: { value: new Vector4() },
    uZoneK: { value: new Vector2() },
    uFeather: { value: 80 },
  };
}

function buildStreakMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: STREAK_VERTEX,
    fragmentShader: STREAK_FRAGMENT,
    // Quads are built in screen space; their winding depends on the streak's direction.
    side: DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      ...sharedUniforms(),
      uTravel: { value: 0 },
      uStreak: { value: 0 },
      uNear: { value: STAR_NEAR },
      uRMin: { value: TUNNEL_R_MIN },
      uRMax: { value: TUNNEL_R_MAX },
      uWidth: { value: 1.5 },
      uTaper: { value: 1 },
      uFar: { value: 0.5 },
      uMaxLen: { value: 400 },
      uInk: { value: new Color() },
      uAccent: { value: new Color() },
      uAccent2: { value: new Color() },
      uColorMix: { value: 0 },
      uAccentShare: { value: 1 },
      uAlpha: { value: 1 },
      uDim: { value: 1 },
    },
  });
}

function buildGateMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: GATE_VERTEX,
    fragmentShader: GATE_FRAGMENT.replace('__GATES__', String(GATE_COUNT)),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      ...sharedUniforms(),
      uGateTravel: { value: 0 },
      uSpacing: { value: GATE_SPACING },
      uRadius: { value: GATE_RADIUS },
      uGateAlpha: { value: 0 },
      uGateA: { value: new Color() },
      uGateB: { value: new Color() },
      uShape: { value: 2 },
      uRing: { value: new Vector2(0, 0) },
      uRingColor: { value: new Color() },
    },
  });
}

const setZone = (target: Vector4, zone: Zone) => target.set(zone.x, zone.y, zone.hx, zone.hy);

export interface WarpSceneProps {
  engine: RefObject<WarpEngine>;
  theme: LabTheme;
  /** Star budget for the device tier. */
  count: number;
  /** Reduced motion: render one composed long-exposure frame. */
  isStill: boolean;
}

/**
 * The warp tunnel: a cylinder of stars that stretch into radial streaks as
 * the drive spools up, gates in the style's own geometry rushing past at full
 * warp, and a ring that bursts out when the drive drops out. Reads the shared
 * engine every frame; owns no simulation itself.
 */
export default function WarpScene({ engine, theme, count, isStill }: WarpSceneProps) {
  const streaksRef = useRef<Mesh<InstancedBufferGeometry, ShaderMaterial>>(null);
  const gatesRef = useRef<Mesh<PlaneGeometry, ShaderMaterial>>(null);
  const invalidate = useThree(state => state.invalidate);

  const geometry = useMemo(() => buildStreakGeometry(count), [count]);
  const quad = useMemo(() => new PlaneGeometry(2, 2), []);
  const streakMaterial = useMemo(() => buildStreakMaterial(), []);
  const gateMaterial = useMemo(() => buildGateMaterial(), []);
  const look = useMemo(() => lookFor(theme), [theme]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(
    () => () => {
      quad.dispose();
      streakMaterial.dispose();
      gateMaterial.dispose();
    },
    [quad, streakMaterial, gateMaterial]
  );

  // A canvas that wakes up on demand (reduced motion, the calm drift) has no
  // frame yet: draw one as soon as the loop allows it.
  const frameloop = useThree(state => state.frameloop);
  useEffect(() => {
    if (frameloop === 'demand') invalidate();
  }, [frameloop, invalidate]);

  // The page drives frames on demand while the panel is up (calm drift, typing).
  useEffect(() => {
    const e = engine.current;
    setFrameRequest(e, invalidate);
    return () => {
      if (e.requestFrame === invalidate) setFrameRequest(e, null);
    };
  }, [engine, invalidate]);

  // Theme → uniforms and blending (through refs: three objects are mutable, memo values are not).
  useEffect(() => {
    const streaks = streaksRef.current;
    const gates = gatesRef.current;
    if (!streaks || !gates) return;
    const isDark = theme.scheme === 'dark';
    const blending = isDark ? AdditiveBlending : NormalBlending;
    const { colors } = theme;
    streaks.geometry.instanceCount = Math.round(count * look.density);
    const s = streaks.material.uniforms;
    // Light grounds: graphite ink (muted) instead of solid black scratches.
    (s.uInk.value as Color).set(isDark ? colors.fg : colors.muted);
    (s.uAccent.value as Color).set(colors.accent);
    (s.uAccent2.value as Color).set(colors.accent2);
    s.uAlpha.value = look.alpha;
    s.uWidth.value = look.width;
    s.uTaper.value = look.taper;
    s.uAccentShare.value = look.accentShare;
    const g = gates.material.uniforms;
    (g.uGateA.value as Color).set(isDark ? colors.accent : colors.muted);
    (g.uGateB.value as Color).set(isDark ? colors.accent2 : colors.accent);
    (g.uRingColor.value as Color).set(colors.accent);
    g.uShape.value = GATE_SHAPE[theme.styleId];
    for (const material of [streaks.material, gates.material]) {
      material.blending = blending;
      material.needsUpdate = true;
    }
    invalidate();
  }, [theme, look, count, isStill, invalidate]);

  useFrame(state => {
    const streaks = streaksRef.current;
    const gates = gatesRef.current;
    if (!streaks || !gates) return;
    const e = engine.current;
    if (isStill) freezeStill(e);
    const { width, height } = state.size;
    const dpr = state.viewport.dpr;
    const f = focalOf(e.fov);

    for (const material of [streaks.material, gates.material]) {
      const u = material.uniforms;
      u.uF.value = f;
      u.uAspect.value = width / Math.max(1, height);
      (u.uCenter.value as Vector2).set(e.centerX, e.centerY);
      (u.uRes.value as Vector2).set(width * dpr, height * dpr);
      u.uDpr.value = dpr;
      u.uSpin.value = e.spin;
      setZone(u.uZoneA.value as Vector4, e.zoneA);
      setZone(u.uZoneB.value as Vector4, e.zoneB);
      // The send flourish briefly lets the light through behind the panel text.
      (u.uZoneK.value as Vector2).set(e.zoneA.k * look.zoneK, e.zoneB.k * look.zoneK * (1 - 0.55 * e.boost));
      u.uFeather.value = e.feather;
    }

    const s = streaks.material.uniforms;
    s.uTravel.value = e.travel;
    s.uStreak.value = e.speed * SHUTTER * look.shutter;
    s.uColorMix.value = smoothstep(0.1, 0.7, e.warp);
    // Calm space keeps only the nearer stars crisp; the deep core fills in at warp.
    s.uFar.value = 0.28 + 0.27 * smoothstep(0, 0.6, e.warp);
    // Peak streaks stop at a third of the screen diagonal: speed without a white-out.
    s.uMaxLen.value = 0.34 * Math.hypot(width, height) * dpr;
    s.uDim.value = 1 - (1 - look.calmAlpha) * e.calm * (1 - e.boost);

    const gateAlpha = smoothstep(0.35, 0.85, e.warp) * look.gateAlpha;
    const ring = e.ringT >= 0 ? Math.pow(1 - e.ringT, 1.6) * look.ring : 0;
    gates.visible = gateAlpha > 0.002 || ring > 0.002;
    const g = gates.material.uniforms;
    g.uGateTravel.value = e.gateTravel;
    g.uGateAlpha.value = gateAlpha;
    (g.uRing.value as Vector2).set(e.ringT >= 0 ? easeOutCubic(e.ringT) : 0, ring);
  });

  return (
    <>
      <mesh ref={gatesRef} geometry={quad} material={gateMaterial} frustumCulled={false} renderOrder={0} />
      <mesh ref={streaksRef} geometry={geometry} material={streakMaterial} frustumCulled={false} renderOrder={1} />
    </>
  );
}
