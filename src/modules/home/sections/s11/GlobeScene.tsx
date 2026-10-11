'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DynamicDrawUsage,
  NormalBlending,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  Vector4,
  type Group,
  type PerspectiveCamera,
} from 'three';
import type { DeviceTier } from '../../types';
import {
  arcPoints,
  CAMERA_FOV,
  CAMERA_Z,
  damp,
  getLandDots,
  globeLayout,
  latLonToVec,
  nearestTurn,
  smoothstep,
  sunDirection,
  type Vec3,
} from './geo';
import type { GlobeLook } from './look';
import { ALL_PINS, DESTINATION_KM, DESTINATIONS, HOME_PIN, TAG_COUNT, TAG_INDEX } from './markets';
import {
  ARC_FRAGMENT,
  ARC_VERTEX,
  BODY_FRAGMENT,
  BODY_VERTEX,
  DOTS_FRAGMENT,
  DOTS_VERTEX,
  GRID_FRAGMENT,
  GRID_VERTEX,
  HALO_FRAGMENT,
  HALO_VERTEX,
  MAX_PULSES,
  RING_FRAGMENT,
  RING_VERTEX,
  RIPPLE_COUNT,
  SPRITE_FRAGMENT,
  SPRITE_VERTEX,
} from './shaders';
import {
  arcDraw,
  beatShownAt,
  carriesReadout,
  facingVisibility,
  labelShown,
  pinShown,
  setBeat,
  setSceneLive,
  SPIN_FROM,
  SPIN_SPEED,
  stepDrag,
  storyPose,
  writeLabel,
  writeReadout,
  type GlobeRuntime,
} from './story';

const TAN_HALF_FOV = Math.tan((CAMERA_FOV * Math.PI) / 360);

/** Dot diameter as a share of the lattice spacing. */
const DOT_FILL = 0.52;
/** Arc tube radius in CSS px (converted to globe units per layout). */
const ARC_RADIUS_PX = 1.15;
const ARC_SEGMENTS = 160;
const PULSE_SECONDS = 3.4;
/** How far below the frame the globe starts its rise, as a share of the stage height. */
const RISE = 0.32;
const PIN_LIFT = 1.004;
const LABEL_LIFT = 1.012;
/**
 * Once the story has landed and nothing is moving but the ambient life
 * (comets, ripples, sway), the scene renders at this rate instead of every
 * display frame. Scroll, drag and draw-on wake it to full rate at once.
 */
const IDLE_FPS = 30;
/** The terminator creeps 0.25° a minute: refresh the sun now and then, not per frame (ms). */
const SUN_REFRESH_MS = 30_000;
/** dt ceiling: one idle frame plus slack, so throttled frames still advance at real speed. */
const MAX_DT = 1 / 20;

const TIER = {
  high: { dots: 'high', pulses: 3, gridSteps: 96, ripples: true },
  mid: { dots: 'mid', pulses: 2, gridSteps: 64, ripples: true },
  low: { dots: 'mid', pulses: 1, gridSteps: 48, ripples: false },
} as const;

interface GlobeSceneProps {
  runtime: GlobeRuntime;
  look: GlobeLook;
  tier: DeviceTier;
  /** Reduced motion: one frame per change, no inertia, comets or ripples. */
  isStatic: boolean;
}

interface Fit {
  x: number;
  y: number;
  scale: number;
  /** World units per CSS px at the globe's depth. */
  unitsPerPx: number;
  radiusPx: number;
}

/** Places a unit globe so its silhouette lands on the layout circle (exact under perspective). */
function fitGlobe(width: number, height: number): Fit {
  const layout = globeLayout(width, height);
  const unitsPerPx = (2 * CAMERA_Z * TAN_HALF_FOV) / height;
  const k = layout.r * unitsPerPx;
  const scale = k / Math.sqrt(1 + (k * k) / (CAMERA_Z * CAMERA_Z));
  return {
    x: (layout.cx - width / 2) * unitsPerPx,
    y: -(layout.cy - height / 2) * unitsPerPx,
    scale,
    unitsPerPx,
    radiusPx: layout.r,
  };
}

function toVector([x, y, z]: Vec3): Vector3 {
  return new Vector3(x, y, z);
}

function colorUniform(hex: string): { value: Color } {
  return { value: new Color(hex) };
}

function buildGrid(steps: number): BufferGeometry {
  const positions: number[] = [];
  const push = (a: Vec3, b: Vec3) => positions.push(...a, ...b);
  const R = 1.0008;
  for (let lon = -180; lon < 180; lon += 20) {
    for (let i = 0; i < steps / 2; i++) {
      const lat0 = -80 + (160 * i) / (steps / 2);
      const lat1 = -80 + (160 * (i + 1)) / (steps / 2);
      push(latLonToVec(lat0, lon, R), latLonToVec(lat1, lon, R));
    }
  }
  for (let lat = -60; lat <= 60; lat += 20) {
    for (let i = 0; i < steps; i++) {
      push(latLonToVec(lat, -180 + (360 * i) / steps, R), latLonToVec(lat, -180 + (360 * (i + 1)) / steps, R));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  return geometry;
}

interface ArcRig {
  curve: CatmullRomCurve3;
  geometry: TubeGeometry;
  material: ShaderMaterial;
  destination: Vector3;
  lastPhase: number;
  lastDraw: number;
}

/** Everything the scene allocates, built once per tier/layout bucket and disposed together. */
function useGlobeRig(tier: DeviceTier, radiusBucket: number) {
  const settings = TIER[tier];
  return useMemo(() => {
    const shared = {
      uTime: { value: 0 },
      uRipples: { value: Array.from({ length: RIPPLE_COUNT }, () => new Vector4(0, 0, 1, -100)) },
      uLit: { value: new Array<number>(TAG_COUNT).fill(0) },
      uPointSize: { value: 4 },
      uCenterDistance: { value: CAMERA_Z },
      uShimmer: { value: 1 },
      uSun: { value: toVector(sunDirection(new Date())) },
    };

    // Land dots, shared by the far-side and near-side passes.
    const dots = getLandDots(settings.dots);
    const dotGeometry = new BufferGeometry();
    dotGeometry.setAttribute('position', new BufferAttribute(dots.positions, 3));
    dotGeometry.setAttribute('aTag', new BufferAttribute(dots.tags, 1));
    const dotMaterial = (side: number) =>
      new ShaderMaterial({
        vertexShader: DOTS_VERTEX,
        fragmentShader: DOTS_FRAGMENT,
        uniforms: {
          ...shared,
          uSide: { value: side },
          uColor: colorUniform('#ffffff'),
          uLitColor: colorUniform('#ffffff'),
          uGlowColor: colorUniform('#ffffff'),
          uOpacity: { value: 0.7 },
          uLitOpacity: { value: 1 },
          uNight: { value: 0.5 },
        },
        transparent: true,
        depthWrite: false,
      });
    const backDots = dotMaterial(-1);
    backDots.depthTest = false;
    const frontDots = dotMaterial(1);

    const bodyGeometry = new SphereGeometry(0.994, 72, 48);
    const bodyMaterial = new ShaderMaterial({
      vertexShader: BODY_VERTEX,
      fragmentShader: BODY_FRAGMENT,
      uniforms: {
        uBody: colorUniform('#000000'),
        uRim: colorUniform('#ffffff'),
        uOpacity: { value: 0.85 },
        uRimStrength: { value: 0.4 },
        uShade: { value: 0.3 },
        uSun: shared.uSun,
        uNightShade: { value: 0.2 },
      },
      transparent: true,
    });

    const haloGeometry = new SphereGeometry(1.42, 64, 40);
    const haloMaterial = new ShaderMaterial({
      vertexShader: HALO_VERTEX,
      fragmentShader: HALO_FRAGMENT,
      uniforms: {
        uColor: colorUniform('#ffffff'),
        uLineColor: colorUniform('#ffffff'),
        uRadius: { value: 1 },
        uStrength: { value: 0.6 },
        uSpread: { value: 0.07 },
        uLine: { value: 0.2 },
      },
      side: BackSide,
      transparent: true,
      depthWrite: false,
    });

    const gridGeometry = buildGrid(settings.gridSteps);
    const gridMaterial = new ShaderMaterial({
      vertexShader: GRID_VERTEX,
      fragmentShader: GRID_FRAGMENT,
      uniforms: { uColor: colorUniform('#ffffff'), uOpacity: { value: 0.08 } },
      transparent: true,
      depthWrite: false,
    });

    // Arcs from Tashkent, one tube per destination.
    const home = latLonToVec(HOME_PIN.lat, HOME_PIN.lon);
    const tubeRadius = ARC_RADIUS_PX / radiusBucket;
    const arcs: ArcRig[] = DESTINATIONS.map((pin, index) => {
      const target = latLonToVec(pin.lat, pin.lon);
      const curve = new CatmullRomCurve3(arcPoints(home, target, 96).map(toVector));
      const geometry = new TubeGeometry(curve, ARC_SEGMENTS, tubeRadius, 6, false);
      const material = new ShaderMaterial({
        vertexShader: ARC_VERTEX,
        fragmentShader: ARC_FRAGMENT,
        uniforms: {
          uTime: shared.uTime,
          uDraw: { value: 0 },
          uSpeed: { value: 1 / PULSE_SECONDS },
          uOffset: { value: index * 0.17 },
          uPulses: { value: settings.pulses },
          uTrail: { value: 0.35 },
          uTail: { value: 0.16 },
          uColorA: colorUniform('#ffffff'),
          uColorB: colorUniform('#ffffff'),
          uHead: colorUniform('#ffffff'),
        },
        transparent: true,
        depthWrite: false,
      });
      return { curve, geometry, material, destination: toVector(target), lastPhase: 0, lastDraw: 0 };
    });

    // Comet heads: per arc, its pulses plus the draw-on head.
    const perArc = MAX_PULSES + 1;
    const cometCount = arcs.length * perArc;
    const cometGeometry = new BufferGeometry();
    const cometPositions = new BufferAttribute(new Float32Array(cometCount * 3), 3);
    cometPositions.setUsage(DynamicDrawUsage);
    const cometAlpha = new BufferAttribute(new Float32Array(cometCount), 1);
    cometAlpha.setUsage(DynamicDrawUsage);
    cometGeometry.setAttribute('position', cometPositions);
    cometGeometry.setAttribute('aAlpha', cometAlpha);
    cometGeometry.setAttribute('aSize', new BufferAttribute(new Float32Array(cometCount).fill(1), 1));
    const cometMaterial = new ShaderMaterial({
      vertexShader: SPRITE_VERTEX,
      fragmentShader: SPRITE_FRAGMENT,
      uniforms: {
        uPointSize: { value: 10 },
        uCenterDistance: shared.uCenterDistance,
        uColor: colorUniform('#ffffff'),
        uCore: colorUniform('#ffffff'),
        uSoftness: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
    });

    // Pin dots (home first) and their tangent ring planes.
    const pinVectors = ALL_PINS.map(pin => toVector(latLonToVec(pin.lat, pin.lon)));
    const pinGeometry = new BufferGeometry();
    pinGeometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(pinVectors.flatMap(v => [v.x * PIN_LIFT, v.y * PIN_LIFT, v.z * PIN_LIFT])), 3)
    );
    const pinAlpha = new BufferAttribute(new Float32Array(pinVectors.length), 1);
    pinAlpha.setUsage(DynamicDrawUsage);
    pinGeometry.setAttribute('aAlpha', pinAlpha);
    pinGeometry.setAttribute('aSize', new BufferAttribute(new Float32Array(pinVectors.map((_, i) => (i === 0 ? 1.5 : 1))), 1));
    const pinMaterial = new ShaderMaterial({
      vertexShader: SPRITE_VERTEX,
      fragmentShader: SPRITE_FRAGMENT,
      uniforms: {
        uPointSize: { value: 8 },
        uCenterDistance: shared.uCenterDistance,
        uColor: colorUniform('#ffffff'),
        uCore: colorUniform('#ffffff'),
        uSoftness: { value: 0.6 },
      },
      transparent: true,
      depthWrite: false,
    });

    const ringGeometry = new PlaneGeometry(1, 1);
    const zAxis = new Vector3(0, 0, 1);
    const rings = pinVectors.map((v, index) => {
      const material = new ShaderMaterial({
        vertexShader: RING_VERTEX,
        fragmentShader: RING_FRAGMENT,
        uniforms: {
          uTime: shared.uTime,
          uSpeed: { value: index === 0 ? 0.42 : 0.55 },
          uAlpha: { value: index === 0 ? 1 : 0 },
          uRings: { value: index === 0 ? 3 : 2 },
          uColor: colorUniform('#ffffff'),
        },
        transparent: true,
        depthWrite: false,
      });
      return {
        material,
        position: v.clone().multiplyScalar(1.002),
        quaternion: new Quaternion().setFromUnitVectors(zAxis, v),
        scale: index === 0 ? 0.2 : 0.11,
      };
    });

    const dispose = () => {
      [dotGeometry, bodyGeometry, haloGeometry, gridGeometry, cometGeometry, pinGeometry, ringGeometry].forEach(g => g.dispose());
      [backDots, frontDots, bodyMaterial, haloMaterial, gridMaterial, cometMaterial, pinMaterial].forEach(m => m.dispose());
      arcs.forEach(arc => {
        arc.geometry.dispose();
        arc.material.dispose();
      });
      rings.forEach(ring => ring.material.dispose());
    };

    return {
      shared,
      dots,
      dotGeometry,
      backDots,
      frontDots,
      bodyGeometry,
      bodyMaterial,
      haloGeometry,
      haloMaterial,
      gridGeometry,
      gridMaterial,
      arcs,
      perArc,
      cometGeometry,
      cometPositions,
      cometAlpha,
      cometMaterial,
      pinVectors,
      pinGeometry,
      pinAlpha,
      pinMaterial,
      ringGeometry,
      rings,
      dispose,
    };
  }, [settings, radiusBucket]);
}

type Rig = ReturnType<typeof useGlobeRig>;

function applyLook(rig: Rig, look: GlobeLook): void {
  const blending = look.blending === 'additive' ? AdditiveBlending : NormalBlending;
  for (const material of [rig.backDots, rig.frontDots]) {
    material.uniforms.uColor.value.set(look.land);
    material.uniforms.uLitColor.value.set(look.lit);
    material.uniforms.uGlowColor.value.set(look.flash);
    material.uniforms.uLitOpacity.value = look.litOpacity;
    material.uniforms.uNight.value = look.night;
    material.blending = blending;
  }
  rig.frontDots.uniforms.uOpacity.value = look.landOpacity;
  rig.backDots.uniforms.uOpacity.value = look.backOpacity;
  rig.backDots.uniforms.uLitOpacity.value = look.backOpacity * 1.6;

  const body = rig.bodyMaterial.uniforms;
  body.uBody.value.set(look.body);
  body.uRim.value.set(look.rim);
  body.uOpacity.value = look.bodyOpacity;
  body.uRimStrength.value = look.rimStrength;
  body.uShade.value = look.shade;
  body.uNightShade.value = look.nightShade;

  const halo = rig.haloMaterial.uniforms;
  halo.uColor.value.set(look.halo);
  halo.uLineColor.value.set(look.limbLine);
  halo.uStrength.value = look.haloStrength;
  halo.uSpread.value = look.haloSpread;
  halo.uLine.value = look.limbLineStrength;
  rig.haloMaterial.blending = blending;

  rig.gridMaterial.uniforms.uColor.value.set(look.grid);
  rig.gridMaterial.uniforms.uOpacity.value = look.gridOpacity;

  for (const arc of rig.arcs) {
    const u = arc.material.uniforms;
    u.uColorA.value.set(look.arcFrom);
    u.uColorB.value.set(look.arcTo);
    u.uHead.value.set(look.arcHead);
    u.uTrail.value = look.arcTrail;
    arc.material.blending = blending;
  }

  for (const material of [rig.cometMaterial, rig.pinMaterial]) {
    material.uniforms.uColor.value.set(look.comet);
    material.uniforms.uCore.value.set(look.cometCore);
    material.blending = blending;
  }
  rig.cometMaterial.uniforms.uSoftness.value = look.cometSoftness;
  rig.pinMaterial.uniforms.uSoftness.value = look.cometSoftness * 0.6;

  for (const ring of rig.rings) {
    ring.material.uniforms.uColor.value.set(look.ring);
    ring.material.blending = blending;
  }
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const scratch = new Vector3();
const scratchNormal = new Vector3();
const scratchCam = new Vector3();
const scratchCenter = new Vector3();
const scratchView = new Vector3();

type TierSettings = (typeof TIER)[DeviceTier];

/** Point sizes follow the globe's on-screen radius and the device pixel ratio. */
function applySizes(rig: Rig, radiusPx: number, dpr: number, isStatic: boolean, settings: TierSettings): void {
  rig.shared.uPointSize.value = radiusPx * rig.dots.spacing * DOT_FILL * dpr;
  rig.cometMaterial.uniforms.uPointSize.value = Math.max(7, radiusPx * 0.034) * dpr;
  rig.pinMaterial.uniforms.uPointSize.value = Math.max(6, radiusPx * 0.026) * dpr;
  rig.shared.uShimmer.value = isStatic ? 0 : 1;
  rig.arcs.forEach(arc => {
    arc.material.uniforms.uPulses.value = isStatic ? 0 : settings.pulses;
  });
}

interface FrameState {
  p: number;
  enter: number;
  rippleIndex: number;
  lit: number[];
  litTargets: number[];
  /** Clock time of the last stepped frame (s); < 0 before the first. */
  lastStep: number;
  /** Date.now() of the last sun update. */
  sunAt: number;
  isIdle: boolean;
}

interface FrameContext {
  rig: Rig;
  runtime: GlobeRuntime;
  state: FrameState;
  group: Group;
  camera: PerspectiveCamera;
  width: number;
  height: number;
  fit: Fit;
  look: GlobeLook;
  settings: TierSettings;
  isStatic: boolean;
  time: number;
  dt: number;
}

function addRipple({ rig, state, settings, isStatic }: FrameContext, direction: Vector3, time: number): void {
  if (!settings.ripples || isStatic) return;
  rig.shared.uRipples.value[state.rippleIndex].set(direction.x, direction.y, direction.z, time);
  state.rippleIndex = (state.rippleIndex + 1) % RIPPLE_COUNT;
}

/** Pose: story + drag + a slow sway; the entrance rises and rolls in. Returns the eased entrance. */
function placeGlobe(ctx: FrameContext): number {
  const { runtime, state: s, group, fit, isStatic, time, dt } = ctx;
  s.p = isStatic ? runtime.target : damp(s.p, runtime.target, 5, dt);
  s.enter = isStatic ? 1 : damp(s.enter, runtime.enter, 7, dt);
  if (!isStatic) stepDrag(runtime.drag, dt, performance.now(), s.p >= SPIN_FROM);

  const enter = easeOutCubic(s.enter);
  const pose = storyPose(s.p);
  const swayYaw = isStatic ? 0 : 0.05 * Math.sin(time * 0.21);
  const swayPitch = isStatic ? 0 : 0.025 * Math.sin(time * 0.17 + 1.3);
  const pitch = Math.max(-1.25, Math.min(1.25, pose.pitch + runtime.drag.pitch + swayPitch));
  group.rotation.set(pitch, pose.yaw + runtime.drag.yaw + swayYaw - (1 - enter) * 0.8, 0);
  group.position.set(fit.x, fit.y - (1 - enter) * RISE * ctx.height * fit.unitsPerPx, 0);
  const scale = fit.scale * (0.84 + 0.16 * enter);
  group.scale.setScalar(scale);
  group.updateMatrixWorld();
  ctx.rig.shared.uTime.value = time;
  ctx.rig.haloMaterial.uniforms.uRadius.value = scale;
  return enter;
}

/** Arcs draw with the story; once landed, comets fly them and each arrival ripples the dots. */
function flyArcs(ctx: FrameContext): number {
  const { rig, state: s, settings, isStatic, time } = ctx;
  let readoutArc = -1;
  const comets = rig.cometPositions.array as Float32Array;
  const cometAlpha = rig.cometAlpha.array as Float32Array;
  const pulses = isStatic ? 0 : settings.pulses;
  rig.arcs.forEach((arc, i) => {
    const draw = arcDraw(i, s.p);
    arc.material.uniforms.uDraw.value = draw;
    if (arc.lastDraw < 0.999 && draw >= 0.999) addRipple(ctx, arc.destination, time);
    arc.lastDraw = draw;

    const base = i * rig.perArc;
    for (let k = 0; k < MAX_PULSES; k++) {
      const slot = base + k;
      if (k >= pulses || draw < 0.999) {
        cometAlpha[slot] = 0;
        continue;
      }
      const phase = (((time / PULSE_SECONDS + arc.material.uniforms.uOffset.value + k / pulses) % 1) + 1) % 1;
      if (k === 0) {
        if (phase < arc.lastPhase) addRipple(ctx, arc.destination, time);
        arc.lastPhase = phase;
      }
      arc.curve.getPointAt(phase, scratch);
      scratch.toArray(comets, slot * 3);
      cometAlpha[slot] = smoothstep(0, 0.06, phase) * smoothstep(1, 0.94, phase);
    }
    const headSlot = base + MAX_PULSES;
    const isDrawing = draw > 0.001 && draw < 0.999;
    if (isDrawing) {
      arc.curve.getPointAt(draw, scratch);
      scratch.toArray(comets, headSlot * 3);
      if (draw > 0.02 && carriesReadout(i)) readoutArc = i;
    }
    cometAlpha[headSlot] = isDrawing ? 1 : 0;
  });
  rig.cometPositions.needsUpdate = true;
  rig.cometAlpha.needsUpdate = true;
  return readoutArc;
}

/** The km counter rides the head of the region's longest flight while it draws. */
function placeReadout(ctx: FrameContext, readoutArc: number): void {
  const { rig, runtime, group, camera, width, fit } = ctx;
  if (readoutArc < 0 || ctx.isStatic) {
    writeReadout(runtime.readout, 0, 0, null, width);
    return;
  }
  const arc = rig.arcs[readoutArc];
  const draw = arc.lastDraw;
  arc.curve.getPointAt(draw, scratch).applyMatrix4(group.matrixWorld);
  group.getWorldPosition(scratchCenter);
  camera.getWorldPosition(scratchCam);
  scratchNormal.copy(scratch).sub(scratchCenter).normalize();
  const facing = scratchNormal.dot(scratchView.copy(scratchCam).sub(scratch).normalize());
  scratch.project(camera);
  const x = (scratch.x * 0.5 + 0.5) * width;
  const y = (0.5 - scratch.y * 0.5) * ctx.height;
  scratchView.copy(scratchCenter).project(camera);
  const cx = (scratchView.x * 0.5 + 0.5) * width;
  const cy = (0.5 - scratchView.y * 0.5) * ctx.height;
  // Behind the planet: only where the head is both turned away and inside the silhouette.
  const isHidden = facing < 0 && Math.hypot(x - cx, y - cy) < fit.radiusPx;
  writeReadout(runtime.readout, x, y, isHidden ? null : DESTINATION_KM[readoutArc] * draw, width);
}

/** Countries light up once an arc lands there; home is always lit. */
function lightCountries({ rig, state: s, isStatic, dt }: FrameContext): void {
  const targets = s.litTargets.fill(0);
  targets[TAG_INDEX.uz] = 1;
  rig.arcs.forEach((arc, i) => {
    if (arc.lastDraw >= 0.999) targets[TAG_INDEX[DESTINATIONS[i].tag]] = 1;
  });
  const lit = rig.shared.uLit.value;
  for (let t = 0; t < TAG_COUNT; t++) {
    s.lit[t] = isStatic ? targets[t] : damp(s.lit[t], targets[t], 3.2, dt);
    lit[t] = s.lit[t];
  }
}

/** Pin dots, rings and the DOM labels (projected to the stage, faded at the limb). */
function placePins(ctx: FrameContext, enter: number): void {
  const { rig, runtime, state: s, group, camera, look, width, height } = ctx;
  const pinAlpha = rig.pinAlpha.array as Float32Array;
  group.getWorldPosition(scratchCenter);
  camera.getWorldPosition(scratchCam);
  const labelFade = smoothstep(0.6, 1, enter);
  ALL_PINS.forEach((_, index) => {
    const shown = pinShown(index, s.p);
    pinAlpha[index] = shown;
    rig.rings[index].material.uniforms.uAlpha.value = shown * look.ringAlpha;

    scratch.copy(rig.pinVectors[index]).multiplyScalar(LABEL_LIFT).applyMatrix4(group.matrixWorld);
    scratchNormal.copy(scratch).sub(scratchCenter).normalize();
    const facing = scratchNormal.dot(scratchView.copy(scratchCam).sub(scratch).normalize());
    scratch.project(camera);
    const x = (scratch.x * 0.5 + 0.5) * width;
    const y = (0.5 - scratch.y * 0.5) * height;
    writeLabel(runtime.labels[index], x, y, labelShown(index, s.p) * facingVisibility(facing) * labelFade, width);
  });
  rig.pinAlpha.needsUpdate = true;
}

/** Keeps the day/night terminator on the real sun. */
function trackSun({ rig, state }: FrameContext): void {
  const now = Date.now();
  if (now - state.sunAt < SUN_REFRESH_MS) return;
  state.sunAt = now;
  const [x, y, z] = sunDirection(new Date(now));
  rig.shared.uSun.value.set(x, y, z);
}

function stepScene(ctx: FrameContext): void {
  trackSun(ctx);
  const enter = placeGlobe(ctx);
  // The copy follows the globe as drawn, not the scroll position.
  setBeat(ctx.runtime, beatShownAt(ctx.state.p));
  const readoutArc = flyArcs(ctx);
  lightCountries(ctx);
  placePins(ctx, enter);
  placeReadout(ctx, readoutArc);
}

const SETTLED = 1e-3;

/** Nothing left to animate but the ambient loop: scroll, entrance, drag, draw-on and lights are at rest. */
function isSettled({ runtime, state: s, rig }: FrameContext): boolean {
  const drag = runtime.drag;
  if (Math.abs(s.p - runtime.target) > SETTLED * 0.2 || Math.abs(s.enter - runtime.enter) > SETTLED) return false;
  if (drag.isActive || Math.abs(drag.pitch) > SETTLED || Math.abs(drag.velPitch) > SETTLED) return false;
  const isSpinning = s.p >= SPIN_FROM;
  if (isSpinning ? Math.abs(drag.velYaw - SPIN_SPEED) > 0.01 : Math.abs(drag.velYaw) > SETTLED) return false;
  if (!isSpinning && Math.abs(drag.yaw - nearestTurn(drag.yaw)) > SETTLED) return false;
  if (rig.arcs.some(arc => arc.lastDraw > 0.001 && arc.lastDraw < 0.999)) return false;
  return s.lit.every((value, index) => Math.abs(value - s.litTargets[index]) < 0.01);
}

/** Input that must be answered this frame even while idling (settled frames snap p/enter onto their targets). */
function hasInput(runtime: GlobeRuntime, s: FrameState): boolean {
  return runtime.drag.isActive || s.p !== runtime.target || s.enter !== runtime.enter;
}

function watchRuntime(runtime: GlobeRuntime, request: () => void): () => void {
  runtime.listeners.add(request);
  return () => {
    runtime.listeners.delete(request);
  };
}

/**
 * 15 · Globe scene: dotted Earth (land on a Fibonacci lattice), a body with
 * a rim, an atmosphere shell, a graticule, arcs from Tashkent with travelling
 * comets, landing ripples that run through the dots, and the market's
 * country lighting up when its arc lands. DOM labels are positioned here.
 */
export default function GlobeScene({ runtime, look, tier, isStatic }: GlobeSceneProps) {
  const size = useThree(state => state.size);
  const dpr = useThree(state => state.viewport.dpr);
  const camera = useThree(state => state.camera) as PerspectiveCamera;
  const invalidate = useThree(state => state.invalidate);
  const groupRef = useRef<Group>(null);
  const fit = useMemo(() => fitGlobe(size.width, size.height), [size.width, size.height]);
  // Rebuild tubes only when the globe size changes noticeably (they are sized in px).
  const radiusBucket = Math.max(80, Math.round(fit.radiusPx / 40) * 40);
  const rig = useGlobeRig(tier, radiusBucket);
  const frameState = useRef<FrameState>({
    p: runtime.target,
    enter: runtime.enter,
    rippleIndex: 0,
    lit: new Array<number>(TAG_COUNT).fill(0),
    litTargets: new Array<number>(TAG_COUNT).fill(0),
    lastStep: -1,
    sunAt: 0,
    isIdle: false,
  });
  const settings = TIER[tier];

  useEffect(() => rig.dispose, [rig]);

  useEffect(() => {
    applyLook(rig, look);
    invalidate();
  }, [rig, look, invalidate]);

  useEffect(() => {
    applySizes(rig, fit.radiusPx, dpr, isStatic, settings);
    invalidate();
  }, [rig, fit, dpr, isStatic, settings, invalidate]);

  useEffect(() => watchRuntime(runtime, () => invalidate()), [runtime, invalidate]);

  // While the scene renders it owns the copy beat (see stepScene).
  useEffect(() => {
    setSceneLive(runtime, true);
    return () => {
      setSceneLive(runtime, false);
      writeReadout(runtime.readout, 0, 0, null, 0);
    };
  }, [runtime]);

  // Priority 1: this callback renders, so idle frames can be skipped outright.
  useFrame((frame, rawDelta) => {
    const group = groupRef.current;
    if (!group) return;
    const state = frameState.current;
    const now = frame.clock.elapsedTime;
    const sinceStep = state.lastStep < 0 ? rawDelta : now - state.lastStep;
    if (!isStatic && state.isIdle && sinceStep < 1 / IDLE_FPS - 0.004 && !hasInput(runtime, state)) return;
    state.lastStep = now;
    const ctx: FrameContext = {
      rig,
      runtime,
      state,
      group,
      camera,
      width: size.width,
      height: size.height,
      fit,
      look,
      settings,
      isStatic,
      time: isStatic ? 0.6 : now,
      dt: Math.min(sinceStep, MAX_DT),
    };
    stepScene(ctx);
    state.isIdle = !isStatic && isSettled(ctx);
    if (state.isIdle) {
      state.p = runtime.target;
      state.enter = runtime.enter;
    }
    frame.gl.render(frame.scene, frame.camera);
  }, 1);

  return (
    <group ref={groupRef}>
      <points geometry={rig.dotGeometry} material={rig.backDots} renderOrder={1} frustumCulled={false} />
      <mesh geometry={rig.bodyGeometry} material={rig.bodyMaterial} renderOrder={2} />
      <lineSegments geometry={rig.gridGeometry} material={rig.gridMaterial} renderOrder={3} />
      <mesh geometry={rig.haloGeometry} material={rig.haloMaterial} renderOrder={4} />
      <points geometry={rig.dotGeometry} material={rig.frontDots} renderOrder={5} frustumCulled={false} />
      {rig.rings.map((ring, index) => (
        <mesh
          key={ALL_PINS[index].id}
          geometry={rig.ringGeometry}
          material={ring.material}
          position={ring.position}
          quaternion={ring.quaternion}
          scale={ring.scale}
          renderOrder={6}
        />
      ))}
      {rig.arcs.map((arc, index) => (
        <mesh key={DESTINATIONS[index].id} geometry={arc.geometry} material={arc.material} renderOrder={7} />
      ))}
      <points geometry={rig.pinGeometry} material={rig.pinMaterial} renderOrder={8} frustumCulled={false} />
      <points geometry={rig.cometGeometry} material={rig.cometMaterial} renderOrder={9} frustumCulled={false} />
    </group>
  );
}
