'use client';

import { useFrame } from '@react-three/fiber';
import { forwardRef, useEffect, useMemo, useState, type RefObject } from 'react';
import {
  CircleGeometry,
  RingGeometry,
  CustomBlending,
  CylinderGeometry,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OneFactor,
  PlaneGeometry,
  Vector2,
  ZeroFactor,
  type Group,
} from 'three';
import type { LabTheme } from '../../theme/useLabTheme';
import type { DeviceTier } from '../../types';
import { DEVICE_APPS, SCREENS_PER_APP } from './data';
import { roundedPlaneGeometry, roundedRingGeometry, slabGeometry } from './geometry';
import { bindScreen, createScreenMaterial, type ScreenMaterial } from './screenMaterial';
import { currentApp, screenState, smooth, type DevicesRuntime, type Story } from './story';
import { createBackSurface, markImageFromSvg, mixHex, type ScreenLibrary } from './textures';

/** A generic modern slab phone (punch-hole display, pill camera), in world units. */
export const PHONE = { width: 0.78, height: 1.62, depth: 0.085, radius: 0.12, bevel: 0.022 } as const;

const FACE = {
  width: PHONE.width - PHONE.bevel * 2 + 0.006,
  height: PHONE.height - PHONE.bevel * 2 + 0.006,
  radius: PHONE.radius - PHONE.bevel * 0.7,
};
const BEZEL = 0.014;
export const SCREEN = {
  width: FACE.width - BEZEL * 2,
  height: FACE.height - BEZEL * 2,
  radius: FACE.radius - BEZEL,
};
const FRONT = PHONE.depth / 2;
const Z_SCREEN = FRONT + 0.0016;
const Z_GLASS = FRONT + 0.0026;
const SEGMENTS: Record<DeviceTier, number> = { high: 10, mid: 6, low: 4 };

/** Camera island on the back: a vertical pill, three lenses and a flash beside it. */
const ISLAND = { width: 0.19, height: 0.44, depth: 0.024, x: PHONE.width / 2 - 0.16, y: PHONE.height / 2 - 0.29 };
const LENS_Y = [0.13, 0, -0.13];
const LENS_RADIUS = 0.05;
const BUMP_SCALE = 2.4;

function createPhoneMaterials(tier: DeviceTier, back: ReturnType<typeof createBackSurface>) {
  const isHigh = tier === 'high';
  const Surface = isHigh ? MeshPhysicalMaterial : MeshStandardMaterial;
  // Frosted glass back with a polished, debossed logo (bump + roughness from one map).
  const backMaterial = new Surface({
    roughness: 1,
    metalness: 0.18,
    roughnessMap: back.texture,
    bumpMap: back.texture,
    bumpScale: BUMP_SCALE,
    envMapIntensity: 1.15,
    // The chassis cap sits under the display stack: push it back so they never z-fight.
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  const lensGlass = isHigh
    ? new MeshPhysicalMaterial({
        color: '#05060a',
        roughness: 0.04,
        metalness: 0.2,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        iridescence: 0.7,
        iridescenceIOR: 1.6,
        iridescenceThicknessRange: [180, 420],
      })
    : new MeshStandardMaterial({ color: '#05060a', roughness: 0.05, metalness: 0.6 });
  const screen = createScreenMaterial({ ...SCREEN, hole: 0.019, holeY: SCREEN.height / 2 - 0.05 });
  return {
    back: backMaterial,
    island: new Surface({ roughness: 0.22, metalness: 0.35, envMapIntensity: 1.2 }),
    metal: new MeshStandardMaterial({ metalness: 1, roughness: 0.2, envMapIntensity: 1.3 }),
    ring: new MeshStandardMaterial({ metalness: 1, roughness: 0.14 }),
    lensGlass,
    lensCore: new MeshStandardMaterial({ color: '#000000', roughness: 0.02, metalness: 0.9 }),
    // Painted catch-light and iris: the lenses read as glass even where the environment is dark.
    glint: new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false }),
    iris: new MeshStandardMaterial({ color: '#3a4152', roughness: 0.25, metalness: 0.9 }),
    screen,
    ink: new MeshStandardMaterial({ color: '#050507', roughness: 0.18, metalness: 0.4 }),
    // Pure reflections added over the display: glass glare without dimming it. Alpha is
    // left untouched so the glass never turns the transparent canvas black.
    glare: new MeshStandardMaterial({
      color: '#ffffff',
      metalness: 1,
      roughness: 0.12,
      transparent: true,
      depthWrite: false,
      envMapIntensity: 0.07,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneFactor,
      blendSrcAlpha: ZeroFactor,
      blendDstAlpha: OneFactor,
    }),
    flash: new MeshBasicMaterial({ color: '#f4efe2', toneMapped: false }),
  };
}

type PhoneMaterials = ReturnType<typeof createPhoneMaterials>;

/**
 * Chassis colours from the style, never a flat grey: on dark pages an
 * anodised tint of the accent; on light pages a deep accent-tinted finish
 * (a dark phone on a pale table reads as the premium object).
 */
function phonePalette(theme: LabTheme) {
  const { colors, scheme } = theme;
  const isDark = scheme === 'dark';
  const back = isDark ? mixHex(mixHex(colors.bg2, colors.accent, 0.22), colors.fg, 0.06) : mixHex(colors.fg, colors.accent, 0.3);
  return {
    back,
    island: isDark ? mixHex(colors.bg2, colors.accent, 0.12) : mixHex(back, colors.fg, 0.35),
    metal: isDark ? mixHex(colors.muted, colors.fg, 0.25) : mixHex(colors.muted, colors.bg2, 0.25),
    ring: mixHex(colors.muted, colors.fg, 0.4),
  };
}

function applyPhoneTheme(materials: PhoneMaterials, theme: LabTheme): void {
  const palette = phonePalette(theme);
  materials.back.color.set(palette.back);
  materials.island.color.set(palette.island);
  materials.metal.color.set(palette.metal);
  materials.ring.color.set(palette.ring);
}

const TAP = new Vector2();

/** Per frame: which screens are on the display, the change between them, the tap, the glare. */
function updateDisplay(material: ScreenMaterial, story: Story, library: ScreenLibrary): void {
  const index = currentApp(story, DEVICE_APPS.length);
  const app = DEVICE_APPS[index];
  if (!app) return;
  const { from, to, mix } = screenState(story, index, SCREENS_PER_APP);
  const leaving = app.screens[from];
  const arriving = app.screens[to];
  bindScreen(material, 'A', library.get(leaving.src), app.fill);
  bindScreen(material, 'B', library.get(arriving.src), app.fill);
  const uniforms = material.uniforms;
  uniforms.uMix.value = mix;
  uniforms.uPush.value = app.transition === 'push' ? 1 : 0;
  TAP.set(leaving.tap[0], leaving.tap[1]);
  // The tap belongs to the screen being left; hide it on the last screen of an app.
  const tap = from < SCREENS_PER_APP - 1 ? story.tap : 0;
  uniforms.uTap.value.set(TAP.x, TAP.y, tap);
  uniforms.uPower.value = smooth(story.boot * 1.4 - 0.2);
  const spinPhase = story.app - Math.floor(story.app);
  uniforms.uSheen.value = (spinPhase - 0.5) * 3 + (1 - story.face) * 0.9;
}

interface PhoneProps {
  runtime: DevicesRuntime;
  library: ScreenLibrary;
  theme: LabTheme;
  tier: DeviceTier;
  /** Hidden DOM host of the panel's logo mark (debossed on the back), and the logo id to repaint on. */
  markHost: RefObject<HTMLElement | null>;
  logoId: number;
}

export const Phone = forwardRef<Group, PhoneProps>(function Phone({ runtime, library, theme, tier, markHost, logoId }, ref) {
  const segments = SEGMENTS[tier];

  const geometries = useMemo(
    () => ({
      body: slabGeometry({ ...PHONE, segments }),
      face: roundedPlaneGeometry(FACE.width, FACE.height, FACE.radius, segments),
      ring: roundedRingGeometry(FACE.width, FACE.height, FACE.radius, BEZEL, segments),
      screen: new PlaneGeometry(SCREEN.width, SCREEN.height),
      island: slabGeometry({ ...ISLAND, radius: ISLAND.width / 2, bevel: 0.009, segments: Math.max(6, segments) }),
      lensRing: new CylinderGeometry(LENS_RADIUS, LENS_RADIUS * 1.04, 0.022, 32),
      lensGlass: new CircleGeometry(LENS_RADIUS * 0.8, 32),
      lensCore: new CircleGeometry(LENS_RADIUS * 0.34, 24),
      lensIris: new RingGeometry(LENS_RADIUS * 0.4, LENS_RADIUS * 0.52, 32),
      glint: new CircleGeometry(LENS_RADIUS * 0.11, 12),
      flash: new CircleGeometry(0.017, 16),
      mic: new CircleGeometry(0.006, 10),
      button: slabGeometry({ width: 0.016, height: 0.2, depth: 0.03, radius: 0.007, bevel: 0.004, segments: 3 }),
      buttonShort: slabGeometry({ width: 0.016, height: 0.11, depth: 0.03, radius: 0.007, bevel: 0.004, segments: 3 }),
    }),
    [segments]
  );

  const [backSurface] = useState(createBackSurface);
  const materials = useMemo(() => createPhoneMaterials(tier, backSurface), [tier, backSurface]);

  useEffect(() => {
    applyPhoneTheme(materials, theme);
    runtime.notify();
  }, [materials, theme, runtime]);

  // The logo picked in the panel, debossed into the back.
  useEffect(() => {
    const svg = markHost.current?.querySelector('svg');
    if (!svg) {
      backSurface.paint(null);
      return;
    }
    return markImageFromSvg(new XMLSerializer().serializeToString(svg), image => {
      backSurface.paint(image);
      runtime.notify();
    });
  }, [markHost, logoId, backSurface, runtime]);

  useEffect(
    () => () => {
      Object.values(geometries).forEach(geometry => geometry.dispose());
      Object.values(materials).forEach(material => material.dispose());
    },
    [geometries, materials]
  );

  useEffect(() => () => backSurface.texture.dispose(), [backSurface]);

  useFrame(() => updateDisplay(materials.screen, runtime.story, library));

  const back = -FRONT;
  return (
    <group ref={ref}>
      {/* Chassis: metal band, frosted back with the logo. */}
      <mesh geometry={geometries.body} material={[materials.back, materials.metal]} />
      <group position={[ISLAND.x, ISLAND.y, back - ISLAND.depth / 2 + 0.003]}>
        <mesh geometry={geometries.island} material={[materials.island, materials.metal]} />
        {LENS_Y.map(y => (
          <group key={y} position={[0, y, -ISLAND.depth / 2 - 0.008]} rotation-x={Math.PI / 2}>
            <mesh geometry={geometries.lensRing} material={materials.ring} />
            <mesh geometry={geometries.lensGlass} material={materials.lensGlass} position-y={-0.0115} rotation-x={Math.PI / 2} />
            <mesh geometry={geometries.lensCore} material={materials.lensCore} position-y={-0.0118} rotation-x={Math.PI / 2} />
            <mesh geometry={geometries.lensIris} material={materials.iris} position-y={-0.0119} rotation-x={Math.PI / 2} />
            <mesh
              geometry={geometries.glint}
              material={materials.glint}
              position={[-LENS_RADIUS * 0.3, -0.0121, -LENS_RADIUS * 0.3]}
              rotation-x={Math.PI / 2}
            />
          </group>
        ))}
      </group>
      <mesh
        geometry={geometries.flash}
        material={materials.flash}
        position={[ISLAND.x - ISLAND.width / 2 - 0.05, ISLAND.y + 0.13, back - 0.0006]}
        rotation-y={Math.PI}
      />
      <mesh
        geometry={geometries.mic}
        material={materials.lensCore}
        position={[ISLAND.x - ISLAND.width / 2 - 0.05, ISLAND.y + 0.04, back - 0.0006]}
        rotation-y={Math.PI}
      />
      <mesh geometry={geometries.button} material={materials.metal} position={[PHONE.width / 2 + 0.004, 0.36, 0]} />
      <mesh geometry={geometries.buttonShort} material={materials.metal} position={[PHONE.width / 2 + 0.004, 0.1, 0]} />

      {/* Front: black print around the display, the display, the cover glass. */}
      <mesh geometry={geometries.ring} material={materials.ink} position-z={Z_GLASS} />
      <mesh geometry={geometries.screen} material={materials.screen} position-z={Z_SCREEN} />
      <mesh geometry={geometries.face} material={materials.glare} position-z={Z_GLASS + 0.0004} renderOrder={2} />
    </group>
  );
});
