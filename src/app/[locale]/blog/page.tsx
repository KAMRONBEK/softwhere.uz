import { Metadata } from 'next';
import { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import BlogListClient, { BlogPostSummary } from '@/components/BlogListClient';
import dbConnect from '@/lib/db';
import BlogPostModel from '@/models/BlogPost';
import { validateLocale } from '@/utils/auth';
import { ENV, BLOG_CONFIG } from '@/constants';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: 'blog' });

  const title = `${t('title')} | SoftWhere.uz`;
  const description = t('description');

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${ENV.BASE_URL}/${locale}/blog`,
      siteName: 'SoftWhere.uz',
      locale,
      type: 'website',
    },
    alternates: {
      canonical: `${ENV.BASE_URL}/${locale}/blog`,
      languages: {
        'x-default': `${ENV.BASE_URL}/${BLOG_CONFIG.DEFAULT_LOCALE}/blog`,
        uz: `${ENV.BASE_URL}/uz/blog`,
        ru: `${ENV.BASE_URL}/ru/blog`,
        en: `${ENV.BASE_URL}/en/blog`,
      },
    },
  };
}

async function getPublishedPosts(locale: string): Promise<BlogPostSummary[]> {
  try {
    await dbConnect();
    const validLocale = validateLocale(locale, 'en');
    const posts = await BlogPostModel.find({ locale: validLocale, status: 'published' })
      .sort({ createdAt: -1 })
      .select('title slug createdAt locale coverImage category')
      .lean();
    return JSON.parse(JSON.stringify(posts));
  } catch {
    return [];
  }
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: 'blog' });
  const posts = await getPublishedPosts(locale);

  const blogSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${t('title')} | SoftWhere.uz`,
    description: t('description'),
    url: `${ENV.BASE_URL}/${locale}/blog`,
    isPartOf: { '@type': 'WebSite', name: 'SoftWhere.uz', url: ENV.BASE_URL },
    publisher: { '@type': 'Organization', name: 'SoftWhere.uz', url: ENV.BASE_URL },
    inLanguage: locale,
  };

  return (
    <div className='page-layout' style={{ backgroundColor: 'var(--gray-100)' }}>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }} />
      <div className='container py-20'>
        <header className='mb-12 text-center'>
          <h1 className='text-4xl font-bold text-gray-900 dark:text-gray-100 leading-tight tracking-wide mb-6'>{t('title')}</h1>
          <p className='text-gray-900 dark:text-gray-300 text-base font-medium leading-5 tracking-tight max-w-2xl mx-auto'>
            {t('description')}
          </p>
        </header>
        <BlogListClient posts={posts} locale={locale} />
      </div>
    </div>
  );
}
