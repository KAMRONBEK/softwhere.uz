import dbConnect from '@/lib/db';
import BlogPost, { ICoverImage } from '@/models/BlogPost';
import { verifyApiSecret } from '@/utils/auth';
import { safeGenerateContent, aiStats } from '@/utils/ai';
import { logger } from '@/utils/logger';
import { getCoverImageForTopic, getImagesForPost } from '@/utils/unsplash';
import { SERVICE_PILLARS, getAllTopics, type SEOTopic, type PostFormat } from '@/data/seo-topics';
import { getBlueprintForFormat } from '@/data/post-blueprints';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

if (!process.env.DEEPSEEK_API_KEY) {
  logger.error('DEEPSEEK_API_KEY environment variable not set', undefined, 'BLOG');
}
if (!process.env.MONGODB_URI) {
  logger.error('MONGODB_URI environment variable not set', undefined, 'BLOG');
}

const getCurrentYear = () => new Date().getFullYear();

// ---------------------------------------------------------------------------
// Smart topic selection — picks the best next topic based on DB history
// ---------------------------------------------------------------------------

interface RecentPostInfo {
  category?: string;
  postFormat?: string;
  primaryKeyword?: string;
}

async function smartSelectTopic(): Promise<SEOTopic & { servicePillar: string; pillarName: string }> {
  const recentPosts = await BlogPost.find({ locale: 'en' })
    .sort({ createdAt: -1 })
    .limit(30)
    .select('category postFormat primaryKeyword')
    .lean<RecentPostInfo[]>();

  const usedKeywords = new Set(recentPosts.map(p => p.primaryKeyword).filter(Boolean));
  const recentFormats = recentPosts
    .slice(0, 4)
    .map(p => p.postFormat)
    .filter(Boolean);
  const pillarUsage = new Map<string, number>();

  for (const p of recentPosts) {
    if (p.category) {
      pillarUsage.set(p.category, (pillarUsage.get(p.category) ?? 0) + 1);
    }
  }

  const allTopics = getAllTopics();

  // Score each topic: lower = better candidate
  const scored = allTopics
    .filter(t => !usedKeywords.has(t.primaryKeyword))
    .map(t => {
      const pillar = SERVICE_PILLARS.find(p => p.id === t.servicePillar);
      const weight = pillar?.weight ?? 1;
      const pillarCount = pillarUsage.get(t.servicePillar) ?? 0;
      const formatPenalty = recentFormats.includes(t.postFormat) ? 10 : 0;
      const score = pillarCount / weight + formatPenalty;
      return { topic: t, score };
    })
    .sort((a, b) => a.score - b.score);

  if (scored.length > 0) {
    // Pick from top 3 candidates randomly for slight variety
    const pool = scored.slice(0, Math.min(3, scored.length));
    return pool[Math.floor(Math.random() * pool.length)].topic;
  }

  // All topics used — reset cycle, pick random from focus pillars
  const focusTopics = allTopics.filter(t => {
    const pillar = SERVICE_PILLARS.find(p => p.id === t.servicePillar);
    return pillar && pillar.weight >= 2;
  });
  return focusTopics[Math.floor(Math.random() * focusTopics.length)] ?? allTopics[0];
}

// ---------------------------------------------------------------------------
// Content generation with blueprint-specific prompts
// ---------------------------------------------------------------------------

function buildPrompt(topic: SEOTopic & { servicePillar: string; pillarName: string }, locale: string, inlineImages: ICoverImage[]): string {
  const blueprint = getBlueprintForFormat(topic.postFormat as PostFormat);
  const year = getCurrentYear();
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const langName = locale === 'en' ? 'English' : locale === 'ru' ? 'Russian' : 'Uzbek';
  const langInstruction =
    locale === 'en'
      ? 'Write in English.'
      : locale === 'ru'
        ? 'ВАЖНО: Пишите ПОЛНОСТЬЮ на русском языке. Весь контент, заголовки и CTA на русском.'
        : "MUHIM: BUTUNLAY o'zbek tilida yozing. Barcha kontent, sarlavhalar va CTA o'zbek tilida.";

  // Build image injection instruction
  let imageInstruction = '';
  if (inlineImages.length > 0) {
    const imgMarkdown = inlineImages.map((img, i) => `![${topic.primaryKeyword} - illustration ${i + 1}](${img.url})`).join('\n');
    imageInstruction = `
INLINE IMAGES — Insert these images naturally between sections (not at the very top or bottom). Place them after the 2nd and 4th major sections:
${imgMarkdown}`;
  }

  const systemPrompt = `You are an expert content writer and SEO specialist. You write for Softwhere.uz, a software development company based in Uzbekistan that builds mobile apps, web apps, AI solutions, CRM systems, Telegram bots, and more for businesses in Central Asia and globally. ${
    locale === 'ru' ? 'Вы пишете на русском языке.' : locale === 'uz' ? "Siz o'zbek tilida yozasiz." : ''
  }`;

  const userPrompt = `${langInstruction}

Write a blog post about: "${topic.title}"

LANGUAGE: Write the ENTIRE post in ${langName}. Do not mix languages.

FORMAT: ${blueprint.name}
TONE: ${blueprint.tone}
TARGET LENGTH: ${blueprint.wordRange[0]}–${blueprint.wordRange[1]} words

OPENING: ${blueprint.openingInstruction}

STRUCTURE:
${blueprint.structurePrompt}

FORMATTING RULES:
${blueprint.formattingRules}

SEO REQUIREMENTS:
- Primary keyword: "${topic.primaryKeyword}" — use 3-5 times naturally
- Secondary keywords: ${topic.secondaryKeywords.map(k => `"${k}"`).join(', ')} — use each 1-2 times
- Target queries to answer: ${topic.targetQueries.map(q => `"${q}"`).join(', ')}
- ${blueprint.seoHint}
- Use H1 for the title, H2 for major sections, H3 for subsections
- Include internal linking suggestions as "[related service]" placeholders

CONTEXT:
- Today is ${date}, we are in ${year}
- Target audience: business owners and decision-makers in Uzbekistan and Central Asia
- Company: Softwhere.uz — ${topic.pillarName} specialists
- Service area: ${topic.pillarName}
${imageInstruction}

CREDIBILITY:
- Include 2-4 statistics from credible sources (Statista, Gartner, McKinsey, etc.)
- Format sources as: "According to [Source](URL), [fact]"
- Use recent data (${year - 2}–${year})

Write a unique, valuable post. No generic filler. Every paragraph should teach something or persuade.`;

  return `${systemPrompt}\n\n---\n\n${userPrompt}`;
}

async function generateBlogContent(
  topic: SEOTopic & { servicePillar: string; pillarName: string },
  locale: string,
  inlineImages: ICoverImage[]
): Promise<string> {
  const prompt = buildPrompt(topic, locale, inlineImages);

  logger.info(`Generating "${topic.postFormat}" content for "${topic.title}" in ${locale}`, undefined, 'BLOG');

  const content = await safeGenerateContent(prompt, `blog-${topic.postFormat}-${locale}`);

  if (content && content.split(/\s+/).length >= 300) {
    logger.info(`Generated ${content.split(/\s+/).length} words for ${locale}`, undefined, 'BLOG');
    return content;
  }

  logger.warn(`Content too short or missing for ${locale}, using fallback`, undefined, 'BLOG');
  return generateFallbackContent(topic, locale);
}

// ---------------------------------------------------------------------------
// Compact fallback — uses blueprint structure, no hardcoded 500-line content
// ---------------------------------------------------------------------------

function generateFallbackContent(topic: SEOTopic & { servicePillar: string; pillarName: string }, locale: string): string {
  const year = getCurrentYear();
  const blueprint = getBlueprintForFormat(topic.postFormat as PostFormat);

  const titles: Record<string, Record<string, string>> = {
    intro: { en: 'Introduction', ru: 'Введение', uz: 'Kirish' },
    why: { en: 'Why This Matters', ru: 'Почему это важно', uz: 'Nima uchun bu muhim' },
    details: { en: 'Key Details', ru: 'Основные детали', uz: 'Asosiy tafsilotlar' },
    market: { en: 'Market Context', ru: 'Рыночный контекст', uz: 'Bozor konteksti' },
    action: { en: 'Next Steps', ru: 'Следующие шаги', uz: 'Keyingi qadamlar' },
    cta: {
      en: `Ready to get started? Contact Softwhere.uz for a free consultation on ${topic.pillarName.toLowerCase()}.`,
      ru: `Готовы начать? Свяжитесь с Softwhere.uz для бесплатной консультации по ${topic.pillarName.toLowerCase()}.`,
      uz: `Boshlashga tayyormisiz? ${topic.pillarName.toLowerCase()} bo'yicha bepul maslahat uchun Softwhere.uz bilan bog'laning.`,
    },
  };

  const l = locale as 'en' | 'ru' | 'uz';

  return `# ${topic.title}

## ${titles.intro[l] ?? titles.intro.en}

${topic.targetQueries[0] ?? topic.title} — this is one of the most common questions business owners ask in ${year}. In this ${blueprint.name.toLowerCase()}, we break down everything you need to know about ${topic.primaryKeyword}.

## ${titles.why[l] ?? titles.why.en}

The demand for ${topic.primaryKeyword} continues to grow, especially in emerging markets like Uzbekistan and Central Asia. According to industry reports, businesses investing in ${topic.pillarName.toLowerCase()} see measurable improvements in efficiency, customer engagement, and revenue.

## ${titles.details[l] ?? titles.details.en}

${topic.secondaryKeywords.map(k => `- **${k}**: A critical factor in any ${topic.pillarName.toLowerCase()} project.`).join('\n')}

Key considerations:
1. **Budget planning** — Understand the full scope before committing
2. **Technology selection** — Choose the right tools for your specific needs
3. **Timeline management** — Set realistic expectations for delivery
4. **Quality assurance** — Never skip testing and validation

## ${titles.market[l] ?? titles.market.en}

The Central Asian tech market is evolving rapidly. Uzbekistan in particular has seen significant digital transformation, with growing demand for professional ${topic.pillarName.toLowerCase()} services.

## ${titles.action[l] ?? titles.action.en}

1. Define your requirements and goals
2. Research potential technology partners
3. Request proposals and compare options
4. Start with a discovery phase or consultation

---

**${titles.cta[l] ?? titles.cta.en}**

*Published in ${year} by Softwhere.uz*`;
}

// ---------------------------------------------------------------------------
// Meta description generation
// ---------------------------------------------------------------------------

async function generateMetaDescription(title: string, primaryKeyword: string, locale: string): Promise<string> {
  const prompt = `Write a 150-160 character meta description for a blog post titled "${title}". Include the keyword "${primaryKeyword}". Make it compelling and action-oriented. Write in ${locale === 'en' ? 'English' : locale === 'ru' ? 'Russian' : 'Uzbek'}. Return ONLY the meta description.`;

  const result = await safeGenerateContent(prompt, `meta-desc-${locale}`);
  if (result && result.length <= 200) return result.trim().replace(/^"|"$/g, '');

  return `${title} — Expert insights and practical advice from Softwhere.uz`;
}

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function transliterate(text: string): string {
  return text
    .split('')
    .map(ch => CYRILLIC_TO_LATIN[ch] ?? ch)
    .join('');
}

function createSlug(title: string): string {
  return transliterate(title.toLowerCase())
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

const ALLOWED_LOCALES = ['en', 'ru', 'uz'];
const MAX_CUSTOM_TOPIC_LENGTH = 200;
const VALID_CATEGORIES = SERVICE_PILLARS.map(p => p.id);

export async function POST(request: NextRequest) {
  const authError = verifyApiSecret(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { category, customTopic, locales = ['en', 'ru', 'uz'] } = body;

    if (customTopic && typeof customTopic === 'string' && customTopic.length > MAX_CUSTOM_TOPIC_LENGTH) {
      return NextResponse.json({ error: `customTopic must be ${MAX_CUSTOM_TOPIC_LENGTH} characters or fewer` }, { status: 400 });
    }

    if (!Array.isArray(locales) || locales.length === 0 || locales.length > 3) {
      return NextResponse.json({ error: 'locales must be an array of 1-3 items' }, { status: 400 });
    }

    const invalidLocales = locales.filter((l: string) => !ALLOWED_LOCALES.includes(l));
    if (invalidLocales.length > 0) {
      return NextResponse.json({ error: `Invalid locales: ${invalidLocales.join(', ')}` }, { status: 400 });
    }

    await dbConnect();

    // -----------------------------------------------------------------------
    // Topic selection: auto (smart), category-based, or custom
    // -----------------------------------------------------------------------
    let selectedTopic: SEOTopic & { servicePillar: string; pillarName: string };

    if (customTopic) {
      // Normalize custom topic with AI
      const normalizePrompt = `You are a professional editor. Normalize this blog post topic by fixing spelling, improving grammar, and making it professional. Return ONLY the normalized topic.\n\nTopic: "${customTopic}"`;
      const normalized = await safeGenerateContent(normalizePrompt, 'topic-normalize');
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
      // Pick from specific pillar
      if (category !== 'random' && !VALID_CATEGORIES.includes(category)) {
        return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
      }

      const pillarTopics = category === 'random' ? getAllTopics() : getAllTopics().filter(t => t.servicePillar === category);

      if (pillarTopics.length === 0) {
        return NextResponse.json({ error: 'No topics for category' }, { status: 400 });
      }

      selectedTopic = pillarTopics[Math.floor(Math.random() * pillarTopics.length)];
    } else {
      // Auto mode: smart selection based on DB history
      selectedTopic = await smartSelectTopic();
      logger.info(
        `Smart selected: "${selectedTopic.title}" (${selectedTopic.servicePillar}/${selectedTopic.postFormat})`,
        undefined,
        'BLOG'
      );
    }

    const generationGroupId = uuidv4();

    // Fetch cover image + inline images
    const coverKeyword = selectedTopic.imageHints?.[0];
    const coverImage = await getCoverImageForTopic(selectedTopic.title, coverKeyword);
    const inlineImages = await getImagesForPost(selectedTopic.imageHints, selectedTopic.title);
    const allContentImages = [...(coverImage ? [coverImage] : []), ...inlineImages];

    // Generate meta description (once, in English, then translate)
    const metaDesc = await generateMetaDescription(selectedTopic.title, selectedTopic.primaryKeyword, 'en');

    const createdPosts = [];

    for (const locale of locales) {
      try {
        const content = await generateBlogContent(selectedTopic, locale, inlineImages);

        // Localize title
        let localizedTitle = selectedTopic.title;
        if (locale !== 'en') {
          const titlePrompt = `Translate the following blog post title into ${locale === 'ru' ? 'Russian' : 'Uzbek'}: "${selectedTopic.title}". Only return the translated title, nothing else.`;
          const translated = await safeGenerateContent(titlePrompt, `title-translate-${locale}`);
          if (translated) {
            localizedTitle = translated.trim().replace(/^"|"$/g, '');
          }
        }

        // Localize meta description
        let localizedMeta = metaDesc;
        if (locale !== 'en') {
          const metaPrompt = `Translate this meta description into ${locale === 'ru' ? 'Russian' : 'Uzbek'}. Keep it under 160 characters. Return ONLY the translation.\n\n"${metaDesc}"`;
          const translatedMeta = await safeGenerateContent(metaPrompt, `meta-translate-${locale}`);
          if (translatedMeta) {
            localizedMeta = translatedMeta.trim().replace(/^"|"$/g, '');
          }
        }

        const slug = `${createSlug(localizedTitle)}-${Date.now()}`;

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
