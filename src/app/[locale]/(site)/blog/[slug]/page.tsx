import { cache, Suspense } from 'react';
import { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, permanentRedirect } from 'next/navigation';
import BlogArticle from '@/modules/blog/components/BlogArticle';
import BlogPostClient from '@/modules/blog/components/BlogPostClient';
import PostCard from '@/modules/blog/components/PostCard';
import PostGrid from '@/modules/blog/components/PostGrid';
import { resolveLegacyAlias } from '@/modules/blog/model/legacy-aliases';
import * as postsRepo from '@/modules/blog/model/posts.repository';
import { Section } from '@/shared/components/site';
import { CoverImage } from '@/shared/types';
import { validateLocale } from '@/core/auth';
import { logger } from '@/core/logger';
import { buildOgUrl } from '@/core/og';
import { getSlugRoot } from '@/shared/utils/slug';
import { ENV, BLOG_CONFIG, OG_LOCALE } from '@/core/constants';
import { BlogPost, BlogPostSchema, extractDescription, getKeywords } from '@/modules/blog/lib/seo';

// ISR: prerender every published post at build time, cache indefinitely.
//
// `false` (not a time window) on purpose: post bodies only change when the
// generator writes, and every write busts its paths via revalidatePath +
// revalidateTag('blog-posts') in /api/admin/revalidate. A time window here is
// pure cost — with ~150 post/locale pages, hourly expiry meant crawlers forced
// a DB read every couple of minutes, so the Neon compute never hit its 5-min
// scale-to-zero idle timer and burned the whole free-tier CU-hour budget.
//
// Build-time prerender (vs the earlier on-demand `return []`): every deploy
// cold-starts the ISR cache, so on-demand meant crawlers re-rendered all
// posts on Fluid CPU (~0.5s each) after each deploy — and kept Neon awake
// while doing it. At build the same renders cost free build minutes and one
// warm Neon burst. If the DB is unreachable at build we fall back to [] —
// exactly the old on-demand behavior (dynamicParams covers every slug), and
// `staticGenerationRetryCount` in next.config.mjs absorbs transient blips.
export const revalidate = false;
export const dynamicParams = true;

// A DB outage here degrades to on-demand ISR (dynamicParams = true), which is
// harmless: the pages render on first request. The blog INDEX page cannot
// degrade (no time window), so the same outage fails the build there first —
// see [locale]/blog/page.tsx.
export async function generateStaticParams({ params }: { params: { locale: string } }): Promise<{ slug: string }[]> {
  try {
    const posts = await postsRepo.listPublished(params.locale as PostLocaleSlug['locale']);
    return posts.map(p => ({ slug: p.slug }));
  } catch (error) {
    logger.warn('generateStaticParams: DB unreachable — falling back to on-demand ISR', error, 'BLOG');
    return [];
  }
}

interface PostLocaleSlug {
  slug: string;
  locale: 'en' | 'ru' | 'uz';
}

// Returns null ONLY when the query succeeds and finds no document (genuine
// 404). A DB/infra error is rethrown so the route returns 500 instead of a
// 404 that could deindex a real post. Wrapped in React cache() (per-request),
// not unstable_cache, so a thrown error is never persisted.
const getBlogPost = cache(async (rawSlug: string, locale: string): Promise<BlogPost | null> => {
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    // Malformed slug can never match a document -> genuine 404.
    return null;
  }
  const validLocale = validateLocale(locale, 'en');
  return postsRepo.getPublishedBySlugFlexible(slug, validLocale);
});

// Swallows DB errors: used only for the canonical/hreflang computation of a
// FOUND post, where degraded metadata beats a 500. The legacy resolver must
// NOT use this — see the strict lookups below.
const getCanonicalPostForLocale = cache(async (locale: string, slug: string): Promise<PostLocaleSlug | null> => {
  try {
    const normalizedLocale = validateLocale(locale, 'en');
    const slugRoot = getSlugRoot(slug);
    return await postsRepo.getCanonicalForLocale(normalizedLocale, slugRoot);
  } catch {
    return null;
  }
});

// Strict lookups for the legacy resolver: a DB error must propagate (uncached
// 500, retried on the next request) — swallowing it to null would mint a
// notFound() that ISR caches indefinitely (revalidate = false) on a URL that
// has a live 308 target.
const getCanonicalForLocaleStrict = cache(async (locale: 'en' | 'ru' | 'uz', slugRoot: string) =>
  postsRepo.getCanonicalForLocale(locale, slugRoot)
);

const getCanonicalAnyLocaleCached = cache(async (slugRoot: string) => postsRepo.getCanonicalAnyLocale(slugRoot));

const getPublishedSlugMeta = cache(async (slug: string, locale?: 'en' | 'ru' | 'uz') => postsRepo.getPublishedSlugMeta(slug, locale));

// A redirect target found in one locale is swapped for the requested locale's
// generation-group sibling when one exists, so /ru legacy URLs land on the RU
// post rather than the EN one the root lookup found.
async function preferRequestedLocale(match: postsRepo.CanonicalMatch, requestedLocale: 'en' | 'ru' | 'uz'): Promise<PostLocaleSlug> {
  if (match.locale !== requestedLocale && match.generationGroupId) {
    try {
      const sibling = await postsRepo.getPublishedGroupSibling(match.generationGroupId, requestedLocale);
      if (sibling) return sibling;
    } catch {
      /* fall through to the found locale */
    }
  }
  return { slug: match.slug, locale: match.locale };
}

// Legacy-URL recovery: when a slug isn't found, resolve the old URL to a live
// post and 308 to it instead of 404ing — preserving the accumulated search
// authority. Resolution order:
//   1. curated alias map (Cyrillic/localized-era roots, renamed topics, and
//      posts deleted in the Jul 2026 duplicate cleanup),
//   2. same-locale slug-root match (pinned `<root>-<timestamp>` URLs),
//   3. any-locale slug-root match (only EN slugs were pinned by the backfill;
//      ru/uz legacy URLs resolve via the EN root, preferring the requested
//      locale's group sibling),
//   4. `-N` duplicate-collision suffixes left behind by deleted posts.
// Returns the redirect path, or null when there is no live post to recover to.
async function legacyRedirectTarget(locale: string, rawSlug: string): Promise<string | null> {
  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    /* keep the raw slug */
  }
  const requestedLocale = validateLocale(locale, 'en');
  const slugRoot = getSlugRoot(slug);
  const pathFor = (target: PostLocaleSlug): string | null =>
    target.slug === slug && target.locale === locale ? null : `/${target.locale}/blog/${encodeURIComponent(target.slug)}`;

  const alias = resolveLegacyAlias(slugRoot);
  if (alias) {
    // Re-check the target is still published before trusting the static map.
    const meta = await getPublishedSlugMeta(alias.slug, alias.locale);
    if (meta) return pathFor(await preferRequestedLocale(meta, requestedLocale));
  }

  const canonical = await getCanonicalForLocaleStrict(requestedLocale, slugRoot);
  if (canonical && canonical.slug !== slug) {
    return `/${canonical.locale}/blog/${encodeURIComponent(canonical.slug)}`;
  }

  const anyLocale = await getCanonicalAnyLocaleCached(slugRoot);
  if (anyLocale && anyLocale.slug !== slug) {
    return pathFor(await preferRequestedLocale(anyLocale, requestedLocale));
  }

  if (/-\d{1,2}$/.test(slug)) {
    const base = slug.replace(/-\d{1,2}$/, '');
    const meta = (await getPublishedSlugMeta(base, requestedLocale)) ?? (await getPublishedSlugMeta(base));
    if (meta) return pathFor(await preferRequestedLocale(meta, requestedLocale));
  }

  return null;
}

const getGroupSiblings = cache(async (generationGroupId: string): Promise<PostLocaleSlug[]> => {
  try {
    return await postsRepo.getGroupSiblings(generationGroupId);
  } catch {
    return [];
  }
});

async function getRelatedPosts(
  category: string | undefined,
  currentId: string,
  locale: string
): Promise<Array<{ title: string; slug: string; coverImage?: CoverImage }>> {
  if (!category) return [];
  try {
    return await postsRepo.getRelatedByCategory(category, validateLocale(locale, 'en'), currentId, 3);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };

  let post: BlogPost | null;
  try {
    post = await getBlogPost(slug, locale);
  } catch {
    // Transient DB/infra error: keep metadata resilient (the page itself will
    // rethrow and 500). Do NOT emit a noindex/"not found" title here.
    return {
      title: 'SoftWhere.uz Blog',
      description: 'Expert insights on software development from SoftWhere.uz.',
    };
  }

  if (!post) {
    // Recover legacy/renamed URLs with a 308 before giving up.
    const target = await legacyRedirectTarget(locale, slug);
    if (target) permanentRedirect(target);
    // Throw notFound() HERE, not only in the page body: metadata resolves
    // before the response shell flushes, so this yields a real HTTP 404.
    // The page body's notFound() fires mid-stream and produces a soft 404
    // (not-found UI with status 200), which search engines keep indexing.
    notFound();
  }

  const description = extractDescription(post.content, post.metaDescription, post.locale);
  const keywords = getKeywords(post);
  const baseUrl = ENV.BASE_URL;
  const canonicalPost = await getCanonicalPostForLocale(post.locale, post.slug);
  const canonicalSlug = canonicalPost?.slug ?? post.slug;
  const encodedCanonicalSlug = encodeURIComponent(canonicalSlug);
  const canonicalUrl = `${baseUrl}/${post.locale}/blog/${encodedCanonicalSlug}`;
  const localeMismatch = post.locale !== locale;
  const isCanonicalVariant = canonicalSlug === post.slug;

  const languageAlternates: Record<string, string> = {
    [post.locale]: canonicalUrl,
  };

  if (post.generationGroupId) {
    const siblings = await getGroupSiblings(post.generationGroupId);
    for (const sibling of siblings) {
      const siblingCanonical = await getCanonicalPostForLocale(sibling.locale, sibling.slug);
      const siblingSlug = siblingCanonical?.slug ?? sibling.slug;
      languageAlternates[sibling.locale] = `${baseUrl}/${sibling.locale}/blog/${encodeURIComponent(siblingSlug)}`;
    }
  }
  languageAlternates['x-default'] = languageAlternates[BLOG_CONFIG.DEFAULT_LOCALE] || canonicalUrl;

  const ogImageUrl = await buildOgUrl({
    title: post.title,
    locale: post.locale,
    ...(post.coverImage?.url ? { image: post.coverImage.url } : {}),
  });

  return {
    // No " | SoftWhere.uz Blog" suffix: it added 19 chars to titles already
    // running a 73.5-char median, pushing 92% of posts past the length Google
    // leaves unrewritten. The brand is carried by openGraph.siteName instead.
    title: post.title,
    description,
    keywords: keywords.join(', '),
    // Keep the meta author consistent with the JSON-LD Person author when
    // BLOG_AUTHOR_NAME is configured (E-E-A-T: one identity everywhere).
    authors: [{ name: process.env.BLOG_AUTHOR_NAME || process.env.NEXT_PUBLIC_BLOG_AUTHOR || 'SoftWhere.uz Team' }],
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt,
      authors: [process.env.BLOG_AUTHOR_NAME || process.env.NEXT_PUBLIC_BLOG_AUTHOR || 'SoftWhere.uz'],
      url: canonicalUrl,
      siteName: 'SoftWhere.uz',
      // No alternateLocale: a post's translations are separate URLs, listed in hreflang.
      locale: OG_LOCALE[post.locale],
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [ogImageUrl],
    },
    robots: isCanonicalVariant && !localeMismatch ? { index: true, follow: true } : { index: false, follow: true },
    alternates: {
      canonical: canonicalUrl,
      languages: languageAlternates,
    },
  };
}

// ---------------------------------------------------------------------------
// Related posts (streamed via Suspense)
// ---------------------------------------------------------------------------

async function RelatedPosts({ category, currentId, locale }: { category?: string; currentId: string; locale: string }) {
  const relatedPosts = await getRelatedPosts(category, currentId, locale);
  if (relatedPosts.length === 0) return null;

  const t = await getTranslations('blog');

  return (
    <Section id='related-articles' heading={t('relatedArticles')}>
      <PostGrid>
        {relatedPosts.map(rp => (
          <PostCard key={rp.slug} title={rp.title} slug={rp.slug} locale={locale} coverImage={rp.coverImage} />
        ))}
      </PostGrid>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function BlogPostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);
  const post = await getBlogPost(slug, locale);

  if (!post) {
    // Recover legacy/renamed URLs with a 308 before 404ing.
    const target = await legacyRedirectTarget(locale, slug);
    if (target) permanentRedirect(target);
    notFound();
  }

  if (post.locale !== locale) {
    // Prefer the requested locale's group sibling so naive locale swaps (the
    // language-switcher anchors) land on the localized article instead of
    // 308ing back to the same post via its own locale. No loop risk: a
    // sibling carrying the requested slug would have exact-matched above.
    const target = await preferRequestedLocale(
      { slug: post.slug, locale: post.locale, generationGroupId: post.generationGroupId },
      validateLocale(locale, 'en')
    );
    permanentRedirect(`/${target.locale}/blog/${encodeURIComponent(target.slug)}`);
  }

  const readingTime = Math.ceil(post.content.split(/\s+/).length / 200);

  return (
    <BlogPostClient
      post={{ title: post.title, slug: post.slug, locale: post.locale, generationGroupId: post.generationGroupId }}
      category={post.category}
      readingTime={readingTime}
    >
      <BlogPostSchema post={post} />
      <BlogArticle
        post={post}
        readingTime={readingTime}
        related={
          <Suspense>
            <RelatedPosts category={post.category} currentId={post._id} locale={post.locale} />
          </Suspense>
        }
      />
    </BlogPostClient>
  );
}
