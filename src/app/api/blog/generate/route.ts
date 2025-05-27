import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, GenerationConfig } from "@google/generative-ai";
import crypto from 'crypto'; // For generating UUID
// Changed back to standard import for slugify
import slugify from 'slugify';
// const slugify = require('slugify'); // Previous workaround
import dbConnect from '@/lib/db'; // Adjust path if necessary
import BlogPost, { IBlogPost } from '@/models/BlogPost'; // Adjust path if necessary

// Ensure API keys and URI are set
if (!process.env.GOOGLE_API_KEY) {
    console.error("FATAL ERROR: GOOGLE_API_KEY environment variable not set.");
    // Optionally throw an error during build/startup if critical
    // throw new Error("GOOGLE_API_KEY environment variable not set.");
}
if (!process.env.MONGODB_URI) {
    console.error("FATAL ERROR: MONGODB_URI environment variable not set.");
    // throw new Error("MONGODB_URI environment variable not set.");
}
if (!process.env.API_SECRET) {
    console.warn("API_SECRET environment variable not set. Blog generation endpoint is insecure.");
}

// Initialize the Google Generative AI client (only if API key exists)
const genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;
// Pass model name in an object
const model = genAI?.getGenerativeModel({ model: "gemini-1.5-flash" });

const TARGET_LOCALES: Array<'en' | 'ru' | 'uz'> = ['en', 'ru', 'uz'];

// Helper function to generate content for a specific locale
async function generateLocalizedContent(
    baseTitle: string,
    baseContent: string,
    targetLocale: 'en' | 'ru' | 'uz'
): Promise<{ title: string; content: string }> {
    if (!model) throw new Error("AI Model not initialized");

    console.log(`Generating content for locale: ${targetLocale}...`);

    if (targetLocale === 'en') {
        // No translation needed for English
        return { title: baseTitle, content: baseContent };
    }

    // Generate Title Translation
    const titlePrompt = `Translate the following blog post title into ${targetLocale === 'ru' ? 'Russian' : 'Uzbek'}: "${baseTitle}". Only return the translated title.`;
    const titleResult = await model.generateContent(titlePrompt);
    const translatedTitle = (await titleResult.response).text().trim().replace(/^"|"$/g, '');
    if (!translatedTitle) throw new Error(`Failed to translate title to ${targetLocale}`);
    console.log(`   Translated Title (${targetLocale}): ${translatedTitle}`);

    // Generate Content Translation
    const contentPrompt = `Translate the following blog post content (which is in Markdown format) into ${targetLocale === 'ru' ? 'Russian' : 'Uzbek'}. Preserve the Markdown formatting (headings, lists, code blocks etc.). Only return the translated Markdown content.\n\nOriginal Content:\n${baseContent}`;
    const contentResult = await model.generateContent(contentPrompt);
    const translatedContent = (await contentResult.response).text().trim();
    if (!translatedContent) throw new Error(`Failed to translate content to ${targetLocale}`);
    console.log(`   Translated Content Snippet (${targetLocale}): ${translatedContent.substring(0, 100)}...`);

    return { title: translatedTitle, content: translatedContent };
}

export async function POST(request: NextRequest) {
    // ⬇️⬇️⬇️ REMOVED API SECRET CHECK ⬇️⬇️⬇️
    // const authHeader = request.headers.get('authorization');
    // if (!process.env.API_SECRET || !authHeader || authHeader !== `Bearer ${process.env.API_SECRET}`) {
    //     console.error("Authentication failed: Invalid or missing API_SECRET/Authorization header.");
    //     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }
    // ⬆️⬆️⬆️ REMOVED API SECRET CHECK ⬆️⬆️⬆️
    // TODO: Implement proper authentication (e.g., check for admin session)
    //       before deploying to production. This endpoint is currently insecure.

    // Check if AI Client is initialized
    if (!genAI || !model) {
        console.error("AI API key not configured or client failed to initialize.");
        return NextResponse.json({ error: 'AI API key not configured' }, { status: 500 });
    }

    // Check MONGODB_URI again just before connection attempt
    if (!process.env.MONGODB_URI) {
        console.error("Database connection string not configured.");
        return NextResponse.json({ error: 'Database connection string not configured' }, { status: 500 });
    }

    console.log("Multi-locale blog generation triggered (Auth bypassed - TODO: Secure this).");

    const generationGroupId = crypto.randomUUID();
    console.log(`Generation Group ID: ${generationGroupId}`);
    let generatedPostsInfo: Array<{ locale: string; title: string; postId: string }> = [];
    let errors: Array<{ locale: string; error: string }> = [];

    try {
        await dbConnect();

        // 1. Generate Base English Content First
        console.log("Generating base English content...");
        const topicPrompt = "Identify a single, current, and relevant trend in web development or mobile development. Suggest a catchy and SEO-friendly blog post title about this trend. Only return the title.";
        const topicResult = await model.generateContent(topicPrompt);
        const baseTitle = (await topicResult.response).text().trim().replace(/^"|"$/g, '');
        if (!baseTitle) throw new Error("Failed to generate base title.");
        console.log(`   Base Title (en): ${baseTitle}`);

        const baseContentPrompt = `Write a blog post in Markdown format about "${baseTitle}". The post should be informative, engaging, approximately 500-800 words long, and optimized for SEO. Include headings, subheadings, and code snippets if relevant. Do not include the title itself at the start of the markdown content, only the body.`;
        const baseContentResult = await model.generateContent(baseContentPrompt);
        const baseContent = (await baseContentResult.response).text().trim();
        if (!baseContent) throw new Error("Failed to generate base content.");
        console.log(`   Base Content (en) generated.`);

        // 2. Loop through locales and generate/save
        for (const locale of TARGET_LOCALES) {
            try {
                const { title: localizedTitle, content: localizedContent } = await generateLocalizedContent(
                    baseTitle,
                    baseContent,
                    locale
                );

                const slug = slugify(localizedTitle, { lower: true, strict: true, remove: /[*+~.()'"!:@]/g });

                // Check if slug exists for this locale
                const existingPost = await BlogPost.findOne({ slug, locale });
                if (existingPost) {
                    console.warn(`   Skipping locale ${locale}: Slug "${slug}" already exists.`);
                    errors.push({ locale, error: `Slug "${slug}" already exists.` });
                    continue; // Skip to next locale
                }

                // Save the post for this locale
                console.log(`   Saving post for locale: ${locale} with slug: ${slug}`);
                const newPost = new BlogPost({
                    title: localizedTitle,
                    slug: slug,
                    content: localizedContent,
                    status: 'draft',
                    locale: locale,
                    generationGroupId: generationGroupId
                });
                const savedPost = await newPost.save();

                // Check if savedPost and _id exist before using toString()
                if (savedPost && savedPost._id) {
                    console.log(`   Post saved successfully for ${locale} with ID: ${savedPost._id}`);
                    // Cast _id to string or use .toString()
                    generatedPostsInfo.push({ locale: savedPost.locale, title: savedPost.title, postId: String(savedPost._id) });
                } else {
                    throw new Error(`Failed to save post or get ID for locale ${locale}`);
                }

            } catch (localeError: any) {
                console.error(`   Error processing locale ${locale}:`, localeError);
                errors.push({ locale, error: localeError.message || String(localeError) });
            }
        }

        // Determine final response based on success/errors
        if (generatedPostsInfo.length > 0 && errors.length === 0) {
            return NextResponse.json({ message: `Successfully generated posts for all locales (${TARGET_LOCALES.join(', ')}).`, posts: generatedPostsInfo });
        } else if (generatedPostsInfo.length > 0) {
            return NextResponse.json({ message: `Partially generated posts. Errors occurred for some locales.`, posts: generatedPostsInfo, errors: errors }, { status: 207 }); // Multi-Status
        } else {
            throw new Error(`Failed to generate post for any locale. Errors: ${JSON.stringify(errors)}`);
        }

    } catch (error: any) {
        console.error("Error during multi-locale blog generation:", error);
        return NextResponse.json({ error: 'Failed to generate blog posts', details: error.message || String(error), errors: errors }, { status: 500 });
    }
} 