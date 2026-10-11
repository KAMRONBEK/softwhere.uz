import en from '@/messages/en.json';
import ru from '@/messages/ru.json';
import uz from '@/messages/uz.json';
import type { BriefLocale } from '@/modules/estimator/ai-brief/constants';

/**
 * Catalog labels in the page language — the same `estimator.*` messages the
 * wizard renders — for the prompts' priced-scope digest and for deterministic
 * fallbacks. Plus the short brand names used when a raw catalog id
 * ("soliq_ofd", "eskiz_sms") leaks into text a visitor would read.
 */

interface CatalogMessages {
  subtype: Record<string, string>;
  feature: Record<string, string>;
  integration: Record<string, string>;
}

const MESSAGES: Record<BriefLocale, CatalogMessages> = {
  en: en.estimator as unknown as CatalogMessages,
  ru: ru.estimator as unknown as CatalogMessages,
  uz: uz.estimator as unknown as CatalogMessages,
};

export function featureLabel(id: string, locale: BriefLocale): string {
  return MESSAGES[locale].feature[id] ?? MESSAGES.en.feature[id] ?? id;
}

export function integrationLabel(id: string, locale: BriefLocale): string {
  return MESSAGES[locale].integration[id] ?? MESSAGES.en.integration[id] ?? id;
}

export function subtypeLabel(id: string, locale: BriefLocale): string {
  return MESSAGES[locale].subtype[id] ?? MESSAGES.en.subtype[id] ?? id;
}

/** Label for any scope ref: a feature, an integration or a `type:subtype` product id. */
export function refLabel(ref: string, locale: BriefLocale): string {
  if (ref.includes(':')) return subtypeLabel(ref.split(':')[1], locale);
  if (MESSAGES.en.feature[ref]) return featureLabel(ref, locale);
  return integrationLabel(ref, locale);
}

/**
 * A scope item the engine could not price for this product, as the reader
 * sees it under "not in the estimate": the catalog label plus the model's
 * note ("AI content generation: reads broker rate confirmations"), so the
 * list names the actual request rather than a bare catalog option.
 */
export function notPricedLabel(id: string, notes: ReadonlyMap<string, string>, locale: BriefLocale): string {
  const note = notes.get(id)?.trim();
  return note ? `${refLabel(id, locale)}: ${note}` : refLabel(id, locale);
}

/**
 * How a raw integration id should read in running text. Brand names are the
 * same in every language except where the market writes them differently
 * (Russian 1С / ОФД / ЮKassa).
 */
const BRAND: Record<string, string | (Partial<Record<BriefLocale, string>> & { en: string })> = {
  payme: 'Payme',
  click: 'Click',
  uzum_bank: 'Uzum Bank',
  paynet: 'Paynet',
  visa_acquiring: 'Visa/Mastercard',
  nasiya: { en: 'installments', ru: 'рассрочка', uz: 'nasiya' },
  soliq_ofd: { en: 'OFD', ru: 'ОФД', uz: 'OFD' },
  stripe: 'Stripe',
  paypal: 'PayPal',
  kaspi: 'Kaspi',
  yookassa: { en: 'YooKassa', ru: 'ЮKassa', uz: 'YooKassa' },
  eskiz_sms: 'Eskiz SMS',
  playmobile_sms: 'Play Mobile SMS',
  telegram_channel: 'Telegram',
  email_service: 'email',
  yandex_maps: 'Yandex Maps',
  gis2: '2GIS',
  google_maps: 'Google Maps',
  onec: { en: '1C', ru: '1С', uz: '1C' },
  bitrix24: 'Bitrix24',
  amocrm: 'amoCRM',
  moysklad: { en: 'MoySklad', ru: 'МойСклад', uz: 'MoySklad' },
  billz: 'Billz',
  smartup: 'Smartup',
  sheets: 'Google Sheets',
  custom_api: 'API',
  oneid: 'OneID',
  myid: 'MyID',
  eimzo: 'E-IMZO',
  didox: 'Didox',
};

export function brandName(id: string, locale: BriefLocale): string | null {
  const entry = BRAND[id];
  if (!entry) return null;
  return typeof entry === 'string' ? entry : (entry[locale] ?? entry.en);
}

export const BRAND_IDS = Object.keys(BRAND);
