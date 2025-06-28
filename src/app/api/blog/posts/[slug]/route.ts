import { blogService } from '@/services/blog.service';
import { logger } from '@/utils/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params;
  const startTime = Date.now();

  try {
    logger.info(`Blog post detail API request started: ${slug}`, undefined, 'API');

    // Get locale from query string, defaulting to "en"
    const locale = request.nextUrl.searchParams.get('locale') || 'en';

    if (!slug) {
      logger.error('Blog post detail API: Slug is required', undefined, 'API');
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    // Use service layer
    const result = await blogService.getPost(slug, locale);

    const duration = Date.now() - startTime;
    logger.performance(`Blog post detail API: ${slug}`, duration, 'API');

    if (!result.success) {
      const statusCode = result.error === 'Post not found' ? 404 : 500;

      logger.error(`Blog post detail API failed: ${slug}`, result.error, 'API');
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    logger.info(`Blog post detail API completed successfully: ${slug}`, undefined, 'API');

    return NextResponse.json({ post: result.data });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`Blog post detail API error: ${slug}`, error, 'API');
    logger.performance(`Blog post detail API (failed): ${slug}`, duration, 'API');

    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 });
  }
}
