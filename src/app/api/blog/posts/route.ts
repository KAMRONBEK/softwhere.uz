import { blogService } from '@/services/blog.service';
import { logger } from '@/utils/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    logger.info('Blog posts API request started', undefined, 'API');

    // Extract query parameters
    const locale = request.nextUrl.searchParams.get('locale') || undefined;
    const generationGroupId = request.nextUrl.searchParams.get('generationGroupId') || undefined;
    const limitParam = request.nextUrl.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    // Use service layer
    const result = await blogService.getPosts({
      locale,
      generationGroupId,
      limit,
    });

    const duration = Date.now() - startTime;
    logger.performance('Blog posts API', duration, 'API');

    if (!result.success) {
      logger.error('Blog posts API failed', result.error, 'API');
      return NextResponse.json(
        {
          error: result.error,
        },
        { status: 500 }
      );
    }

    logger.info(`Blog posts API completed successfully - ${result.data?.length} posts`, undefined, 'API');

    return NextResponse.json({ posts: result.data });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Blog posts API error', error, 'API');
    logger.performance('Blog posts API (failed)', duration, 'API');

    return NextResponse.json(
      {
        error: 'Failed to fetch posts',
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
