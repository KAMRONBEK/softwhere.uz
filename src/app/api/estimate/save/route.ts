import { estimatorService } from '@/services/estimator.service';
import { logger } from '@/utils/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    logger.info('Quote save API request started', undefined, 'API');

    const body = await request.json();

    // Use service layer
    const result = await estimatorService.saveQuote(body);

    const duration = Date.now() - startTime;
    logger.performance('Quote save API', duration, 'API');

    if (!result.success) {
      logger.error('Quote save API failed', result.error, 'API');

      // Determine appropriate status code
      let statusCode = 500;
      if (result.error?.includes('required') || result.error?.includes('Invalid')) {
        statusCode = 400;
      }

      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    logger.info(`Quote save API completed successfully: ${result.data?.quoteId}`, undefined, 'API');

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Quote save API error', error, 'API');
    logger.performance('Quote save API (failed)', duration, 'API');

    return NextResponse.json({ error: 'Failed to save quote' }, { status: 500 });
  }
}
