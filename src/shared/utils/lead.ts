/**
 * Lead submission with no UI dependency (kept apart from send.ts, which pulls
 * in react-toastify), so a page with its own inline states — the homepage
 * finale — does not ship the toast library.
 */
import { trackEvent } from '@/shared/utils/analytics';

const FORM_SOURCE_MAP: Record<string, 'hero' | 'discuss' | 'contact'> = {
  consultation: 'hero',
  discuss: 'discuss',
  '': 'contact',
};

export interface LeadInput {
  name: string;
  /** Phone, Telegram handle or email: /api/contact stores it as the lead's contact. */
  phone: string;
  message: string;
  /** Where the form lives, e.g. 'home-finale'; stored as the lead's source. */
  from: string;
}

/**
 * Creates a lead (POST /api/contact: stored, then sent to Telegram) without
 * any UI. Resolves true when the server accepted it; never throws. Forms that
 * show their own success/error state use this; `sender` wraps it in toasts.
 */
export async function postLead({ name, phone, message, from }: LeadInput): Promise<boolean> {
  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, message, from }),
    });
    if (res.ok) trackEvent('form_submit', { source: FORM_SOURCE_MAP[from] ?? 'contact' });
    return res.ok;
  } catch {
    return false;
  }
}
