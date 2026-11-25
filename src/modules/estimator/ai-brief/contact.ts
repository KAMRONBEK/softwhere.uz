/** An email, a Telegram @handle or t.me link, or a phone number, trimmed; null for anything else. Used by the form and the route. */
export function parseContact(value: string): string | null {
  const contact = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact)) return contact;
  const handle = /^(?:@|(?:https?:\/\/)?t\.me\/)([a-z][a-z0-9_]{3,31})\/?$/i.exec(contact);
  if (handle) return `@${handle[1]}`;
  const digits = contact.replace(/\D/g, '').length;
  return /^\+?[\d\s().-]+$/.test(contact) && digits >= 7 && digits <= 15 ? contact : null;
}
