import type { LabProject } from './portfolio';

/**
 * Localized labels for portfolio data fields: where a product was built for
 * (`location`), its industry (`type`) and its platforms. The values in
 * src/shared/data/projects.ts are English; these tables give the uz/ru words.
 * A value missing from a table (a later addition) shows as written in the
 * data, so a new project never renders blank.
 *
 * Read them through `useProjectDescriber()` (media/useProjectDescriber.ts) in
 * a component, or call these with a locale in plain helpers.
 */

export type DescriptorLocale = 'en' | 'ru' | 'uz';

export type Phrase = Readonly<Record<DescriptorLocale, string>>;

/** next-intl locale → descriptor locale (anything unknown reads English). */
export function toDescriptorLocale(locale: string): DescriptorLocale {
  return locale === 'ru' || locale === 'uz' ? locale : 'en';
}

/** By `project.location`. */
const LOCATIONS: Readonly<Record<string, Phrase>> = {
  USA: { en: 'USA', ru: 'США', uz: 'AQSH' },
  Uzbekistan: { en: 'Uzbekistan', ru: 'Узбекистан', uz: 'Oʻzbekiston' },
  Australia: { en: 'Australia', ru: 'Австралия', uz: 'Avstraliya' },
  Canada: { en: 'Canada', ru: 'Канада', uz: 'Kanada' },
  Europe: { en: 'Europe', ru: 'Европа', uz: 'Yevropa' },
  International: { en: 'International', ru: 'Международный', uz: 'Xalqaro' },
  Netherlands: { en: 'Netherlands', ru: 'Нидерланды', uz: 'Niderlandiya' },
  'United Kingdom': { en: 'United Kingdom', ru: 'Великобритания', uz: 'Buyuk Britaniya' },
};

/** By `project.type` (the industry label on cards and the lightbox). */
const INDUSTRIES: Readonly<Record<string, Phrase>> = {
  'AI & EdTech': { en: 'AI & EdTech', ru: 'ИИ и EdTech', uz: 'AI va EdTech' },
  Banking: { en: 'Banking', ru: 'Банкинг', uz: 'Bank xizmatlari' },
  'Booking marketplace': { en: 'Booking marketplace', ru: 'Маркетплейс бронирования', uz: 'Bron qilish marketpleysi' },
  'Brand monitoring': { en: 'Brand monitoring', ru: 'Мониторинг бренда', uz: 'Brend monitoringi' },
  'Car leasing': { en: 'Car leasing', ru: 'Автолизинг', uz: 'Avtolizing' },
  'Civic tech': { en: 'Civic tech', ru: 'Гражданские сервисы', uz: 'Fuqarolik xizmatlari' },
  Construction: { en: 'Construction', ru: 'Строительство', uz: 'Qurilish' },
  'Developer tools': { en: 'Developer tools', ru: 'Инструменты разработчика', uz: 'Dasturchilar uchun vositalar' },
  'Document signing': { en: 'Document signing', ru: 'Подписание документов', uz: 'Hujjat imzolash' },
  'E-commerce': { en: 'E-commerce', ru: 'Электронная коммерция', uz: 'Elektron tijorat' },
  'E-documents': { en: 'E-documents', ru: 'Электронный документооборот', uz: 'Elektron hujjatlar' },
  EdTech: { en: 'EdTech', ru: 'Онлайн-образование', uz: 'Onlayn taʼlim' },
  Education: { en: 'Education', ru: 'Образование', uz: 'Taʼlim' },
  'Event planning': { en: 'Event planning', ru: 'Планирование мероприятий', uz: 'Tadbirlarni rejalashtirish' },
  'Event Staffing': { en: 'Event Staffing', ru: 'Персонал для мероприятий', uz: 'Tadbirlar uchun xodimlar' },
  'EV & Mobility': { en: 'EV & Mobility', ru: 'Электромобили', uz: 'Elektromobillar' },
  'Fashion & Design': { en: 'Fashion & Design', ru: 'Мода и дизайн', uz: 'Moda va dizayn' },
  FinTech: { en: 'FinTech', ru: 'Финтех', uz: 'Fintex' },
  'Fleet fuel cards': { en: 'Fleet fuel cards', ru: 'Топливные карты', uz: 'Yoqilgʻi kartalari' },
  'Food delivery': { en: 'Food delivery', ru: 'Доставка еды', uz: 'Ovqat yetkazib berish' },
  Gaming: { en: 'Gaming', ru: 'Игры', uz: 'Oʻyinlar' },
  GovTech: { en: 'GovTech', ru: 'Госуслуги', uz: 'Davlat xizmatlari' },
  'Halal FinTech': { en: 'Halal FinTech', ru: 'Халяльный финтех', uz: 'Halol fintex' },
  Healthcare: { en: 'Healthcare', ru: 'Медицина', uz: 'Tibbiyot' },
  'Healthcare social network': { en: 'Healthcare social network', ru: 'Медицинская соцсеть', uz: 'Tibbiyot ijtimoiy tarmogʻi' },
  Insurance: { en: 'Insurance', ru: 'Страхование', uz: 'Sugʻurta' },
  InsurTech: { en: 'InsurTech', ru: 'Страховые сервисы', uz: 'Sugʻurta xizmatlari' },
  'Job marketplace': { en: 'Job marketplace', ru: 'Биржа вакансий', uz: 'Vakansiyalar birjasi' },
  Logistics: { en: 'Logistics', ru: 'Логистика', uz: 'Logistika' },
  Marketplace: { en: 'Marketplace', ru: 'Маркетплейс', uz: 'Marketpleys' },
  Messaging: { en: 'Messaging', ru: 'Мессенджеры', uz: 'Messenjerlar' },
  'Music marketplace': { en: 'Music marketplace', ru: 'Музыкальный маркетплейс', uz: 'Musiqa marketpleysi' },
  'Retail analytics': { en: 'Retail analytics', ru: 'Аналитика ритейла', uz: 'Chakana savdo tahlili' },
  'Ride-hailing': { en: 'Ride-hailing', ru: 'Заказ поездок', uz: 'Taksi xizmati' },
  Robotics: { en: 'Robotics', ru: 'Робототехника', uz: 'Robototexnika' },
  Services: { en: 'Services', ru: 'Услуги', uz: 'Xizmatlar' },
  'Social / Community': { en: 'Social / Community', ru: 'Соцсеть / сообщества', uz: 'Ijtimoiy tarmoq / hamjamiyat' },
  'Social / Travel': { en: 'Social / Travel', ru: 'Соцсеть / путешествия', uz: 'Ijtimoiy tarmoq / sayohat' },
  'Sport & Social': { en: 'Sport & Social', ru: 'Спорт и общение', uz: 'Sport va muloqot' },
  Transport: { en: 'Transport', ru: 'Транспорт', uz: 'Transport' },
  'Video streaming': { en: 'Video streaming', ru: 'Видеостриминг', uz: 'Video striming' },
  'Workforce management': { en: 'Workforce management', ru: 'Управление персоналом', uz: 'Xodimlarni boshqarish' },
};

export type PlatformId = LabProject['platforms'][number];

const PLATFORMS: Readonly<Record<PlatformId, Phrase>> = {
  ios: { en: 'iOS', ru: 'iOS', uz: 'iOS' },
  android: { en: 'Android', ru: 'Android', uz: 'Android' },
  web: { en: 'Web', ru: 'Веб', uz: 'Veb' },
};

/** "USA" → "США" / "AQSH". */
export function locationLabel(location: string, locale: DescriptorLocale = 'en'): string {
  return LOCATIONS[location]?.[locale] ?? location;
}

/** "FinTech" → "Финтех" / "Fintex". */
export function industryLabel(type: string, locale: DescriptorLocale = 'en'): string {
  return INDUSTRIES[type]?.[locale] ?? type;
}

/** 'web' → "Web" / "Веб" / "Veb". */
export function platformLabel(platform: PlatformId, locale: DescriptorLocale = 'en'): string {
  return PLATFORMS[platform][locale];
}
