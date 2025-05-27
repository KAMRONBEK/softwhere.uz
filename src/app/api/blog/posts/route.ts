import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db'; // Adjust path if necessary
import BlogPost, { IBlogPost } from '@/models/BlogPost'; // Adjust path if necessary

export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        // Get locale from query params, defaulting to all if not specified
        const url = new URL(request.url);
        const locale = url.searchParams.get('locale');

        // Define the type for the selected fields
        type PublishedPostSummary = Pick<IBlogPost, 'title' | 'slug' | 'createdAt' | 'locale'>;

        // Build query - filter by locale if provided
        const query: any = { status: 'published' };
        if (locale) {
            query.locale = locale;
        }

        // Fetch only published posts, sorted by creation date (newest first)
        const posts: PublishedPostSummary[] = await BlogPost.find(query)
            .sort({ createdAt: -1 })
            .select('title slug createdAt locale') // Include locale in the response
            .lean(); // Use .lean() for plain JS objects if not modifying
        // Add .limit(10) or implement pagination later for performance

        return NextResponse.json({ posts });

    } catch (error: any) {
        console.error("Error fetching published blog posts:", error);
        return NextResponse.json(
            { error: 'Failed to fetch posts', details: error.message || String(error) },
            { status: 500 }
        );
    }
} 