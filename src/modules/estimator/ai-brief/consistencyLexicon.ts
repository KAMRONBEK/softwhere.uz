import type { ProjectType } from '@/modules/estimator/types';
import type { BlockKind } from '@/modules/estimator/ai-brief/constants';

/**
 * Vocabulary of the brief CONSISTENCY checker (`consistency.ts`): how a priced
 * capability shows up in visible text, in all three page languages.
 *
 * A concept is something a wireframe, an assumption or the MVP narrative can
 * promise ("Pay with Payme", "Reviews 4.8★", "Chat with the driver"). It is
 * consistent when ANY of its `refs` is priced in the MVP; `inherentFor` names
 * product types where the mention needs no priced ref (a bot's messages ARE
 * chat). Patterns only anchor the start of a word so inflected forms match
 * ("корзину", "savatga", "reviews"). Deliberately narrow: a missed mention costs
 * a finding, a false one costs trust in the checker.
 */

export interface Concept {
  id: string;
  re: RegExp;
  refs: readonly string[];
  inherentFor?: readonly ProjectType[];
  /** Context that makes the mention something else (cash at the counter is not an online payment). */
  exempt?: RegExp;
  /**
   * Only used to spot an assumption that says the thing is absent ("payment
   * later", "to'lov yo'q"): too broad for screens, where "payment terms" or
   * "to'lov holati" is content, not a feature.
   */
  negationOnly?: boolean;
  /** Page languages where the pattern is an ordinary word ("click" in English). */
  skipLocales?: readonly string[];
}

/** Uzbek o'/g'/tutuq apostrophe in any of its spellings (or none). */
const AP = "['‘’ʻ`]?";
/** Start-of-word anchor. */
const B = '(?<![\\p{L}\\p{N}])';
/** End-of-word anchor. */
const E = '(?![\\p{L}\\p{N}])';

const re = (source: string) => new RegExp(source, 'iu');

export const PAYMENT_REFS = ['payme', 'click', 'uzum_bank', 'paynet', 'visa_acquiring', 'stripe', 'paypal', 'kaspi', 'yookassa'] as const;
const UZ_PAYMENT_REFS = ['payme', 'click', 'uzum_bank', 'paynet', 'visa_acquiring'];
const MAP_REFS = ['map_view', 'address_picker', 'courier_tracking', 'delivery_zones', 'yandex_maps', 'google_maps', 'gis2'];
const NOTIFY_REFS = ['push', 'eskiz_sms', 'playmobile_sms', 'otp_sms', 'telegram_channel', 'email_service', 'bot_broadcast', 'realtime'];
const AI_REFS = ['ai_chatbot', 'rag_kb', 'ai_content', 'speech', 'vision', 'recommendations'];

const CASH = re(
  `cash|in person|on site|at the (?:studio|counter|desk|venue|clinic|shop|store)|(?:on|at|upon)[- ]pick-?up|при получении|наличн|на месте|${B}касс|naqd${E}|naqd pul|joyida|${B}kassa|qabul qilganda`
);

export const CONCEPTS: readonly Concept[] = [
  /* Payments */
  {
    id: 'payment',
    re: re(
      `(?:^|·\\s*)pay${E}(?![\\s-]+(?:at|on|in person|later|cash|upon))|${B}pay (?:now|online|with|by card)|payment (?:method|option)s?|(?:online|card|in-app) payments?|prepayment|предоплат|оплатить|онлайн-?оплат|оплат\\p{L}* (?:онлайн|картой|по карте|через)|способ\\p{L}* оплаты|принять оплату|${B}to${AP}lash${E}|to${AP}lov (?:qilish|usul|turi)|onlayn to${AP}lov|oldindan to${AP}lov|karta (?:orqali|bilan) to${AP}la`
    ),
    refs: [...PAYMENT_REFS, 'subscriptions'],
    exempt: CASH,
  },
  {
    id: 'payment-any',
    re: re(
      `${B}pay(?:s|ing|ment|ments)?${E}|${B}paid${E}|${B}оплат|${B}платеж|${B}платёж|${B}to${AP}lov|${B}to${AP}la(?:sh|nadi|ydi|nmaydi)`
    ),
    refs: [...PAYMENT_REFS, 'subscriptions'],
    negationOnly: true,
  },
  { id: 'brand:payme', re: re(`${B}payme${E}`), refs: ['payme'] },
  { id: 'brand:click', re: re(`${B}click${E}(?!\\s+(?:here|to|on|the))`), refs: ['click'], skipLocales: ['en'] },
  { id: 'brand:uzum', re: re(`${B}uzum\\s*(?:bank|pay|nasiya)`), refs: ['uzum_bank', 'nasiya'] },
  { id: 'brand:paynet', re: re(`${B}paynet${E}`), refs: ['paynet'] },
  { id: 'brand:stripe', re: re(`${B}stripe${E}`), refs: ['stripe'] },
  { id: 'brand:paypal', re: re(`${B}paypal${E}`), refs: ['paypal'] },
  { id: 'brand:kaspi', re: re(`${B}kaspi${E}`), refs: ['kaspi'] },
  { id: 'brand:yookassa', re: re(`yookassa|ю\\s?kassa|юкасс`), refs: ['yookassa'] },
  { id: 'brand:local-cards', re: re(`${B}(?:uzcard|humo)${E}`), refs: UZ_PAYMENT_REFS },
  { id: 'brand:cards', re: re(`${B}(?:visa|mastercard)${E}`), refs: [...PAYMENT_REFS] },
  { id: 'brand:wallets', re: re(`(?:apple|google)\\s?pay${E}`), refs: ['stripe', 'paypal', 'visa_acquiring'] },
  {
    id: 'installments',
    re: re(`${B}nasiya|muddatli to${AP}lov|рассрочк|${B}installments?${E}|${B}bnpl${E}|pay later|в кредит|kreditga`),
    refs: ['nasiya'],
  },
  { id: 'fiscal', re: re(`${B}(?:ofd|офд)${E}|fiskal|фискал|fiscal`), refs: ['soliq_ofd', 'printer_fiscal'] },

  /* Commerce */
  /** A 'cart' block is often just an order summary: priced by orders too. */
  { id: 'order-summary', re: /(?!)/u, refs: ['cart_checkout', 'orders'], exempt: CASH },
  { id: 'cart', re: re(`${B}cart${E}|${B}basket|${B}корзин|${B}savat`), refs: ['cart_checkout'] },
  { id: 'checkout', re: re(`${B}checkout`), refs: ['cart_checkout', 'subscriptions', ...PAYMENT_REFS] },
  {
    id: 'promo',
    re: re(`promo\\s?-?codes?|${B}promo${E}|${B}coupon|${B}купон|промокод|promokod|discount codes?|chegirma kodi`),
    refs: ['promo', 'loyalty'],
  },
  {
    id: 'loyalty',
    re: re(
      `loyalty|лояльн|sodiqlik|cashback|кэшбэк|кешбэк|keshbek|bonus points|бонус|${B}bonus(?:lar|ni)?${E}|referral (?:program|bonus|code|link)|реферальн|приведи друга|do${AP}st(?:ingiz|ingni)? taklif`
    ),
    refs: ['loyalty', 'promo'],
  },
  {
    id: 'subscription',
    re: re(`subscription|${B}subscribe|recurring (?:billing|payment)|подписк|${B}obuna`),
    refs: ['subscriptions'],
  },
  { id: 'payouts', re: re(`${B}payouts?${E}|выплат|commission|комисси|komissiya`), refs: ['marketplace_vendors'] },
  {
    id: 'reviews',
    re: re(`(?:leave|write) a review|reviews? (?:and|&) ratings?|${B}ratings?${E}|★|отзыв|рейтинг|${B}sharh|reyting`),
    refs: ['reviews'],
  },

  /* Communication */
  {
    id: 'chat',
    re: re(`${B}(?:chat|чат)(?!\\s?-?\\s?(?:bot|бот))|переписк|yozishma|мессенджер|messenger`),
    refs: ['chat', 'ai_chatbot', 'rag_kb', 'video_call'],
    inherentFor: ['telegram', 'ai'],
  },
  {
    id: 'live-operator',
    re: re(
      `(?:live|human)\\s(?:agent|operator|support)|жив\\p{L}*\\sоператор|оператор\\p{L}*\\s(?:подключ|ответ)|jonli operator|operator(?:ga)? (?:ulan|bog${AP}lan)`
    ),
    refs: ['chat', 'bot_admin', 'custom_api'],
  },
  {
    id: 'video-call',
    re: re(`video\\s?call|videocall|видеозвон|видеосвяз|видеоконсульт|video\\s?qo${AP}ng${AP}iroq|video\\s?konsultats`),
    refs: ['video_call'],
  },
  {
    id: 'notify',
    re: re(`${B}push|notification|уведомлен|bildirishnoma|xabarnoma|reminder|напоминан|eslatma`),
    refs: NOTIFY_REFS,
    inherentFor: ['telegram'],
  },
  { id: 'sms', re: re(`${B}(?:sms|смс)${E}`), refs: ['otp_sms', 'eskiz_sms', 'playmobile_sms'] },
  { id: 'broadcast', re: re(`broadcast|рассылк|ommaviy xabar|${B}mailing|newsletter`), refs: ['bot_broadcast', 'email_service', 'push'] },
  {
    id: 'brand:telegram',
    re: re(`telegram|телеграм`),
    refs: ['telegram_channel', 'bot_broadcast', 'bot_admin'],
    inherentFor: ['telegram'],
  },
  { id: 'brand:eskiz', re: re(`${B}eskiz${E}`), refs: ['eskiz_sms'] },

  /* Accounts */
  {
    id: 'auth',
    re: re(
      `sign[\\s-](?:up|in)${E}|log\\s?-?in${E}|create (?:an )?account|${B}register|registration|регистрац|${B}войти|вход в (?:аккаунт|кабинет|систему)|ro${AP}yxatdan o${AP}t|tizimga kirish|^\\s*kirish\\s*$|${B}parol${E}|password|пароль`
    ),
    refs: ['auth_basic', 'otp_sms', 'social_login', 'oneid', 'myid'],
    inherentFor: ['telegram'],
    // Joining a waitlist or a newsletter is not an account.
    exempt: re(`waitlist|newsletter|mailing list|лист ожидания|рассылк|kutish ro${AP}yxati`),
  },
  {
    id: 'social-login',
    re: re(
      `(?:sign|log)\\s?-?in with (?:google|apple|facebook|microsoft)|continue with (?:google|apple|facebook|microsoft)|(?:через|orqali) (?:google|apple|microsoft)|google bilan kirish|apple id|single sign-on|${B}sso${E}`
    ),
    refs: ['social_login'],
  },
  { id: 'brand:myid', re: re(`${B}my\\s?id${E}`), refs: ['myid'] },
  { id: 'brand:oneid', re: re(`${B}one\\s?id${E}`), refs: ['oneid'] },
  { id: 'brand:eimzo', re: re(`e-?imzo|э-?имзо`), refs: ['eimzo'] },
  { id: 'brand:didox', re: re(`${B}didox${E}|e-?faktura|э-?фактур|e-?invoic`), refs: ['didox'] },

  /* Operations */
  {
    id: 'admin',
    re: re(`${B}admin|админ|back-?office|бэк-?офис|панел\\p{L}* оператора|operator paneli|boshqaruv paneli|control panel`),
    refs: ['admin_panel', 'bot_admin', 'cms', 'dashboard'],
  },
  { id: 'blog', re: re(`${B}blog|блог|${B}news${E}|новост|yangilik`), refs: ['blog', 'cms'] },
  { id: 'analytics', re: re(`analytics|аналитик|analitika|${B}kpi${E}`), refs: ['dashboard', 'reports_export', 'analytics_setup'] },
  {
    id: 'reports',
    re: re(
      `${B}reports${E}|(?:sales|daily|monthly|weekly|financial|kpi|manager)\\s+reports?|отч[её]т|hisobot|${B}export|экспорт|выгрузк|eksport`
    ),
    refs: ['reports_export', 'import_export', 'dashboard', 'sheets'],
  },
  { id: 'import', re: re(`${B}import|импорт`), refs: ['import_export', 'onec', 'sheets', 'custom_api'] },
  {
    id: 'upload',
    re: re(
      `${B}upload|загрузить файл|загрузк\\p{L}* (?:файл|фото|документ)|прикреп|${B}attach|(?:fayl|rasm|hujjat|foto|surat)(?:ni|lar|larni)? yukla`
    ),
    refs: ['file_upload', 'import_export', 'vision', 'speech', 'rag_kb', 'cms', 'admin_panel'],
    inherentFor: ['ai'],
  },
  {
    id: 'offline',
    re: re(
      `offline mode|works offline|without (?:internet|signal|connection)|офлайн-?режим|работ\\p{L}* (?:офлайн|без интернета)|без интернета|oflayn rejim|internetsiz`
    ),
    refs: ['offline'],
  },
  {
    id: 'barcode',
    re: re(
      `barcode|штрих-?код|shtrix|${B}scan(?:ning)?\\s+(?:the\\s+|a\\s+)?(?:barcode|qr|code|ticket|pallet|label)|скан\\p{L}* (?:штрих|qr|код)|qr[- ]?(?:kod|код|code)ni skaner|skanerla`
    ),
    refs: ['barcode', 'vision'],
  },
  {
    id: 'printer',
    re: re(`(?:receipt|fiscal) printer|${B}printer|принтер|chek printer`),
    refs: ['printer_fiscal', 'soliq_ofd'],
  },

  /* Geo */
  {
    id: 'map',
    re: re(
      `${B}maps?${E}|xarita|на карте|карт\\p{L}* (?:города|маршрут|точек|филиал|доставк)|маршрут|${B}routes?${E}(?!\\s+(?:unresolved|chats?|leads?|tickets?|calls?|requests?|messages?|orders?|them|it|to)${E})|marshrut`
    ),
    refs: MAP_REFS,
  },
  {
    id: 'live-tracking',
    re: re(
      `(?:live|real[- ]?time|gps)\\s(?:tracking|location)|track(?:ing)?\\s(?:the\\s|your\\s)?(?:courier|driver)|где (?:курьер|водитель)|отслеживан\\p{L}* (?:курьер|водител)|(?:kuryer|haydovchi)(?:ni)? (?:jonli )?kuzat|jonli kuzat`
    ),
    refs: ['courier_tracking', 'realtime'],
  },
  { id: 'delivery-zones', re: re(`delivery zones?|зон\\p{L}* доставки|yetkaz\\p{L}*(?: berish)? zona`), refs: ['delivery_zones'] },
  { id: 'brand:yandex-maps', re: re(`(?:yandex|яндекс)\\s?(?:maps|карт|xarita)`), refs: ['yandex_maps'] },
  { id: 'brand:google-maps', re: re(`google\\s?maps`), refs: ['google_maps'] },
  { id: 'brand:2gis', re: re(`2\\s?(?:gis|гис)`), refs: ['gis2'] },

  /* Business systems */
  { id: 'brand:1c', re: re(`${B}1\\s?[cс]${E}`), refs: ['onec'] },
  { id: 'brand:bitrix', re: re(`bitrix|битрикс`), refs: ['bitrix24'] },
  { id: 'brand:amocrm', re: re(`amo\\s?crm|амо\\s?срм`), refs: ['amocrm'] },
  { id: 'brand:moysklad', re: re(`мойсклад|moy\\s?sklad`), refs: ['moysklad'] },
  { id: 'brand:billz', re: re(`${B}billz${E}`), refs: ['billz'] },
  { id: 'brand:smartup', re: re(`${B}smartup${E}`), refs: ['smartup'] },
  { id: 'brand:sheets', re: re(`google\\s?(?:sheets|таблиц)`), refs: ['sheets'] },
  {
    id: 'brand:third-party',
    re: re(
      `quickbooks|sharepoint|zendesk|shopify|salesforce|hubspot|samsara|athenahealth|active directory|google calendar|outlook|${B}slack${E}|docusign|${B}(?:mls|idx)${E}|${B}zoom${E}|calendly|mindbody|follow up boss|${B}xero${E}|netsuite|${B}sap${E}|toast pos|square pos|${B}epic${E} ehr`
    ),
    refs: ['custom_api'],
  },
  /** Email marketing tools are priced by the email service (round 2: Mailchimp flagged although it was priced). */
  { id: 'brand:email-tools', re: re(`mailchimp|sendgrid|${B}brevo${E}|mailgun|postmark|klaviyo`), refs: ['email_service', 'custom_api'] },
  /** An SMS gateway outside Uzbekistan is priced by the SMS feature (Eskiz / Play Mobile inside it). */
  {
    id: 'brand:sms-tools',
    re: re(`twilio|vonage|messagebird|${B}plivo${E}`),
    refs: ['otp_sms', 'eskiz_sms', 'playmobile_sms', 'custom_api'],
  },

  /* AI */
  {
    id: 'ai',
    re: re(`${B}(?:ai|ии|gpt)${E}|sun${AP}iy intellekt|искусственн|нейросет`),
    refs: AI_REFS,
    inherentFor: ['ai'],
  },
  {
    id: 'citations',
    re: re(`citation|${B}cited${E}|with sources|ссылк\\p{L}* на (?:источник|документ)|manbaga havola`),
    refs: ['rag_kb'],
  },
  {
    id: 'speech',
    re: re(
      `speech[- ]to[- ]text|transcri|распознав\\p{L}* речи|расшифровк|nutqni (?:aniq|matn)|voice (?:recognition|assistant|input|search)|голосов\\p{L}* (?:ввод|ассистент|поиск)|ovozli (?:qidiruv|yordamchi|buyruq)`
    ),
    refs: ['speech'],
  },
  {
    id: 'vision',
    re: re(`(?:image|photo) recognition|распознаван\\p{L}* (?:изображ|фото)|(?:rasm|tasvir)ni aniqla|${B}ocr${E}`),
    refs: ['vision'],
  },
  {
    id: 'recommendations',
    re: re(`(?:ai|personali[sz]ed) recommend|персональн\\p{L}* рекоменд|ии-?рекоменд|(?:shaxsiy|ai) tavsiya`),
    refs: ['recommendations'],
  },
];

/** Block kinds that draw a capability on their own (an MVP map block needs a priced map…). */
export const BLOCK_CONCEPTS: Partial<Record<BlockKind, string>> = {
  map: 'map',
  chat: 'chat',
  checkout: 'payment',
  cart: 'order-summary',
  upload: 'upload',
  chart: 'analytics',
};

/**
 * MVP refs a user sees on a screen (for the coverage figure). Plumbing such as
 * roles, fiscal receipts or a custom API has no screen of its own.
 */
export const INVISIBLE_REFS: ReadonlySet<string> = new Set([
  'roles',
  'analytics_setup',
  'soliq_ofd',
  'custom_api',
  'eskiz_sms',
  'playmobile_sms',
  'email_service',
  'telegram_channel',
  'multi_tenant',
  'highload',
  'api_public',
  'realtime',
  'autoupdate',
  'offline',
  'profiles',
  'catalog',
  'orders',
  'search',
  'address_picker',
  'yandex_maps',
  'google_maps',
  'gis2',
]);

/* ------------------------------------------------------------------ */
/* Assumption / prose markers                                          */
/* ------------------------------------------------------------------ */

/** "later", "second phase", "keyingi bosqich"… — the clause defers what it names. */
export const DEFERRAL = re(
  `${B}later${E}|postpone|${B}defer|after (?:the )?(?:mvp|launch|first (?:version|release))|(?:next|second|growth) phase|phase (?:2|two)|in the future|${B}eventually|post-?launch|${B}v2${E}|coming soon|` +
    `позже|${B}потом${E}|втор\\p{L}* (?:этап|фаз)|следующ\\p{L}* (?:этап|фаз)|после (?:mvp|запуска)|в будущем|на будущее|скоро|отклад|перенос\\p{L}* на|` +
    `${B}keyin${E}(?=\\s*(?:[.,;)]|$))|keyinroq|keyinchalik|keyingi (?:bosqich|faza|versiya)|ikkinchi (?:bosqich|faza)|kelajakda|kechiktiril|keyinga qoldir|mvp(?:dan)? (?:so${AP}ng|keyin)|tez orada`
);

/** Wireframe copy that openly defers ("Coming soon") is not a promise. */
export const SCREEN_DEFERRAL = re(`coming soon|${B}later${E}|скоро|позже|tez orada|keyinroq|keyinchalik`);

/** "Cash only" excludes online payment even without a negation word. */
export const CASH_ONLY = re(`cash only|only (?:in )?cash|только наличн|наличными только|faqat naqd`);

/** "no", "without", "не требуется", "yo'q", "-siz"… — the clause excludes what it names. */
export const NEGATION = re(
  `${B}(?:no|not|without|none|never|excluded?|isn${AP}t|aren${AP}t|doesn${AP}t|don${AP}t|won${AP}t)${E}|` +
    `${B}(?:без|не|нет|ни)${E}|` +
    `yo${AP}q${E}|${B}emas${E}|${B}kerakmas|(?:to${AP}lov|internet|ro${AP}yxat|login|parol|kuryer|xarita|admin|ilova|sayt|sms|chat|onlayn)siz${E}|\\p{L}(?:maydi|magan|masdan|maslik|maydigan|mas)${E}`
);

/** "provided by the client", "handled separately" — outside our build, not a promise. */
export const EXTERNAL = re(
  `separately|by the client|unpriced|not priced|(?:outside|not in|not part of) (?:the|this) (?:estimate|scope|price)|вне (?:этой )?оценки|не входит в (?:эту )?(?:оценку|смету|стоимость)|baholanmagan|narxga kirmaydi|narxga kiritilmagan|client (?:provides|supplies)|supplied|provided by|handled (?:offline|by)|` +
    `отдельно|заказчик|сам\\p{L}* клиент|предоставля|вне (?:системы|платформы|приложения)|outside the (?:system|platform|app)|tizimdan tashqari|` +
    `${B}alohida|mijoz tomon|buyurtmachi|o${AP}zi (?:beradi|tayyorlaydi)`
);

/** Unpriced needs that are not software (content, licences, hardware, physical ops): fine to show on a screen. */
export const NON_SOFTWARE = re(
  `production|${B}content${E}|контент|kontent|наполнени|to${AP}ldirish|разметк|annotat|label?ling|data (?:preparation|cleaning|entry)|подготовк|очистк|tayyorla|copywriting|photo\\s?shoot|licen[cs]|лиценз|litsenz|hardware|оборудован|uskuna|${B}gpu${E}|${B}server|сервер|hosting|хостинг|purchas|закуп|оцифровк|digiti[sz]|съёмк|контент\\p{L}* (?:создан|подготов)|подготовк\\p{L}* (?:архив|контент)|fleet|автопарк|avtopark|warehouse|${B}ombor|logistics|логистик|logistika|legal|юрид|staff|персонал|xodim`
);

/** …unless the item is an integration (then a screen showing it does promise it). */
export const INTEGRATION_WORDS = re(
  `integrat|интеграц|integratsiya|${B}sync|синхрон|sinxron|${B}api${E}|${B}sdk${E}|connect|подключ|${B}ulash`
);

/* ------------------------------------------------------------------ */
/* Tokens for free-text unpriced items                                 */
/* ------------------------------------------------------------------ */

/** Function words and generic product words — never distinctive. */
export const STOPWORDS: ReadonlySet<string> = new Set(
  (
    'and the for with from into onto over under via per one two our their your its this that these those than then ' +
    'beyond only own custom basic simple full first second new existing internal external based level provider vendor account plan ' +
    'integration integrations sync syncing synchronization system systems module modules platform platforms app apps ' +
    'application applications service services support data user users management manage managing api apis tool tools ' +
    'feature features setup set process pipeline engine layer flow workflow automatic automated automation ' +
    'и в во на с со по для от до из к ко о об при через без или а но же это как что так все всё его её их ' +
    'интеграция интеграции интеграцию синхронизация синхронизации система системы систему модуль модуля платформа ' +
    'приложение приложения приложении сервис сервиса поддержка данных данные пользователей управление ' +
    'оценивается отдельно напрямую собственный свой своя своё провайдер провайдера ' +
    'va bilan uchun orqali hamda yoki ham bu shu ular integratsiya integratsiyasi sinxronlash tizim tizimi tizimga ' +
    'modul ilova ilovasi platforma platformasi xizmat xizmati qollab maxsus alohida provayder'
  )
    .split(/\s+/)
    .filter(Boolean)
);

/** Brand names: one of them alone is enough to tie a text to an unpriced item. */
export const BRAND_TOKENS: ReadonlySet<string> = new Set([
  'quickbooks',
  'sharepoint',
  'mailchimp',
  'zendesk',
  'shopify',
  'salesforce',
  'hubspot',
  'samsara',
  'athenahealth',
  'calendly',
  'mindbody',
  'twilio',
  'docusign',
  'netsuite',
  'xero',
  'slack',
  'outlook',
  'zoom',
  'whatsapp',
  'instagram',
  'uzcard',
  'humo',
  'ifta',
  'sdk',
]);
