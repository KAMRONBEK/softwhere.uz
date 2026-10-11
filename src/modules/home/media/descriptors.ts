import type { DescriptorLocale, Phrase } from './labels';
import type { LabProject } from './portfolio';

/**
 * Generic, name-free descriptions of the portfolio ("a messenger app", "a taxi
 * app"). Founder's rule (2026-10-10): the story sections describe what we
 * built, never whose it was; only the work wall (and its video popup) shows
 * real project names, as proof.
 *
 * Each descriptor is a lowercase noun phrase without an article, written from
 * the project's `type` and English description in src/shared/data/projects.ts,
 * so it says no more than the data does. A project missing from the table
 * (a later addition) gets one from the same fields by rule, so a new project
 * never shows up nameless or named.
 *
 * Every phrase has en/ru/uz. In a component, read them through
 * `useProjectDescriber()` (media/useProjectDescriber.ts), which binds the page
 * locale; plain helpers take a `locale` argument.
 */

export type { DescriptorLocale } from './labels';

type DescribedProject = Pick<LabProject, 'slug' | 'type' | 'description' | 'platforms'>;

/** By slug (media/portfolio.ts `slug`), in portfolio order. */
const KINDS: Readonly<Record<string, Phrase>> = {
  'talim-ai': { en: 'AI learning platform', ru: 'ИИ-платформа для обучения', uz: 'AI taʼlim platformasi' },
  bysmillah: {
    en: 'halal car-financing marketplace',
    ru: 'халяльный маркетплейс автофинансирования',
    uz: 'halol avtomobil moliyalashtirish marketpleysi',
  },
  'tes-chat': { en: 'messenger app', ru: 'мессенджер', uz: 'messenjer' },
  driveme: { en: 'ride-hailing app', ru: 'приложение для заказа поездок', uz: 'safar buyurtma qilish ilovasi' },
  'truck-me': { en: 'truck-services app', ru: 'приложение сервисов для грузовиков', uz: 'yuk mashinalari servislari ilovasi' },
  vbrato: { en: 'music marketplace', ru: 'музыкальный маркетплейс', uz: 'musiqa marketpleysi' },
  workaxle: { en: 'workforce app', ru: 'приложение для управления персоналом', uz: 'xodimlarni boshqarish ilovasi' },
  'united-fuel': {
    en: 'fuel-card app for truckers',
    ru: 'приложение топливных карт для дальнобойщиков',
    uz: 'yuk haydovchilari uchun yoqilgʻi kartasi ilovasi',
  },
  voltai: { en: 'EV-charging map', ru: 'карта зарядок для электромобилей', uz: 'elektromobil quvvatlash xaritasi' },
  'my-barber': { en: 'barber-booking app', ru: 'приложение для записи к барберу', uz: 'sartaroshga yozilish ilovasi' },
  kiber: { en: 'e-document platform', ru: 'платформа электронного документооборота', uz: 'elektron hujjat almashinuvi platformasi' },
  'tes-tube': { en: 'video-streaming platform', ru: 'видеоплатформа', uz: 'video platforma' },
  'oss-sdks': { en: 'open-source library kit', ru: 'набор open-source библиотек', uz: 'ochiq kodli kutubxonalar toʻplami' },
  pulse: { en: 'social network for doctors', ru: 'соцсеть для врачей', uz: 'shifokorlar uchun ijtimoiy tarmoq' },
  whoriddle: { en: 'family riddle game', ru: 'семейная игра-загадка', uz: 'oilaviy topishmoq oʻyini' },
  'challenge-ei': { en: 'therapy-notes app', ru: 'приложение для психотерапевтов', uz: 'terapevtlar uchun ilova' },
  'ai-merch': { en: 'retail-analytics app', ru: 'приложение розничной аналитики', uz: 'chakana savdo tahlili ilovasi' },
  'stadium-people': {
    en: 'event-staffing platform',
    ru: 'платформа подбора персонала на мероприятия',
    uz: 'tadbirlar uchun xodim yollash platformasi',
  },
  livemysteps: { en: 'travel-journal app', ru: 'приложение-дневник путешествий', uz: 'sayohat kundaligi ilovasi' },
  heyall: { en: 'event-planning app', ru: 'приложение для планирования мероприятий', uz: 'tadbirlarni rejalashtirish ilovasi' },
  swish: { en: 'pickup-sports app', ru: 'приложение для любительского спорта', uz: 'havaskor sport ilovasi' },
  edocs: { en: 'e-signature app', ru: 'приложение для электронной подписи', uz: 'elektron imzo ilovasi' },
  'brand-guard': { en: 'brand-monitoring dashboard', ru: 'панель мониторинга бренда', uz: 'brend monitoringi paneli' },
  'haru-console': { en: 'calling platform for robots', ru: 'платформа звонков для роботов', uz: 'robotlar uchun qoʻngʻiroq platformasi' },
  'novalinq-eld': { en: 'fleet-compliance dashboard', ru: 'панель учёта для автопарков', uz: 'avtopark hisobi paneli' },
  medrite: { en: 'patient app', ru: 'приложение для пациентов', uz: 'bemorlar uchun ilova' },
  'zeno-learning': { en: 'gamified learning platform', ru: 'игровая платформа обучения', uz: 'oʻyin tarzidagi taʼlim platformasi' },
  persona: { en: 'community app', ru: 'приложение для сообществ', uz: 'hamjamiyat ilovasi' },
  nexus: { en: 'investing app', ru: 'инвестиционное приложение', uz: 'investitsiya ilovasi' },
  'align-360': { en: 'construction-team app', ru: 'приложение для строительных бригад', uz: 'qurilish jamoalari uchun ilova' },
  bdm: { en: 'document-signing app', ru: 'приложение для подписания документов', uz: 'hujjat imzolash ilovasi' },
  'primus-mall': { en: 'online mall app', ru: 'приложение онлайн-молла', uz: 'onlayn savdo markazi ilovasi' },
  naft: { en: 'job marketplace', ru: 'биржа вакансий', uz: 'vakansiyalar birjasi' },
  'snap-taxi': { en: 'taxi app', ru: 'приложение такси', uz: 'taksi ilovasi' },
  'seyf-bazar': { en: 'electronics store app', ru: 'приложение магазина электроники', uz: 'elektronika doʻkoni ilovasi' },
  avtogen: { en: 'car-wash booking app', ru: 'приложение для записи на автомойку', uz: 'avtoyuvishga yozilish ilovasi' },
  brainwake: { en: 'educational alarm app', ru: 'обучающий будильник', uz: 'oʻrgatuvchi budilnik' },
  mydesign: { en: 'fashion-design app', ru: 'приложение для дизайна одежды', uz: 'kiyim dizayni ilovasi' },
  'express-100k': {
    en: 'intercity taxi and delivery app',
    ru: 'приложение междугороднего такси и доставки',
    uz: 'shaharlararo taksi va yetkazib berish ilovasi',
  },
  birmakon: { en: 'multi-vendor marketplace', ru: 'маркетплейс многих продавцов', uz: 'koʻp sotuvchili marketpleys' },
  'full-taxi': { en: 'taxi app', ru: 'приложение такси', uz: 'taksi ilovasi' },
  businessgov: { en: 'GovTech app prototype', ru: 'прототип госприложения', uz: 'davlat xizmati ilovasi prototipi' },
  hamd: { en: 'food-delivery operator panel', ru: 'панель оператора доставки еды', uz: 'ovqat yetkazish operator paneli' },
  'litter-picking': { en: 'community clean-up app', ru: 'приложение для уборки мусора', uz: 'chiqindi yigʻish ilovasi' },
  'hello-box': { en: 'Telegram-bot shop admin', ru: 'админка магазина в Telegram-боте', uz: 'Telegram-bot doʻkoni admin paneli' },
  'chat-app': { en: 'messenger prototype', ru: 'прототип мессенджера', uz: 'messenjer prototipi' },
  netevia: { en: 'business-banking app', ru: 'приложение бизнес-банкинга', uz: 'biznes-banking ilovasi' },
  nestegg: { en: 'loan-comparison site', ru: 'сайт сравнения кредитов', uz: 'kreditlarni solishtirish sayti' },
  'asia-insurance': { en: 'insurance app', ru: 'страховое приложение', uz: 'sugʻurta ilovasi' },
  ascon: { en: 'auto-service app', ru: 'приложение автопомощи', uz: 'avtoyordam ilovasi' },
  'agrobank-fresh': { en: 'mobile-banking prototype', ru: 'прототип мобильного банка', uz: 'mobil banking prototipi' },
  'ipak-yuli-locator': { en: 'bank-branch locator', ru: 'карта отделений банка', uz: 'bank filiallari xaritasi' },
  zpay: { en: 'installments app prototype', ru: 'прототип приложения рассрочки', uz: 'muddatli toʻlov ilovasi prototipi' },
  'emit-autolab': { en: 'car-leasing app', ru: 'приложение автолизинга', uz: 'avtolizing ilovasi' },
};

/** Fallback for projects not in the table: first rule matching `type` + description wins. */
const RULES: ReadonlyArray<{ pattern: RegExp; phrase: Phrase }> = [
  { pattern: /messenger|messaging/i, phrase: { en: 'messenger app', ru: 'мессенджер', uz: 'messenjer' } },
  { pattern: /\btaxi\b|ride-hailing|chauffeur/i, phrase: { en: 'taxi app', ru: 'приложение такси', uz: 'taksi ilovasi' } },
  { pattern: /\bdelivery\b/i, phrase: { en: 'delivery app', ru: 'приложение доставки', uz: 'yetkazib berish ilovasi' } },
  { pattern: /\bbook(ing|s)?\b/i, phrase: { en: 'booking app', ru: 'приложение для записи', uz: 'yozilish ilovasi' } },
  { pattern: /e-commerce|storefront|marketplace/i, phrase: { en: 'online store', ru: 'интернет-магазин', uz: 'onlayn doʻkon' } },
  { pattern: /edtech|education|learning/i, phrase: { en: 'learning platform', ru: 'платформа обучения', uz: 'taʼlim platformasi' } },
  { pattern: /health|patient|doctor|clinic/i, phrase: { en: 'healthcare app', ru: 'медицинское приложение', uz: 'tibbiyot ilovasi' } },
  { pattern: /\bcrm\b|admin|dashboard|operator panel/i, phrase: { en: 'admin system', ru: 'админ-система', uz: 'boshqaruv tizimi' } },
  { pattern: /invest/i, phrase: { en: 'investing app', ru: 'инвестиционное приложение', uz: 'investitsiya ilovasi' } },
  { pattern: /bank|insur|leas|loan|fintech/i, phrase: { en: 'finance app', ru: 'финансовое приложение', uz: 'moliya ilovasi' } },
];

const MOBILE: Phrase = { en: 'mobile app', ru: 'мобильное приложение', uz: 'mobil ilova' };
const WEB: Phrase = { en: 'web platform', ru: 'веб-платформа', uz: 'veb-platforma' };

function phraseOf(project: DescribedProject): Phrase {
  const known = KINDS[project.slug];
  if (known) return known;
  const text = `${project.type} ${project.description}`;
  const rule = RULES.find(item => item.pattern.test(text));
  if (rule) return rule.phrase;
  return project.platforms.some(platform => platform !== 'web') ? MOBILE : WEB;
}

/** "messenger app": lowercase noun phrase, no article (any locale). */
export function projectKind(project: DescribedProject, locale: DescriptorLocale = 'en'): string {
  return phraseOf(project)[locale];
}

/** Sentence-case, for labels and headings: "Messenger app". */
export function projectTitle(project: DescribedProject, locale: DescriptorLocale = 'en'): string {
  return capitalize(projectKind(project, locale));
}

// "an" before a vowel sound: vowels except "uni…"/"use…" (a unified, a user),
// and letter-named acronyms that start with a vowel sound (an SMS bot, an LLM).
const AN = /^(?:[aeio]|u(?!ni|s[aeiu])|(?:HR|LLM|MVP|SDK|SMS|SEO)\b)/i;

/**
 * The kind as it reads inside a sentence: English takes its indefinite article
 * ("a messenger app", "an AI learning platform"); Russian and Uzbek have none
 * ("мессенджер", "messenjer").
 */
export function describeProject(project: DescribedProject, options: { isCapitalized?: boolean; locale?: DescriptorLocale } = {}): string {
  const locale = options.locale ?? 'en';
  const kind = projectKind(project, locale);
  const phrase = locale === 'en' ? `${AN.test(kind) ? 'an' : 'a'} ${kind}` : kind;
  return options.isCapitalized ? capitalize(phrase) : phrase;
}

/**
 * The first project of each kind, in order, up to `limit` kinds: lists of
 * examples never say "a taxi app" twice. Map the result through
 * `describeProject` or `projectTitle`.
 */
export function distinctByKind<T extends DescribedProject>(projects: readonly T[], limit = Infinity): T[] {
  const seen = new Set<string>();
  const picked: T[] = [];
  for (const project of projects) {
    if (picked.length >= limit) break;
    const kind = projectKind(project);
    if (seen.has(kind)) continue;
    seen.add(kind);
    picked.push(project);
  }
  return picked;
}

function capitalize(text: string): string {
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : text;
}
