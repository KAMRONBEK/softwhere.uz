import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BlogPost from '@/models/BlogPost';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const generationGroupId = searchParams.get('generationGroupId');
    const targetLocale = searchParams.get('locale');

    if (!generationGroupId || !targetLocale) {
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
      return NextResponse.json(
        { error: 'No related post found in target language' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      post: {
        slug: relatedPost.slug,
        locale: relatedPost.locale,
      },
    });
  } catch (error) {
    console.error('Error finding related post:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
