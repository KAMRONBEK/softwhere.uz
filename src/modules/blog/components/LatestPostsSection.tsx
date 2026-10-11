import { format } from 'date-fns';
import type { Locale as DateFnsLocale } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import Link from 'next/link';
import { validateLocale } from '@/core/auth';
import { getLatestPosts } from '../lib/latestPosts';

const DATE_LOCALES: Record<string, DateFnsLocale> = { ru, uz };

/**
 * Server-rendered latest-posts block for the homepage. Gives crawlers a path
 * from the site's most-crawled page to individual posts — before this, no
 * post URL was linked from any homepage.
 */
export default async function LatestPostsSection({ locale }: { locale: string }) {
  const validLocale = validateLocale(locale, 'en');
  // [] when the DB is unreachable with nothing cached: no section.
  const posts = await getLatestPosts(validLocale);
  if (posts.length === 0) return null;

  const t = await getTranslations({ locale: validLocale, namespace: 'latestPosts' });

  return (
    <section id='latest-posts' className='py-16' style={{ backgroundColor: 'var(--bg)' }}>
      <div className='container'>
        <div className='flex items-end justify-between gap-4 mb-8'>
          <h2 className='text-3xl font-bold font-display tracking-tight text-ember-text'>{t('title')}</h2>
          <Link href={`/${locale}/blog`} className='text-ember-accent font-semibold whitespace-nowrap hover:underline underline-offset-4'>
            {t('viewAll')} →
          </Link>
        </div>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          {posts.map(post => (
            <Link
              key={post._id}
              href={`/${post.locale}/blog/${encodeURIComponent(post.slug)}`}
              className='bg-ember-surface rounded-lg shadow border border-ember-border overflow-hidden hover:shadow-md transition-shadow'
            >
              {post.coverImage?.thumbUrl ? (
                <div className='relative h-40'>
                  <Image
                    src={post.coverImage.thumbUrl}
                    alt={post.title}
                    fill
                    className='object-cover'
                    sizes='(max-width: 768px) 100vw, 33vw'
                  />
                </div>
              ) : (
                <div
                  className='h-40 flex items-center justify-center'
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))' }}
                >
                  <span className='text-[#0a0705] text-4xl font-bold'>{post.title.charAt(0)}</span>
                </div>
              )}
              <div className='p-4'>
                <h3 className='font-semibold font-display text-ember-text line-clamp-2 mb-2'>{post.title}</h3>
                <p className='text-ember-muted text-sm'>
                  {format(new Date(post.createdAt), locale === 'en' ? 'MMMM dd, yyyy' : 'd MMMM yyyy', {
                    locale: DATE_LOCALES[locale],
                  })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
