'use client';

import { CoverImage } from '@/shared/types';
import { trackEvent } from '@/shared/utils/analytics';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { formatPostDate } from '../utils/postDate';
import PostCard from './PostCard';
import PostGrid from './PostGrid';
import css from './blog.module.css';

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

export default function BlogListClient({ posts, locale }: { posts: BlogPostSummary[]; locale: string }) {
  const t = useTranslations('blog');
  const tCat = useTranslations('blog.categories');
  const [activeCategory, setActiveCategory] = useState<string>('all');

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
        <div className={css.filters}>
          {['all', ...availableCategories].map(cat => (
            <button
              key={cat}
              type='button'
              aria-pressed={activeCategory === cat}
              onClick={() => handleCategoryChange(cat)}
              className={css.filter}
            >
              {cat === 'all' ? t('allCategories') : categoryLabel(cat)}
            </button>
          ))}
        </div>
      )}

      {filteredPosts.length === 0 ? (
        <p className={css.empty}>{t('noPostsAvailable')}</p>
      ) : (
        <PostGrid>
          {filteredPosts.map((post, index) => (
            <PostCard
              key={post.slug}
              title={post.title}
              slug={post.slug}
              locale={locale}
              coverImage={post.coverImage}
              as='h2'
              category={post.category && CATEGORY_ORDER.includes(post.category) ? categoryLabel(post.category) : undefined}
              date={{
                iso: post.createdAt,
                text: formatPostDate(post.createdAt, locale),
              }}
              isLead={index === 0}
              hasCredit
              isPriority={index === 0}
            />
          ))}
        </PostGrid>
      )}
    </>
  );
}
