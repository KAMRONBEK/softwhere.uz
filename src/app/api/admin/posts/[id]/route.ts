import { adminService } from '@/services/admin.service';
import { logger } from '@/utils/logger';
import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

// TODO: Add authentication/authorization check here

// GET handler to fetch a single post by ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  // In a real app, verify user is authenticated and authorized admin here
  const { id } = params;
  const startTime = Date.now();

  try {
    logger.info(`Admin get post API request started: ${id}`, undefined, 'API');

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      logger.error(`Admin get post API: Invalid post ID: ${id}`, undefined, 'API');
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    // Use service layer
    const result = await adminService.getPost(id);

    const duration = Date.now() - startTime;
    logger.performance(`Admin get post API: ${id}`, duration, 'API');

    if (!result.success) {
      const statusCode = result.error === 'Post not found' ? 404 : 500;

      logger.error(`Admin get post API failed: ${id}`, result.error, 'API');
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    logger.info(`Admin get post API completed successfully: ${id}`, undefined, 'API');

    return NextResponse.json({
      success: true,
      post: result.data,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`Admin get post API error: ${id}`, error, 'API');
    logger.performance(`Admin get post API (failed): ${id}`, duration, 'API');

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT handler to update a single post
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  // In a real app, verify user is authenticated and authorized admin here
  const { id } = params;
  const startTime = Date.now();

  try {
    logger.info(`Admin update post API request started: ${id}`, undefined, 'API');

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      logger.error(`Admin update post API: Invalid post ID: ${id}`, undefined, 'API');
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    const body = await request.json();
    const { title, slug, content, status, locale, generationGroupId } = body;

    // Use service layer
    const result = await adminService.updatePost(id, {
      title,
      slug,
      content,
      status,
      locale,
      generationGroupId,
    });

    const duration = Date.now() - startTime;
    logger.performance(`Admin update post API: ${id}`, duration, 'API');

    if (!result.success) {
      let statusCode = 500;
      if (result.error?.includes('required') || result.error?.includes('Invalid')) {
        statusCode = 400;
      } else if (result.error?.includes('already exists')) {
        statusCode = 409;
      } else if (result.error?.includes('not found')) {
        statusCode = 404;
      }

      logger.error(`Admin update post API failed: ${id}`, result.error, 'API');
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    logger.info(`Admin update post API completed successfully: ${id}`, undefined, 'API');

    return NextResponse.json({
      success: true,
      message: 'Post updated successfully',
      post: result.data,
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`Admin update post API error: ${id}`, error, 'API');
    logger.performance(`Admin update post API (failed): ${id}`, duration, 'API');

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const startTime = Date.now();

  try {
    logger.info(`Admin patch post API request started: ${id}`, undefined, 'API');

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      logger.error(`Admin patch post API: Invalid post ID: ${id}`, undefined, 'API');
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    const body = await request.json();

    // Use service layer - handle common PATCH operations
    let result;
    if (body.status === 'published') {
      result = await adminService.publishPost(id);
    } else if (body.status === 'draft') {
      result = await adminService.unpublishPost(id);
    } else {
      // Generic update for other fields
      result = await adminService.updatePost(id, body);
    }

    const duration = Date.now() - startTime;
    logger.performance(`Admin patch post API: ${id}`, duration, 'API');

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 500;

      logger.error(`Admin patch post API failed: ${id}`, result.error, 'API');
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    logger.info(`Admin patch post API completed successfully: ${id}`, undefined, 'API');

    return NextResponse.json({
      success: true,
      post: result.data,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Admin patch post API error: ${id}`, error, 'API');
    logger.performance(`Admin patch post API (failed): ${id}`, duration, 'API');

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const startTime = Date.now();

  try {
    logger.info(`Admin delete post API request started: ${id}`, undefined, 'API');

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      logger.error(`Admin delete post API: Invalid post ID: ${id}`, undefined, 'API');
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    // Use service layer
    const result = await adminService.deletePost(id);

    const duration = Date.now() - startTime;
    logger.performance(`Admin delete post API: ${id}`, duration, 'API');

    if (!result.success) {
      const statusCode = result.error?.includes('not found') ? 404 : 500;

      logger.error(`Admin delete post API failed: ${id}`, result.error, 'API');
      return NextResponse.json({ error: result.error }, { status: statusCode });
    }

    logger.info(`Admin delete post API completed successfully: ${id}`, undefined, 'API');

    return NextResponse.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Admin delete post API error: ${id}`, error, 'API');
    logger.performance(`Admin delete post API (failed): ${id}`, duration, 'API');

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
