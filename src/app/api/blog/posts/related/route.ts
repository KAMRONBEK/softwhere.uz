import dbConnect from '@/lib/db';
import BlogPost from '@/models/BlogPost';
import { logger } from '@/utils/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const generationGroupId = searchParams.get('generationGroupId');
    const targetLocale = searchParams.get('locale');

    logger.info(
      `Finding related post for generationGroupId: ${generationGroupId}, locale: ${targetLocale}`,
      undefined,
      'RELATED_POSTS_API'
    );

    if (!generationGroupId || !targetLocale) {
      logger.warn(
        'Missing required parameters: generationGroupId and locale are required',
        undefined,
        'RELATED_POSTS_API'
      );

      return NextResponse.json(
        { error: 'generationGroupId and locale are required' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find the post in the target locale with the same generation group ID
    const relatedPost = await BlogPost.findOne({
      generationGroupId,
      locale: targetLocale,
      status: 'published',
    });

    if (!relatedPost) {
      logger.info(
        `No related post found for generationGroupId: ${generationGroupId}, locale: ${targetLocale}`,
        undefined,
        'RELATED_POSTS_API'
      );

      return NextResponse.json(
        { error: 'No related post found in target language' },
        { status: 404 }
      );
    }

    logger.info(
      `Found related post: ${relatedPost.slug} for locale: ${targetLocale}`,
      undefined,
      'RELATED_POSTS_API'
    );

    return NextResponse.json({
      success: true,
      post: {
        slug: relatedPost.slug,
        locale: relatedPost.locale,
      },
    });
  } catch (error) {
    logger.error('Error finding related post', error, 'RELATED_POSTS_API');

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
