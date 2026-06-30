import { cache, Suspense } from 'react';
import { format } from 'date-fns';
import type { Locale as DateFnsLocale } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import TrackedCTALink from '@/shared/components/TrackedCTALink';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import BlogPostClient from '@/modules/blog/components/BlogPostClient';
import dbConnect from '@/core/db';
import BlogPostModel from '@/modules/blog/model/BlogPost';
import { CoverImage } from '@/shared/types';
import { validateLocale } from '@/core/auth';
import { getSlugRoot } from '@/shared/utils/slug';
import { ENV, BLOG_CONFIG } from '@/core/constants';
import { BlogPost, BlogPostSchema, escapeRegex, extractDescription, getKeywords, PILLAR_LABELS } from '@/modules/blog/lib/seo';

// ISR: render posts on demand and cache for an hour. generateStaticParams
// returns [] so nothing is prerendered at build time (no build-time DB), and
// dynamicParams lets any slug render + cache on first request.
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return [] as { slug: string }[];
}

interface PostLocaleSlug {
  slug: string;
  locale: 'en' | 'ru' | 'uz';
}

const DATE_LOCALES: Record<string, DateFnsLocale> = { ru, uz };

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
  await dbConnect();
  const validLocale = validateLocale(locale, 'en');
  let post = await BlogPostModel.findOne({ slug, locale: validLocale, status: 'published' }).lean();
  if (!post) {
    post = await BlogPostModel.findOne({ slug, status: 'published' }).lean();
  }
  if (!post) return null;
  return JSON.parse(JSON.stringify(post));
});

const getCanonicalPostForLocale = cache(async (locale: string, slug: string): Promise<PostLocaleSlug | null> => {
  try {
    await dbConnect();
    const normalizedLocale = validateLocale(locale, 'en');
    const slugRoot = getSlugRoot(slug);
    const slugPattern = new RegExp(`^${escapeRegex(slugRoot)}(?:-\\d{10,})?$`);
    const canonicalPost = await BlogPostModel.findOne({
      locale: normalizedLocale,
      status: 'published',
      slug: slugPattern,
    })
      .sort({ createdAt: 1 })
      .select('slug locale')
      .lean();

    if (!canonicalPost) return null;
    return JSON.parse(JSON.stringify(canonicalPost));
  } catch {
    return null;
  }
});

const getGroupSiblings = cache(async (generationGroupId: string): Promise<PostLocaleSlug[]> => {
  try {
    await dbConnect();
    const siblings = await BlogPostModel.find({ generationGroupId, status: 'published' }).select('slug locale').lean();
    return JSON.parse(JSON.stringify(siblings));
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
    await dbConnect();
    const posts = await BlogPostModel.find({
      category,
      locale,
      status: 'published',
      _id: { $ne: currentId },
    })
      .sort({ createdAt: -1 })
      .limit(3)
      .select('title slug coverImage')
      .lean();
    return JSON.parse(JSON.stringify(posts));
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
    return {
      title: 'Post Not Found | SoftWhere.uz',
      description: 'The requested blog post could not be found.',
    };
  }

  const description = extractDescription(post.content, post.metaDescription);
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

  return {
    title: `${post.title} | SoftWhere.uz Blog`,
    description,
    keywords: keywords.join(', '),
    authors: [{ name: 'SoftWhere.uz Team' }],
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt,
      authors: ['SoftWhere.uz'],
      url: canonicalUrl,
      siteName: 'SoftWhere.uz',
      locale: post.locale,
      images: [
        {
          url: post.coverImage?.url
            ? `${baseUrl}/api/og?title=${encodeURIComponent(post.title)}&locale=${post.locale}&image=${encodeURIComponent(post.coverImage.url)}`
            : `${baseUrl}/api/og?title=${encodeURIComponent(post.title)}&locale=${post.locale}`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [
        post.coverImage?.url
          ? `${baseUrl}/api/og?title=${encodeURIComponent(post.title)}&locale=${post.locale}&image=${encodeURIComponent(post.coverImage.url)}`
          : `${baseUrl}/api/og?title=${encodeURIComponent(post.title)}&locale=${post.locale}`,
      ],
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
    <section className='mt-12'>
      <h2 className='text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6'>{t('relatedArticles')}</h2>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        {relatedPosts.map(rp => (
          <Link
            key={rp.slug}
            href={`/${locale}/blog/${rp.slug}`}
            className='bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow'
          >
            {rp.coverImage?.thumbUrl ? (
              <div className='relative h-40'>
                <Image src={rp.coverImage.thumbUrl} alt={rp.title} fill className='object-cover' sizes='(max-width: 768px) 100vw, 33vw' />
              </div>
            ) : (
              <div className='h-40 bg-gradient-to-br from-[#fe4502] to-[#ff5f24] flex items-center justify-center'>
                <span className='text-white text-4xl font-bold'>{rp.title.charAt(0)}</span>
              </div>
            )}
            <div className='p-4'>
              <h3 className='font-semibold text-gray-900 dark:text-gray-100 line-clamp-2'>{rp.title}</h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function BlogPostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);
  const post = await getBlogPost(slug, locale);
  const t = await getTranslations('blog');
  const tCat = await getTranslations('blog.categories');

  if (!post) {
    notFound();
  }

  if (post.locale !== locale) {
    permanentRedirect(`/${post.locale}/blog/${encodeURIComponent(post.slug)}`);
  }

  const formattedDate = format(new Date(post.createdAt), 'MMMM dd, yyyy', { locale: DATE_LOCALES[locale] });
  const readingTime = Math.ceil(post.content.split(/\s+/).length / 200);

  return (
    <BlogPostClient
      post={{ title: post.title, slug: post.slug, locale: post.locale, generationGroupId: post.generationGroupId }}
      category={post.category}
      readingTime={readingTime}
    >
      <BlogPostSchema post={post} />

      <div className='page-layout min-h-screen' style={{ backgroundColor: 'var(--gray-100)' }}>
        {/* Breadcrumbs */}
        <nav className='bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700' aria-label='Breadcrumb'>
          <div className='container py-4'>
            <ol className='flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400'>
              <li>
                <Link href={`/${locale}`} className='hover:text-[#fe4502] transition-colors'>
                  Home
                </Link>
              </li>
              <li>›</li>
              <li>
                <Link href={`/${locale}/blog`} className='hover:text-[#fe4502] transition-colors'>
                  Blog
                </Link>
              </li>
              <li>›</li>
              <li className='text-gray-900 dark:text-gray-100 truncate max-w-xs'>{post.title}</li>
            </ol>
          </div>
        </nav>

        {/* Header with navigation */}
        <header className='bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm'>
          <div className='container py-4'>
            <Link
              href={`/${locale}/blog`}
              className='inline-flex items-center text-gray-600 dark:text-gray-300 hover:text-[#fe4502] transition-colors duration-300 font-medium'
            >
              <svg className='w-5 h-5 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M15 19l-7-7 7-7'></path>
              </svg>
              {t('backToBlog')}
            </Link>
          </div>
        </header>

        {/* Hero cover image */}
        {post.coverImage?.url && (
          <div className='relative w-full h-64 md:h-96'>
            <Image
              src={post.coverImage.url}
              alt={post.title}
              fill
              priority
              className='object-cover'
              sizes='(max-width: 768px) 100vw, 1280px'
            />
            <div className='absolute inset-0 bg-gradient-to-t from-black/30 to-transparent' />
            <span className='absolute bottom-3 right-4 text-xs text-white/80 bg-black/30 px-2 py-1 rounded'>
              Photo by{' '}
              <a
                href={`${post.coverImage.authorUrl}?utm_source=softwhere&utm_medium=referral`}
                target='_blank'
                rel='noopener noreferrer'
                className='underline'
              >
                {post.coverImage.authorName}
              </a>
              {' on '}
              <a
                href='https://unsplash.com?utm_source=softwhere&utm_medium=referral'
                target='_blank'
                rel='noopener noreferrer'
                className='underline'
              >
                Unsplash
              </a>
            </span>
          </div>
        )}

        {/* Main content */}
        <main className='container py-12'>
          <div className='bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden'>
            <article className='p-8 md:p-12'>
              {/* Article header */}
              <header className='mb-12 text-center'>
                <h1 className='text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-8 leading-tight tracking-wide'>
                  {post.title}
                </h1>
                <div className='flex items-center justify-center flex-wrap gap-4 text-gray-500 dark:text-gray-400 text-sm font-medium'>
                  <time dateTime={post.createdAt} className='flex items-center'>
                    <svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                      ></path>
                    </svg>
                    {formattedDate}
                  </time>
                  <span className='flex items-center'>
                    <svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth='2'
                        d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                      ></path>
                    </svg>
                    {readingTime} {t('readingTime')}
                  </span>
                  <span className='px-3 py-1 bg-[#fe4502] text-white text-xs font-semibold rounded-full'>{post.locale.toUpperCase()}</span>
                  {post.category && PILLAR_LABELS[post.category] && (
                    <span className='px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold rounded-full'>
                      {(tCat as (k: string) => string)(post.category)}
                    </span>
                  )}
                </div>
              </header>

              {/* Article content */}
              <div className='prose prose-lg prose-gray dark:prose-invert max-w-none'>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className='text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mt-12 mb-6 leading-tight'>
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className='text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mt-10 mb-5 leading-tight'>
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className='text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-8 mb-4 leading-tight'>{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p className='text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-6 font-light'>{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className='list-disc pl-6 mb-6 space-y-2 text-lg text-gray-700 dark:text-gray-300'>{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className='list-decimal pl-6 mb-6 space-y-2 text-lg text-gray-700 dark:text-gray-300'>{children}</ol>
                    ),
                    li: ({ children }) => <li className='leading-relaxed'>{children}</li>,
                    blockquote: ({ children }) => (
                      <blockquote className='border-l-4 border-blue-500 pl-6 py-2 my-8 bg-gray-50 dark:bg-gray-900 italic text-lg text-gray-700 dark:text-gray-300 rounded-r-lg'>
                        {children}
                      </blockquote>
                    ),
                    code: ({ children }) => (
                      <code className='bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm font-mono text-gray-800 dark:text-gray-200'>
                        {children}
                      </code>
                    ),
                    pre: ({ children }) => (
                      <pre className='bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto my-6'>{children}</pre>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        className='text-[#fe4502] hover:text-[#ff5f24] underline transition-colors'
                        target={href?.startsWith('http') ? '_blank' : undefined}
                        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                      >
                        {children}
                      </a>
                    ),
                    img: ({ src, alt }) => (
                      <figure className='my-8'>
                        {/* In-article markdown images come from arbitrary hosts, so a plain
                            <img> stays safe (next/image would 400 on non-allow-listed hosts).
                            The 16:9 wrapper reserves space to eliminate layout shift (CLS). */}
                        <span className='relative block w-full overflow-hidden rounded-lg' style={{ aspectRatio: '16 / 9' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={src}
                            alt={alt || ''}
                            loading='lazy'
                            decoding='async'
                            className='absolute inset-0 h-full w-full object-cover'
                          />
                        </span>
                        {alt && <figcaption className='text-center text-sm text-gray-500 dark:text-gray-400 mt-2'>{alt}</figcaption>}
                      </figure>
                    ),
                    table: ({ children }) => (
                      <div className='overflow-x-auto my-6'>
                        <table className='min-w-full border-collapse border border-gray-200 dark:border-gray-700 text-base'>
                          {children}
                        </table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className='border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2 text-left font-semibold text-gray-900 dark:text-gray-100'>
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className='border border-gray-200 dark:border-gray-700 px-4 py-2 text-gray-700 dark:text-gray-300'>{children}</td>
                    ),
                  }}
                >
                  {post.content}
                </ReactMarkdown>
              </div>

              {/* Call to Action */}
              <div className='mt-16 p-8 bg-gradient-to-r from-[#fe4502] to-[#ff5f24] rounded-xl text-white'>
                <div className='text-center'>
                  <h3 className='text-2xl font-bold mb-4'>{t('cta.title')}</h3>
                  <p className='text-lg mb-6 max-w-2xl mx-auto opacity-90'>{t('cta.description')}</p>
                  <div className='flex flex-col sm:flex-row gap-4 justify-center'>
                    <TrackedCTALink
                      href={`/${locale}#contact`}
                      type='get_started'
                      slug={post.slug}
                      className='inline-flex items-center px-6 py-3 bg-white text-[#fe4502] font-semibold rounded-lg hover:bg-gray-100 transition-colors duration-300'
                    >
                      {t('cta.getStarted')}
                      <svg className='w-4 h-4 ml-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 5l7 7-7 7'></path>
                      </svg>
                    </TrackedCTALink>
                    <TrackedCTALink
                      href={`/${locale}#portfolio`}
                      type='view_work'
                      slug={post.slug}
                      className='inline-flex items-center px-6 py-3 bg-transparent text-white font-semibold rounded-lg border-2 border-white hover:bg-white hover:text-[#fe4502] transition-colors duration-300'
                    >
                      {t('cta.viewWork')}
                    </TrackedCTALink>
                  </div>
                </div>
              </div>
            </article>
          </div>

          {/* Related Posts (streamed independently) */}
          <Suspense>
            <RelatedPosts category={post.category} currentId={post._id} locale={post.locale} />
          </Suspense>

          {/* Back to blog link */}
          <div className='text-center mt-12'>
            <Link
              href={`/${locale}/blog`}
              className='inline-flex items-center text-[#fe4502] hover:text-[#ff5f24] font-semibold transition-colors duration-300'
            >
              <svg className='w-4 h-4 mr-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M15 19l-7-7 7-7'></path>
              </svg>
              {t('readMoreArticles')}
            </Link>
          </div>
        </main>
      </div>
    </BlogPostClient>
  );
}
