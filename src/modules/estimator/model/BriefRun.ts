import { boolean, doublePrecision, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * `ai_brief_runs` — one row per AI brief request that reached the pipeline
 * (or was turned away because the day's budgets were spent), for the admin's
 * usage and spend stats. Metadata only: never the idea text, never the IP —
 * `visitorHash` is a keyed hash of it, enough to count unique visitors.
 */
export const aiBriefRuns = pgTable(
  'ai_brief_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    locale: text('locale').notNull(),
    /** The admin's provider choice when the run started ('kimi' | 'deepseek'). */
    mode: text('mode').notNull(),
    /** Which daily budget paid: 'main' or 'overflow' (deepseek-flash once the main cap is spent). */
    lane: text('lane'),
    /** 'ok' | 'rejected' | 'declined_policy' | 'error' | 'busy' (both budgets spent, nothing ran). */
    status: text('status').notNull(),
    errorCode: text('error_code'),
    /** The model that wrote the scope. */
    model: text('model'),
    visitorHash: text('visitor_hash').notNull(),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    kimiCostUsd: doublePrecision('kimi_cost_usd').notNull().default(0),
    deepseekCostUsd: doublePrecision('deepseek_cost_usd').notNull().default(0),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    ms: integer('ms').notNull().default(0),
    calls: integer('calls').notNull().default(0),
    /** A call was answered by the other provider than the chosen one (a fallback). */
    fallbackUsed: boolean('fallback_used').notNull().default(false),
  },
  table => [index('ai_brief_runs_created_idx').on(table.createdAt)]
);

/**
 * `ai_brief_settings` — the admin-editable switches for the AI brief, one row
 * (`id = 'default'`). `provider` picks who writes the briefs.
 */
export const aiBriefSettings = pgTable('ai_brief_settings', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull().default('kimi'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type NewAiBriefRun = typeof aiBriefRuns.$inferInsert;
