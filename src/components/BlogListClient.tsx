'use client';

import { CoverImage } from '@/types';
import { trackEvent } from '@/utils/analytics';
import { format } from 'date-fns';
import type { Locale as DateFnsLocale } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

export interface BlogPostSummary {
  title: string;
  slug: string;
  createdAt: string;
  locale: string;
  coverImage?: CoverImage;
  category?: string;
}

const CATEGORY_ORDER = [
  'mobile-app-development',
  'mvp-startup',
  'ai-solutions',
  'web-app-development',
  'telegram-bot-development',
  'crm-development',
  'business-automation',
  'saas-development',
  'outsourcing',
  'project-rescue',
  'ecommerce',
  'ui-ux-design',
  'maintenance-support',
  'cybersecurity',
];

const DATE_LOCALES: Record<string, DateFnsLocale> = { ru, uz };

export default function BlogListClient({ posts, locale }: { posts: BlogPostSummary[]; locale: string }) {
  const t = useTranslations('blog');
  const tCat = useTranslations('blog.categories');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const dateLocale = DATE_LOCALES[locale];
  const categoryLabel = (cat: string) => (CATEGORY_ORDER.includes(cat) ? (tCat as (k: string) => string)(cat) : cat);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    posts.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
  }, [posts]);

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    trackEvent('blog_category_filter', { category });
  };

  const filteredPosts = useMemo(() => {
    if (activeCategory === 'all') return posts;
    return posts.filter(p => p.category === activeCategory);
  }, [posts, activeCategory]);

  return (
    <>
      {availableCategories.length > 1 && (
        <div className='flex flex-wrap justify-center gap-2 mb-12'>
          <button
            onClick={() => handleCategoryChange('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === 'all' ? 'bg-[#fe4502] text-white' : 'glass text-gray-600 dark:text-gray-300 hover:-translate-y-0.5'
            }`}
          >
            {t('allCategories')}
          </button>
          {availableCategories.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat ? 'bg-[#fe4502] text-white' : 'glass text-gray-600 dark:text-gray-300 hover:-translate-y-0.5'
              }`}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      )}

      {filteredPosts.length === 0 ? (
        <div className='text-center py-16'>
          <p className='text-xl text-gray-500 dark:text-gray-400'>{t('noPostsAvailable')}</p>
        </div>
      ) : (
        <div className='grid md:grid-cols-2 lg:grid-cols-3 gap-8'>
          {filteredPosts.map((post, index) => (
            <div
              key={post.slug}
              className='glass rounded-xl overflow-hidden hover:shadow-xl hover:-translate-y-2 transition-all duration-300'
            >
              {/* The image is a link; the Unsplash attribution is a SIBLING
                  (not nested) anchor to keep the HTML valid / avoid hydration
                  mismatch. */}
              <div className='relative h-48 overflow-hidden'>
                <Link href={`/${locale}/blog/${post.slug}`} className='absolute inset-0 z-0'>
                  {post.coverImage?.thumbUrl ? (
                    <Image
                      src={post.coverImage.thumbUrl}
                      alt={post.title}
                      fill
                      className='object-cover transition-transform duration-300 hover:scale-105'
                      sizes='(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw'
                      priority={index === 0}
                    />
                  ) : (
                    <div className='w-full h-full bg-gradient-to-br from-[#fe4502] to-[#ff5f24] flex items-center justify-center'>
                      <span className='text-white/80 text-4xl font-bold'>{post.title.charAt(0)}</span>
                    </div>
                  )}
                </Link>
                {post.coverImage?.thumbUrl && (
                  <span className='absolute bottom-2 right-2 z-10 text-[10px] text-white/70 bg-black/30 px-1.5 py-0.5 rounded'>
                    Photo by{' '}
                    <a
                      href={`${post.coverImage.authorUrl}?utm_source=softwhere&utm_medium=referral`}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='underline'
                    >
                      {post.coverImage.authorName}
                    </a>
                  </span>
                )}
              </div>
              <div className='p-6'>
                {post.category && CATEGORY_ORDER.includes(post.category) && (
                  <span className='inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded mb-2'>
                    {categoryLabel(post.category)}
                  </span>
                )}
                <h2 className='text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 line-clamp-2 leading-tight'>
                  <Link href={`/${locale}/blog/${post.slug}`} className='hover:text-[#fe4502] transition-colors duration-300'>
                    {post.title}
                  </Link>
                </h2>
                <div className='text-sm text-gray-500 dark:text-gray-400 mb-4 font-medium'>
                  {format(new Date(post.createdAt), 'MMMM dd, yyyy', { locale: dateLocale })}
                </div>
                <div className='mt-4'>
                  <Link
                    href={`/${locale}/blog/${post.slug}`}
                    className='inline-flex items-center text-[var(--accent-text)] hover:text-[#ff5f24] font-semibold text-sm transition-colors duration-300'
                  >
                    {t('readMore')}
                    <svg className='w-4 h-4 ml-2' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M9 5l7 7-7 7'></path>
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
