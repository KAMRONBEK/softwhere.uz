import { deleteById, getById, isValidPostId, slugTaken, updateById } from '@/modules/blog/model/posts.repository';
import type { NewBlogPost } from '@/modules/blog/model/BlogPost';
import { verifyApiSecret } from '@/core/auth';
import { logger } from '@/core/logger';
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

type PostPatch = Partial<Pick<NewBlogPost, 'title' | 'slug' | 'content' | 'status' | 'locale'>>;

// Bust the blog ISR caches after a successful write. revalidateTag busts the
// list page's tagged data query; revalidatePath busts the statically-rendered
// blog detail pages (which use per-request cache(), not a tag) so an edit /
// unpublish propagates immediately instead of after the 1h timer.
function invalidateBlogCache(): void {
  try {
    revalidateTag('blog-posts', 'max');
    revalidatePath('/[locale]/blog/[slug]', 'page');
  } catch (e) {
    logger.error('Failed to revalidate blog caches', e, 'API');
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = verifyApiSecret(request);
  if (authError) return authError;

  const { id } = await params;

  if (!id || !isValidPostId(id)) {
    return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
  }

  try {
    const post = await getById(id);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error) {
    logger.error('Error fetching post', error, 'API');

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT handler to update a single post
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = verifyApiSecret(request);
  if (authError) return authError;

  const { id } = await params;

  if (!id || !isValidPostId(id)) {
    return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    // Validate required fields
    const { title, slug, content, status, locale } = body;

    if (!title || !slug || !content || !status || !locale) {
      return NextResponse.json(
        {
          error: 'Missing required fields (title, slug, content, status, locale)',
        },
        { status: 400 }
      );
    }
    if (!['draft', 'published'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }
    if (!['en', 'ru', 'uz'].includes(locale)) {
      return NextResponse.json({ error: 'Invalid locale value' }, { status: 400 });
    }

    // Find the existing post
    const existingPost = await getById(id);

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check for slug collision only if the slug has changed (same locale, other id)
    if (slug !== existingPost.slug) {
      if (await slugTaken(slug, locale, id)) {
        return NextResponse.json({ error: `Slug "${slug}" already exists for locale "${locale}"` }, { status: 409 }); // 409 Conflict
      }
    }

    // Perform the update
    const updatedPost = await updateById(id, {
      title,
      slug,
      content,
      status: status as 'draft' | 'published',
      locale: locale as 'en' | 'ru' | 'uz',
    });

    if (!updatedPost) {
      // Should not happen if getById found it, but handle just in case
      return NextResponse.json({ error: 'Post not found after update attempt' }, { status: 404 });
    }

    logger.info(`Post ${id} updated successfully`, undefined, 'API');

    invalidateBlogCache();

    return NextResponse.json({
      success: true,
      message: 'Post updated successfully',
      post: updatedPost,
    });
  } catch (error) {
    logger.error('Error updating post', error, 'API');

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const PATCH_ALLOWED_FIELDS = ['status', 'title', 'content', 'slug', 'locale'] as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = verifyApiSecret(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    if (!id || !isValidPostId(id)) {
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    const body = await request.json();

    const patch: PostPatch = {};
    for (const field of PATCH_ALLOWED_FIELDS) {
      if (field in body) patch[field] = body[field];
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    if (patch.status && !['draft', 'published'].includes(patch.status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    if (patch.locale && !['en', 'ru', 'uz'].includes(patch.locale)) {
      return NextResponse.json({ error: 'Invalid locale value' }, { status: 400 });
    }

    const updatedPost = await updateById(id, patch);

    if (!updatedPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    invalidateBlogCache();

    return NextResponse.json({
      success: true,
      post: updatedPost,
    });
  } catch (error) {
    logger.error('Error updating post', error, 'API');

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = verifyApiSecret(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    if (!id || !isValidPostId(id)) {
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    const deleted = await deleteById(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    invalidateBlogCache();

    return NextResponse.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting post', error, 'API');

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
