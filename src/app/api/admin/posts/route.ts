import { adminService } from '@/services/admin.service';
import { logger } from '@/utils/logger';
import { NextRequest, NextResponse } from 'next/server';

// TODO: Add authentication/authorization check here

export async function GET(_request: NextRequest) {
  // In a real app, verify user is authenticated and authorized admin here
  const startTime = Date.now();

  try {
    logger.info('Admin posts API request started', undefined, 'API');

    // Use service layer
    const result = await adminService.getAllPosts();

    const duration = Date.now() - startTime;
    logger.performance('Admin posts API', duration, 'API');

    if (!result.success) {
      logger.error('Admin posts API failed', result.error, 'API');
      return NextResponse.json(
        {
          error: result.error,
        },
        { status: 500 }
      );
    }

    logger.info(`Admin posts API completed successfully - ${result.data?.length} posts`, undefined, 'API');

    return NextResponse.json({ posts: result.data });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Admin posts API error', error, 'API');
    logger.performance('Admin posts API (failed)', duration, 'API');

    return NextResponse.json(
      {
        error: 'Failed to fetch posts',
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

// POST handler to create a new blog post
export async function POST(request: NextRequest) {
  // In a real app, verify user is authenticated and authorized admin here
  const startTime = Date.now();

  try {
    logger.info('Admin create post API request started', undefined, 'API');

    const body = await request.json();
    const { title, slug, content, status, locale, generationGroupId } = body;

    // Use service layer
    const result = await adminService.createPost({
      title,
      slug,
      content,
      status,
      locale,
      generationGroupId,
    });

    const duration = Date.now() - startTime;
    logger.performance('Admin create post API', duration, 'API');

    if (!result.success) {
      logger.error('Admin create post API failed', result.error, 'API');

      // Determine appropriate status code based on error
      const statusCode =
        result.error?.includes('required') || result.error?.includes('Invalid')
          ? 400
          : result.error?.includes('already exists')
            ? 409
            : 500;

      return NextResponse.json(
        {
          error: result.error,
        },
        { status: statusCode }
      );
    }

    logger.info(`Admin create post API completed successfully - ${result.data?._id}`, undefined, 'API');

    return NextResponse.json(
      {
        message: 'Post created successfully',
        post: result.data,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('Admin create post API error', error, 'API');
    logger.performance('Admin create post API (failed)', duration, 'API');

    return NextResponse.json(
      {
        error: 'Failed to create post',
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}

// We can add PUT/DELETE handlers here later for managing posts
