import { NextResponse } from 'next/server';
import { listForFeed } from '@/modules/blog/model/posts.repository';
import { validateLocale } from '@/core/auth';
import { ENV } from '@/core/constants';
import { logger } from '@/core/logger';

// One RSS 2.0 feed per locale (/en/feed.xml, /ru/feed.xml, /uz/feed.xml).
// Feeds matter for answer-engine/aggregator ingestion and freshness signals.
//
// Daily window rather than hourly: publishes purge these immediately via
// revalidatePath(`/${locale}/feed.xml`), so the window is only a safety net
// against a missed cache bust. Three routes at 1h expiry was enough steady DB
// traffic to keep the Neon compute off its 5-min scale-to-zero timer.
export const revalidate = 86400;

// Without this the `[locale]` segment makes the route render on demand, so
// every CDN miss became a DB read (~72/day) and each one held the Neon compute
// up for its full 5-min idle timeout. Enumerating the three locales lets Next
// prerender + ISR-cache them, so revalidatePath() controls freshness instead.
// Note: the explicit Cache-Control below keeps this handler dynamic, so the
// s-maxage there is what actually caps origin (and DB) hits at ~3/day.
export function generateStaticParams() {
  return [{ locale: 'uz' }, { locale: 'ru' }, { locale: 'en' }];
}

const CHANNEL_TITLE: Record<string, string> = {
  en: 'SoftWhere.uz Blog',
  ru: 'Блог SoftWhere.uz',
  uz: 'SoftWhere.uz blogi',
};

const CHANNEL_DESCRIPTION: Record<string, string> = {
  en: 'Practical software advice for businesses in Uzbekistan and Central Asia — apps, web, AI, Telegram bots.',
  ru: 'Практичные статьи о разработке ПО для бизнеса в Узбекистане и Центральной Азии.',
  uz: "O'zbekiston biznesi uchun dasturiy ta'minot bo'yicha amaliy maqolalar.",
};

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = validateLocale(rawLocale, 'en');
  const baseUrl = ENV.BASE_URL;

  try {
    const posts = await listForFeed(locale, 20);

    const items = posts
      .map(post => {
        const url = `${baseUrl}/${locale}/blog/${encodeURIComponent(post.slug)}`;
        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(post.createdAt).toUTCString()}</pubDate>${
        post.metaDescription ? `\n      <description>${escapeXml(post.metaDescription)}</description>` : ''
      }${post.category ? `\n      <category>${escapeXml(post.category)}</category>` : ''}
    </item>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(CHANNEL_TITLE[locale] ?? CHANNEL_TITLE.en)}</title>
    <link>${baseUrl}/${locale}/blog</link>
    <description>${escapeXml(CHANNEL_DESCRIPTION[locale] ?? CHANNEL_DESCRIPTION.en)}</description>
    <language>${locale}</language>
    <atom:link href="${baseUrl}/${locale}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        // Matches the ISR window above; an hourly s-maxage would pull the
        // origin (and the DB) awake every hour regardless of the route cache.
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error) {
    logger.error('Failed to render RSS feed', error, 'SEO');
    return new NextResponse('Feed unavailable', { status: 500 });
  }
}
