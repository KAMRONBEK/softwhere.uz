-- Initial schema for the Neon Postgres migration.
--
-- Preferred path: run `yarn db:push` (introspects the Drizzle schema and
-- applies it). This file is a hand-written equivalent you can paste straight
-- into the Neon SQL editor if you'd rather not run the CLI.
--
-- `gen_random_uuid()` is built into Postgres 13+ (Neon runs 16+), so no
-- extension is required.

CREATE TABLE IF NOT EXISTS "blog_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "content" text NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "locale" text NOT NULL,
  "generation_group_id" text,
  "cover_image" jsonb,
  "category" text,
  "post_format" text,
  "primary_keyword" text,
  "secondary_keywords" jsonb,
  "meta_description" text,
  "content_images" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "blog_posts_locale_slug_uq" ON "blog_posts" ("locale", "slug");
CREATE INDEX IF NOT EXISTS "blog_posts_status_locale_created_idx" ON "blog_posts" ("status", "locale", "created_at");
CREATE INDEX IF NOT EXISTS "blog_posts_category_locale_status_created_idx" ON "blog_posts" ("category", "locale", "status", "created_at");
CREATE INDEX IF NOT EXISTS "blog_posts_group_idx" ON "blog_posts" ("generation_group_id");
