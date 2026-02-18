import { logger } from '@/core/logger';
import dbConnect from '@/lib/db';
import BlogPost from '@/models/BlogPost';
import { isValidLocale } from '@/utils/auth';
import { NextRequest, NextResponse } from 'next/server';

const MAX_GROUP_ID_LENGTH = 128;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const generationGroupId = searchParams.get('generationGroupId');
    const targetLocale = searchParams.get('locale');

    if (!generationGroupId || !targetLocale) {
      return NextResponse.json({ error: 'generationGroupId and locale are required' }, { status: 400 });
    }

    if (!isValidLocale(targetLocale)) {
      return NextResponse.json({ error: 'Invalid locale. Allowed: en, ru, uz' }, { status: 400 });
    }

    if (typeof generationGroupId !== 'string' || generationGroupId.length > MAX_GROUP_ID_LENGTH) {
      return NextResponse.json({ error: 'Invalid generationGroupId' }, { status: 400 });
    }

    logger.info(
      `Finding related post for generationGroupId: ${generationGroupId}, locale: ${targetLocale}`,
      undefined,
      'RELATED_POSTS_API'
    );

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

      return NextResponse.json({ error: 'No related post found in target language' }, { status: 404 });
    }

    logger.info(`Found related post: ${relatedPost.slug} for locale: ${targetLocale}`, undefined, 'RELATED_POSTS_API');

    return NextResponse.json({
      success: true,
      post: {
        slug: relatedPost.slug,
        locale: relatedPost.locale,
      },
    });
  } catch (error) {
    logger.error('Error finding related post', error, 'RELATED_POSTS_API');

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
