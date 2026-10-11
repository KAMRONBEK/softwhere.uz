'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Device tilt → gravity for the stack pile. Off until the visitor taps
 * "Tilt" (iOS only grants motion sensors from a user gesture), then streams
 * the screen-space gravity vector and fires `onShake` on a hard shake.
 * `turnOff()` removes the sensor listeners (the section calls it when it
 * scrolls away, so a phone in a pocket never keeps the engine awake).
 */

export type TiltState = 'off' | 'on' | 'blocked';

interface TiltHandlers {
  onGravity: (x: number, y: number) => void;
  onShake: () => void;
}

interface PermissionGate {
  requestPermission?: () => Promise<PermissionState | 'granted' | 'denied'>;
}

const DEG = Math.PI / 180;
const SMOOTHING = 0.22;
const SIDEWAYS_GAIN = 1.6;
const SENSOR_TIMEOUT_MS = 1800;
const SHAKE_ACCELERATION = 17; // m/s², gravity excluded
const SHAKE_COOLDOWN_MS = 900;

/**
 * Screen-space gravity (x right, y down, |g| ≤ 1) from W3C device angles.
 * World gravity rotated into the device frame by R = Rz(α)·Rx(β)·Ry(γ)
 * gives (cosβ·sinγ, sinβ) on the screen plane, then the screen's own
 * rotation (landscape) is undone.
 */
export function gravityFromOrientation(beta: number, gamma: number, screenAngle: number): { x: number; y: number } {
  const x = Math.cos(beta * DEG) * Math.sin(gamma * DEG);
  const y = Math.sin(beta * DEG);
  const a = screenAngle * DEG;
  const screenX = x * Math.cos(a) + y * Math.sin(a);
  const screenY = -x * Math.sin(a) + y * Math.cos(a);
  // Phones are held at a reading angle, which mutes sideways tilt; boost it a little.
  return { x: Math.max(-1, Math.min(1, screenX * SIDEWAYS_GAIN)), y: screenY };
}

function screenAngle(): number {
  return window.screen.orientation?.angle ?? 0;
}

async function requestSensors(): Promise<boolean> {
  const orientation = window.DeviceOrientationEvent as unknown as PermissionGate | undefined;
  const motion = window.DeviceMotionEvent as unknown as PermissionGate | undefined;
  // Both requests start inside the tap's activation window, before any await.
  const [orientationResult] = await Promise.allSettled([
    orientation?.requestPermission?.() ?? Promise.resolve('granted' as const),
    motion?.requestPermission?.() ?? Promise.resolve('granted' as const),
  ]);
  return orientationResult.status === 'fulfilled' && orientationResult.value === 'granted';
}

export function useTilt({ onGravity, onShake }: TiltHandlers): {
  state: TiltState;
  isSupported: boolean;
  toggle: () => void;
  turnOff: () => void;
} {
  const [state, setState] = useState<TiltState>('off');
  const [isSupported] = useState(() => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window);
  const handlers = useRef<TiltHandlers>({ onGravity, onShake });
  useEffect(() => {
    handlers.current = { onGravity, onShake };
  }, [onGravity, onShake]);

  useEffect(() => {
    if (state !== 'on') return;
    const gravity = { x: 0, y: 1 };
    let hasSignal = false;
    let lastShake = -Infinity;

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      hasSignal = true;
      const target = gravityFromOrientation(event.beta, event.gamma, screenAngle());
      gravity.x += (target.x - gravity.x) * SMOOTHING;
      gravity.y += (target.y - gravity.y) * SMOOTHING;
      handlers.current.onGravity(gravity.x, gravity.y);
    };
    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.acceleration;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      const now = performance.now();
      if (Math.hypot(a.x, a.y, a.z) < SHAKE_ACCELERATION || now - lastShake < SHAKE_COOLDOWN_MS) return;
      lastShake = now;
      handlers.current.onShake();
    };
    const watchdog = window.setTimeout(() => {
      if (!hasSignal) setState('blocked');
    }, SENSOR_TIMEOUT_MS);

    window.addEventListener('deviceorientation', onOrientation);
    window.addEventListener('devicemotion', onMotion);
    return () => {
      window.clearTimeout(watchdog);
      window.removeEventListener('deviceorientation', onOrientation);
      window.removeEventListener('devicemotion', onMotion);
      handlers.current.onGravity(0, 1);
    };
  }, [state]);

  const toggle = useCallback(() => {
    if (state === 'on') {
      setState('off');
      return;
    }
    requestSensors()
      .then(isGranted => setState(isGranted ? 'on' : 'blocked'))
      .catch(() => setState('blocked'));
  }, [state]);

  const turnOff = useCallback(() => setState(previous => (previous === 'on' ? 'off' : previous)), []);

  return { state, isSupported, toggle, turnOff };
}
