import { format } from 'date-fns';
import { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import TrackedCTALink from '@/components/TrackedCTALink';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import BlogPostClient from '@/components/BlogPostClient';
import dbConnect from '@/lib/db';
import BlogPostModel from '@/models/BlogPost';
import { CoverImage } from '@/types';
import { validateLocale } from '@/utils/auth';

interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published';
  locale: 'en' | 'ru' | 'uz';
  generationGroupId?: string;
  coverImage?: CoverImage;
  category?: string;
  postFormat?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  metaDescription?: string;
  contentImages?: CoverImage[];
  createdAt: string;
  updatedAt: string;
}

function extractDescription(content: string, storedMeta?: string): string {
  if (storedMeta) return storedMeta;
  return (
    `${content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .split('\n')
      .find(line => line.trim().length > 50)
      ?.substring(0, 160)}...` || 'Expert insights on software development from Softwhere.uz.'
  );
}

function getKeywords(post: BlogPost): string[] {
  if (post.primaryKeyword || post.secondaryKeywords?.length) {
    return [...(post.primaryKeyword ? [post.primaryKeyword] : []), ...(post.secondaryKeywords ?? []), 'softwhere.uz', 'uzbekistan'];
  }
  const fallback = ['mobile app development', 'web development', 'telegram bot', 'software development', 'uzbekistan'];
  const contentLower = post.content.toLowerCase();
  return fallback.filter(kw => contentLower.includes(kw));
}

const PILLAR_LABELS: Record<string, string> = {
  'mobile-app-development': 'Mobile App Development',
  'mvp-startup': 'MVP & Startup Development',
  'ai-solutions': 'AI Solutions',
  'web-app-development': 'Web App Development',
  'telegram-bot-development': 'Telegram Bot Development',
  'crm-development': 'CRM Development',
  'business-automation': 'Business Automation',
  'saas-development': 'SaaS Development',
  outsourcing: 'Developer Outsourcing',
  'project-rescue': 'Project Rescue',
  ecommerce: 'E-commerce Development',
  'ui-ux-design': 'UI/UX Design',
  'maintenance-support': 'Maintenance & Support',
  cybersecurity: 'Cybersecurity',
};

async function getBlogPost(rawSlug: string, locale: string): Promise<BlogPost | null> {
  try {
    await dbConnect();
    const slug = decodeURIComponent(rawSlug);
    const validLocale = validateLocale(locale, 'en');
    let post = await BlogPostModel.findOne({ slug, locale: validLocale, status: 'published' }).lean();
    if (!post) {
      post = await BlogPostModel.findOne({ slug, status: 'published' }).lean();
    }
    if (!post) return null;
    return JSON.parse(JSON.stringify(post));
  } catch {
    return null;
  }
}

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
  const post = await getBlogPost(slug, locale);

  if (!post) {
    return {
      title: 'Post Not Found | SoftWhere.uz',
      description: 'The requested blog post could not be found.',
    };
  }

  const description = extractDescription(post.content, post.metaDescription);
  const keywords = getKeywords(post);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://softwhere.uz';

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
      url: `${baseUrl}/${locale}/blog/${slug}`,
      siteName: 'SoftWhere.uz',
      locale,
      images: [
        {
          url: post.coverImage?.url
            ? `${baseUrl}/api/og?title=${encodeURIComponent(post.title)}&locale=${locale}&image=${encodeURIComponent(post.coverImage.url)}`
            : `${baseUrl}/api/og?title=${encodeURIComponent(post.title)}&locale=${locale}`,
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
          ? `${baseUrl}/api/og?title=${encodeURIComponent(post.title)}&locale=${locale}&image=${encodeURIComponent(post.coverImage.url)}`
          : `${baseUrl}/api/og?title=${encodeURIComponent(post.title)}&locale=${locale}`,
      ],
    },
    alternates: {
      canonical: `${baseUrl}/${locale}/blog/${slug}`,
      languages: {
        uz: `${baseUrl}/uz/blog/${slug}`,
        ru: `${baseUrl}/ru/blog/${slug}`,
        en: `${baseUrl}/en/blog/${slug}`,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Structured data: BlogPosting + optional FAQ / HowTo
// ---------------------------------------------------------------------------

function parseFAQPairs(content: string): Array<{ q: string; a: string }> {
  const pairs: Array<{ q: string; a: string }> = [];
  const lines = content.split('\n');
  let currentQ = '';
  let currentA = '';

  for (const line of lines) {
    const questionMatch = line.match(/^#{1,3}\s+(.+\?)\s*$/);
    if (questionMatch) {
      if (currentQ && currentA.trim()) {
        pairs.push({ q: currentQ, a: currentA.trim().slice(0, 300) });
      }
      currentQ = questionMatch[1];
      currentA = '';
    } else if (currentQ) {
      const clean = line
        .replace(/^[-*]\s+/, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .trim();
      if (clean) currentA += (currentA ? ' ' : '') + clean;
    }
  }
  if (currentQ && currentA.trim()) {
    pairs.push({ q: currentQ, a: currentA.trim().slice(0, 300) });
  }
  return pairs.slice(0, 10);
}

function BlogPostSchema({ post, locale }: { post: BlogPost; locale: string }) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://softwhere.uz';
  const description = extractDescription(post.content, post.metaDescription);
  const keywords = getKeywords(post);
  const articleSection = post.category ? (PILLAR_LABELS[post.category] ?? 'Technology') : 'Technology';

  const schemas: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description,
      image: post.coverImage?.url || `${baseUrl}/api/og?title=${encodeURIComponent(post.title)}&locale=${locale}`,
      author: { '@type': 'Organization', name: 'SoftWhere.uz', url: baseUrl },
      publisher: {
        '@type': 'Organization',
        name: 'SoftWhere.uz',
        logo: { '@type': 'ImageObject', url: `${baseUrl}/icons/logo.svg` },
      },
      datePublished: post.createdAt,
      dateModified: post.updatedAt,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${baseUrl}/${locale}/blog/${post.slug}`,
      },
      articleSection,
      keywords: keywords.join(', '),
      wordCount: post.content.split(' ').length,
      inLanguage: locale,
      isPartOf: { '@type': 'Blog', '@id': `${baseUrl}/${locale}/blog` },
    },
  ];

  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/${locale}` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${baseUrl}/${locale}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title },
    ],
  });

  // FAQ schema for faq-format posts
  if (post.postFormat === 'faq' || post.postFormat === 'myth-buster') {
    const faqPairs = parseFAQPairs(post.content);
    if (faqPairs.length >= 3) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqPairs.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      });
    }
  }

  return (
    <>
      {schemas.map((s, i) => (
        <script key={i} type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function BlogPostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const post = await getBlogPost(slug, locale);
  const t = await getTranslations('blog');

  if (!post) {
    notFound();
  }

  const formattedDate = format(new Date(post.createdAt), 'MMMM dd, yyyy');
  const readingTime = Math.ceil(post.content.split(/\s+/).length / 200);
  const relatedPosts = await getRelatedPosts(post.category, post._id, locale);

  return (
    <BlogPostClient post={post} category={post.category}>
      <BlogPostSchema post={post} locale={locale} />

      <div className='page-layout min-h-screen' style={{ backgroundColor: 'var(--gray-100)' }}>
        {/* Breadcrumbs */}
        <nav className='bg-white border-b border-gray-200' aria-label='Breadcrumb'>
          <div className='container py-4'>
            <ol className='flex items-center space-x-2 text-sm text-gray-500'>
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
              <li className='text-gray-900 truncate max-w-xs'>{post.title}</li>
            </ol>
          </div>
        </nav>

        {/* Header with navigation */}
        <header className='bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm'>
          <div className='container py-4'>
            <Link
              href={`/${locale}/blog`}
              className='inline-flex items-center text-gray-600 hover:text-[#fe4502] transition-colors duration-300 font-medium'
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
            <Image src={post.coverImage.url} alt={post.title} fill priority className='object-cover' sizes='100vw' />
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
          <div className='bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden'>
            <article className='p-8 md:p-12'>
              {/* Article header */}
              <header className='mb-12 text-center'>
                <h1 className='text-4xl md:text-5xl font-bold text-gray-900 mb-8 leading-tight tracking-wide'>{post.title}</h1>
                <div className='flex items-center justify-center flex-wrap gap-4 text-gray-500 text-sm font-medium'>
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
                    <span className='px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full'>
                      {PILLAR_LABELS[post.category]}
                    </span>
                  )}
                </div>
              </header>

              {/* Article content */}
              <div className='prose prose-lg prose-gray max-w-none'>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className='text-3xl md:text-4xl font-bold text-gray-900 mt-12 mb-6 leading-tight'>{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className='text-2xl md:text-3xl font-bold text-gray-900 mt-10 mb-5 leading-tight'>{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className='text-xl md:text-2xl font-bold text-gray-900 mt-8 mb-4 leading-tight'>{children}</h3>
                    ),
                    p: ({ children }) => <p className='text-lg text-gray-700 leading-relaxed mb-6 font-light'>{children}</p>,
                    ul: ({ children }) => <ul className='list-disc pl-6 mb-6 space-y-2 text-lg text-gray-700'>{children}</ul>,
                    ol: ({ children }) => <ol className='list-decimal pl-6 mb-6 space-y-2 text-lg text-gray-700'>{children}</ol>,
                    li: ({ children }) => <li className='leading-relaxed'>{children}</li>,
                    blockquote: ({ children }) => (
                      <blockquote className='border-l-4 border-blue-500 pl-6 py-2 my-8 bg-gray-50 italic text-lg text-gray-700 rounded-r-lg'>
                        {children}
                      </blockquote>
                    ),
                    code: ({ children }) => (
                      <code className='bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800'>{children}</code>
                    ),
                    pre: ({ children }) => <pre className='bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-6'>{children}</pre>,
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={alt || ''} loading='lazy' className='rounded-lg w-full object-cover max-h-[500px]' />
                        {alt && <figcaption className='text-center text-sm text-gray-500 mt-2'>{alt}</figcaption>}
                      </figure>
                    ),
                    table: ({ children }) => (
                      <div className='overflow-x-auto my-6'>
                        <table className='min-w-full border-collapse border border-gray-200 text-base'>{children}</table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className='border border-gray-200 bg-gray-50 px-4 py-2 text-left font-semibold text-gray-900'>{children}</th>
                    ),
                    td: ({ children }) => <td className='border border-gray-200 px-4 py-2 text-gray-700'>{children}</td>,
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

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section className='mt-12'>
              <h2 className='text-2xl font-bold text-gray-900 mb-6'>{t('relatedArticles')}</h2>
              <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                {relatedPosts.map(rp => (
                  <Link
                    key={rp.slug}
                    href={`/${locale}/blog/${rp.slug}`}
                    className='bg-white rounded-lg shadow border border-gray-100 overflow-hidden hover:shadow-md transition-shadow'
                  >
                    {rp.coverImage?.thumbUrl ? (
                      <div className='relative h-40'>
                        <Image
                          src={rp.coverImage.thumbUrl}
                          alt={rp.title}
                          fill
                          className='object-cover'
                          sizes='(max-width: 768px) 100vw, 33vw'
                        />
                      </div>
                    ) : (
                      <div className='h-40 bg-gradient-to-br from-[#fe4502] to-[#ff5f24] flex items-center justify-center'>
                        <span className='text-white text-4xl font-bold'>{rp.title.charAt(0)}</span>
                      </div>
                    )}
                    <div className='p-4'>
                      <h3 className='font-semibold text-gray-900 line-clamp-2'>{rp.title}</h3>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

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
