import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BlogPost from '@/models/BlogPost';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;
  const startTime = Date.now();

  // Get locale from query string, defaulting to "en"
  const locale = request.nextUrl.searchParams.get('locale') || 'en';

  if (!slug) {
    return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
  }

  try {
    // Add timeout wrapper for the entire operation
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('API operation timeout after 20 seconds'));
      }, 20000);
    });

    const operationPromise = async () => {
      await dbConnect();

      // First, try to find the published post with this slug and the requested locale
      let post = await BlogPost.findOne({
        slug,
        locale,
        status: 'published',
      }).lean();

      // If not found in the requested locale, try to find it in any locale
      if (!post) {
        post = await BlogPost.findOne({
          slug,
          status: 'published',
        }).lean();
      }

      return post;
    };

    const post = await Promise.race([operationPromise(), timeoutPromise]);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const duration = Date.now() - startTime;

    console.log(`Blog post fetch completed in ${duration}ms`);

    // Return the post
    return NextResponse.json({ post });
  } catch (error) {
    const duration = Date.now() - startTime;

    console.error(
      `Error fetching post with slug '${slug}' after ${duration}ms:`,
      error
    );

    return NextResponse.json(
      { error: 'Failed to fetch post' },
      { status: 500 }
    );
  }
}
