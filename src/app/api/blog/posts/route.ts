import { listPublished } from '@/modules/blog/model/posts.repository';
import { isValidLocale } from '@/core/auth';
import { logger } from '@/core/logger';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const localeParam = request.nextUrl.searchParams.get('locale');

    let locale: 'en' | 'ru' | 'uz' | undefined;
    if (localeParam) {
      if (!isValidLocale(localeParam)) {
        return NextResponse.json({ error: 'Invalid locale. Allowed: en, ru, uz' }, { status: 400 });
      }
      locale = localeParam;
    }

    const posts = await listPublished(locale, 100);

    logger.performance('Blog posts fetch', Date.now() - startTime, 'BLOG');

    return NextResponse.json({ posts });
  } catch (error) {
    logger.error(`Error fetching published blog posts after ${Date.now() - startTime}ms`, error, 'BLOG');

    // Don't leak internal DB error strings to unauthenticated clients;
    // the details are already logged server-side above.
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}
