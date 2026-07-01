import { NextRequest, NextResponse } from 'next/server';
import { getPublishedBySlug } from '@/modules/blog/model/posts.repository';
import { validateLocale } from '@/core/auth';
import { logger } from '@/core/logger';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const startTime = Date.now();

  const locale = validateLocale(request.nextUrl.searchParams.get('locale'), 'en');

  if (!slug) {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
  }

  try {
    const post = await getPublishedBySlug(slug, locale);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    logger.performance('Blog post fetch', Date.now() - startTime, 'BLOG');

    return NextResponse.json({ post });
  } catch (error) {
    logger.error(`Error fetching post with slug '${slug}' after ${Date.now() - startTime}ms`, error, 'BLOG');

    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
}
