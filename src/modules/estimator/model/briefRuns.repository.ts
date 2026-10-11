import { desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '@/core/db';
import { logger } from '@/core/logger';
import { DEFAULT_BRIEF_PROVIDER, isBriefProvider, type BriefProvider } from '@/modules/estimator/ai-brief/chains';
import { aiBriefRuns, aiBriefSettings, type NewAiBriefRun } from './BriefRun';

/**
 * The AI brief's admin data: the provider switch (`ai_brief_settings`) and the
 * per-brief usage/spend rows (`ai_brief_runs`) behind `/admin/ai-demo`.
 * Recording and reading the switch never fail a brief: on a database error the
 * brief runs on the last known (else the default) provider and goes unrecorded.
 */

const SETTINGS_ID = 'default';
/** Every instance re-reads the switch this often, so a change applies everywhere within ~30 s. */
const PROVIDER_CACHE_MS = 30_000;
/** A slow database must not hold a brief up: past this the cached/default provider is used. */
const PROVIDER_READ_TIMEOUT_MS = 2_000;
/** Stats days are Tashkent days (the founder's calendar); the spend caps reset at UTC midnight. */
const STATS_TZ = sql.raw(`'Asia/Tashkent'`);
const RECENT_RUNS = 50;
const SERIES_DAYS = 30;

let providerCache: { value: BriefProvider; at: number } | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms))]);
}

/** Who writes the briefs right now (cached per instance for 30 s). */
export async function getBriefProvider(now = Date.now()): Promise<BriefProvider> {
  if (providerCache && now - providerCache.at < PROVIDER_CACHE_MS) return providerCache.value;
  try {
    const rows = await withTimeout(
      db.select({ provider: aiBriefSettings.provider }).from(aiBriefSettings).where(eq(aiBriefSettings.id, SETTINGS_ID)).limit(1),
      PROVIDER_READ_TIMEOUT_MS
    );
    const stored = rows[0]?.provider;
    providerCache = { value: isBriefProvider(stored) ? stored : DEFAULT_BRIEF_PROVIDER, at: now };
  } catch (error) {
    logger.warn('AI brief provider read failed; using the last known one', error instanceof Error ? error.message : error, 'AI_BRIEF');
    // Cached as well, so a database outage costs one slow read per 30 s, not one per brief.
    providerCache = { value: providerCache?.value ?? DEFAULT_BRIEF_PROVIDER, at: now };
  }
  return providerCache.value;
}

export interface BriefSettings {
  provider: BriefProvider;
  /** ISO time of the last change; null = never changed (the default applies). */
  updatedAt: string | null;
}

export async function getBriefSettings(): Promise<BriefSettings> {
  const [row] = await db.select().from(aiBriefSettings).where(eq(aiBriefSettings.id, SETTINGS_ID)).limit(1);
  if (!row) return { provider: DEFAULT_BRIEF_PROVIDER, updatedAt: null };
  return { provider: isBriefProvider(row.provider) ? row.provider : DEFAULT_BRIEF_PROVIDER, updatedAt: row.updatedAt.toISOString() };
}

export async function setBriefProvider(provider: BriefProvider): Promise<BriefSettings> {
  const updatedAt = new Date();
  await db
    .insert(aiBriefSettings)
    .values({ id: SETTINGS_ID, provider, updatedAt })
    .onConflictDoUpdate({ target: aiBriefSettings.id, set: { provider, updatedAt } });
  providerCache = { value: provider, at: Date.now() };
  return { provider, updatedAt: updatedAt.toISOString() };
}

/** Store one brief's stats row. Never throws: a lost row must not fail the visitor's brief. */
export async function recordBriefRun(row: NewAiBriefRun): Promise<void> {
  try {
    await db.insert(aiBriefRuns).values(row);
  } catch (error) {
    logger.warn('AI brief run not recorded', error instanceof Error ? error.message : error, 'AI_BRIEF');
  }
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export interface BriefUsageSummary {
  /** Every request that reached the pipeline, plus the ones turned away as "busy". */
  requests: number;
  delivered: number;
  /** Not a project, too vague, abusive, or outside the work policy. */
  rejected: number;
  failed: number;
  busy: number;
  /** Unique visitors who sent anything. */
  visitors: number;
  /** Unique visitors who got a brief. */
  servedVisitors: number;
  costUsd: number;
  kimiCostUsd: number;
  deepseekCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  /** Average time of a delivered brief; null = none delivered. */
  avgMs: number | null;
  fallbacks: number;
}

export interface BriefUsageDay extends Pick<BriefUsageSummary, 'requests' | 'delivered' | 'visitors' | 'costUsd'> {
  /** YYYY-MM-DD, Tashkent time. */
  day: string;
}

export interface BriefUsageGroup extends Pick<BriefUsageSummary, 'requests' | 'delivered' | 'costUsd'> {
  key: string;
}

export interface BriefRecentRun {
  createdAt: string;
  locale: string;
  mode: string;
  lane: string | null;
  status: string;
  errorCode: string | null;
  model: string | null;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  ms: number;
  fallbackUsed: boolean;
}

export interface BriefStats {
  today: BriefUsageSummary;
  week: BriefUsageSummary;
  month: BriefUsageSummary;
  allTime: BriefUsageSummary;
  /** Spend since UTC midnight per lane — what the per-instance daily caps count against. */
  capDay: { mainUsd: number; overflowUsd: number };
  days: BriefUsageDay[];
  byLocale: BriefUsageGroup[];
  byProvider: BriefUsageGroup[];
  recent: BriefRecentRun[];
}

const r = aiBriefRuns;
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);

/** Start of the Tashkent day `daysBack` days ago, as a timestamptz. */
const tashkentDayStart = (daysBack: number): SQL =>
  sql`((date_trunc('day', now() AT TIME ZONE ${STATS_TZ}) - make_interval(days => ${daysBack}::int)) AT TIME ZONE ${STATS_TZ})`;

const sinceTashkentDay = (daysBack: number): SQL => sql`${r.createdAt} >= ${tashkentDayStart(daysBack)}`;

const totals = {
  requests: sql<number>`count(*)::int`,
  delivered: sql<number>`(count(*) filter (where ${r.status} = 'ok'))::int`,
  costUsd: sql<number>`coalesce(sum(${r.costUsd}), 0)::float8`,
};

async function summary(where?: SQL): Promise<BriefUsageSummary> {
  const [row] = await db
    .select({
      ...totals,
      rejected: sql<number>`(count(*) filter (where ${r.status} in ('rejected', 'declined_policy')))::int`,
      failed: sql<number>`(count(*) filter (where ${r.status} = 'error'))::int`,
      busy: sql<number>`(count(*) filter (where ${r.status} = 'busy'))::int`,
      visitors: sql<number>`count(distinct ${r.visitorHash})::int`,
      servedVisitors: sql<number>`(count(distinct ${r.visitorHash}) filter (where ${r.status} = 'ok'))::int`,
      kimiCostUsd: sql<number>`coalesce(sum(${r.kimiCostUsd}), 0)::float8`,
      deepseekCostUsd: sql<number>`coalesce(sum(${r.deepseekCostUsd}), 0)::float8`,
      inputTokens: sql<number>`coalesce(sum(${r.inputTokens}), 0)::float8`,
      outputTokens: sql<number>`coalesce(sum(${r.outputTokens}), 0)::float8`,
      avgMs: sql<number | null>`(avg(${r.ms}) filter (where ${r.status} = 'ok'))::float8`,
      fallbacks: sql<number>`(count(*) filter (where ${r.fallbackUsed}))::int`,
    })
    .from(r)
    .where(where);
  return {
    requests: num(row?.requests),
    delivered: num(row?.delivered),
    rejected: num(row?.rejected),
    failed: num(row?.failed),
    busy: num(row?.busy),
    visitors: num(row?.visitors),
    servedVisitors: num(row?.servedVisitors),
    costUsd: num(row?.costUsd),
    kimiCostUsd: num(row?.kimiCostUsd),
    deepseekCostUsd: num(row?.deepseekCostUsd),
    inputTokens: num(row?.inputTokens),
    outputTokens: num(row?.outputTokens),
    avgMs: row?.avgMs == null ? null : num(row.avgMs),
    fallbacks: num(row?.fallbacks),
  };
}

async function capDaySpend(): Promise<BriefStats['capDay']> {
  const [row] = await db
    .select({
      mainUsd: sql<number>`coalesce(sum(${r.costUsd}) filter (where ${r.lane} = 'main'), 0)::float8`,
      overflowUsd: sql<number>`coalesce(sum(${r.costUsd}) filter (where ${r.lane} = 'overflow'), 0)::float8`,
    })
    .from(r)
    .where(sql`${r.createdAt} >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`);
  return { mainUsd: num(row?.mainUsd), overflowUsd: num(row?.overflowUsd) };
}

async function dailySeries(): Promise<BriefUsageDay[]> {
  const day = sql<string>`to_char(${r.createdAt} AT TIME ZONE ${STATS_TZ}, 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day, ...totals, visitors: sql<number>`count(distinct ${r.visitorHash})::int` })
    .from(r)
    .where(sinceTashkentDay(SERIES_DAYS - 1))
    .groupBy(day)
    .orderBy(desc(day));
  return rows.map(row => ({
    day: row.day,
    requests: num(row.requests),
    delivered: num(row.delivered),
    visitors: num(row.visitors),
    costUsd: num(row.costUsd),
  }));
}

async function groupedBy(column: typeof r.locale | typeof r.mode): Promise<BriefUsageGroup[]> {
  const rows = await db
    .select({ key: column, ...totals })
    .from(r)
    .where(sinceTashkentDay(SERIES_DAYS - 1))
    .groupBy(column)
    .orderBy(desc(totals.requests));
  return rows.map(row => ({ key: row.key, requests: num(row.requests), delivered: num(row.delivered), costUsd: num(row.costUsd) }));
}

async function recentRuns(): Promise<BriefRecentRun[]> {
  const rows = await db.select().from(r).orderBy(desc(r.createdAt)).limit(RECENT_RUNS);
  return rows.map(row => ({
    createdAt: row.createdAt.toISOString(),
    locale: row.locale,
    mode: row.mode,
    lane: row.lane,
    status: row.status,
    errorCode: row.errorCode,
    model: row.model,
    costUsd: row.costUsd,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    ms: row.ms,
    fallbackUsed: row.fallbackUsed,
  }));
}

/** Everything the admin's AI demo page shows, in one go (parallel queries). */
export async function getBriefStats(): Promise<BriefStats> {
  const [today, week, month, allTime, capDay, days, byLocale, byProvider, recent] = await Promise.all([
    summary(sinceTashkentDay(0)),
    summary(sinceTashkentDay(6)),
    summary(sinceTashkentDay(SERIES_DAYS - 1)),
    summary(),
    capDaySpend(),
    dailySeries(),
    groupedBy(r.locale),
    groupedBy(r.mode),
    recentRuns(),
  ]);
  return { today, week, month, allTime, capDay, days, byLocale, byProvider, recent };
}
