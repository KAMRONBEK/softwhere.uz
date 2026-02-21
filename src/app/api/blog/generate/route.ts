import dbConnect from '@/lib/db';
import BlogPost, { IBlogPost, ICoverImage } from '@/models/BlogPost';
import { verifyApiSecret } from '@/utils/auth';
import { safeGenerateContent, aiStats } from '@/utils/ai';
import { logger } from '@/utils/logger';
import { getCoverImageForTopic, getImagesForPost } from '@/utils/unsplash';
import { SERVICE_PILLARS, getAllTopics, type PostFormat } from '@/data/seo-topics';
import {
  extractTextFromUrl,
  classifySourceContent,
  buildSourcePrompt,
  smartSelectTopic,
  generateBlogContent,
  generateFallbackContent,
  generateMetaDescription,
  createSlug,
  MAX_SOURCE_TEXT_LENGTH,
  MAX_CUSTOM_TOPIC_LENGTH,
  ALLOWED_LOCALES,
  type SourceClassification,
  type TopicResult,
} from '@/lib/blog-generator';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 60;

if (!process.env.DEEPSEEK_API_KEY) {
  logger.error('DEEPSEEK_API_KEY environment variable not set', undefined, 'BLOG');
}
if (!process.env.MONGODB_URI) {
  logger.error('MONGODB_URI environment variable not set', undefined, 'BLOG');
}

const VALID_CATEGORIES = SERVICE_PILLARS.map(p => p.id);

export async function POST(request: NextRequest) {
  const authError = verifyApiSecret(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { category, customTopic, sourceUrl, sourceText, locales = ['en', 'ru', 'uz'] } = body;

    // --- Validation -----------------------------------------------------------

    if (customTopic && typeof customTopic === 'string' && customTopic.length > MAX_CUSTOM_TOPIC_LENGTH) {
      return NextResponse.json({ error: `customTopic must be ${MAX_CUSTOM_TOPIC_LENGTH} characters or fewer` }, { status: 400 });
    }

    if (sourceText && typeof sourceText === 'string' && sourceText.length > MAX_SOURCE_TEXT_LENGTH) {
      return NextResponse.json({ error: `sourceText must be ${MAX_SOURCE_TEXT_LENGTH} characters or fewer` }, { status: 400 });
    }

    if (sourceUrl && typeof sourceUrl === 'string') {
      try {
        new URL(sourceUrl);
      } catch {
        return NextResponse.json({ error: 'sourceUrl must be a valid URL' }, { status: 400 });
      }
    }

    if (!Array.isArray(locales) || locales.length === 0 || locales.length > 3) {
      return NextResponse.json({ error: 'locales must be an array of 1-3 items' }, { status: 400 });
    }

    const invalidLocales = locales.filter((l: string) => !ALLOWED_LOCALES.includes(l));
    if (invalidLocales.length > 0) {
      return NextResponse.json({ error: `Invalid locales: ${invalidLocales.join(', ')}` }, { status: 400 });
    }

    await dbConnect();

    let selectedTopic: TopicResult;
    let sourceClassification: SourceClassification | null = null;
    let resolvedSource: string | null = null;
    let generationGroupId: string;
    let coverImage: ICoverImage | null = null;
    let inlineImages: ICoverImage[] = [];
    let allContentImages: ICoverImage[] = [];
    let metaDesc: string;

    // --- Continuation mode: reuse topic/images from a previous call ----------

    if (body.generationGroupId) {
      const existingPost = await BlogPost.findOne({ generationGroupId: body.generationGroupId }).lean<IBlogPost>();

      if (!existingPost) {
        return NextResponse.json({ error: 'No post found for the given generationGroupId' }, { status: 404 });
      }

      const pillar = SERVICE_PILLARS.find(p => p.id === existingPost.category);

      selectedTopic = {
        id: existingPost.category ?? 'unknown',
        title: existingPost.title,
        primaryKeyword: existingPost.primaryKeyword ?? existingPost.title.toLowerCase().slice(0, 60),
        secondaryKeywords: existingPost.secondaryKeywords ?? [],
        searchIntent: 'informational',
        postFormat: (existingPost.postFormat ?? 'beginner-guide') as PostFormat,
        targetQueries: [existingPost.primaryKeyword ?? existingPost.title.toLowerCase()],
        imageHints: [],
        servicePillar: existingPost.category ?? 'web-app-development',
        pillarName: pillar?.name ?? 'Software Development',
      };

      generationGroupId = body.generationGroupId;
      coverImage = existingPost.coverImage ?? null;
      allContentImages = existingPost.contentImages ?? [];
      inlineImages = coverImage ? allContentImages.filter(img => img.url !== coverImage!.url) : allContentImages;
      metaDesc = existingPost.metaDescription ?? `${selectedTopic.title} — Expert insights from Softwhere.uz`;

      logger.info(`Continuing generation group ${generationGroupId} for locales: ${locales.join(', ')}`, undefined, 'BLOG');
    } else {
      // --- Full setup: resolve source, select topic, fetch images, meta ------

      if (sourceUrl) {
        try {
          logger.info(`Fetching source URL: ${sourceUrl}`, undefined, 'BLOG');
          resolvedSource = await extractTextFromUrl(sourceUrl);
          logger.info(`Extracted ${resolvedSource.length} chars from URL`, undefined, 'BLOG');
        } catch (err) {
          logger.error('Failed to fetch source URL', err, 'BLOG');
          return NextResponse.json({ error: 'Could not fetch the provided URL' }, { status: 400 });
        }
      } else if (sourceText) {
        resolvedSource = sourceText.trim().slice(0, MAX_SOURCE_TEXT_LENGTH);
      }

      if (resolvedSource) {
        sourceClassification = await classifySourceContent(resolvedSource);
        const pillar = SERVICE_PILLARS.find(p => p.id === sourceClassification!.category);

        selectedTopic = {
          id: `source-${Date.now()}`,
          title: sourceClassification.title,
          primaryKeyword: sourceClassification.primaryKeyword,
          secondaryKeywords: sourceClassification.secondaryKeywords,
          searchIntent: 'informational',
          postFormat: sourceClassification.postFormat,
          targetQueries: [sourceClassification.primaryKeyword],
          imageHints: sourceClassification.imageHints,
          servicePillar: sourceClassification.category,
          pillarName: pillar?.name ?? 'Software Development',
        };
        logger.info(
          `Source classified: "${selectedTopic.title}" (${selectedTopic.servicePillar}/${selectedTopic.postFormat})`,
          undefined,
          'BLOG'
        );
      } else if (customTopic) {
        const normalizePrompt = `You are a professional editor. Normalize this blog post topic by fixing spelling, improving grammar, and making it professional. Return ONLY the normalized topic.\n\nTopic: "${customTopic}"`;
        const normalized = await safeGenerateContent(normalizePrompt, 'topic-normalize', 100);
        const topicTitle = normalized ? normalized.trim().replace(/^"|"$/g, '') : customTopic;

        selectedTopic = {
          id: `custom-${Date.now()}`,
          title: topicTitle,
          primaryKeyword: topicTitle.toLowerCase().slice(0, 60),
          secondaryKeywords: [],
          searchIntent: 'informational',
          postFormat: 'beginner-guide' as PostFormat,
          targetQueries: [topicTitle.toLowerCase()],
          imageHints: [],
          servicePillar: 'web-app-development',
          pillarName: 'Software Development',
        };
        logger.info(`Custom topic: "${topicTitle}"`, undefined, 'BLOG');
      } else if (category && category !== 'auto') {
        if (category !== 'random' && !VALID_CATEGORIES.includes(category)) {
          return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
        }

        const pillarTopics = category === 'random' ? getAllTopics() : getAllTopics().filter(t => t.servicePillar === category);

        if (pillarTopics.length === 0) {
          return NextResponse.json({ error: 'No topics for category' }, { status: 400 });
        }

        selectedTopic = pillarTopics[Math.floor(Math.random() * pillarTopics.length)];
      } else {
        selectedTopic = await smartSelectTopic();
        logger.info(
          `Smart selected: "${selectedTopic.title}" (${selectedTopic.servicePillar}/${selectedTopic.postFormat})`,
          undefined,
          'BLOG'
        );
      }

      generationGroupId = uuidv4();

      const coverKeyword = selectedTopic.imageHints?.[0];
      coverImage = await getCoverImageForTopic(selectedTopic.title, coverKeyword);
      inlineImages = await getImagesForPost(selectedTopic.imageHints, selectedTopic.title);
      allContentImages = [...(coverImage ? [coverImage] : []), ...inlineImages];

      metaDesc = await generateMetaDescription(selectedTopic.title, selectedTopic.primaryKeyword, 'en');
    }

    // --- Generate per locale -------------------------------------------------

    const createdPosts = [];

    for (const locale of locales) {
      try {
        let content: string;

        if (resolvedSource && sourceClassification) {
          const prompt = buildSourcePrompt(resolvedSource, sourceClassification, locale, inlineImages);
          logger.info(`Generating source-based content for "${selectedTopic.title}" in ${locale}`, undefined, 'BLOG');
          const generated = await safeGenerateContent(prompt, `blog-source-${locale}`);
          content = generated && generated.split(/\s+/).length >= 800 ? generated : generateFallbackContent(selectedTopic, locale);
        } else {
          content = await generateBlogContent(selectedTopic, locale, inlineImages);
        }

        // Localize title
        let localizedTitle = selectedTopic.title;
        if (locale !== 'en') {
          const titlePrompt = `Translate the following blog post title into ${locale === 'ru' ? 'Russian' : 'Uzbek'}: "${selectedTopic.title}". Only return the translated title, nothing else.`;
          const translated = await safeGenerateContent(titlePrompt, `title-translate-${locale}`, 100);
          if (translated) {
            localizedTitle = translated.trim().replace(/^"|"$/g, '');
          }
        }

        // Localize meta description
        let localizedMeta = metaDesc;
        if (locale !== 'en') {
          const metaPrompt = `Translate this meta description into ${locale === 'ru' ? 'Russian' : 'Uzbek'}. Keep it under 160 characters. Return ONLY the translation.\n\n"${metaDesc}"`;
          const translatedMeta = await safeGenerateContent(metaPrompt, `meta-translate-${locale}`, 200);
          if (translatedMeta) {
            localizedMeta = translatedMeta.trim().replace(/^"|"$/g, '');
          }
        }

        const slug = `${createSlug(selectedTopic.title)}-${Date.now()}`;

        const blogPost = new BlogPost({
          title: localizedTitle,
          slug,
          content,
          status: 'draft',
          locale,
          generationGroupId,
          ...(coverImage && { coverImage }),
          category: selectedTopic.servicePillar,
          postFormat: selectedTopic.postFormat,
          primaryKeyword: selectedTopic.primaryKeyword,
          secondaryKeywords: selectedTopic.secondaryKeywords,
          metaDescription: localizedMeta,
          contentImages: allContentImages,
        });

        const savedPost = await blogPost.save();

        createdPosts.push({
          id: savedPost._id,
          title: savedPost.title,
          slug: savedPost.slug,
          locale: savedPost.locale,
          status: savedPost.status,
          category: selectedTopic.servicePillar,
          postFormat: selectedTopic.postFormat,
        });
      } catch (error) {
        logger.error(`Error generating post for locale ${locale}`, error, 'BLOG');
      }
    }

    if (createdPosts.length === 0) {
      return NextResponse.json({ error: 'Failed to generate any posts' }, { status: 500 });
    }

    logger.info(
      `Generation complete: ${createdPosts.length} post(s) — ${selectedTopic.postFormat} / ${selectedTopic.servicePillar}`,
      { aiStats: { ...aiStats } },
      'BLOG'
    );

    return NextResponse.json({
      success: true,
      message: `Generated ${createdPosts.length} blog post(s)`,
      posts: createdPosts,
      generationGroupId,
      topic: selectedTopic.title,
      format: selectedTopic.postFormat,
      pillar: selectedTopic.servicePillar,
    });
  } catch (error) {
    logger.error('Error in blog generation', error, 'BLOG');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
