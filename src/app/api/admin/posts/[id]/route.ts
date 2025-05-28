import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BlogPost from '@/models/BlogPost';
import mongoose from 'mongoose';
const slugify = require('slugify'); // Use require if import causes issues

// TODO: Add authentication/authorization check here

// GET handler to fetch a single post by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // In a real app, verify user is authenticated and authorized admin here
  const { id } = params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
  }

  try {
    await dbConnect();

    const post = await BlogPost.findById(id);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error: any) {
    console.error('Error fetching post:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT handler to update a single post
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // In a real app, verify user is authenticated and authorized admin here
  const { id } = params;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    // Validate required fields
    const { title, slug, content, status, locale } = body;

    if (!title || !slug || !content || !status || !locale) {
      return NextResponse.json(
        {
          error:
            'Missing required fields (title, slug, content, status, locale)',
        },
        { status: 400 }
      );
    }
    if (!['draft', 'published'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }
    if (!['en', 'ru', 'uz'].includes(locale)) {
      return NextResponse.json(
        { error: 'Invalid locale value' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find the existing post
    const existingPost = await BlogPost.findById(id);

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check for slug collision only if the slug has changed
    if (slug !== existingPost.slug) {
      const slugCollision = await BlogPost.findOne({
        slug,
        locale,
        _id: { $ne: id },
      }); // Check other posts in same locale

      if (slugCollision) {
        return NextResponse.json(
          { error: `Slug "${slug}" already exists for locale "${locale}"` },
          { status: 409 }
        ); // 409 Conflict
      }
    }

    // Perform the update
    const updatedPost = await BlogPost.findByIdAndUpdate(
      id,
      { title, slug, content, status, locale },
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );

    if (!updatedPost) {
      // Should not happen if findById found it, but handle just in case
      return NextResponse.json(
        { error: 'Post not found after update attempt' },
        { status: 404 }
      );
    }

    console.log(`Post ${id} updated successfully.`);

    return NextResponse.json({
      success: true,
      message: 'Post updated successfully',
      post: updatedPost,
    });
  } catch (error: any) {
    console.error('Error updating post:', error);
    // Handle potential validation errors from Mongoose
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { error: 'Validation failed', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    await dbConnect();

    const updatedPost = await BlogPost.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    });

    if (!updatedPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      post: updatedPost,
    });
  } catch (error) {
    console.error('Error updating post:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    await dbConnect();

    const deletedPost = await BlogPost.findByIdAndDelete(id);

    if (!deletedPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting post:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// TODO: Add DELETE handler here later for deleting the post
