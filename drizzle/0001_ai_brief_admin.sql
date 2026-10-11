-- AI brief admin: the provider switch and per-brief usage/spend rows
-- (src/modules/estimator/model/BriefRun.ts). Additive only; safe to re-run.

CREATE TABLE IF NOT EXISTS "ai_brief_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locale" text NOT NULL,
  "mode" text NOT NULL,
  "lane" text,
  "status" text NOT NULL,
  "error_code" text,
  "model" text,
  "visitor_hash" text NOT NULL,
  "cost_usd" double precision DEFAULT 0 NOT NULL,
  "kimi_cost_usd" double precision DEFAULT 0 NOT NULL,
  "deepseek_cost_usd" double precision DEFAULT 0 NOT NULL,
  "input_tokens" integer DEFAULT 0 NOT NULL,
  "output_tokens" integer DEFAULT 0 NOT NULL,
  "ms" integer DEFAULT 0 NOT NULL,
  "calls" integer DEFAULT 0 NOT NULL,
  "fallback_used" boolean DEFAULT false NOT NULL
);

CREATE INDEX IF NOT EXISTS "ai_brief_runs_created_idx" ON "ai_brief_runs" ("created_at");

CREATE TABLE IF NOT EXISTS "ai_brief_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" text DEFAULT 'kimi' NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
