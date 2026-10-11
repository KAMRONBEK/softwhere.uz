import { useSyncExternalStore } from 'react';

/**
 * A tiny external store for "may the walkthrough play now". The timeline
 * flips it from its onUpdate; only the video subscribes, so crossing the
 * threshold re-renders one <LabVideo>, not the whole mini site (two copies
 * of every piece) in the middle of a scrubbed launch.
 */
export interface VideoGate {
  get: () => boolean;
  set: (value: boolean) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createVideoGate(): VideoGate {
  let value = false;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: next => {
      if (next === value) return;
      value = next;
      listeners.forEach(listener => listener());
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const serverValue = () => false;

export function useVideoGate(gate: VideoGate): boolean {
  return useSyncExternalStore(gate.subscribe, gate.get, serverValue);
}
