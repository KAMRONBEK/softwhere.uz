'use client';

import { useSyncExternalStore } from 'react';
import { useLabState } from '../context/LabContext';
import type { DeviceTier } from '../types';

/**
 * Device tiers:
 * - high: desktop with 8+ cores — every effect at full density, DPR up to 2.
 * - mid:  phones, tablets and mid laptops — every effect (the founder wants the
 *         full show on phones), lighter densities, DPR capped at 1.5.
 * - low:  weak/old hardware, Save-Data, reduced motion, no or software WebGL —
 *         static or CSS-only versions, DPR 1.
 */
export const DPR_CAPS: Record<DeviceTier, [min: number, max: number]> = {
  high: [1, 2],
  mid: [1, 1.5],
  low: [1, 1],
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';
const SOFTWARE_GPU = /swiftshader|llvmpipe|softpipe|software|basic render/i;

type Subscribe = (onChange: () => void) => () => void;
const mediaSubscribers = new Map<string, Subscribe>();

function subscribeTo(query: string): Subscribe {
  const cached = mediaSubscribers.get(query);
  if (cached) return cached;
  const subscribe: Subscribe = onChange => {
    const mql = window.matchMedia(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  };
  mediaSubscribers.set(query, subscribe);
  return subscribe;
}

/** Live media-query match; `serverValue` is used for SSR and hydration. */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    subscribeTo(query),
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}

export function useReducedMotion(): boolean {
  return useMediaQuery(REDUCED_MOTION_QUERY);
}

/** True on touch-first devices (no hover, coarse pointer): phones and tablets. */
export function useIsTouch(): boolean {
  return useMediaQuery(TOUCH_QUERY);
}

export interface HardwareInfo {
  cores: number;
  /** GB, Chromium only (capped at 8); null where the browser hides it. */
  memory: number | null;
  saveData: boolean;
  webgl: boolean;
  softwareGpu: boolean;
}

interface NavigatorHints {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

function probeWebGL(): { webgl: boolean; softwareGpu: boolean } {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return { webgl: false, softwareGpu: false };
    // Chromium masks RENDERER ("WebKit WebGL"); the debug extension unmasks it.
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(debugInfo ? debugInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
    // Free the probe's context slot right away (mobile caps live contexts).
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { webgl: true, softwareGpu: SOFTWARE_GPU.test(renderer) };
  } catch {
    return { webgl: false, softwareGpu: false };
  }
}

let hardware: HardwareInfo | null = null;

function readHardware(): HardwareInfo {
  if (hardware) return hardware;
  const nav = navigator as Navigator & NavigatorHints;
  hardware = {
    cores: nav.hardwareConcurrency || 4,
    memory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    saveData: nav.connection?.saveData === true,
    ...probeWebGL(),
  };
  return hardware;
}

const staticSubscribe: Subscribe = () => () => undefined;

/** Hardware hints, probed once per page; null during SSR and hydration. */
export function useHardware(): HardwareInfo | null {
  return useSyncExternalStore(staticSubscribe, readHardware, () => null);
}

export function detectTier(hw: HardwareInfo, reducedMotion: boolean, isTouch: boolean): DeviceTier {
  if (!hw.webgl || hw.softwareGpu || hw.saveData || reducedMotion) return 'low';
  if (hw.cores < 4 || (hw.memory !== null && hw.memory < 4)) return 'low';
  if (isTouch) return 'mid';
  return hw.cores >= 8 && (hw.memory === null || hw.memory >= 8) ? 'high' : 'mid';
}

/** The tier auto-detection picks, ignoring the panel's Quality override. */
export function useDetectedTier(): DeviceTier {
  const hw = useHardware();
  const reducedMotion = useReducedMotion();
  const isTouch = useIsTouch();
  // 'mid' while hydrating keeps server and first client render identical.
  return hw ? detectTier(hw, reducedMotion, isTouch) : 'mid';
}

/** The tier to render for: the panel's Quality override, else auto-detection. */
export function useDeviceTier(): DeviceTier {
  const { state } = useLabState();
  const detected = useDetectedTier();
  return state.quality === 'auto' ? detected : state.quality;
}

/** Everything a section usually needs about the device, in one call. */
export function useLabDevice(): {
  tier: DeviceTier;
  dpr: [number, number];
  reducedMotion: boolean;
  isTouch: boolean;
  webgl: boolean;
} {
  const tier = useDeviceTier();
  const reducedMotion = useReducedMotion();
  const isTouch = useIsTouch();
  const hw = useHardware();
  return { tier, dpr: DPR_CAPS[tier], reducedMotion, isTouch, webgl: hw?.webgl ?? true };
}
