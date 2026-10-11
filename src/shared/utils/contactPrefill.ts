'use client';

import { useEffect, useRef } from 'react';

/**
 * Hand a ready-made message to the site's contact form without submitting
 * anything. A feature that wants "talk to us about this" calls
 * `prefillContactMessage`; the contact form (`useContactPrefill`) picks it up
 * either live, when it is on the same page, or on its next mount, after the
 * visitor was sent to the page that has it. The message lives in
 * sessionStorage only until a form takes it.
 */

const PREFILL_EVENT = 'contact:prefill';
const STORAGE_KEY = 'contact-prefill';

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null; // blocked storage (privacy mode, sandboxed frames)
  }
}

export function prefillContactMessage(message: string): void {
  try {
    storage()?.setItem(STORAGE_KEY, message);
  } catch {
    // Quota or privacy mode: the live event below still reaches a form on this page.
  }
  window.dispatchEvent(new CustomEvent<string>(PREFILL_EVENT, { detail: message }));
}

function takeStoredMessage(): string | null {
  const store = storage();
  if (!store) return null;
  try {
    const message = store.getItem(STORAGE_KEY);
    if (message !== null) store.removeItem(STORAGE_KEY);
    return message;
  } catch {
    return null;
  }
}

/** For a contact form: receive prefilled messages (stored before this mount, or sent live). */
export function useContactPrefill(onMessage: (message: string) => void): void {
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  });

  useEffect(() => {
    const stored = takeStoredMessage();
    if (stored) handlerRef.current(stored);

    const onEvent = (event: Event) => {
      const message = (event as CustomEvent<unknown>).detail;
      if (typeof message !== 'string' || !message) return;
      takeStoredMessage();
      handlerRef.current(message);
    };
    window.addEventListener(PREFILL_EVENT, onEvent);
    return () => window.removeEventListener(PREFILL_EVENT, onEvent);
  }, []);
}
