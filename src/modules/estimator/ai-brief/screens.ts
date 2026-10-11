import type { ProjectType } from '@/modules/estimator/types';
import { BLOCK_KINDS, CAPS, DEVICES, PHASES, type BlockKind, type Device } from '@/modules/estimator/ai-brief/constants';
import type { PricedScope } from '@/modules/estimator/ai-brief/digest';
import { asList, asObject, clip, extractJson, label, pick, type TextContext } from '@/modules/estimator/ai-brief/parse';
import { isClaimLike } from '@/modules/estimator/ai-brief/textGuards';
import type { Parsed, WireframeBlock, WireframeScreen } from '@/modules/estimator/ai-brief/types';

/**
 * Call 3 parser + scope guard for the lo-fi wireframes.
 *
 * The screens call sees the priced scope, but a wireframe is still the most
 * visible place for a contradiction, so the guard enforces the scope
 * deterministically (each rule maps to an audit finding):
 *  - frames: an MVP screen uses the product's frame (phone/chat/desktop) or,
 *    when an admin panel is priced, the browser — never a web marketplace in
 *    browser frames for a mobile-first MVP;
 *  - MVP screens never name an integration that is not priced in the MVP
 *    (Payme/Uzum at checkout, OFD receipts, nasiya, Eskiz…) and never draw a
 *    checkout, map, chat or upload block the MVP does not price;
 *  - sample copy states no facts about the client: no percentages, years,
 *    "12 years on the market", experience claims;
 *  - at most one 'later' screen.
 */

export interface ScreensContext extends TextContext {
  priced: PricedScope;
  /** Drawable screens this answer needs to be usable (default `CAPS.screensMin`; a wireframe half needs fewer). */
  minScreens?: number;
  /** False for the half that draws only MVP screens: a 'later' screen there is dropped. */
  allowLater?: boolean;
}

const word = (source: string) => new RegExp(`(?<![\\p{L}\\p{N}])(?:${source})(?![\\p{L}\\p{N}])`, 'iu');

/**
 * How an integration shows up in wireframe copy. Only services whose presence
 * on a screen is a promise to the visitor (a way to pay, fiscal receipts,
 * identity checks, Telegram notifications) — business systems such as 1C or
 * amoCRM are often named as one-time import sources and stay untouched.
 */
const MENTIONS: Record<string, RegExp> = {
  payme: word('payme'),
  click: word('click'),
  // Bare "uzum" is the Uzbek word for grapes; only the payment brand counts here
  // (a bare "Uzum" checkout option is caught by CHECKOUT_MENTIONS).
  uzum_bank: /uzum\s*(?:bank|pay|nasiya)/iu,
  paynet: word('paynet'),
  nasiya: /nasiya|muddatli to['‘’ʻ`]?lov|рассрочк|installment|(?<!\p{L})bnpl(?!\p{L})|pay later/iu,
  soliq_ofd: /(?<!\p{L})(?:ofd|офд)(?!\p{L})|fiskal|фискал|fiscal/iu,
  stripe: word('stripe'),
  paypal: word('paypal'),
  kaspi: word('kaspi'),
  yookassa: /yookassa|ю\s?kassa|юкасс/iu,
  telegram_channel: /telegram|телеграм/iu,
  myid: word('my\\s?id'),
  oneid: word('one\\s?id'),
  eimzo: /e-?imzo|э-?имзо/iu,
  didox: word('didox'),
};

/** Payment options written as a bare name inside a checkout block. */
const CHECKOUT_MENTIONS: Record<string, RegExp> = { uzum_bank: /^\s*uzum\s*$/iu };

const PAYMENT_REFS = ['payme', 'click', 'uzum_bank', 'paynet', 'visa_acquiring', 'nasiya', 'stripe', 'paypal', 'kaspi', 'yookassa'];
const MAP_REFS = ['map_view', 'address_picker', 'courier_tracking', 'delivery_zones', 'yandex_maps', 'google_maps', 'gis2'];
const CHAT_REFS = ['chat', 'ai_chatbot', 'rag_kb', 'video_call'];
const UPLOAD_REFS = ['file_upload', 'import_export', 'vision', 'speech', 'rag_kb'];
/** A chat named as such ("Chat with the driver", "Чат с оператором") — not "correspondence" or "messages". */
const CHAT_MENTION = /(?<!\p{L})(?:chat|чат)/iu;

interface Gate {
  mvp: Set<string>;
  projectType: ProjectType;
  device: Device;
  primary: Device;
}

const has = (g: Gate, refs: string[]) => refs.some(r => g.mvp.has(r));
const chatAllowed = (g: Gate) => g.device === 'chat' || g.projectType === 'telegram' || g.projectType === 'ai' || has(g, CHAT_REFS);

const SEARCH_REFS = ['search', 'rag_kb'];
/** An address or place search sits on top of a priced map or address picker. */
const ADDRESS_SEARCH = /address|location|place|street|manzil|joy|ko['‘’ʻ`]?cha|адрес|улиц|мест/iu;

/**
 * A search field or filter chips on the product's own screens is the "Search
 * & filters" feature (14 h): drawn without it, the wireframe showed work the
 * MVP does not price (round-2 audit: "Search coffees", "Tovar qidirish").
 * Operator/admin views keep theirs — finding a row is part of any admin panel.
 */
const searchAllowed = (g: Gate, block: WireframeBlock) =>
  g.projectType === 'ai' ||
  g.device !== g.primary ||
  has(g, SEARCH_REFS) ||
  (has(g, MAP_REFS) && ADDRESS_SEARCH.test([block.label, ...block.items].join(' ')));

/** Block kinds an MVP screen may only draw when the MVP prices them. */
const BLOCK_GATES: Partial<Record<BlockKind, (g: Gate, block: WireframeBlock) => boolean>> = {
  checkout: g => has(g, ['cart_checkout', 'subscriptions', ...PAYMENT_REFS]),
  map: g => has(g, MAP_REFS),
  chat: chatAllowed,
  upload: g =>
    g.projectType === 'ai' || has(g, UPLOAD_REFS) || (g.device !== g.primary && has(g, ['admin_panel', 'cms'])) || g.mvp.has('cms'),
  search: searchAllowed,
  filters: searchAllowed,
};

/* ------------------------------------------------------------------ */
/* Structural parse                                                    */
/* ------------------------------------------------------------------ */

/**
 * Template zeros that read as a glitch to a client: "Plan A — $00/mo",
 * "Tarif A — 000 000 so'm/oy", "Active members: 00". The amount (with its
 * currency, period and the separator before it) is removed; real amounts
 * ("45 000 so'm", "$2,000") and times ("09:00") are not zeros-only and stay.
 */
const CURRENCY = "(?:\\$|€|£|₸|₽|so['‘’ʻ`]?m|сум|сўм|тг|руб\\.?|usd|uzs)";
const ZERO_AMOUNT = new RegExp(
  `\\s*(?:[—–:|-]\\s*)?(?:${CURRENCY}\\s?)?(?<!\\p{N}[\\s.,]?)(?<!:)0{2,}(?:[ \\u00a0.,]0{3})*(?!\\p{N})(?:\\s?${CURRENCY})?(?:\\s?\\/\\s?\\p{L}+\\.?)?`,
  'giu'
);

export function stripZeroAmounts(value: string): string {
  if (!value.includes('00')) return value;
  return value
    .replace(ZERO_AMOUNT, '')
    .replace(/[\s—–:|-]+$/u, '')
    .trim();
}

const text = (value: unknown, max: number, ctx?: TextContext) => stripZeroAmounts(ctx ? label(value, max, ctx) : clip(value, max));

/** Paragraph-like blocks carry a sentence, not a caption: give them room instead of a mid-word "…". */
const LONG_LABEL_KINDS: readonly string[] = ['text', 'hero'];
const LONG_ITEM_KINDS: readonly string[] = ['chat'];

function parseBlocks(value: unknown, screenName: string, issues: string[], ctx?: TextContext): WireframeBlock[] {
  const blocks: WireframeBlock[] = [];
  for (const entry of asList(value)) {
    const raw = asObject(entry);
    if (typeof raw.kind !== 'string' || !(BLOCK_KINDS as readonly string[]).includes(raw.kind)) {
      issues.push(`screen "${screenName}": dropped block kind ${JSON.stringify(raw.kind)}`);
      continue;
    }
    const kind = raw.kind as BlockKind;
    blocks.push({
      kind,
      label: text(raw.label, LONG_LABEL_KINDS.includes(kind) ? CAPS.shortText : CAPS.label, ctx),
      items: asList(raw.items)
        .map(v => text(v, LONG_ITEM_KINDS.includes(kind) ? CAPS.shortText : CAPS.label, ctx))
        .filter(Boolean)
        .slice(0, CAPS.blockItems),
    });
  }
  return blocks.slice(0, CAPS.blocksMax);
}

function parseScreenList(value: unknown, issues: string[], ctx?: TextContext): WireframeScreen[] {
  const screens: WireframeScreen[] = [];
  for (const entry of asList(value)) {
    const raw = asObject(entry);
    const name = text(raw.name, CAPS.label, ctx);
    const blocks = parseBlocks(raw.blocks, name, issues, ctx);
    if (!name || blocks.length < CAPS.blocksMin) {
      issues.push(`screen "${name}": dropped (${blocks.length} usable blocks)`);
      continue;
    }
    screens.push({
      name,
      purpose: text(raw.purpose, CAPS.sentence, ctx),
      device: pick(raw.device, DEVICES, 'phone', `screen "${name}".device`, issues),
      phase: pick(raw.phase, PHASES, 'mvp', `screen "${name}".phase`, issues),
      blocks,
    });
  }
  return screens;
}

/* ------------------------------------------------------------------ */
/* Scope guard                                                         */
/* ------------------------------------------------------------------ */

/** Mentions an MVP screen must not contain: services not priced in the MVP. */
function forbiddenMentions(ctx: ScreensContext, mentions: Record<string, RegExp>): RegExp[] {
  const mvp = new Set(ctx.priced.mvpRefs);
  return Object.entries(mentions)
    .filter(([id]) => !mvp.has(id))
    .filter(([id]) => !(id === 'click' && ctx.locale === 'en'))
    .filter(([id]) => !(id === 'telegram_channel' && ctx.priced.product.projectType === 'telegram'))
    .map(([, re]) => re);
}

type TextCheck = (text: string, kind?: BlockKind) => boolean;

function guardBlocks(screen: WireframeScreen, gate: Gate, isBad: TextCheck, issues: string[]): WireframeBlock[] {
  return screen.blocks.flatMap(block => {
    const allowed = BLOCK_GATES[block.kind];
    if (screen.phase === 'mvp' && allowed && !allowed(gate, block)) {
      issues.push(`screen "${screen.name}": dropped ${block.kind} block (not priced in the MVP)`);
      return [];
    }
    const blockLabel = isBad(block.label) ? '' : block.label;
    const items = block.items.filter(item => !isBad(item, block.kind));
    const removed = (blockLabel !== block.label ? 1 : 0) + block.items.length - items.length;
    if (removed) issues.push(`screen "${screen.name}": removed ${removed} ${block.kind} text(s) outside the scope or stating facts`);
    if ((removed && !blockLabel && items.length === 0) || (block.kind === 'checkout' && items.length === 0)) return [];
    return [{ ...block, label: blockLabel, items }];
  });
}

/** A whole-word match of any scrubbed name ("Анна" in "Мастер Анна", not in "Аннаниев"). */
function mentionsName(text: string, names: RegExp | null): boolean {
  return !!names && names.test(text);
}

const escapeRe = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A whole-word match of any of the names the scrubber replaced (null when there are none). */
export function namesRegex(names?: readonly string[]): RegExp | null {
  return names?.length ? new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.map(escapeRe).join('|')})(?![\\p{L}\\p{N}])`, 'iu') : null;
}

/**
 * Systems a product connects to, whose own screens are not ours to draw
 * (round-2 iteration 2: "Agent handoff queue in Zendesk" wireframed Zendesk's
 * agent workspace as an MVP deliverable).
 */
const THIRD_PARTY =
  'zendesk|intercom|freshdesk|amo\\s?crm|амо\\s?срм|bitrix\\s?24|битрикс|1[cс]|shopify|salesforce|hubspot|quickbooks|sap|follow up boss|athenahealth|epic|toast|mindbody|calendly|google calendar|outlook|slack|jira|sharepoint|zoho|pipedrive|odoo|moysklad|мойсклад';
const IN_THIRD_PARTY = new RegExp(
  `(?:(?<![\\p{L}])(?:in|inside|within)\\s+(?:the\\s+)?(?:${THIRD_PARTY})(?![\\p{L}\\p{N}])|(?<![\\p{L}])(?:${THIRD_PARTY})\\s+ichida(?![\\p{L}]))`,
  'iu'
);

/** A screen named as a place inside a third-party system: its UI, not ours. */
export function isThirdPartyScreen(name: string): boolean {
  return IN_THIRD_PARTY.test(name);
}

export function guardScreens(screens: WireframeScreen[], ctx: ScreensContext, issues: string[]): WireframeScreen[] {
  const { priced } = ctx;
  const avoid = namesRegex(ctx.avoidNames);
  const mvp = new Set(priced.mvpRefs);
  const forbidden = forbiddenMentions(ctx, MENTIONS);
  const forbiddenAtCheckout = forbiddenMentions(ctx, CHECKOUT_MENTIONS);
  const guarded: WireframeScreen[] = [];
  let laterScreens = 0;

  for (const screen of screens) {
    if (screen.phase === 'later' && ctx.allowLater === false) {
      issues.push(`screen "${screen.name}": dropped (this part draws MVP screens only)`);
      continue;
    }
    if (screen.phase === 'later' && ++laterScreens > CAPS.laterScreens) {
      issues.push(`screen "${screen.name}": dropped (only ${CAPS.laterScreens} later screen)`);
      continue;
    }
    const frames = screen.phase === 'mvp' ? priced.frames.mvp : priced.frames.later;
    const device = frames.includes(screen.device) ? screen.device : priced.frames.primary;
    if (device !== screen.device) issues.push(`screen "${screen.name}": frame ${screen.device} → ${device}`);

    const gate: Gate = { mvp, projectType: priced.product.projectType, device, primary: priced.frames.primary };
    const isMvp = screen.phase === 'mvp';
    const noChat = isMvp && !chatAllowed(gate);
    const isBad: TextCheck = (t, kind) =>
      !!t &&
      (isClaimLike(t, ctx.idea) ||
        mentionsName(t, avoid) ||
        (isMvp && forbidden.some(re => re.test(t))) ||
        (isMvp && kind === 'checkout' && forbiddenAtCheckout.some(re => re.test(t))) ||
        (noChat && CHAT_MENTION.test(t)));

    if (isBad(screen.name)) {
      issues.push(`screen "${screen.name}": dropped (its subject is not priced in the MVP)`);
      continue;
    }
    if (isThirdPartyScreen(screen.name)) {
      issues.push(`screen "${screen.name}": dropped (a third-party system's own screen, not ours to build)`);
      continue;
    }
    const blocks = guardBlocks({ ...screen, device }, gate, isBad, issues);
    if (blocks.length < CAPS.blocksMin) {
      issues.push(`screen "${screen.name}": dropped after the scope guard (${blocks.length} blocks left)`);
      continue;
    }
    guarded.push({ ...screen, device, purpose: isBad(screen.purpose) ? '' : screen.purpose, blocks });
  }
  return guarded;
}

/**
 * Normalize a wireframe answer — and, given the priced scope, guard it.
 * Usable with at least `CAPS.screensMin` drawable screens.
 */
export function parseScreensJson(textIn: string, ctx?: ScreensContext): Parsed<WireframeScreen[]> | null {
  const raw = extractJson(textIn);
  if (!raw) return null;
  const issues: string[] = [];
  const parsed = parseScreenList(raw.screens, issues, ctx);
  const screens = (ctx ? guardScreens(parsed, ctx, issues) : parsed).slice(0, CAPS.screensMax);
  const usable = screens.length >= (ctx?.minScreens ?? CAPS.screensMin);
  if (!usable) issues.push(`unusable: ${screens.length} screen(s)`);
  return { value: screens, issues, usable };
}

const screenKey = (screen: WireframeScreen) =>
  screen.name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const NAME_STOPWORDS = new Set([
  'and',
  'the',
  'for',
  'with',
  'of',
  'a',
  'an',
  'to',
  'your',
  'my',
  'va',
  'bilan',
  'uchun',
  'и',
  'для',
  'с',
  'в',
  'на',
  'по',
]);
const nameTokens = (screen: WireframeScreen) =>
  new Set(
    screenKey(screen)
      .split(' ')
      .filter(w => w && !NAME_STOPWORDS.has(w))
  );

/**
 * The same screen drawn by both halves under a longer name ("Contract review"
 * / "Contract Review with Risk Flags" — round 2): one name's words (two or
 * more) all appear in the other's.
 */
function nearDuplicate(a: WireframeScreen, b: WireframeScreen): boolean {
  const [small, big] = [nameTokens(a), nameTokens(b)].sort((x, y) => x.size - y.size);
  return small.size >= 2 && [...small].every(w => big.has(w));
}

/**
 * The two wireframe halves as one set: the main user's screens first, then the
 * rest; a screen the second half repeated (same name, or a near-duplicate of a
 * main-half MVP screen) is dropped, at most one 'later' screen, MVP screens
 * before it.
 */
export function mergeScreenParts(main: WireframeScreen[], rest: WireframeScreen[], issues: string[] = []): WireframeScreen[] {
  const seen = new Set<string>();
  const merged: WireframeScreen[] = [];
  for (const screen of [...main, ...rest]) {
    const key = screenKey(screen);
    const fromRest = !main.includes(screen);
    const twin = fromRest && screen.phase === 'mvp' ? main.find(m => m.phase === 'mvp' && nearDuplicate(m, screen)) : undefined;
    if (seen.has(key) || twin) {
      issues.push(`screen "${screen.name}": dropped (drawn twice${twin ? ` — as "${twin.name}"` : ''})`);
      continue;
    }
    seen.add(key);
    merged.push(screen);
  }
  const later = merged.filter(sc => sc.phase === 'later').slice(0, CAPS.laterScreens);
  const mvp = merged.filter(sc => sc.phase === 'mvp').slice(0, CAPS.screensMax - later.length);
  return [...mvp, ...later];
}

/* ------------------------------------------------------------------ */
/* Sample prices across the two halves                                 */
/* ------------------------------------------------------------------ */

/** "Patir — 12 000 so'm", "Latte: $4.50", "Тариф Бизнес — 990 000 сум/мес": an item, a separator and a price. */
const PRICED_TEXT =
  /^(.{2,48}?)\s*([—–:|]|\s-\s)\s*((?:[$€£]\s?\d[\d\s.,]*|\d[\d\s.,]*\s?(?:so['‘’ʻ`]?m|сум|сўм|руб\.?|₽|тг|₸|\$|usd|uzs))(?:\s?\/\s?\p{L}+\.?)?)\s*$/iu;

const itemKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Totals, fees and period figures differ from screen to screen by nature ("Jami", "Delivery", "Today") — never harmonized. */
const AGGREGATE =
  /(?<![\p{L}])(?:total|subtotal|sum|amount|balance|revenue|income|sales|paid|due|price|cost|fee|tip|tax|delivery|shipping|discount|today|month|week|year|jami|summa|narx|tushum|daromad|balans|to['‘’ʻ`]?lov|yetkazib|chegirma|bugun|oylik|haftalik|итог|сумм|всего|выручк|доход|баланс|доставк|скидк|оплат|сегодня|месяц|недел|цена|стоимост)/iu;

/**
 * One item, one price: the two wireframe halves are drawn in parallel and gave
 * the same item two prices ("Patir — 12 000 so'm" on the menu, "Patir — 15 000
 * so'm" in the admin list — round-2 iteration-2 audit). The first price shown
 * (the main user's screens come first) wins everywhere else. Labels and items
 * of every block are checked; anything that is not "item — price" is left alone.
 */
export function harmonizeSamplePrices(screens: WireframeScreen[], issues: string[] = []): WireframeScreen[] {
  const first = new Map<string, string>();
  const fix = (text: string): string => {
    const m = PRICED_TEXT.exec(text);
    if (!m) return text;
    const [, name, separator, price] = m;
    const key = itemKey(name);
    if (!key || AGGREGATE.test(key)) return text;
    const known = first.get(key);
    if (!known) {
      first.set(key, price);
      return text;
    }
    if (known === price) return text;
    const fixed = `${name}${separator === ':' ? ':' : ` ${separator.trim()}`} ${known}`;
    issues.push(`harmonized "${text}" → "${fixed}" (one item, one price)`);
    return fixed;
  };
  return screens.map(screen => ({
    ...screen,
    blocks: screen.blocks.map(block => ({ ...block, label: fix(block.label), items: block.items.map(fix) })),
  }));
}
