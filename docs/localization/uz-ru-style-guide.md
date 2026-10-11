# Uzbek and Russian copy: style guide

How SoftWhere writes the site in Uzbek (uz, Latin) and Russian (ru). The rule
underneath everything: **write it as a Tashkent copywriter would for a local
client, not as a translation of the English.** English is the source of
*meaning*, never of sentence shape, idiom or rhythm.

Sources: website-localization practice (style guide + glossary before
translating, native final review, local search wording rather than translated
keywords), Ilyakhov's information style and anti-канцелярит rules for Russian,
Uzbek Unicode/orthography notes (U+02BB), the 676 "wrong → right" pairs from
our native Uzbek audits of the AI brief (`src/modules/estimator/ai-brief/uzGlossary.ts`),
and how Tashkent studios and OLX/Yellow Pages listings name these services.

## Who reads it

Owners and managers of small and mid-size businesses in Uzbekistan (cafés,
shops, clinics, logistics, education, distributors), plus startup founders.
Busy, practical and price-aware. Most are not technical. Many read Russian at
work and Uzbek at home; younger owners read Uzbek Latin first.

## Both languages

- **Transcreate, don't translate.** Rewrite each sentence from its meaning.
  If an English line is a pun, a rhythm trick or an idiom ("ship it", "no
  fluff", "under the hood"), find the local way to say the same thing, or say
  it plainly.
- **Concrete over clever.** Name what the client gets: orders in Telegram,
  payment through Click/Payme, the manager sees everything in one screen.
  Cut abstract nouns.
- **Address the reader politely:** Uzbek **siz** (never sen); Russian **вы**
  (lower case — capital «Вы» only in a personal letter). Keep one form across
  the page.
- **Keep it short.** Uzbek and Russian run 15–35% longer than English, and
  headings, buttons and badges have fixed space. Aim for the English length;
  a button stays 1–3 words.
- **Don't add or drop facts.** Numbers, prices, weeks, brand names, product
  names and claims stay exactly as in English. Don't invent promises,
  statistics or guarantees.
- **Local realities:**
  - money in so'm on uz/ru pages where the English uses so'm;
  - Click, Payme, Uzum and Telegram where they appear;
  - cities and names as locals write them (Toshkent / Ташкент).
- **Brand and tech names stay in Latin:** Telegram, Mini App, iOS, Android,
  App Store, Google Play, CRM, AI, RAG, API, Next.js, React Native. Don't
  transliterate them.

## Uzbek (Latin)

- **Letters:** oʻ, gʻ with U+02BB (ʻ). Tutuq belgisi (ta'minot, san'at,
  e'lon) with U+02BC (ʼ): taʼminot, sanʼat, eʼlon. Never ASCII ', never
  ‘ ’ inside words. Quotes are «…» or “…”, used consistently.
- **Register:** natural, respectful business Uzbek. Not bureaucratic (avoid
  "amalga oshirilmoqda" chains, "mazkur", "ushbu" piles) and not street slang.
  Short active sentences: "Buyurtmani Telegramda qabul qilasiz", not
  "Buyurtmalarning qabul qilinishi Telegram orqali amalga oshiriladi".
- **Russian and English calques to avoid** (from the native audits):

  | Don't write | Write | Note |
  |---|---|---|
  | qurish / quramiz (software) | ishlab chiqish / ishlab chiqamiz; yaratamiz | |
  | yopadi (covers a need) | hal qiladi, qamrab oladi | |
  | og'riqli joy / og'riq (pain point) | muammo | |
  | qiymat (value) | foyda, mohiyat | qiymat = a number or price |
  | sur'at (photo) | surat | sur'at = speed |
  | yozuv (booking) | bron, yozilish | |
  | zahoti on its own | darhol | |
  | "keys" for a case study | loyiha, ish namunasi | |
  | "relizdan keyin" overuse | ishga tushgandan keyin | |
  | "fidbek" | fikr-mulohaza | |
  | "deadline" | muddat | |

  Also check the full list in `uzGlossary.ts` (the same reviewers).
- **Settled IT words:**
  - mobil ilova; veb-sayt or sayt; Telegram-bot / Telegram bot
  - Mini App (keep English); admin panel; CRM tizimi
  - dasturiy taʼminot; server; maʼlumotlar bazasi; integratsiya
  - test qilish / sinovdan oʻtkazish; dizayn; prototip
  - ishga tushirish (launch); qoʻllab-quvvatlash (support)
  - texnik topshiriq (TZ, spec); narx (price); muddat (timeline)
  - buyurtma (order); toʻlov (payment); mijoz (customer/client)
- **Word order and suffixes:**
  - verbs at the end;
  - don't stack -ning chains;
  - plural -lar only where Uzbek needs it ("3 ta ilova", not "3 ta ilovalar");
  - numbers + "ta" for counted things.
- **Headings:** a short statement or a short question. No English-style
  fragments that don't parse in Uzbek.

## Russian

- **Information style** (Ilyakhov):
  - cut канцелярит: «осуществляем», «является», «данный», «в рамках»,
    «производится», «на сегодняшний день»;
  - cut genitive chains («процесс оптимизации системы…»);
  - cut empty superlatives: «уникальный», «инновационный», «лучший»,
    «высококачественный»;
  - prefer verbs: «принимаем заказы в Telegram», not «осуществляем приём заказов».
- **English calques to avoid:**
  - «в конце дня», «давайте нырнём», «это меняет игру», «под капотом»
    (fine only in a tech aside)
  - «доставляем ценность», «решение под ваши нужды», «end-to-end»
  - «команда экспертов», «мы — ваш партнёр», «не просто X, а Y»
- **Settled IT words:**
  - мобильное приложение; сайт; Telegram-бот; Mini App (keep); админ-панель
  - CRM-система; разработка; запуск; поддержка; дизайн; прототип
  - техническое задание (ТЗ); смета; сроки; «под ключ» (where natural)
  - заявка (lead); оплата через Click и Payme
- **Typography:**
  - quotes «ёлочки», with „лапки“ inside them;
  - em dash — with spaces;
  - ranges with an en dash without spaces (3–5 недель);
  - non-breaking space after one- and two-letter prepositions and conjunctions
    where the copy is long-form (skip in short UI strings);
  - ё written where it changes meaning or pronunciation (всё, ещё, её).
- **Grammar:**
  - correct numeral agreement in ICU plurals (one/few/many/other:
    1 неделя, 2 недели, 5 недель);
  - no unnecessary capitals in headings (Russian capitalises only the first
    word and proper names).

## Technical rules for the message files

- **Keep structure:** keep every JSON key, the ICU placeholders (`{count}`,
  `{min}`), plural/select blocks and rich tags (`<b>…</b>`) exactly.
  Translate only the text.
- **Match English:** the key sets of uz/ru must equal en.
- **Length:** don't make visible strings much longer than English. Buttons,
  badges, tabs and table headers must stay short.
- **What changes:** only the text values. When unsure of a term, prefer the
  word a Tashkent business owner would type into Google or OLX.
