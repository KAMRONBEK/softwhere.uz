import { deleteById, getById, isValidPostId, slugTaken, updateById } from '@/modules/blog/model/posts.repository';
import type { NewBlogPost } from '@/modules/blog/model/BlogPost';
import { requireAdmin } from '@/core/auth';
import { logger } from '@/core/logger';
import { ENV } from '@/core/constants';
import { pingIndexNow } from '@/modules/blog/utils/indexnow';
import { pathsForPost, postPath, revalidateBlogCaches } from '@/modules/blog/utils/revalidate';
import { NextRequest, NextResponse } from 'next/server';

type PostPatch = Partial<Pick<NewBlogPost, 'title' | 'slug' | 'content' | 'status' | 'locale'>>;

// Every write purges the post (old and new URL if the slug/locale moved), its
// locale siblings (their hreflang alternates embed this slug) and its
// category-mates (their "related articles" cards can show this post) — a
// bounded set, instead of every post on the site as the previous purge did.
async function purgeAfterWrite(before: { locale: string; slug: string }, after: Parameters<typeof pathsForPost>[0]): Promise<void> {
  const paths = await pathsForPost(after);
  const oldPath = postPath(before.locale, before.slug);
  revalidateBlogCaches(paths.includes(oldPath) ? paths : [oldPath, ...paths], 'API');
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAdmin(request);
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
  const authError = await requireAdmin(request);
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

    await purgeAfterWrite(existingPost, updatedPost);

    // On publish (or a published post's URL/content change), ping IndexNow so
    // Yandex/Bing pick the URL up within minutes. Awaited: fire-and-forget
    // promises can be killed when the serverless instance suspends.
    if (status === 'published') {
      await pingIndexNow([`${ENV.BASE_URL}/${locale}/blog/${encodeURIComponent(slug)}`]);
    }

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
  const authError = await requireAdmin(request);
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

    const existingPost = await getById(id);
    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const updatedPost = await updateById(id, patch);

    if (!updatedPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    await purgeAfterWrite(existingPost, updatedPost);

    // The admin UI publishes via PATCH {status:'published'} — this is the real
    // publish path, so ping IndexNow here. Awaited: a fire-and-forget promise
    // can be killed when the serverless instance suspends after responding.
    if (patch.status === 'published') {
      await pingIndexNow([`${ENV.BASE_URL}/${updatedPost.locale}/blog/${encodeURIComponent(updatedPost.slug)}`]);
    }

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
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { id } = await params;

    if (!id || !isValidPostId(id)) {
      return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
    }

    const existingPost = await getById(id);
    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Resolve the siblings BEFORE the row is gone: their hreflang sets drop
    // this locale and must re-render, and the sitemap must lose the URL now,
    // not after its 6h window.
    const paths = await pathsForPost(existingPost);
    const deleted = await deleteById(id);

    if (!deleted) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    revalidateBlogCaches(paths, 'API');

    return NextResponse.json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting post', error, 'API');

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
