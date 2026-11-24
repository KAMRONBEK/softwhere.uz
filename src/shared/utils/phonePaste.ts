import type { ClipboardEvent } from 'react';

const UZ_FULL = /^998\d{9}$/;
const UZ_LOCAL = /^\d{9}$/;

/**
 * A pasted Uzbek number, full or local, replaces the phone field's whole
 * value. The input would append a full number to its prefilled +998 and read
 * a local one's first digits as another country code. Anything else pastes
 * as usual.
 */
export function replaceWithPastedUzPhone(setPhone: (phone: string) => void) {
  return (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text').trim();
    const digits = text.replace(/\D/g, '');
    const isFull = UZ_FULL.test(digits);
    const isLocal = !text.startsWith('+') && UZ_LOCAL.test(digits);
    const { value, selectionStart, selectionEnd } = event.currentTarget;
    // A local number only over Uzbekistan's field: over the whole of it, or after the prefilled code.
    const typed = value.replace(/\D/g, '');
    const isWhole = selectionStart === 0 && selectionEnd === value.length;
    const isFresh = typed === '' || (typed.startsWith('998') && (typed === '998' || isWhole));
    if (!isFull && !(isLocal && isFresh)) return;
    event.preventDefault();
    setPhone(`+${isFull ? digits : `998${digits}`}`);
  };
}
