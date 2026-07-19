/**
 * Curated legacy-slug aliases: decoded pre-Neon slug roots (timestamp suffix
 * already stripped) mapped to the live post that superseded them. Covers URLs
 * the DB root-match can never resolve: Cyrillic/localized-era slugs, renamed
 * topics, and posts removed in the Jul 2026 duplicate-cluster cleanup.
 *
 * Keys MUST be exact decoded roots (some are stripped-Cyrillic artifacts like
 * '-' or '-2024-'); never prefix- or fuzzy-match against this table. Every
 * target was verified against the published-posts table when added; the
 * redirect layer re-checks the target is still published before redirecting.
 */

export type AliasLocale = 'en' | 'ru' | 'uz';

export interface LegacyAliasTarget {
  slug: string;
  locale: AliasLocale;
}

const LEGACY_SLUG_ALIASES: Record<string, LegacyAliasTarget> = {
  'мини-приложения-telegram-против-традиционных-мобильных-приложений-что-выбрать': {
    slug: 'telegram-mini-apps-ili-mobilnye-prilozheniya-chto-vybrat',
    locale: 'ru',
  },
  'telegram-mini-ilovasi-ilova-ichidagi-tajribalarning-kelajagi': {
    slug: 'telegram-mini-apps-kelajakdagi-ilova-tajribalari-softwhereuz-blog',
    locale: 'uz',
  },
  'оптимизация-производительности-сайта-ускорьте-свой-сайт': {
    slug: 'optimizatsiya-skorosti-sayta-kak-medlennye-stranitsy-ubivayut-prodazhi',
    locale: 'ru',
  },
  'telegram-botlarini-ishlab-chiqish-boyicha-toliq-qollanma-biznes-uchun': {
    slug: 'telegram-bot-yaratish-toliq-qollanma-biznes-uchun',
    locale: 'uz',
  },
  'pwa-против-мобильного-приложения': { slug: 'pwa-ili-mobilnoe-prilozhenie-chto-vybrat-biznesu', locale: 'ru' },
  'современная-веб-разработка-фреймворки-и-технологии-в-2025-году': {
    slug: 'sovremennye-freymvorki-veb-razrabotki-top-tekhnologiy',
    locale: 'ru',
  },
  'ozbekistonda-muvaffaqiyatli-texnologiya-startapini-qurish': {
    slug: 'ozbekistonda-startap-ochish-muvaffaqiyat-strategiyasi',
    locale: 'uz',
  },
  'мини-приложения-telegram-будущее-внутриприложных-взаимодействий': {
    slug: 'telegram-mini-apps-budushchee-vstroennykh-servisov',
    locale: 'ru',
  },
  'полное-руководство-по-разработке-telegram-ботов-для-бизнеса': {
    slug: 'razrabotka-telegram-botov-dlya-biznesa-polnoe-rukovodstvo',
    locale: 'ru',
  },
  'нативное-гибридное-или-кроссплатформенное-какое-решение-подходит-вашему-бизнесу': {
    slug: 'nativnaya-ili-krossplatformennaya-razrabotka-gid-dlya-biznesa',
    locale: 'ru',
  },
  'безопасность-ботов-telegram-защита-вашего-бизнеса-и-пользователей': {
    slug: 'bezopasnost-telegram-botov-zashchita-biznesa-i-klientov',
    locale: 'ru',
  },
  'startup-app-development-from-mvp-to-market-success': { slug: 'build-your-mvp-in-90-days-step-by-step-roadmap', locale: 'en' },
  '2025-yilgi-mobil-ilova-narxi': { slug: 'mobil-ilova-narxi-2025-qancha-turadi', locale: 'uz' },
  '-react-native-flutter': { slug: 'react-native-vs-flutter-krossplatformennaya-razrabotka', locale: 'ru' },
  '-2024-': { slug: 'sovremennye-freymvorki-veb-razrabotki-top-tekhnologiy', locale: 'ru' },
  'pwa-vs-mobil-ilova': { slug: 'pwa-vs-mobil-ilova-biznesingiz-uchun-qaysi-yaxshiroq', locale: 'uz' },
  'расширенные-возможности-ботов-telegram-платежи-вебхуки-и-многое-другое': {
    slug: 'razrabotka-telegram-botov-dlya-biznesa-polnoe-rukovodstvo',
    locale: 'ru',
  },
  'telegram-boti-xavfsizligi-sizning-biznesingiz-va-foydalanuvchilaringizni-himoya-qilish': {
    slug: 'telegram-bot-xavfsizligi-biznesni-himoya-qilish',
    locale: 'uz',
  },
  'ozbekistonda-muvaffaqiyatli-texnologiya-startapini-barpo-etish': {
    slug: 'ozbekistonda-startap-ochish-muvaffaqiyat-strategiyasi',
    locale: 'uz',
  },
  'seo-дружественная-веб-разработка-лучшие-технические-практики': {
    slug: 'seo-razrabotka-saytov-tekhnicheskie-luchshie-praktiki-1',
    locale: 'ru',
  },
  'veb-sayt-ishlashini-optimallashtirish-saytingizni-tezlashtiring': {
    slug: 'sayt-tezligini-oshirish-sekin-sahifalar-qanday-qilib-daromadingizni-yoqotadi',
    locale: 'uz',
  },
  'seoga-mos-keluvchi-veb-dasturlash-texnik-eng-yaxshi-amaliyotlar': {
    slug: 'seo-veb-dasturlash-texnik-yaxshi-amaliyotlar-softwhereuz-blog',
    locale: 'uz',
  },
  'native-vs-hybrid-vs-cross-platform-which-is-right-for-your-business': {
    slug: 'native-vs-cross-platform-apps-the-complete-business-guide',
    locale: 'en',
  },
  'создание-успешного-технологического-стартапа-в-узбекистане': {
    slug: 'tekhnostartap-v-uzbekistane-kak-zapustit-uspeshnyy-proekt',
    locale: 'ru',
  },
  'web-development-trends-that-will-shape-2025': { slug: 'web-development-trends-that-will-shape-2026', locale: 'en' },
  'seo-га-мос-веб-дастурлаш-техник-энг-яхши-амалиётлар': {
    slug: 'seo-veb-dasturlash-texnik-yaxshi-amaliyotlar-softwhereuz-blog',
    locale: 'uz',
  },
  'тренды-веб-разработки-которые-определят-2025-год': { slug: 'trendy-veb-razrabotki-2026-chto-vazhno-znat', locale: 'ru' },
  'native-hybrid-va-cross-platform-sizning-biznesingiz-uchun-qaysi-biri-mos-keladi': {
    slug: 'native-va-cross-platform-ilovalar-biznes-uchun-toliq-qollanma',
    locale: 'uz',
  },
  'react-native-va-flutter-yordamida-platformadan-qatiy-nazar-dasturlash': {
    slug: 'react-native-vs-flutter-kross-platforma-rivojlanishi',
    locale: 'uz',
  },
  'стоимость-мобильного-приложения-в-2025-году': { slug: 'stoimost-mobilnogo-prilozheniya-2025', locale: 'ru' },
  'mobil-ilova-texnik-xizmati-ilovaning-raqobatbardoshligini-saqlash': {
    slug: 'mobil-ilova-qollab-quvvatlash-raqobatda-yetakchi-boling',
    locale: 'uz',
  },
  'обслуживание-мобильных-приложений-как-сохранить-конкурентоспособность': {
    slug: 'podderzhka-mobilnykh-prilozheniy-ostavaytes-konkurentosposobnymi',
    locale: 'ru',
  },
  '-': { slug: 'tekhnostartap-v-uzbekistane-kak-zapustit-uspeshnyy-proekt', locale: 'ru' },
  '2025-yilni-shakllantiradigan-veb-dasturlash-tendentsiyalari': {
    slug: '2026-yilgi-veb-dasturlash-trendlari-softwhereuz-blog',
    locale: 'uz',
  },
  'стратегии-привлечения-пользователей-для-мобильных-приложений': {
    slug: 'privlechenie-polzovateley-v-mobilnye-prilozheniya-strategii',
    locale: 'ru',
  },
  'mobil-ilovalar-uchun-foydalanuvchi-jalb-qilish-strategiyalari': {
    slug: 'mobil-ilova-foydalanuvchilarni-jalb-qilish-strategiyalari',
    locale: 'uz',
  },
  'zamonaviy-veb-dasturlash-2025-yildagi-frameworklar-va-texnologiyalar': {
    slug: 'zamonaviy-web-dasturlash-freymvorklari-eng-yaxshi-texnologiyalar',
    locale: 'uz',
  },
  'telegram-mini-ilovasi-va-ananaviy-mobil-ilovalar-qaysi-birini-tanlash-kerak': {
    slug: 'telegram-mini-app-va-oddiy-ilovalar-qaysi-yaxshiroq',
    locale: 'uz',
  },
  'zamonaviy-veb-dasturlash-2024-yildagi-frameworklar-va-texnologiyalar': {
    slug: 'zamonaviy-web-dasturlash-freymvorklari-eng-yaxshi-texnologiyalar',
    locale: 'uz',
  },
  'website-performance-optimization-speed-up-your-site': {
    slug: 'website-speed-optimization-how-slow-pages-kill-your-revenue',
    locale: 'en',
  },
  'telegram-botning-takomillashgan-xususiyatlari-tolovlar-webhooklar-va-boshqalar': {
    slug: 'telegram-bot-yaratish-toliq-qollanma-biznes-uchun',
    locale: 'uz',
  },
  'advanced-telegram-bot-features-payments-webhooks-and-more': {
    slug: 'complete-guide-to-telegram-bot-development-for-businesses',
    locale: 'en',
  },
  'zamonaviy-veb-dasturlash-2025-yildagi-ramkalar-va-texnologiyalar': {
    slug: 'zamonaviy-web-dasturlash-freymvorklari-eng-yaxshi-texnologiyalar',
    locale: 'uz',
  },
  'seo-оптимизированная-веб-разработка-технические-рекомендации': {
    slug: 'seo-razrabotka-saytov-tekhnicheskie-luchshie-praktiki-1',
    locale: 'ru',
  },
  'modern-web-development-frameworks-and-technologies-in-2024': {
    slug: 'modern-web-development-frameworks-and-technologies-in-2025',
    locale: 'en',
  },
  'seo-veb-dasturlash-texnik-usullar': { slug: 'seo-veb-dasturlash-texnik-yaxshi-amaliyotlar-softwhereuz-blog', locale: 'uz' },
  'seo-razrabotka-saytov-tekhnicheskie-luchshie-praktiki': {
    slug: 'seo-razrabotka-saytov-tekhnicheskie-luchshie-praktiki-1',
    locale: 'ru',
  },
  'ilova-turi-native-hybrid-yoki-cross-platform': { slug: 'native-va-cross-platform-ilovalar-biznes-uchun-toliq-qollanma', locale: 'uz' },
  'mvp-za-90-dney-poshagovyy-plan-zapuska': { slug: 'mvp-za-90-dney-poshagovyy-plan-dlya-startapa', locale: 'ru' },
  'mvp-yaratish-90-kunlik-amaliy-yol-xaritasi': { slug: '90-kun-ichida-mvp-yaratish-bosqichma-bosqich-yonaltiruvchi', locale: 'uz' },
  'trendy-veb-razrabotki-2025-chto-zhdyot-otrasl': { slug: 'trendy-veb-razrabotki-2026-chto-vazhno-znat', locale: 'ru' },
};

/** Exact-match lookup of a decoded legacy slug root. */
export function resolveLegacyAlias(slugRoot: string): LegacyAliasTarget | null {
  return Object.prototype.hasOwnProperty.call(LEGACY_SLUG_ALIASES, slugRoot) ? LEGACY_SLUG_ALIASES[slugRoot] : null;
}
