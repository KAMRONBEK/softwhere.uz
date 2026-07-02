import { NextResponse } from 'next/server';
import { listForFeed } from '@/modules/blog/model/posts.repository';
import { validateLocale } from '@/core/auth';
import { ENV } from '@/core/constants';
import { logger } from '@/core/logger';

// One RSS 2.0 feed per locale (/en/feed.xml, /ru/feed.xml, /uz/feed.xml).
// Feeds matter for answer-engine/aggregator ingestion and freshness signals.
export const revalidate = 3600;

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
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    logger.error('Failed to render RSS feed', error, 'SEO');
    return new NextResponse('Feed unavailable', { status: 500 });
  }
}
