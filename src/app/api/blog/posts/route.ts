import dbConnect from '@/lib/db'; // Adjust path if necessary
import BlogPost, { IBlogPost } from '@/models/BlogPost'; // Adjust path if necessary
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Add timeout wrapper for the entire operation
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('API operation timeout after 25 seconds'));
      }, 25000);
    });

    const operationPromise = async () => {
      await dbConnect();

      // Get locale from query params, defaulting to all if not specified
      const locale = request.nextUrl.searchParams.get('locale');

      // Define the type for the selected fields
      type PublishedPostSummary = Pick<
        IBlogPost,
        'title' | 'slug' | 'createdAt' | 'locale'
      >;

      // Build query - filter by locale if provided
      const query: any = { status: 'published' };

      if (locale) {
        query.locale = locale;
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

    console.error(
      `Error fetching published blog posts after ${duration}ms:`,
      error
    );

    return NextResponse.json(
      {
        error: 'Failed to fetch posts',
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
