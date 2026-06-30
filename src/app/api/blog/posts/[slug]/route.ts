import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/core/db';
import BlogPost from '@/modules/blog/model/BlogPost';
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
    // Add timeout wrapper for the entire operation
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('API operation timeout after 20 seconds'));
      }, 20000);
    });

    const operationPromise = async () => {
      await dbConnect();

      const post = await BlogPost.findOne({
        slug,
        locale,
        status: 'published',
      }).lean();

      return post;
    };

    const post = await Promise.race([operationPromise(), timeoutPromise]);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const duration = Date.now() - startTime;

    logger.performance('Blog post fetch', duration, 'BLOG');

    // Return the post
    return NextResponse.json({ post });
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error(`Error fetching post with slug '${slug}' after ${duration}ms`, error, 'BLOG');

    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
}
