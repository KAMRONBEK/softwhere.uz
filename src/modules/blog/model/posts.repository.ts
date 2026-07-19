import { and, asc, desc, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/core/db';
import { blogPosts, serializePost, type IBlogPost, type ICoverImage, type NewBlogPost } from './BlogPost';

type Locale = 'en' | 'ru' | 'uz';
type Status = 'draft' | 'published';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres-side id validity check (replaces `mongoose.Types.ObjectId.isValid`). */
export function isValidPostId(id: string): boolean {
  return UUID_RE.test(id);
}

/** Escape a string for safe interpolation into a Postgres POSIX regex. */
function escapeRegexLiteral(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Summary shapes (subset selects — deliberately omit `content` for list views)
// ---------------------------------------------------------------------------

export interface PostSummary {
  _id: string;
  title: string;
  slug: string;
  createdAt: string;
  locale: Locale;
  coverImage?: ICoverImage;
  category?: string;
}

export interface AdminPostSummary {
  _id: string;
  title: string;
  slug: string;
  status: Status;
  locale: Locale;
  generationGroupId?: string;
  coverImage?: ICoverImage;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocaleSlug {
  slug: string;
  locale: Locale;
}

export interface RelatedPost {
  title: string;
  slug: string;
  coverImage?: ICoverImage;
}

export interface SitemapPost {
  slug: string;
  locale: Locale;
  createdAt: string;
  updatedAt: string;
  generationGroupId?: string;
}

// ---------------------------------------------------------------------------
// Reads — public
// ---------------------------------------------------------------------------

/** Published posts (optionally one locale), newest first. Omits `content`. */
export async function listPublished(locale?: Locale, limit?: number): Promise<PostSummary[]> {
  const where = locale ? and(eq(blogPosts.status, 'published'), eq(blogPosts.locale, locale)) : eq(blogPosts.status, 'published');

  const q = db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      createdAt: blogPosts.createdAt,
      locale: blogPosts.locale,
      coverImage: blogPosts.coverImage,
      category: blogPosts.category,
    })
    .from(blogPosts)
    .where(where)
    .orderBy(desc(blogPosts.createdAt));

  const rows = await (limit ? q.limit(limit) : q);
  return rows.map(r => ({
    _id: r.id,
    title: r.title,
    slug: r.slug,
    createdAt: r.createdAt.toISOString(),
    locale: r.locale,
    coverImage: r.coverImage ?? undefined,
    category: r.category ?? undefined,
  }));
}

/** A single published post by exact (slug, locale). */
export async function getPublishedBySlug(slug: string, locale: Locale): Promise<IBlogPost | null> {
  const rows = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.locale, locale), eq(blogPosts.status, 'published')))
    .limit(1);
  return rows[0] ? serializePost(rows[0]) : null;
}

/** Published post by (slug, locale); falls back to any-locale slug match. */
export async function getPublishedBySlugFlexible(slug: string, locale: Locale): Promise<IBlogPost | null> {
  const exact = await getPublishedBySlug(slug, locale);
  if (exact) return exact;
  const rows = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'published')))
    .limit(1);
  return rows[0] ? serializePost(rows[0]) : null;
}

/** The published sibling for a generation group in a target locale. */
export async function getPublishedGroupSibling(generationGroupId: string, locale: Locale): Promise<LocaleSlug | null> {
  const rows = await db
    .select({ slug: blogPosts.slug, locale: blogPosts.locale })
    .from(blogPosts)
    .where(and(eq(blogPosts.generationGroupId, generationGroupId), eq(blogPosts.locale, locale), eq(blogPosts.status, 'published')))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * The canonical (oldest) published post in a locale whose slug matches the
 * cluster root, i.e. `root` itself or `root-<10+ digits>` (legacy timestamped
 * variants). Faithful translation of the former Mongo regex query.
 */
export async function getCanonicalForLocale(locale: Locale, slugRoot: string): Promise<LocaleSlug | null> {
  const pattern = `^${escapeRegexLiteral(slugRoot)}(-[0-9]{10,})?$`;
  const rows = await db
    .select({ slug: blogPosts.slug, locale: blogPosts.locale })
    .from(blogPosts)
    .where(and(eq(blogPosts.locale, locale), eq(blogPosts.status, 'published'), sql`${blogPosts.slug} ~ ${pattern}`))
    .orderBy(asc(blogPosts.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export interface CanonicalMatch {
  slug: string;
  locale: Locale;
  generationGroupId?: string;
}

/**
 * Any-locale variant of getCanonicalForLocale. The 2026-07 backfill pinned
 * only the EN slug of each recovered topic to its legacy root, so a ru/uz
 * legacy `<root>-<timestamp>` URL can only resolve through the EN post; the
 * caller then prefers the requested locale's group sibling.
 */
export async function getCanonicalAnyLocale(slugRoot: string): Promise<CanonicalMatch | null> {
  const pattern = `^${escapeRegexLiteral(slugRoot)}(-[0-9]{10,})?$`;
  const rows = await db
    .select({ slug: blogPosts.slug, locale: blogPosts.locale, generationGroupId: blogPosts.generationGroupId })
    .from(blogPosts)
    .where(and(eq(blogPosts.status, 'published'), sql`${blogPosts.slug} ~ ${pattern}`))
    .orderBy(asc(blogPosts.createdAt))
    .limit(1);
  return rows[0] ? { slug: rows[0].slug, locale: rows[0].locale, generationGroupId: rows[0].generationGroupId ?? undefined } : null;
}

/** Lightweight published lookup (slug [+ locale]) for redirect resolution. */
export async function getPublishedSlugMeta(slug: string, locale?: Locale): Promise<CanonicalMatch | null> {
  const where = locale
    ? and(eq(blogPosts.slug, slug), eq(blogPosts.locale, locale), eq(blogPosts.status, 'published'))
    : and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'published'));
  const rows = await db
    .select({ slug: blogPosts.slug, locale: blogPosts.locale, generationGroupId: blogPosts.generationGroupId })
    .from(blogPosts)
    .where(where)
    .limit(1);
  return rows[0] ? { slug: rows[0].slug, locale: rows[0].locale, generationGroupId: rows[0].generationGroupId ?? undefined } : null;
}

/** All published posts in a generation group (for hreflang siblings). */
export async function getGroupSiblings(generationGroupId: string): Promise<LocaleSlug[]> {
  return db
    .select({ slug: blogPosts.slug, locale: blogPosts.locale })
    .from(blogPosts)
    .where(and(eq(blogPosts.generationGroupId, generationGroupId), eq(blogPosts.status, 'published')));
}

/** Locales that exist in a group in ANY status (drafts included) — used by
 *  the generation CLI to resume a partially generated weekly group without
 *  duplicating locales that already have drafts awaiting review. */
export async function listGroupLocales(generationGroupId: string): Promise<Locale[]> {
  const rows = await db.select({ locale: blogPosts.locale }).from(blogPosts).where(eq(blogPosts.generationGroupId, generationGroupId));
  return [...new Set(rows.map(r => r.locale))];
}

/** Up to `limit` published posts in a category/locale, excluding one id. */
export async function getRelatedByCategory(category: string, locale: Locale, excludeId: string, limit = 3): Promise<RelatedPost[]> {
  const rows = await db
    .select({ title: blogPosts.title, slug: blogPosts.slug, coverImage: blogPosts.coverImage })
    .from(blogPosts)
    .where(
      and(eq(blogPosts.category, category), eq(blogPosts.locale, locale), eq(blogPosts.status, 'published'), ne(blogPosts.id, excludeId))
    )
    .orderBy(desc(blogPosts.createdAt))
    .limit(limit);
  return rows.map(r => ({ title: r.title, slug: r.slug, coverImage: r.coverImage ?? undefined }));
}

/** All published posts, minimal columns, oldest first — for the sitemap. */
export interface FeedPost {
  title: string;
  slug: string;
  createdAt: string;
  metaDescription: string | null;
  category: string | null;
}

/** Newest published posts for the per-locale RSS feed. */
export async function listForFeed(locale: Locale, limit = 20): Promise<FeedPost[]> {
  const rows = await db
    .select({
      title: blogPosts.title,
      slug: blogPosts.slug,
      createdAt: blogPosts.createdAt,
      metaDescription: blogPosts.metaDescription,
      category: blogPosts.category,
    })
    .from(blogPosts)
    .where(and(eq(blogPosts.status, 'published'), eq(blogPosts.locale, locale)))
    .orderBy(desc(blogPosts.createdAt))
    .limit(limit);

  return rows.map(r => ({
    title: r.title,
    slug: r.slug,
    createdAt: r.createdAt.toISOString(),
    metaDescription: r.metaDescription,
    category: r.category,
  }));
}

export async function listForSitemap(): Promise<SitemapPost[]> {
  const rows = await db
    .select({
      slug: blogPosts.slug,
      locale: blogPosts.locale,
      createdAt: blogPosts.createdAt,
      updatedAt: blogPosts.updatedAt,
      generationGroupId: blogPosts.generationGroupId,
    })
    .from(blogPosts)
    .where(eq(blogPosts.status, 'published'))
    .orderBy(asc(blogPosts.createdAt));
  return rows.map(r => ({
    slug: r.slug,
    locale: r.locale,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    generationGroupId: r.generationGroupId ?? undefined,
  }));
}

// ---------------------------------------------------------------------------
// Reads — admin / generation
// ---------------------------------------------------------------------------

/** Every post, newest first, without `content` — for the admin list. */
export async function listForAdmin(): Promise<AdminPostSummary[]> {
  const rows = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      status: blogPosts.status,
      locale: blogPosts.locale,
      generationGroupId: blogPosts.generationGroupId,
      coverImage: blogPosts.coverImage,
      category: blogPosts.category,
      createdAt: blogPosts.createdAt,
      updatedAt: blogPosts.updatedAt,
    })
    .from(blogPosts)
    .orderBy(desc(blogPosts.createdAt));
  return rows.map(r => ({
    _id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status,
    locale: r.locale,
    generationGroupId: r.generationGroupId ?? undefined,
    coverImage: r.coverImage ?? undefined,
    category: r.category ?? undefined,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** A full post by id (any status). */
export async function getById(id: string): Promise<IBlogPost | null> {
  const rows = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  return rows[0] ? serializePost(rows[0]) : null;
}

/** The first post in a generation group (any status/locale) — continuation mode. */
export async function getByGroupId(generationGroupId: string): Promise<IBlogPost | null> {
  // Prefer the English row: continuation/resume rebuilds the group's shared
  // topic from this post, and reconstructing it from a ru/uz sibling would
  // poison the remaining locales with localized titles/keywords.
  const rows = await db
    .select()
    .from(blogPosts)
    .where(eq(blogPosts.generationGroupId, generationGroupId))
    .orderBy(sql`CASE WHEN ${blogPosts.locale} = 'en' THEN 0 ELSE 1 END`)
    .limit(1);
  return rows[0] ? serializePost(rows[0]) : null;
}

/** Whether a (slug, locale) is already taken, optionally excluding one id. */
export async function slugTaken(slug: string, locale: Locale, excludeId?: string): Promise<boolean> {
  const conds = [eq(blogPosts.slug, slug), eq(blogPosts.locale, locale)];
  if (excludeId) conds.push(ne(blogPosts.id, excludeId));
  const rows = await db
    .select({ id: blogPosts.id })
    .from(blogPosts)
    .where(and(...conds))
    .limit(1);
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Insert a post and return the serialized row. */
export async function createPost(data: NewBlogPost): Promise<IBlogPost> {
  const [row] = await db.insert(blogPosts).values(data).returning();
  return serializePost(row);
}

/** Update a post by id; returns the serialized row or null if none matched. */
export async function updateById(
  id: string,
  patch: Partial<Pick<NewBlogPost, 'title' | 'slug' | 'content' | 'status' | 'locale'>>
): Promise<IBlogPost | null> {
  const [row] = await db.update(blogPosts).set(patch).where(eq(blogPosts.id, id)).returning();
  return row ? serializePost(row) : null;
}

/** Delete a post by id; returns whether a row was removed. */
export async function deleteById(id: string): Promise<boolean> {
  const rows = await db.delete(blogPosts).where(eq(blogPosts.id, id)).returning({ id: blogPosts.id });
  return rows.length > 0;
}

/** Lightweight connectivity check for the health endpoint. */
export async function pingDb(): Promise<void> {
  await db.execute(sql`select 1`);
}

// ---------------------------------------------------------------------------
// Bulk / tooling helpers (used by the CLI generation + maintenance scripts)
// ---------------------------------------------------------------------------

export interface RecentTopicInfo {
  category?: string;
  postFormat?: string;
  primaryKeyword?: string;
}

/** Every published title for a locale — lets topic selection skip a topic
 *  that is already covered (not just one in the recent-30 window). */
export async function listPublishedTitles(locale: Locale = 'en'): Promise<string[]> {
  const rows = await db
    .select({ title: blogPosts.title })
    .from(blogPosts)
    .where(and(eq(blogPosts.status, 'published'), eq(blogPosts.locale, locale)));
  return rows.map(r => r.title);
}

/** Recent posts' topic metadata for a locale — drives smart topic rotation. */
export async function listRecentTopicInfo(limit = 30, locale: Locale = 'en'): Promise<RecentTopicInfo[]> {
  const rows = await db
    .select({ category: blogPosts.category, postFormat: blogPosts.postFormat, primaryKeyword: blogPosts.primaryKeyword })
    .from(blogPosts)
    .where(eq(blogPosts.locale, locale))
    .orderBy(desc(blogPosts.createdAt))
    .limit(limit);
  return rows.map(r => ({
    category: r.category ?? undefined,
    postFormat: r.postFormat ?? undefined,
    primaryKeyword: r.primaryKeyword ?? undefined,
  }));
}

/** Every post, full rows, newest first — for bulk maintenance tooling. */
export async function listAll(): Promise<IBlogPost[]> {
  const rows = await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
  return rows.map(serializePost);
}

/** Apply a partial field update to a post by id (no-op if `fields` is empty). */
export async function updateFieldsById(id: string, fields: Record<string, unknown>): Promise<void> {
  if (Object.keys(fields).length === 0) return;
  await db
    .update(blogPosts)
    .set(fields as Partial<NewBlogPost>)
    .where(eq(blogPosts.id, id));
}
