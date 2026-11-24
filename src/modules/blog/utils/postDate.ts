import { format } from 'date-fns';
import type { Locale as DateFnsLocale } from 'date-fns';
import { ru, uz } from 'date-fns/locale';

const DATE_LOCALES: Record<string, DateFnsLocale> = { ru, uz };

/**
 * A post's date as readers see it: its UTC day, whatever the time zone. The
 * server (UTC) and a visitor's browser must print the same text, or hydration
 * fails for posts created near midnight.
 */
export function formatPostDate(iso: string, locale: string): string {
  const date = new Date(iso);
  const utcDay = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
  // RU/UZ read day-first ('3 июля 2026'); 'MMMM dd, yyyy' is English-only order.
  return format(utcDay, locale === 'en' ? 'MMMM dd, yyyy' : 'd MMMM yyyy', { locale: DATE_LOCALES[locale] });
}
