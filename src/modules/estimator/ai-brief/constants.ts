import type { DeepSeekThinking } from '@/core/ai';

/**
 * AI project brief — limits, model chain and the fixed vocabularies the model
 * must answer in. Everything the UI draws (wireframe blocks, devices) and
 * everything the engine prices (catalog ids) is a closed set, so a creative
 * answer can degrade a field but never invent a new kind of thing.
 */

export const BRIEF_LOCALES = ['uz', 'ru', 'en'] as const;
export type BriefLocale = (typeof BRIEF_LOCALES)[number];

/** Idea text limits (characters, after whitespace normalization). */
export const MIN_IDEA_CHARS = 12;
export const MAX_IDEA_CHARS = 3000;

/**
 * One step of the model fallback chain. The model id picks the provider
 * (`providerOfModel`: 'deepseek-…' runs on DeepSeek, everything else on Kimi);
 * a step never falls through to another provider by itself.
 */
export interface BriefModelStep {
  model: string;
  /**
   * Kimi: K3 only ('low' | 'high' | 'max'); K2.x runs without thinking.
   * DeepSeek: the thinking depth, 'off' = thinking disabled.
   */
  reasoningEffort?: DeepSeekThinking;
  timeoutMs: number;
  maxTokens: number;
  /** The step that runs instead when this step's provider has no API key (see `chains.ts#usableChain`). */
  ifUnavailable?: BriefModelStep;
}

/**
 * The parts of a brief, each its own model call. After the scope is priced the
 * other four run in parallel (see `orchestrator.ts`):
 *  - scope   — catalog ids the engine prices (call 1);
 *  - plan    — what to build first, what can wait, the phases;
 *  - risks   — risks and discovery questions;
 *  - screens — the MVP wireframes, drawn in two halves (`screensMain`,
 *    `screensRest`) so neither call has to write all of them.
 */
export const BRIEF_PARTS = ['scope', 'plan', 'risks', 'screensMain', 'screensRest'] as const;
export type BriefPart = (typeof BRIEF_PARTS)[number];

/**
 * Helper calls around the five parts, never on the critical path of a brief
 * that can ship without them (see `orchestrator.ts`):
 *  - samples — the sample content both wireframe halves reuse (items with
 *    prices, places, plan names), written in parallel with the scope so the
 *    two halves stop contradicting each other (round-2 iteration-2 audit:
 *    "Patir 12 000 so'm on the menu, 15 000 in admin");
 *  - polish* — the Uzbek copy-edit of each part's visible text (uz only).
 */
export const AUX_PARTS = ['samples', 'polishScope', 'polishPlan', 'polishRisks', 'polishScreens'] as const;
export type AuxPart = (typeof AUX_PARTS)[number];
export type BriefCallPart = BriefPart | AuxPart;

/**
 * Products whose wireframes show what a business sells, books or lists to its
 * customers: they get the shared sample content. An internal tool (a CRM, an
 * ERP, a staff app) does not — its samples came back as invented "tariffs"
 * and districts stuffed into a sales funnel (iteration 3 live run).
 */
export const SAMPLE_PRODUCTS: Readonly<Record<string, readonly string[]>> = {
  mobile: ['ecommerce', 'delivery', 'booking', 'edtech'],
  web: ['landing', 'corporate', 'ecommerce', 'portal'],
  telegram: ['order_bot', 'miniapp', 'bot_miniapp', 'info_bot'],
  desktop: ['pos_kiosk'],
};

/** kimi-k2.6: the fallback before 2026-10-11, kept for a deployment without a DeepSeek key — cheaper, ~2.5× faster, weaker Uzbek. */
const K26_FALLBACK: BriefModelStep = { model: 'kimi-k2.6', timeoutMs: 30_000, maxTokens: 8_000 };
/** A scope runs to ~1k tokens on a detailed idea, ~30 s on k2.6 — give its fallback room. */
const K26_SCOPE_FALLBACK: BriefModelStep = { ...K26_FALLBACK, timeoutMs: 40_000 };

/**
 * deepseek-flash (DeepSeek-V4.1-Flash): the fallback for every part since
 * 2026-10-11 (founder decision). A blind 60-case comparison put Kimi K3 first
 * (4.37/5) and deepseek-flash, or a Kimi scope + flash mix, at ~3.97 — so
 * flash only answers when Kimi fails or is slow, never by default.
 *
 * No strict json_schema on DeepSeek: it runs json_object with the schema in
 * the system prompt and the same validators (`src/core/ai.ts`). Thinking per
 * call (2026-10-11 runs, 60 cases): the scope thinks 'high' (p50 19 s, p90
 * 36 s, max 51 s); the later parts answer without thinking in 3 s (p90 5 s,
 * max 13 s), with a same-model retry that thinks ('low') when the fast answer
 * is unusable (~1% of calls). Reasoning tokens bill and count as output, so
 * the caps leave them room. When DeepSeek has no key, each flash step becomes
 * the old k2.6 fallback (`ifUnavailable`).
 */
export const DS_FLASH = 'deepseek-flash';
const FLASH_SCOPE_FALLBACK: BriefModelStep = {
  model: DS_FLASH,
  reasoningEffort: 'high',
  timeoutMs: 50_000,
  maxTokens: 16_000,
  ifUnavailable: K26_SCOPE_FALLBACK,
};
const FLASH_FALLBACK: BriefModelStep = {
  model: DS_FLASH,
  reasoningEffort: 'off',
  timeoutMs: 15_000,
  maxTokens: 8_000,
  ifUnavailable: K26_FALLBACK,
};
const FLASH_RETRY: BriefModelStep = { ...FLASH_FALLBACK, reasoningEffort: 'low', timeoutMs: 25_000, maxTokens: 12_000 };
/** The later parts' fallback: flash without thinking, then the same model thinking. */
const FLASH_LATER_FALLBACK: readonly BriefModelStep[] = [FLASH_FALLBACK, FLASH_RETRY];

/**
 * Production model chains, per part — round-2 matrix winner (variant c):
 * kimi-k3 at reasoning effort 'high' for the scope, 'low' for everything
 * written after it, deepseek-flash as the fallback (kimi-k2.6 until
 * 2026-10-11, and still when DeepSeek has no key).
 *
 * Why (2026-10 round 2, 60 cases, four auditors): high effort on the scope
 * call gave the best accuracy (4.31 vs 4.24/4.09 for k3-low everywhere),
 * usefulness (4.42) and the fewest briefs with deterministic consistency
 * errors (19% vs 30%) for +5 s of scope latency and ~$0.004 a brief; the
 * scope is where a wrong call (an unpriced core module, a dropped request)
 * contaminates everything after it. Wireframes on kimi-k2.6 (variant b) were
 * the cheapest but scored worst on screens (3.5) and language, so the later
 * calls stay on k3-low. Its effort costs ~300 reasoning tokens (median), so the
 * scope cap must still leave room for them. Its timeout sits at the round-2
 * matrix's slowest scope (61 s, p90 41 s); when it is hit, the fallback scope and
 * the later calls still fit the deadline (`runPart` skips a step that cannot
 * finish in the time left when a faster fallback can).
 *
 * Re-checked in round-2 iteration 3 (2026-10-10) against the matrix and both
 * iterations: c stays the production default. Quality first — it led accuracy,
 * usefulness and consistency; b's cheaper wireframes cost the most on screens
 * and Uzbek, and a's 6 s faster scope cost accuracy. Latency is spent on the
 * scope where it pays and recovered elsewhere (the fallback hedges, parallel
 * later calls); cost is ~$0.09 a brief at list price (~2/3 of that billed).
 */
/**
 * The later calls answer in ~19 s (p50) / 23 s (p90) / 27 s (max) on k3-low
 * (round-2 iteration 1); their 35 s timeout keeps a stuck call from eating the
 * time its fallback needs.
 */
const K3_LATER: BriefModelStep = { model: 'kimi-k3', reasoningEffort: 'low', timeoutMs: 35_000, maxTokens: 8_000 };
export const BRIEF_PART_CHAINS: Readonly<Record<BriefPart, readonly BriefModelStep[]>> = {
  scope: [{ model: 'kimi-k3', reasoningEffort: 'high', timeoutMs: 60_000, maxTokens: 16_000 }, FLASH_SCOPE_FALLBACK],
  plan: [K3_LATER, ...FLASH_LATER_FALLBACK],
  risks: [K3_LATER, ...FLASH_LATER_FALLBACK],
  screensMain: [K3_LATER, ...FLASH_LATER_FALLBACK],
  screensRest: [K3_LATER, ...FLASH_LATER_FALLBACK],
};

/**
 * The high-effort scope's tail: a quarter of the first 24 round-2 iteration-1
 * scopes ran past 38 s and two hit the 60 s timeout, which left the later calls
 * too little time (`timeout` errors). From this point the fallback (flash at
 * high thinking, ≤ 50 s) runs in parallel; the first usable scope wins
 * (~$0.003 extra, only on slow briefs). Hedge + flash scope + a no-thinking
 * flash later call (≤ 15 s) still fit the deadline.
 */
export const SCOPE_HEDGE_MS = 38_000;

/**
 * A long, detailed idea (the 1.6k-character "rambling" cases) spells its scope
 * out: high effort there bought nothing but time (57 s vs 31–36 s at 'low' in
 * the round-2 matrix, and two 60 s timeouts in iteration 1). Ideas longer than
 * this scope at 'low' effort; everything shorter — where the model must infer
 * the product — keeps 'high'.
 */
export const LONG_IDEA_CHARS = 900;
export const LONG_IDEA_SCOPE_CHAIN: readonly BriefModelStep[] = [
  { model: 'kimi-k3', reasoningEffort: 'low', timeoutMs: 50_000, maxTokens: 16_000 },
  FLASH_SCOPE_FALLBACK,
];

/**
 * The later calls' tail: on k3-low they answer in 17 s (p50) / 23 s (p95) /
 * 29 s (max but one) over 148 round-2 briefs; one screens call took 41 s. Past
 * this point the flash fallback runs in parallel and the first usable answer
 * wins (~1% of calls, well under $0.001 each).
 */
export const LATER_HEDGE_MS = 27_000;

/**
 * Sample content for the wireframes: kimi-k3 at effort 'low', in parallel with
 * the scope call (which takes ~30 s), so it adds nothing to the wall clock.
 * Optional: without it the wireframes are drawn as before.
 */
export const SAMPLES_CHAIN: readonly BriefModelStep[] = [{ model: 'kimi-k3', reasoningEffort: 'low', timeoutMs: 25_000, maxTokens: 3_000 }];

/**
 * Uzbek copy-edit of the visible text (uz pages only): kimi-k3 calls per part
 * (scope, plan, risks, wireframes), returning only find → replace spans that
 * fix an error. The scope text is edited while the later calls run; each
 * later part right after its own call. A failed or slow edit keeps the text
 * as it was. Measured on 12 audited uz briefs (iteration 3): the native
 * auditors' 83 flagged errors → 65 after the deterministic fixes → 36 after
 * the copy-edit, no price, number or scope changed; ~$0.03 a part.
 *
 * Latency is the answer's length (~35 tokens/s), most of it the reasoning
 * before the fixes, and it grows with the text sent. The iteration-3 live run
 * sent the plan and the risks as one ~2.5k-character call: it hit its 15 s
 * limit in 4 of 5 Uzbek briefs (13–20 s in the saved-brief test). Each part
 * (scope ~1.1k, plan ~1.2k, risks ~1.3k, wireframes ~1.7k characters, p50 of
 * 57 uz briefs) is now edited in balanced chunks of at most
 * POLISH_CHUNK_CHARS characters / POLISH_CHUNK_STRINGS strings, all in
 * parallel, with a 20 s limit. Round-3 live runs (2026-10-10): 14-string
 * chunks (~13 calls a brief) — 40 calls, 2–12 s, none timed out, but every
 * chunk re-sends the ~3k-token system prompt (mostly cached by Moonshot);
 * 1,200-character chunks (~7 calls) — 3 of 15 calls took 15–20 s and one
 * timed out, because the reasoning before the fixes varies 3× from call to
 * call. ~800 characters (~9 calls, ~$0.10 a brief at list price) keeps each
 * answer short enough for the limit.
 */
export const UZ_POLISH_ENABLED = true;
export const POLISH_CHAIN: readonly BriefModelStep[] = [{ model: 'kimi-k3', reasoningEffort: 'low', timeoutMs: 20_000, maxTokens: 3_000 }];
export const POLISH_CHUNK_STRINGS = 30;
export const POLISH_CHUNK_CHARS = 800;

/**
 * Interface languages a brief prices by page. uz and ru pages ALWAYS price an
 * Uzbek + Russian interface (2), whether or not the idea names languages — the
 * local market standard; a language the idea asks for on top (+ English) is
 * priced as well, up to the engine's 3 (`reconcile.ts`, rule 11). English
 * pages price the languages the idea names, 1 when it names none. Founder
 * decision 2026-10-10 (round 4), reverting round 3's one-language default,
 * which priced uz/ru briefs ~3–4% lower.
 */
export const DEFAULT_UI_LANGUAGES: Readonly<Record<BriefLocale, number>> = { uz: 2, ru: 2, en: 1 };

/** Whole-pipeline wall clock; the route's maxDuration (120s) sits above it. */
export const BRIEF_DEADLINE_MS = 110_000;
/** Don't start a fallback attempt with less time than this left. */
export const MIN_ATTEMPT_MS = 15_000;
/**
 * A dropped connection ("Connection error", ETIMEDOUT within a second) is
 * retried once on the same model before falling back: in the audit run it
 * cost 4 of 60 briefs their wireframes.
 */
export const CONNECTION_RETRIES = 1;

/** Founder rule for English pages: low end at $14/h, high end at $40/h. */
export const EN_RATE_LOW = 14;
export const EN_RATE_HIGH = 40;

/**
 * Policy enforcement: when the model classifies the CORE product as outside
 * the published "work we take" policy, the brief returns a calm decline
 * instead of a price. Founder decision point — flip to false to only flag.
 */
export const ENFORCE_POLICY_DECLINE = true;

/* ------------------------------------------------------------------ */
/* Closed vocabularies                                                 */
/* ------------------------------------------------------------------ */

/** Wireframe building blocks the UI knows how to draw (top → bottom). */
export const BLOCK_KINDS = [
  'header',
  'nav-bar',
  'tabs',
  'search',
  'filters',
  'hero',
  'text',
  'image',
  'video',
  'card-grid',
  'list',
  'table',
  'chart',
  'stats',
  'map',
  'calendar',
  'form',
  'button',
  'chat',
  'profile',
  'cart',
  'checkout',
  'settings',
  'upload',
] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

/** Frame each wireframe is drawn in. */
export const DEVICES = ['phone', 'browser', 'desktop', 'chat'] as const;
export type Device = (typeof DEVICES)[number];

export const PHASES = ['mvp', 'later'] as const;
export type ScopePhase = (typeof PHASES)[number];

export const COMPLEXITY_FLAGS = [
  'payments',
  'realtime',
  'geo_tracking',
  'two_sided_marketplace',
  'multi_role',
  'regulated',
  'personal_data',
  'ai_quality',
  'offline_first',
  'high_load',
  'legacy_integration',
  'hardware',
  'content_moderation',
  'multi_language',
] as const;
export type ComplexityFlag = (typeof COMPLEXITY_FLAGS)[number];

/**
 * Engine inputs set by RULE, not by the model (the audit saw the same idea
 * swing 40–80% between models when they picked tier and screen count):
 *  - tier: a brief prices a first version, so 'mvp' — 'standard' (more QA,
 *    edge cases, documentation) only for regulated products (medical records,
 *    finance, identity). 'enterprise' needs a discovery call, never a brief.
 *  - screens: the subtype's default, plus this share when the MVP has a second
 *    user-facing side (couriers/drivers, sellers, a two-sided marketplace).
 */
export const STANDARD_TIER_FLAGS: readonly ComplexityFlag[] = ['regulated'];
export const SECOND_SIDE_SCREEN_SHARE = 0.3;
export const SECOND_SIDE_FEATURES: readonly string[] = ['courier_tracking', 'marketplace_vendors'];

/** Catch-all subtypes whose wizard label ("Something else", "Custom project") reads as a glitch in a brief: the brief names the service instead. */
export const GENERIC_SUBTYPES: readonly string[] = ['custom_app', 'custom_project'];

export const POLICY_STATUSES = ['ok', 'ask', 'decline'] as const;
export type PolicyStatus = (typeof POLICY_STATUSES)[number];

export const POLICY_TOPICS = [
  'interest_lending',
  'conventional_insurance',
  'gambling',
  'alcohol_tobacco_pork',
  'adult_dating',
  'weapons',
  'speculative_crypto',
  'illegal_or_deceptive',
] as const;
export type PolicyTopic = (typeof POLICY_TOPICS)[number];

export const REJECTIONS = ['none', 'not_software', 'abusive', 'too_vague'] as const;
export type Rejection = (typeof REJECTIONS)[number];

export const CLARITY = ['vague', 'clear', 'detailed'] as const;
export type Clarity = (typeof CLARITY)[number];

/* ------------------------------------------------------------------ */
/* Output caps (characters / items) — enforced by the parser           */
/* ------------------------------------------------------------------ */

export const CAPS = {
  title: 80,
  summary: 400,
  shortText: 120,
  label: 60,
  sentence: 320,
  audience: 3,
  roles: 4,
  features: 20,
  integrations: 8,
  extras: 2,
  /** Six, not five: a big ERP idea filled five with modules and moved its data migration and EDI into assumptions ("priced separately"). */
  unpriced: 6,
  /** Sample content items both wireframe halves share. */
  samples: 8,
  stack: 6,
  screensMin: 3,
  screensMax: 8,
  blocksMin: 2,
  blocksMax: 9,
  /** Screens per wireframe half (the main user's journey; everything else). */
  mainScreens: 3,
  restMvpScreens: 2,
  blockItems: 4,
  canWait: 5,
  risks: 4,
  questionsMin: 3,
  questionsMax: 5,
  assumptions: 5,
  deliverables: 5,
  /** Wireframe screens drawn from 'later' scope (the rest are MVP). */
  laterScreens: 1,
} as const;
