import dbConnect from '@/core/db';
import BlogPost, { IBlogPost, ICoverImage } from '@/modules/blog/model/BlogPost';
import { verifyApiSecret } from '@/core/auth';
import { safeGenerateContent, aiStats } from '@/core/ai';
import { logger } from '@/core/logger';
import { createSlug } from '@/shared/utils/slug';
import { getCoverImageForTopic, getImagesForPost } from '@/modules/blog/utils/unsplash';
import { SERVICE_PILLARS, getAllTopics, type PostFormat } from '@/modules/blog/data/seo-topics';
import {
  extractTextFromUrl,
  classifySourceContent,
  buildSourcePrompt,
  smartSelectTopic,
  generateBlogContent,
  generateMetaDescription,
  localizePostMeta,
  WORD_FLOOR,
  MAX_SOURCE_TEXT_LENGTH,
  MAX_CUSTOM_TOPIC_LENGTH,
  ALLOWED_LOCALES,
  type SourceClassification,
  type TopicResult,
} from '@/modules/blog/api/generator';
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const maxDuration = 60;

if (!process.env.MOONSHOT_API_KEY && !process.env.DEEPSEEK_API_KEY) {
  logger.error('No AI key set (MOONSHOT_API_KEY or DEEPSEEK_API_KEY)', undefined, 'BLOG');
}
if (!process.env.MONGODB_URI) {
  logger.error('MONGODB_URI environment variable not set', undefined, 'BLOG');
}

const VALID_CATEGORIES = SERVICE_PILLARS.map(p => p.id);

async function resolveUniqueSlug(baseSlug: string, locale: string): Promise<string> {
  let candidate = baseSlug;
  let suffix = 1;

  while (await BlogPost.exists({ slug: candidate, locale })) {
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

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
      if (typeof body.generationGroupId !== 'string') {
        return NextResponse.json({ error: 'generationGroupId must be a string' }, { status: 400 });
      }
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
    const generatedSlugBase = createSlug(selectedTopic.title) || `post-${generationGroupId.slice(0, 8)}`;

    for (const locale of locales) {
      try {
        // 1. Generate the body. null => generation failed or was too thin, so
        //    we skip this locale rather than persist boilerplate filler.
        let content: string | null;
        if (resolvedSource && sourceClassification) {
          const { system, user } = buildSourcePrompt(resolvedSource, sourceClassification, locale, inlineImages);
          logger.info(`Generating source-based content for "${selectedTopic.title}" in ${locale}`, undefined, 'BLOG');
          const generated = await safeGenerateContent(user, `blog-source-${locale}`, undefined, system);
          content = generated && generated.trim().split(/\s+/).filter(Boolean).length >= WORD_FLOOR ? generated : null;
        } else {
          content = await generateBlogContent(selectedTopic, locale, inlineImages);
        }

        if (!content) {
          logger.warn(`Skipping ${locale}: no acceptable content generated`, undefined, 'BLOG');
          continue;
        }

        // 2. Localize title/meta/keywords for ru|uz (single JSON call), so
        //    non-English posts target their own language's search terms.
        let localizedTitle = selectedTopic.title;
        let localizedMeta = metaDesc;
        let localizedPrimary = selectedTopic.primaryKeyword;
        let localizedSecondary = selectedTopic.secondaryKeywords;
        if (locale === 'ru' || locale === 'uz') {
          const loc = await localizePostMeta(locale, {
            title: selectedTopic.title,
            metaDescription: metaDesc,
            primaryKeyword: selectedTopic.primaryKeyword,
            secondaryKeywords: selectedTopic.secondaryKeywords,
          });
          localizedTitle = loc.title;
          localizedMeta = loc.metaDescription;
          localizedPrimary = loc.primaryKeyword;
          localizedSecondary = loc.secondaryKeywords;
        }

        // 3. Localized, stable slug from THIS locale's title (no timestamp).
        const slugBase = createSlug(localizedTitle) || generatedSlugBase;
        const slug = await resolveUniqueSlug(slugBase, locale);

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
          primaryKeyword: localizedPrimary,
          secondaryKeywords: localizedSecondary,
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

    // Bust the blog ISR caches so newly generated posts surface (list via tag,
    // detail pages via path).
    try {
      revalidateTag('blog-posts', 'max');
      revalidatePath('/[locale]/blog/[slug]', 'page');
    } catch (e) {
      logger.error('Failed to revalidate blog caches', e, 'BLOG');
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
