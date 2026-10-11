'use client';

import { useFrame } from '@react-three/fiber';
import { forwardRef, useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  type Group,
} from 'three';
import type { LabTheme } from '../../theme/useLabTheme';
import type { DeviceTier } from '../../types';
import { LAPTOP_SITE } from './data';
import { roundedPlaneGeometry, slabGeometry } from './geometry';
import { bindScreen, createScreenMaterial, setChrome, type ScreenMaterial } from './screenMaterial';
import { lerp, smooth, type DevicesRuntime } from './story';
import { createChromeTexture, mixHex, type ScreenLibrary } from './textures';

/** A generic thin laptop (no notch, no logo), base centred on the origin. */
export const LAPTOP = { width: 3, depth: 2, thickness: 0.07, lidHeight: 1.96, lidDepth: 0.032 } as const;

const SCREEN = { width: LAPTOP.width - 0.14, height: LAPTOP.lidHeight - 0.2, radius: 0.035 };
const SCREEN_Y = 0.13 + SCREEN.height / 2;
const TOP = LAPTOP.thickness / 2;
const HINGE = { y: TOP + LAPTOP.lidDepth / 2 + 0.004, z: -LAPTOP.depth / 2 + 0.02 };
const LID_CLOSED = Math.PI / 2 - 0.004;
const LID_OPEN = -0.3;
const SEGMENTS: Record<DeviceTier, number> = { high: 10, mid: 6, low: 4 };

/** Browser bar height as a share of the display. */
const CHROME_SHARE = 0.052;
/** Width / height of the page area under the browser bar. */
const CONTENT_ASPECT = SCREEN.width / (SCREEN.height * (1 - CHROME_SHARE));
/** Visible share of the site capture's height (the display window). */
const WINDOW = LAPTOP_SITE.width / LAPTOP_SITE.height / CONTENT_ASPECT;
const MAX_SCROLL = 1 - WINDOW;

/**
 * Someone reading the page: rest at the top, scroll to the next section,
 * rest, scroll further, then jump back up. Stops in fractions of MAX_SCROLL.
 */
const SCROLL_STOPS = [0, 0.48, 1, 0];
const SCROLL_HOLD = 2.4;
const SCROLL_MOVE = 1.6;

function siteScroll(time: number): number {
  const leg = SCROLL_HOLD + SCROLL_MOVE;
  const period = leg * (SCROLL_STOPS.length - 1);
  const t = time % period;
  const index = Math.floor(t / leg);
  const local = Math.max(0, t - index * leg - SCROLL_HOLD) / SCROLL_MOVE;
  const eased = local < 0.5 ? 4 * local ** 3 : 1 - (-2 * local + 2) ** 3 / 2;
  return lerp(SCROLL_STOPS[index], SCROLL_STOPS[index + 1], eased) * MAX_SCROLL;
}

interface KeyRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Key layout: 5 rows of 13 + a bottom row with a long space bar. */
function keyLayout(): KeyRect[] {
  const keys: KeyRect[] = [];
  const pitch = 0.2;
  const size = 0.168;
  const left = -(13 * pitch) / 2 + pitch / 2;
  for (let row = 0; row < 5; row++) {
    const z = -0.86 + row * pitch;
    const depth = row === 0 ? size * 0.6 : size;
    for (let col = 0; col < 13; col++) keys.push({ x: left + col * pitch, z, w: size, d: depth });
  }
  const z = -0.86 + 5 * pitch;
  const small = [0, 1, 2, 3, 9, 10, 11, 12];
  small.forEach(col => keys.push({ x: left + col * pitch, z, w: size, d: size }));
  keys.push({ x: left + 6 * pitch, z, w: pitch * 4 + size, d: size });
  return keys;
}

const KEYS = keyLayout();

function createLaptopMaterials() {
  const screen = createScreenMaterial({ ...SCREEN });
  screen.uniforms.uWindow.value.set(0, WINDOW);
  screen.uniforms.uChromeH.value = CHROME_SHARE;
  return {
    shell: new MeshStandardMaterial({ metalness: 1, roughness: 0.28, envMapIntensity: 1.2 }),
    shellCap: new MeshStandardMaterial({ metalness: 0.92, roughness: 0.34 }),
    ink: new MeshStandardMaterial({ color: '#050507', roughness: 0.2, metalness: 0.3 }),
    well: new MeshStandardMaterial({ roughness: 0.6, metalness: 0.4 }),
    key: new MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 }),
    trackpad: new MeshStandardMaterial({ roughness: 0.2, metalness: 0.6 }),
    lens: new MeshStandardMaterial({ color: '#0b0d12', roughness: 0.05, metalness: 0.8 }),
    screen,
  };
}

type LaptopMaterials = ReturnType<typeof createLaptopMaterials>;

function applyLaptopTheme(materials: LaptopMaterials, theme: LabTheme): void {
  const { colors, scheme } = theme;
  const metal = scheme === 'dark' ? mixHex(colors.muted, colors.fg, 0.2) : mixHex(colors.muted, colors.bg2, 0.4);
  materials.shell.color.set(metal);
  materials.shellCap.color.set(metal);
  materials.well.color.set(mixHex(metal, '#000000', 0.4));
  materials.key.color.set(mixHex(metal, '#000000', 0.84));
  materials.trackpad.color.set(mixHex(metal, '#ffffff', 0.08));
}

/** Per frame: the lid opens and the display powers on as the section scrolls in; the page scrolls. */
function updateLaptop(lid: Group | null, screen: ScreenMaterial, boot: number, time: number): void {
  if (lid) lid.rotation.x = lerp(LID_CLOSED, LID_OPEN, smooth(boot * 1.25));
  const uniforms = screen.uniforms;
  uniforms.uPower.value = smooth((boot - 0.55) * 2.6);
  uniforms.uWindow.value.x = siteScroll(time);
  uniforms.uSheen.value = Math.sin(time * 0.15) * 0.4 - 0.2;
}

interface LaptopProps {
  runtime: DevicesRuntime;
  library: ScreenLibrary;
  theme: LabTheme;
  tier: DeviceTier;
  reducedMotion: boolean;
}

export const Laptop = forwardRef<Group, LaptopProps>(function Laptop({ runtime, library, theme, tier, reducedMotion }, ref) {
  const lidRef = useRef<Group>(null);
  const keysRef = useRef<InstancedMesh>(null);
  const segments = SEGMENTS[tier];

  const geometries = useMemo(
    () => ({
      base: slabGeometry({ width: LAPTOP.width, height: LAPTOP.depth, depth: LAPTOP.thickness, radius: 0.13, bevel: 0.022, segments }),
      lid: slabGeometry({ width: LAPTOP.width, height: LAPTOP.lidHeight, depth: LAPTOP.lidDepth, radius: 0.1, bevel: 0.012, segments }),
      bezel: roundedPlaneGeometry(LAPTOP.width - 0.03, LAPTOP.lidHeight - 0.03, 0.09, segments),
      screen: new PlaneGeometry(SCREEN.width, SCREEN.height),
      well: roundedPlaneGeometry(2.72, 1.24, 0.05, 4),
      trackpad: roundedPlaneGeometry(1.15, 0.62, 0.06, 6),
      key: new BoxGeometry(1, 1, 1),
      hinge: new CylinderGeometry(0.03, 0.03, LAPTOP.width - 0.5, 16),
      lens: new CircleGeometry(0.011, 16),
    }),
    [segments]
  );

  const materials = useMemo(() => createLaptopMaterials(), []);

  useEffect(() => {
    applyLaptopTheme(materials, theme);
    runtime.notify();
  }, [materials, theme, runtime]);

  // Browser bar, painted in the style's body face (repainted once the face has loaded).
  useEffect(() => {
    const font = theme.fontFamily.body;
    const aspect = SCREEN.width / (SCREEN.height * CHROME_SHARE);
    let chrome = createChromeTexture(LAPTOP_SITE.url, LAPTOP_SITE.fill, font, aspect);
    setChrome(materials.screen, chrome);
    let isCurrent = true;
    document.fonts
      ?.load(`500 24px ${font}`)
      .then(() => {
        if (!isCurrent) return;
        chrome.dispose();
        chrome = createChromeTexture(LAPTOP_SITE.url, LAPTOP_SITE.fill, font, aspect);
        setChrome(materials.screen, chrome);
        runtime.notify();
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
      chrome.dispose();
    };
  }, [materials, theme.fontFamily.body, runtime]);

  useEffect(() => {
    const mesh = keysRef.current;
    if (!mesh) return;
    const dummy = new Object3D();
    KEYS.forEach((key, i) => {
      dummy.position.set(key.x, TOP + 0.009, key.z);
      dummy.scale.set(key.w, 0.014, key.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);

  useEffect(
    () => () => {
      Object.values(geometries).forEach(geometry => geometry.dispose());
      Object.values(materials).forEach(material => material.dispose());
    },
    [geometries, materials]
  );

  useFrame(() => {
    bindScreen(materials.screen, 'A', library.get(LAPTOP_SITE.src), LAPTOP_SITE.fill);
    // The runtime's clock (it pauses while the scene sleeps, so the page never jumps on wake-up).
    updateLaptop(lidRef.current, materials.screen, runtime.story.boot, reducedMotion ? 0 : runtime.time);
  });

  return (
    <group ref={ref}>
      <mesh geometry={geometries.base} material={[materials.shellCap, materials.shell]} rotation-x={-Math.PI / 2} />
      <mesh geometry={geometries.well} material={materials.well} position={[0, TOP + 0.0006, -0.36]} rotation-x={-Math.PI / 2} />
      <instancedMesh ref={keysRef} args={[geometries.key, materials.key, KEYS.length]} />
      <mesh geometry={geometries.trackpad} material={materials.trackpad} position={[0, TOP + 0.0006, 0.6]} rotation-x={-Math.PI / 2} />
      <mesh geometry={geometries.hinge} material={materials.shell} position={[0, HINGE.y - 0.012, HINGE.z]} rotation-z={Math.PI / 2} />
      <group ref={lidRef} position={[0, HINGE.y, HINGE.z]} rotation-x={LID_CLOSED}>
        <group position-y={LAPTOP.lidHeight / 2}>
          <mesh geometry={geometries.lid} material={[materials.shellCap, materials.shell]} />
          <mesh geometry={geometries.bezel} material={materials.ink} position-z={LAPTOP.lidDepth / 2 + 0.0006} />
        </group>
        <mesh geometry={geometries.screen} material={materials.screen} position={[0, SCREEN_Y, LAPTOP.lidDepth / 2 + 0.0014]} />
        <mesh geometry={geometries.lens} material={materials.lens} position={[0, LAPTOP.lidHeight - 0.035, LAPTOP.lidDepth / 2 + 0.0012]} />
      </group>
    </group>
  );
});
