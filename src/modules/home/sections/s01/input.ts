'use client';

import { useEffect, type RefObject } from 'react';
import { markCenterPixels, markPixels } from './layout';

/**
 * Pointer, touch, tilt and scroll state shared between the hero's DOM layer
 * and its WebGL scene. A plain mutable object (not React state): it changes
 * every pointer event and is read once per frame inside useFrame.
 */
export interface HeroInput {
  /** Pointer in the stage's normalised device coordinates (-1..1, y up). */
  x: number;
  y: number;
  /** A mouse is over the hero or a finger is down. */
  isActive: boolean;
  /** A press being held on the stage (performance.now() at the press); null when nothing is held. */
  hold: { startedAt: number } | null;
  /** Pulses (click/tap releases) waiting to be turned into ripples: NDC and strength (1 = a plain tap). */
  pulses: Array<{ x: number; y: number; strength: number }>;
  /** Device tilt, -1..1 per axis; null until the first reading. */
  tilt: { x: number; y: number } | null;
  /** How far the page has scrolled into the hero, in stage heights (0 at the top). */
  scroll: number;
  /** Stage heights the stage stays sticky for (section height / stage height - 1). */
  sticky: number;
  /** Bumped on every user input (move, drag, tap, tilt): the scene's idle clock resets on change. */
  serial: number;
  /** Set by the scene: asks the (on-demand) render loop for a frame right away. */
  wake: (() => void) | null;
}

export function createHeroInput(): HeroInput {
  return { x: 0, y: 0, isActive: false, hold: null, pulses: [], tilt: null, scroll: 0, sticky: 0, serial: 0, wake: null };
}

/** A press shorter than this is a plain click/tap: no charge, no visible gathering. */
const HOLD_DELAY_S = 0.12;
/** Time constant of the charge: ~85% after one second of holding. */
const CHARGE_TAU_S = 0.45;
/** A fully charged release hits this much harder than a tap. */
const CHARGE_GAIN = 1.6;

/** Charge 0..1 after holding for `heldSeconds` (the scene's gravity well and the release use the same curve). */
export function chargeAt(heldSeconds: number): number {
  return 1 - Math.exp(-Math.max(0, heldSeconds - HOLD_DELAY_S) / CHARGE_TAU_S);
}

/** Seconds the current press has been held (0 when nothing is held). */
export function heldSeconds(state: HeroInput, now = performance.now()): number {
  return state.hold ? Math.max(0, now - state.hold.startedAt) / 1000 : 0;
}

/** A released pulse, in client pixels, for the DOM layer (the headline feels the shockwave). */
export interface HeroPulse {
  clientX: number;
  clientY: number;
  /** 1 for a tap, up to 1 + CHARGE_GAIN for a full charge. */
  strength: number;
}

/** Lets the scene's render loop be woken by input; returns the unbind. */
export function bindWake(state: HeroInput, wake: () => void): () => void {
  state.wake = wake;
  return () => {
    if (state.wake === wake) state.wake = null;
  };
}

/** Records a user input and wakes the render loop if it was throttled. */
function noteInput(state: HeroInput): void {
  state.serial += 1;
  state.wake?.();
}

/** A finger that travels further than this is scrolling or stirring, not pressing. */
const TAP_SLOP_PX = 12;
/** Radius around the mark's centre (in mark widths) where a press always charges, whatever is on top. */
const MARK_PRESS_REACH = 0.62;
const MAX_QUEUED_PULSES = 4;
const INTERACTIVE = 'a, button, [role="button"], input, select, textarea';

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null;
}

interface HeroInputOptions {
  /** Element that receives the events (the whole hero, text included). */
  rootRef: RefObject<HTMLElement | null>;
  /** Element whose box the canvas fills (coordinates are relative to it). */
  stageRef: RefObject<HTMLElement | null>;
  input: RefObject<HeroInput>;
  isEnabled: boolean;
  /** Called on every released pulse (click/tap, charged or not). */
  onPulse?: (pulse: HeroPulse) => void;
}

/**
 * Cursor = wind; press = gravity well; release = pulse, harder the longer it
 * was held. Touch listeners are passive and the stage is `touch-action:
 * pan-y`, so a finger that moves (a scroll, or a sideways swipe that stirs
 * the cloud) cancels the charge instead of firing it.
 */
export function useHeroPointer({ rootRef, stageRef, input, isEnabled, onPulse }: HeroInputOptions): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !isEnabled) return;
    const state = input.current;

    const toNdc = (clientX: number, clientY: number) => {
      const rect = (stageRef.current ?? root).getBoundingClientRect();
      state.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      state.y = -(((clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
    };
    // Presses charge on the stage, or anywhere over the mark (the copy column's
    // box reaches under its lower left); elsewhere on the copy a press is
    // reading or selecting text.
    const canPress = (target: EventTarget | null, clientX: number, clientY: number) => {
      if (!(target instanceof Node) || isInteractive(target)) return false;
      const stage = stageRef.current;
      if (!stage) return false;
      if (stage.contains(target)) return true;
      const rect = stage.getBoundingClientRect();
      const [cx, cy] = markCenterPixels(rect.width, rect.height);
      const reach = markPixels(rect.width, rect.height) * MARK_PRESS_REACH;
      return Math.hypot(clientX - rect.left - cx, clientY - rect.top - cy) < reach;
    };
    const press = () => {
      state.hold = { startedAt: performance.now() };
      noteInput(state);
    };
    const cancel = () => {
      state.hold = null;
    };
    /** Release: the ripple fires where the press ends, as hard as the charge built up. */
    const release = (clientX: number, clientY: number) => {
      if (!state.hold) return;
      const strength = 1 + chargeAt(heldSeconds(state)) * CHARGE_GAIN;
      state.hold = null;
      toNdc(clientX, clientY);
      if (state.pulses.length >= MAX_QUEUED_PULSES) state.pulses.shift();
      state.pulses.push({ x: state.x, y: state.y, strength });
      noteInput(state);
      onPulse?.({ clientX, clientY, strength });
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      toNdc(event.clientX, event.clientY);
      state.isActive = true;
      noteInput(state);
    };
    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') state.isActive = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.button !== 0 || !canPress(event.target, event.clientX, event.clientY)) return;
      toNdc(event.clientX, event.clientY);
      press();
    };
    // On the window, so a press dragged off the hero still releases.
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') release(event.clientX, event.clientY);
    };

    let touchStart: { x: number; y: number } | null = null;
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      toNdc(touch.clientX, touch.clientY);
      state.isActive = true;
      noteInput(state);
      // A second finger is a pinch or a scroll, not a charge.
      if (event.touches.length > 1 || !canPress(event.target, touch.clientX, touch.clientY)) {
        touchStart = null;
        cancel();
        return;
      }
      touchStart = { x: touch.clientX, y: touch.clientY };
      press();
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      toNdc(touch.clientX, touch.clientY);
      noteInput(state);
      if (touchStart && Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y) > TAP_SLOP_PX) {
        touchStart = null;
        cancel();
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      state.isActive = false;
      const touch = event.changedTouches[0];
      if (touchStart && touch && event.type === 'touchend') release(touch.clientX, touch.clientY);
      else cancel();
      touchStart = null;
    };
    // A long press must not open the browser's context menu over the canvas.
    const onContextMenu = (event: Event) => {
      if (state.hold) event.preventDefault();
    };

    const passive = { passive: true } as const;
    root.addEventListener('pointermove', onPointerMove, passive);
    root.addEventListener('pointerleave', onPointerLeave, passive);
    root.addEventListener('pointerdown', onPointerDown, passive);
    window.addEventListener('pointerup', onPointerUp, passive);
    window.addEventListener('blur', cancel);
    root.addEventListener('touchstart', onTouchStart, passive);
    root.addEventListener('touchmove', onTouchMove, passive);
    root.addEventListener('touchend', onTouchEnd, passive);
    root.addEventListener('touchcancel', onTouchEnd, passive);
    root.addEventListener('contextmenu', onContextMenu);
    return () => {
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerleave', onPointerLeave);
      root.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('blur', cancel);
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', onTouchEnd);
      root.removeEventListener('touchcancel', onTouchEnd);
      root.removeEventListener('contextmenu', onContextMenu);
      state.isActive = false;
      state.hold = null;
    };
  }, [rootRef, stageRef, input, isEnabled, onPulse]);
}

type PermissionState = 'granted' | 'denied' | 'default';
interface OrientationEventWithPermission {
  requestPermission?: () => Promise<PermissionState>;
}

/** iOS 13+ gates deviceorientation behind a permission that needs a user tap. */
export function needsTiltPermission(): boolean {
  if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') return false;
  return typeof (DeviceOrientationEvent as unknown as OrientationEventWithPermission).requestPermission === 'function';
}

/** Must be called from a click/tap handler. Resolves true when tilt may be read. */
export async function requestTiltPermission(): Promise<boolean> {
  const request = (DeviceOrientationEvent as unknown as OrientationEventWithPermission).requestPermission;
  if (typeof request !== 'function') return true;
  try {
    return (await request()) === 'granted';
  } catch {
    return false;
  }
}

const TILT_RANGE_DEG = 28;
/** Hand tremor is not input: only a tilt change this large keeps the scene awake. */
const TILT_WAKE_STEP = 0.03;

/** Streams device tilt into `input.tilt` while enabled (relative to how the phone was first held). */
export function useHeroTilt(input: RefObject<HeroInput>, isEnabled: boolean): void {
  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') return;
    const state = input.current;
    let baseline: number | null = null;
    let woke = { x: 0, y: 0 };
    const clamp = (value: number) => Math.max(-1, Math.min(1, value));
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      baseline ??= event.beta;
      const next = { x: clamp(event.gamma / TILT_RANGE_DEG), y: clamp((baseline - event.beta) / TILT_RANGE_DEG) };
      state.tilt = next;
      if (Math.hypot(next.x - woke.x, next.y - woke.y) > TILT_WAKE_STEP) {
        woke = next;
        noteInput(state);
      }
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      state.tilt = null;
    };
  }, [input, isEnabled]);
}
