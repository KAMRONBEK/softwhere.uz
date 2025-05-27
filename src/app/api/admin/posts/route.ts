import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import BlogPost from '@/models/BlogPost';
import { logger } from '@/utils/logger';

// TODO: Add authentication/authorization check here

export async function GET(request: NextRequest) {
    // In a real app, verify user is authenticated and authorized admin here
    const startTime = Date.now();
    
    try {
        logger.info('Starting admin posts fetch', undefined, 'API');
        
        // Add timeout wrapper
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Database operation timeout')), 25000); // 25 seconds
        });
        
        const dbPromise = (async () => {
            await dbConnect();
            logger.info('Database connected for admin posts', undefined, 'API');
            
            // Fetch all posts, sorted by creation date (newest first)
            const posts = await BlogPost.find({})
                .sort({ createdAt: -1 })
                .select('_id title slug content status locale generationGroupId createdAt updatedAt')
                .lean(); // Use .lean() for plain JS objects
                
            logger.info(`Fetched ${posts.length} posts for admin`, undefined, 'API');
            return posts;
        })();
        
        const posts = await Promise.race([dbPromise, timeoutPromise]);
        
        const duration = Date.now() - startTime;
        logger.performance('Admin posts fetch', duration, 'API');
        
        return NextResponse.json({ posts });

    } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error("Error fetching posts for admin", error, 'API');
        logger.performance('Admin posts fetch (failed)', duration, 'API');
        
        // Check if it's a timeout error
        if (error.message === 'Database operation timeout') {
            return NextResponse.json(
                { error: 'Request timeout - database took too long to respond' },
                { status: 504 }
            );
        }
        
        return NextResponse.json(
            { error: 'Failed to fetch posts', details: error.message || String(error) },
            { status: 500 }
        );
    }
}

// POST handler to create a new blog post
export async function POST(request: NextRequest) {
    // In a real app, verify user is authenticated and authorized admin here

    try {
        const body = await request.json();

        // Validate required fields - locale is mandatory
        const { title, slug, content, status, locale, generationGroupId } = body;

        if (!title || !slug || !content || !status || !locale) {
            return NextResponse.json(
                { error: 'Missing required fields (title, slug, content, status, locale)' },
                { status: 400 }
            );
        }

        if (!['draft', 'published'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
        }

        if (!['en', 'ru', 'uz'].includes(locale)) {
            return NextResponse.json({ error: 'Invalid locale value' }, { status: 400 });
        }

        await dbConnect();

        // Check for slug collision within the same locale
        const slugCollision = await BlogPost.findOne({ slug, locale });
        if (slugCollision) {
            return NextResponse.json(
                { error: `Slug "${slug}" already exists for locale "${locale}"` },
                { status: 409 }
            ); // 409 Conflict
        }

        // Create new blog post with locale
        const newPost = new BlogPost({
            title,
            slug,
            content,
            status,
            locale,
            generationGroupId,
        });

        await newPost.save();

        return NextResponse.json(
            {
                message: 'Post created successfully',
                post: newPost
            },
            { status: 201 }
        );

    } catch (error: any) {
        console.error("Error creating new post:", error);

        // Handle potential validation errors from Mongoose
        if (error.name === 'ValidationError') {
            return NextResponse.json(
                { error: 'Validation failed', details: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to create post', details: error.message || String(error) },
            { status: 500 }
        );
    }
}

// We can add PUT/DELETE handlers here later for managing posts 