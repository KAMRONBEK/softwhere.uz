import dbConnect from '@/lib/db';
import BlogPost, { IBlogPost } from '@/models/BlogPost';
import { isValidLocale } from '@/utils/auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('API operation timeout after 25 seconds'));
      }, 25000);
    });

    const operationPromise = async () => {
      await dbConnect();

      const localeParam = request.nextUrl.searchParams.get('locale');

      type PublishedPostSummary = Pick<IBlogPost, 'title' | 'slug' | 'createdAt' | 'locale'>;

      const query: Record<string, string> = { status: 'published' };

      if (localeParam) {
        if (!isValidLocale(localeParam)) {
          throw new Error('INVALID_LOCALE');
        }
        query.locale = localeParam;
      }

      // Fetch only published posts, sorted by creation date (newest first)
      // Add limit for better performance on Vercel
      const posts: PublishedPostSummary[] = await BlogPost.find(query)
        .sort({ createdAt: -1 })
        .select('title slug createdAt locale') // Include locale in the response
        .limit(50) // Add limit for performance
        .lean(); // Use .lean() for plain JS objects if not modifying

      return posts;
    };

    const posts = await Promise.race([operationPromise(), timeoutPromise]);

    const duration = Date.now() - startTime;

    console.log(`Blog posts fetch completed in ${duration}ms`);

    return NextResponse.json({ posts });
  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(`Error fetching published blog posts after ${duration}ms:`, error);

    if (error.message === 'INVALID_LOCALE') {
      return NextResponse.json({ error: 'Invalid locale. Allowed: en, ru, uz' }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: 'Failed to fetch posts',
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
