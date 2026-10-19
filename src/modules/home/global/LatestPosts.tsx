import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import css from './LatestPosts.module.css';

/** One post, already resolved by the app layer (the home module never reads the blog module). */
export interface HomePost {
  id: string;
  title: string;
  /** Locale-prefixed path, e.g. /uz/blog/<slug>. */
  href: string;
  /** ISO date. */
  publishedAt: string;
}

interface LatestPostsProps {
  locale: Locale;
  posts: readonly HomePost[];
}

function Arrow() {
  return (
    <svg className={css.arrow} viewBox='0 0 16 16' width='14' height='14' aria-hidden='true' focusable='false'>
      <path d='M3 8h10M9 4l4 4-4 4' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}

/** Uzbek month names (lower case, Latin script), January first. */
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'] as const;

/**
 * "31 August 2026" / "31 августа 2026 г." / "2026-yil 31-avgust". Uzbek is
 * written by hand: ICU's Uzbek pattern ("31-avgust, 2026") is not the form
 * Uzbek editors use, and server and browser ICU data differ for it.
 */
function formatPostDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (locale === 'uz') return `${date.getUTCFullYear()}-yil ${date.getUTCDate()}-${UZ_MONTHS[date.getUTCMonth()]}`;
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

/**
 * The homepage's latest-posts block (server component, passed to the shell as
 * its `appendix`): real links from the most-crawled page to the newest
 * articles. Copy: src/messages/home/posts/<locale>.json. Renders nothing
 * without posts. Rendered just before the finale (LabShell), with the same gutters and width as its contact panel.
 */
export default async function LatestPosts({ locale, posts }: LatestPostsProps) {
  if (posts.length === 0) return null;
  const t = await getTranslations({ locale, namespace: 'home.posts' });

  return (
    <section id='latest-posts' className={css.root} aria-labelledby='latest-posts-heading'>
      <div className={css.inner}>
        <div className={css.head}>
          <div className={css.titleBlock}>
            <p className={css.kicker}>{t('kicker')}</p>
            <h2 id='latest-posts-heading' className={css.title}>
              {t('title')}
            </h2>
          </div>
          <Link href={`/${locale}/blog`} className={css.all}>
            {t('viewAll')}
            <Arrow />
          </Link>
        </div>
        <ul className={css.list}>
          {posts.map(post => (
            <li key={post.id} className={css.item}>
              <Link href={post.href} className={css.card}>
                <time className={css.date} dateTime={post.publishedAt}>
                  {formatPostDate(post.publishedAt, locale)}
                </time>
                <h3 className={css.cardTitle}>{post.title}</h3>
                <span className={css.read} aria-hidden='true'>
                  {t('read')}
                  <Arrow />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
