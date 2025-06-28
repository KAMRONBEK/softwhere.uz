import { blogService } from '@/services/blog.service';
import { logger } from '@/utils/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const { searchParams } = request.nextUrl;
    const generationGroupId = searchParams.get('generationGroupId');
    const targetLocale = searchParams.get('locale');

    logger.info(`Related post API request started: generationGroupId=${generationGroupId}, locale=${targetLocale}`, undefined, 'API');

    if (!generationGroupId || !targetLocale) {
      logger.error('Related post API: Missing required parameters', undefined, 'API');
      return NextResponse.json({ error: 'generationGroupId and locale are required' }, { status: 400 });
    }

    // Use service layer
    const result = await blogService.getRelatedPost(generationGroupId, targetLocale);

    const duration = Date.now() - startTime;
    logger.performance(`Related post API: ${generationGroupId}`, duration, 'API');

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 500;

      logger.error(`Related post API failed: ${generationGroupId}`, result.error, 'API');
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    logger.info(`Related post API completed successfully: ${result.data?.slug}`, undefined, 'API');

    return NextResponse.json({
      success: true,
      post: result.data,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Related post API error', error, 'API');
    logger.performance('Related post API (failed)', duration, 'API');

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
