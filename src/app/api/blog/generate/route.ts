import { generationService } from '@/services/generation.service';
import { logger } from '@/utils/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    logger.info('Blog generation API request started', undefined, 'API');

    const body = await request.json();

    // Use service layer
    const result = await generationService.generatePosts(body);

    const duration = Date.now() - startTime;
    logger.performance('Blog generation API', duration, 'API');

    if (!result.success) {
      logger.error('Blog generation API failed', result.error, 'API');

      // Determine appropriate status code
      let statusCode = 500;
      if (result.error?.includes('required') || result.error?.includes('Invalid')) {
        statusCode = 400;
      }

      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    logger.info(`Blog generation API completed successfully: ${result.data?.posts?.length} posts generated`, undefined, 'API');

    return NextResponse.json({
      success: true,
      message: result.data?.message,
      posts: result.data?.posts,
      generationGroupId: result.data?.generationGroupId,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Blog generation API error', error, 'API');
    logger.performance('Blog generation API (failed)', duration, 'API');

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
