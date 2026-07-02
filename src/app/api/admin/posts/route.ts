import { logger } from '@/core/logger';
import { createPost, listForAdmin, slugTaken } from '@/modules/blog/model/posts.repository';
import { requireAdmin } from '@/core/auth';
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  const startTime = Date.now();

  try {
    logger.info('Starting admin posts fetch', undefined, 'API');

    const posts = await listForAdmin();

    logger.info(`Fetched ${posts.length} posts for admin`, undefined, 'API');
    logger.performance('Admin posts fetch', Date.now() - startTime, 'API');

    return NextResponse.json({ posts });
  } catch (error: any) {
    logger.error('Error fetching posts for admin', error, 'API');
    logger.performance('Admin posts fetch (failed)', Date.now() - startTime, 'API');

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
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json();

    // Validate required fields - locale is mandatory
    const { title, slug, content, status, locale, generationGroupId } = body;

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

    // Check for slug collision within the same locale
    if (await slugTaken(slug, locale)) {
      return NextResponse.json({ error: `Slug "${slug}" already exists for locale "${locale}"` }, { status: 409 }); // 409 Conflict
    }

    const created = await createPost({
      title,
      slug,
      content,
      status: status as 'draft' | 'published',
      locale: locale as 'en' | 'ru' | 'uz',
      generationGroupId: generationGroupId ?? null,
    });

    // Bust the blog ISR caches so published changes show up (list via tag,
    // detail pages via path).
    try {
      revalidateTag('blog-posts', 'max');
      revalidatePath('/[locale]/blog/[slug]', 'page');
    } catch (e) {
      logger.error('Failed to revalidate blog caches', e, 'API');
    }

    return NextResponse.json(
      {
        message: 'Post created successfully',
        post: created,
      },
      { status: 201 }
    );
  } catch (error: any) {
    logger.error('Error creating new post', error, 'API');

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
