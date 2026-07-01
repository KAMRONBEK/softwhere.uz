import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

// Structure of an embedded image (cover or inline). Kept structurally identical
// to `CoverImage` in `@/shared/types` so the two are interchangeable.
export interface ICoverImage {
  url: string;
  thumbUrl: string;
  authorName: string;
  authorUrl: string;
  keyword: string;
}

/**
 * `blog_posts` — the single table backing the blog. Migrated from the former
 * Mongoose `BlogPost` collection. Embedded documents (cover/inline images) and
 * the keyword array are stored as `jsonb`; the id is a Postgres `uuid`.
 */
export const blogPosts = pgTable(
  'blog_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    content: text('content').notNull(),
    status: text('status', { enum: ['draft', 'published'] })
      .notNull()
      .default('draft'),
    locale: text('locale', { enum: ['en', 'ru', 'uz'] }).notNull(),
    generationGroupId: text('generation_group_id'),
    coverImage: jsonb('cover_image').$type<ICoverImage>(),
    category: text('category'),
    postFormat: text('post_format'),
    primaryKeyword: text('primary_keyword'),
    secondaryKeywords: jsonb('secondary_keywords').$type<string[]>(),
    metaDescription: text('meta_description'),
    contentImages: jsonb('content_images').$type<ICoverImage[]>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  table => [
    // Enforces one slug per locale (the former unique compound index).
    uniqueIndex('blog_posts_locale_slug_uq').on(table.locale, table.slug),
    // Covers the published-list query (ORDER BY created_at DESC scans backward).
    index('blog_posts_status_locale_created_idx').on(table.status, table.locale, table.createdAt),
    // Covers the related-posts query.
    index('blog_posts_category_locale_status_created_idx').on(table.category, table.locale, table.status, table.createdAt),
    // Covers cross-locale sibling / continuation lookups.
    index('blog_posts_group_idx').on(table.generationGroupId),
  ]
);

/** A full row exactly as Drizzle returns it (id: string, dates: Date). */
export type BlogPostRow = typeof blogPosts.$inferSelect;
/** Insert shape (id + timestamps optional). */
export type NewBlogPost = typeof blogPosts.$inferInsert;

/**
 * The serialized post shape every consumer already expects: `_id` instead of
 * `id`, ISO-string timestamps, `null` normalized to `undefined`. Keeping this
 * identical to the old Mongoose-lean+JSON output means the API contract and all
 * frontend/SEO code are untouched by the Postgres migration.
 */
export interface IBlogPost {
  _id: string;
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published';
  locale: 'en' | 'ru' | 'uz';
  generationGroupId?: string;
  coverImage?: ICoverImage;
  category?: string;
  postFormat?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  metaDescription?: string;
  contentImages?: ICoverImage[];
  createdAt: string;
  updatedAt: string;
}

/** Map a full DB row to the `_id`/ISO-string shape consumers expect. */
export function serializePost(row: BlogPostRow): IBlogPost {
  return {
    _id: row.id,
    title: row.title,
    slug: row.slug,
    content: row.content,
    status: row.status,
    locale: row.locale,
    generationGroupId: row.generationGroupId ?? undefined,
    coverImage: row.coverImage ?? undefined,
    category: row.category ?? undefined,
    postFormat: row.postFormat ?? undefined,
    primaryKeyword: row.primaryKeyword ?? undefined,
    secondaryKeywords: row.secondaryKeywords ?? undefined,
    metaDescription: row.metaDescription ?? undefined,
    contentImages: row.contentImages ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
