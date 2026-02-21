/**
 * Generate a new blog post group (en/ru/uz) and save directly to MongoDB.
 * Designed to run in GitHub Actions where there is no Vercel timeout.
 *
 * Usage:
 *   npx tsx scripts/generate-post.ts [options]
 *
 * Options:
 *   --category <id>      Service pillar (e.g. mobile-app-development) or "random"
 *   --customTopic <str>  Custom topic; overrides category when set
 *   --sourceUrl <url>    URL to fetch and use as source material
 *   --sourceText <str>   Raw text to use as source material (max 5000 chars)
 *   --locales <list>     Comma-separated locales (default: en,ru,uz)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { SERVICE_PILLARS, getAllTopics, type SEOTopic, type PostFormat } from '../src/data/seo-topics';
import { getBlueprintForFormat } from '../src/data/post-blueprints';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MONGODB_URI = process.env.MONGODB_URI;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

if (!MONGODB_URI) throw new Error('MONGODB_URI not set');
if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not set');

const ai = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: DEEPSEEK_API_KEY });
const MODEL = 'deepseek-chat';
const TEMPERATURE_EN = 0.9;
const TEMPERATURE_OTHER = 0.75;
const CONTENT_MAX_TOKENS = 8192;
const FREQUENCY_PENALTY = 0.4;
const PRESENCE_PENALTY = 0.35;
const UNSPLASH_API = 'https://api.unsplash.com';
const MAX_SOURCE_TEXT_LENGTH = 5000;
const MAX_EXTRACTED_TEXT_LENGTH = 4000;

type TopicResult = SEOTopic & { servicePillar: string; pillarName: string };

// ---------------------------------------------------------------------------
// Mongoose model (inline to avoid @/ alias issues outside Next.js)
// ---------------------------------------------------------------------------

interface ICoverImage {
  url: string;
  thumbUrl: string;
  authorName: string;
  authorUrl: string;
  keyword: string;
}

const BlogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, index: true },
    content: { type: String, required: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    locale: { type: String, enum: ['en', 'ru', 'uz'], required: true, index: true },
    generationGroupId: { type: String, index: true, sparse: true },
    coverImage: { url: String, thumbUrl: String, authorName: String, authorUrl: String, keyword: String },
    category: { type: String, index: true, sparse: true },
    postFormat: String,
    primaryKeyword: String,
    secondaryKeywords: [String],
    metaDescription: String,
    contentImages: [{ url: String, thumbUrl: String, authorName: String, authorUrl: String, keyword: String }],
  },
  { timestamps: true }
);

BlogPostSchema.index({ locale: 1, slug: 1 }, { unique: true });
const BlogPost = mongoose.models.BlogPost || mongoose.model('BlogPost', BlogPostSchema);

// ---------------------------------------------------------------------------
// AI helper
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sanitizeContent(text: string): string {
  return text
    .replace(/[\\\s]+$/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/^(#{1,6}\s.*)\n{3,}/gm, '$1\n\n')
    .trim();
}

async function generate(prompt: string, label: string, maxTokens?: number): Promise<string | null> {
  const isContent = label.startsWith('content-') || label.startsWith('blog-');
  const isNonEnContent = isContent && !label.endsWith('-en');
  const temperature = isNonEnContent ? TEMPERATURE_OTHER : TEMPERATURE_EN;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await ai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens ?? (isContent ? CONTENT_MAX_TOKENS : undefined),
        frequency_penalty: isContent ? FREQUENCY_PENALTY : 0,
        presence_penalty: isContent ? PRESENCE_PENALTY : 0,
      });
      const raw = res.choices[0]?.message?.content ?? null;
      return raw && isContent ? sanitizeContent(raw) : raw;
    } catch (err: unknown) {
      const status = (err as Record<string, unknown>).status;
      if (status === 429) {
        console.log(`  ⏳ Rate limited on ${label}, waiting 60s...`);
        await sleep(60_000);
        continue;
      }
      console.error(`  ❌ AI error (${attempt}/3) ${label}:`, (err as Error).message);
      if (attempt === 3) return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  category: string;
  customTopic: string;
  sourceUrl: string;
  sourceText: string;
  locales: string[];
} {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      opts[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }

  return {
    category: opts.category || '',
    customTopic: opts.customTopic || '',
    sourceUrl: opts.sourceUrl || '',
    sourceText: opts.sourceText || '',
    locales: (opts.locales || 'en,ru,uz').split(',').filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// URL text extraction
// ---------------------------------------------------------------------------

async function extractTextFromUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SoftwherBot/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_EXTRACTED_TEXT_LENGTH);
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Source classification
// ---------------------------------------------------------------------------

interface SourceClassification {
  title: string;
  category: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  postFormat: PostFormat;
  imageHints: string[];
}

const POST_FORMATS: PostFormat[] = [
  'cost-guide',
  'comparison',
  'how-to',
  'listicle',
  'faq',
  'case-study',
  'myth-buster',
  'checklist',
  'trend-report',
  'roi-analysis',
  'beginner-guide',
  'deep-dive',
  'glossary',
  'troubleshooting-guide',
];

async function classifySourceContent(sourceText: string): Promise<SourceClassification> {
  const categories = SERVICE_PILLARS.map(p => p.id).join(', ');

  const prompt = `Analyze this source content and classify it for a blog post by Softwhere.uz (a software development company in Uzbekistan). Return ONLY valid JSON, no markdown fences.

SOURCE CONTENT (excerpt):
"${sourceText.slice(0, 2000)}"

Return JSON:
{
  "title": "Engaging blog post title from Softwhere.uz perspective (in English)",
  "category": "one of: ${categories}",
  "primaryKeyword": "main SEO keyword (2-4 words)",
  "secondaryKeywords": ["kw1", "kw2", "kw3"],
  "postFormat": "one of: ${POST_FORMATS.join(', ')}",
  "imageHints": ["unsplash search term 1", "unsplash search term 2"]
}

Pick the category that best matches how Softwhere.uz would cover this topic.`;

  const result = await generate(prompt, 'source-classify', 500);

  if (result) {
    try {
      const cleaned = result
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      const validCategories = SERVICE_PILLARS.map(p => p.id);
      return {
        title: parsed.title || 'Industry Update: Expert Analysis',
        category: validCategories.includes(parsed.category) ? parsed.category : 'cybersecurity',
        primaryKeyword: parsed.primaryKeyword || 'software development',
        secondaryKeywords: Array.isArray(parsed.secondaryKeywords) ? parsed.secondaryKeywords.slice(0, 5) : [],
        postFormat: POST_FORMATS.includes(parsed.postFormat) ? (parsed.postFormat as PostFormat) : 'deep-dive',
        imageHints: Array.isArray(parsed.imageHints) ? parsed.imageHints.slice(0, 3) : [],
      };
    } catch {
      /* fall through */
    }
  }

  return {
    title: 'Industry Update: What Businesses Need to Know',
    category: 'cybersecurity',
    primaryKeyword: 'data security',
    secondaryKeywords: ['cybersecurity', 'data protection'],
    postFormat: 'deep-dive' as PostFormat,
    imageHints: ['cybersecurity', 'data protection'],
  };
}

// ---------------------------------------------------------------------------
// Unsplash image fetching
// ---------------------------------------------------------------------------

function extractFallbackKeyword(title: string): string {
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'vs',
    'versus',
    'what',
    'how',
    'why',
    'when',
    'where',
    'which',
    'that',
    'this',
    'it',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'can',
    'need',
    'complete',
    'guide',
    'ultimate',
    'best',
    'top',
    'new',
    'your',
    'our',
  ]);
  const words = title
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));
  return words.slice(0, 3).join(' ') || 'technology';
}

async function searchUnsplash(keyword: string, page = 1): Promise<ICoverImage | null> {
  if (!UNSPLASH_ACCESS_KEY) return null;

  try {
    const params = new URLSearchParams({ query: keyword, per_page: '1', page: String(page), orientation: 'landscape' });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${UNSPLASH_API}/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const photo = data?.results?.[0];
    if (!photo?.urls?.regular) return null;

    return {
      url: photo.urls.regular,
      thumbUrl: photo.urls.small,
      authorName: photo.user?.name ?? 'Unknown',
      authorUrl: photo.user?.links?.html ?? '',
      keyword,
    };
  } catch {
    return null;
  }
}

async function fetchImages(
  title: string,
  imageHints: string[]
): Promise<{ cover: ICoverImage | null; inline: ICoverImage[]; all: ICoverImage[] }> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.log('   ⚠️  UNSPLASH_ACCESS_KEY not set, skipping images');
    return { cover: null, inline: [], all: [] };
  }

  const coverKeyword = imageHints[0] || extractFallbackKeyword(title);
  const cover = await searchUnsplash(coverKeyword);
  const usedUrls = new Set(cover ? [cover.url] : []);

  const inlineKeywords = [
    imageHints[1] || extractFallbackKeyword(title),
    imageHints[2] || `${extractFallbackKeyword(title)} technology`,
    imageHints[0] ? `${imageHints[0]} business` : 'software development',
  ];

  const inline: ICoverImage[] = [];
  for (const kw of inlineKeywords) {
    if (inline.length >= 3) break;
    for (let page = 1; page <= 2 && inline.length < 3; page++) {
      const img = await searchUnsplash(kw, page);
      if (img && !usedUrls.has(img.url)) {
        inline.push(img);
        usedUrls.add(img.url);
      }
    }
  }

  const all = [...(cover ? [cover] : []), ...inline];
  return { cover, inline, all };
}

// ---------------------------------------------------------------------------
// Smart topic selection (queries DB to pick the best unused topic)
// ---------------------------------------------------------------------------

async function smartSelectTopic(): Promise<TopicResult> {
  const recentPosts = await BlogPost.find({ locale: 'en' })
    .sort({ createdAt: -1 })
    .limit(30)
    .select('category postFormat primaryKeyword')
    .lean();

  const usedKeywords = new Set((recentPosts as Array<{ primaryKeyword?: string }>).map(p => p.primaryKeyword).filter(Boolean));
  const recentFormats = (recentPosts as Array<{ postFormat?: string }>)
    .slice(0, 4)
    .map(p => p.postFormat)
    .filter(Boolean);
  const pillarUsage = new Map<string, number>();

  for (const p of recentPosts as Array<{ category?: string }>) {
    if (p.category) {
      pillarUsage.set(p.category, (pillarUsage.get(p.category) ?? 0) + 1);
    }
  }

  const allTopics = getAllTopics();

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
    const pool = scored.slice(0, Math.min(3, scored.length));
    return pool[Math.floor(Math.random() * pool.length)].topic;
  }

  const focusTopics = allTopics.filter(t => {
    const pillar = SERVICE_PILLARS.find(p => p.id === t.servicePillar);
    return pillar && pillar.weight >= 2;
  });
  return focusTopics[Math.floor(Math.random() * focusTopics.length)] ?? allTopics[0];
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildTopicPrompt(topic: TopicResult, locale: string, inlineImages: ICoverImage[]): string {
  const bp = getBlueprintForFormat(topic.postFormat as PostFormat);
  const year = new Date().getFullYear();
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const langName = locale === 'en' ? 'English' : locale === 'ru' ? 'Russian' : 'Uzbek';
  const langInstruction =
    locale === 'en'
      ? 'Write in English.'
      : locale === 'ru'
        ? 'ВАЖНО: Пишите ПОЛНОСТЬЮ на русском языке. Весь контент, заголовки и CTA на русском.'
        : "MUHIM: BUTUNLAY o'zbek tilida yozing. Barcha kontent, sarlavhalar va CTA o'zbek tilida.";

  let imageInstruction = '';
  if (inlineImages.length > 0) {
    const imgMd = inlineImages.map((img, i) => `![${topic.primaryKeyword} - illustration ${i + 1}](${img.url})`).join('\n');
    imageInstruction = `\nINLINE IMAGES — Insert these naturally between sections:\n${imgMd}`;
  }

  const system = `You are an expert content writer and SEO specialist for Softwhere.uz, a software development company in Uzbekistan. ${
    locale === 'ru' ? 'Вы пишете на русском языке.' : locale === 'uz' ? "Siz o'zbek tilida yozasiz." : ''
  }`;

  const user = `${langInstruction}

Write a blog post about: "${topic.title}"

LANGUAGE: Write the ENTIRE post in ${langName}. Do not mix languages.

FORMAT: ${bp.name}
TONE: ${bp.tone}
TARGET LENGTH: ${bp.wordRange[0]}–${bp.wordRange[1]} words

OPENING: ${bp.openingInstruction}

STRUCTURE:
${bp.structurePrompt}

FORMATTING RULES:
${bp.formattingRules}

SEO REQUIREMENTS:
- Primary keyword: "${topic.primaryKeyword}" — use 3-5 times naturally
- Secondary keywords: ${topic.secondaryKeywords.map(k => `"${k}"`).join(', ')} — use each 1-2 times
- Target queries to answer: ${topic.targetQueries.map(q => `"${q}"`).join(', ')}
- ${bp.seoHint}
- Use H1 for the title, H2 for major sections, H3 for subsections

CONTEXT:
- Today is ${date}, we are in ${year}
- Target audience: business owners in Uzbekistan and Central Asia
- Company: Softwhere.uz — ${topic.pillarName} specialists
${imageInstruction}

CREDIBILITY:
- Include 2-4 statistics from credible sources (Statista, Gartner, McKinsey, etc.)
- Use recent data (${year - 2}–${year})

Write a unique, valuable post. Every paragraph should teach something or persuade.`;

  return `${system}\n\n---\n\n${user}`;
}

function buildSourcePrompt(sourceText: string, classification: SourceClassification, locale: string, inlineImages: ICoverImage[]): string {
  const year = new Date().getFullYear();
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const bp = getBlueprintForFormat(classification.postFormat);
  const pillar = SERVICE_PILLARS.find(p => p.id === classification.category);
  const pillarName = pillar?.name ?? 'Software Development';

  const langName = locale === 'en' ? 'English' : locale === 'ru' ? 'Russian' : 'Uzbek';
  const langInstruction =
    locale === 'en'
      ? 'Write in English.'
      : locale === 'ru'
        ? 'ВАЖНО: Пишите ПОЛНОСТЬЮ на русском языке. Весь контент, заголовки и CTA на русском.'
        : "MUHIM: BUTUNLAY o'zbek tilida yozing. Barcha kontent, sarlavhalar va CTA o'zbek tilida.";

  let imageInstruction = '';
  if (inlineImages.length > 0) {
    const imgMd = inlineImages.map((img, i) => `![${classification.primaryKeyword} - illustration ${i + 1}](${img.url})`).join('\n');
    imageInstruction = `\nINLINE IMAGES — Insert these images naturally between sections:\n${imgMd}`;
  }

  return `You are an expert content writer for Softwhere.uz, a software development company in Uzbekistan. You've been given source material to use as inspiration. Write a completely ORIGINAL blog post — do NOT copy the source.

---

${langInstruction}

LANGUAGE: Write the ENTIRE post in ${langName}. Do not mix languages.

SOURCE MATERIAL (context/inspiration ONLY — do NOT copy):
---
${sourceText.slice(0, 3000)}
---

Write an original blog post. Suggested title: "${classification.title}"

FORMAT: ${bp.name}
TONE: ${bp.tone}
TARGET LENGTH: ${bp.wordRange[0]}–${bp.wordRange[1]} words

OPENING: ${bp.openingInstruction}

STRUCTURE:
${bp.structurePrompt}

FORMATTING RULES:
${bp.formattingRules}

SEO REQUIREMENTS:
- Primary keyword: "${classification.primaryKeyword}" — use 3-5 times naturally
- Secondary keywords: ${classification.secondaryKeywords.map(k => `"${k}"`).join(', ')} — use each 1-2 times
- ${bp.seoHint}
- Use H1 for the title, H2 for major sections, H3 for subsections

GUIDELINES:
- Reference the source news/event but add YOUR expert analysis
- Include actionable advice for business owners
- Subtle CTA tying back to how Softwhere.uz can help
- Include 2-4 statistics from credible sources (${year - 2}–${year})

CONTEXT:
- Today is ${date}, we are in ${year}
- Target audience: business owners in Uzbekistan and Central Asia
- Company: Softwhere.uz — ${pillarName} specialists
${imageInstruction}

Write a unique, valuable post. Every paragraph should teach something or persuade.`;
}

// ---------------------------------------------------------------------------
// Fallback content
// ---------------------------------------------------------------------------

function generateFallbackContent(topic: TopicResult, locale: string): string {
  const year = new Date().getFullYear();
  const bp = getBlueprintForFormat(topic.postFormat as PostFormat);
  const l = locale as 'en' | 'ru' | 'uz';

  const t: Record<string, Record<string, string>> = {
    intro: { en: 'Introduction', ru: 'Введение', uz: 'Kirish' },
    why: { en: 'Why This Matters', ru: 'Почему это важно', uz: 'Nima uchun bu muhim' },
    details: { en: 'Key Details', ru: 'Основные детали', uz: 'Asosiy tafsilotlar' },
    cta: {
      en: `Ready to get started? Contact Softwhere.uz for a free consultation on ${topic.pillarName.toLowerCase()}.`,
      ru: `Готовы начать? Свяжитесь с Softwhere.uz для бесплатной консультации по ${topic.pillarName.toLowerCase()}.`,
      uz: `Boshlashga tayyormisiz? ${topic.pillarName.toLowerCase()} bo'yicha bepul maslahat uchun Softwhere.uz bilan bog'laning.`,
    },
  };

  return `# ${topic.title}

## ${t.intro[l] ?? t.intro.en}

${topic.title} — one of the most common questions business owners ask in ${year}. In this ${bp.name.toLowerCase()}, we cover everything about ${topic.primaryKeyword}.

## ${t.why[l] ?? t.why.en}

The demand for ${topic.primaryKeyword} continues to grow in Central Asia. Businesses investing in ${topic.pillarName.toLowerCase()} see measurable improvements in efficiency and revenue.

## ${t.details[l] ?? t.details.en}

${topic.secondaryKeywords.map(k => `- **${k}**: A critical factor in any ${topic.pillarName.toLowerCase()} project.`).join('\n')}

---

**${t.cta[l] ?? t.cta.en}**

*Published in ${year} by Softwhere.uz*`;
}

// ---------------------------------------------------------------------------
// Slug helpers
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
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);
  console.log('✅ Connected\n');

  let selectedTopic: TopicResult;
  let sourceClassification: SourceClassification | null = null;
  let resolvedSource: string | null = null;

  // --- Resolve source if provided -----------------------------------------

  if (opts.sourceUrl) {
    console.log(`🌐 Fetching source URL: ${opts.sourceUrl}`);
    try {
      resolvedSource = await extractTextFromUrl(opts.sourceUrl);
      console.log(`   Extracted ${resolvedSource.length} chars from URL`);
    } catch (err) {
      console.error('❌ Failed to fetch source URL:', (err as Error).message);
      process.exit(1);
    }
  } else if (opts.sourceText) {
    resolvedSource = opts.sourceText.trim().slice(0, MAX_SOURCE_TEXT_LENGTH);
    console.log(`📄 Using provided source text (${resolvedSource.length} chars)`);
  }

  // --- Select topic -------------------------------------------------------

  if (resolvedSource) {
    console.log('🔍 Classifying source content...');
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
    console.log(`   → "${selectedTopic.title}" (${selectedTopic.servicePillar}/${selectedTopic.postFormat})`);
  } else if (opts.customTopic) {
    console.log(`✍️  Custom topic: "${opts.customTopic}"`);
    const normalizePrompt = `You are a professional editor. Normalize this blog post topic by fixing spelling, improving grammar, and making it professional. Return ONLY the normalized topic.\n\nTopic: "${opts.customTopic}"`;
    const normalized = await generate(normalizePrompt, 'topic-normalize', 100);
    const topicTitle = normalized ? normalized.trim().replace(/^"|"$/g, '') : opts.customTopic;

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
    console.log(`   → Normalized: "${topicTitle}"`);
  } else if (opts.category && opts.category !== 'auto') {
    const validCategories = SERVICE_PILLARS.map(p => p.id);
    if (opts.category !== 'random' && !validCategories.includes(opts.category)) {
      console.error(`❌ Invalid category: ${opts.category}`);
      process.exit(1);
    }

    const pillarTopics = opts.category === 'random' ? getAllTopics() : getAllTopics().filter(t => t.servicePillar === opts.category);
    if (pillarTopics.length === 0) {
      console.error(`❌ No topics for category: ${opts.category}`);
      process.exit(1);
    }

    selectedTopic = pillarTopics[Math.floor(Math.random() * pillarTopics.length)];
    console.log(`📂 Category "${opts.category}" → "${selectedTopic.title}"`);
  } else {
    console.log('🧠 Smart topic selection...');
    selectedTopic = await smartSelectTopic();
    console.log(`   → "${selectedTopic.title}" (${selectedTopic.servicePillar}/${selectedTopic.postFormat})`);
  }

  const generationGroupId = uuidv4();
  console.log(`\n📦 Generation group: ${generationGroupId}`);
  console.log(`📝 Topic: "${selectedTopic.title}"`);
  console.log(`   Format: ${selectedTopic.postFormat} | Pillar: ${selectedTopic.servicePillar}`);

  // --- Fetch images -------------------------------------------------------

  console.log('\n🖼️  Fetching images...');
  const {
    cover: coverImage,
    inline: inlineImages,
    all: allContentImages,
  } = await fetchImages(selectedTopic.title, selectedTopic.imageHints);
  console.log(`   Got ${allContentImages.length} image(s)`);

  // --- Generate meta description ------------------------------------------

  console.log('\n📋 Generating meta description...');
  const metaPrompt = `Write a 150-160 character meta description for a blog post titled "${selectedTopic.title}". Include the keyword "${selectedTopic.primaryKeyword}". Make it compelling. Return ONLY the meta description.`;
  const metaDesc =
    (await generate(metaPrompt, 'meta-en', 200))?.trim().replace(/^"|"$/g, '') ??
    `${selectedTopic.title} — Expert insights from Softwhere.uz`;

  // --- Generate per locale ------------------------------------------------

  const createdPosts = [];

  for (const locale of opts.locales) {
    console.log(`\n🌐 Generating ${locale.toUpperCase()} content...`);

    let content: string;
    if (resolvedSource && sourceClassification) {
      const prompt = buildSourcePrompt(resolvedSource, sourceClassification, locale, inlineImages);
      const generated = await generate(prompt, `content-source-${locale}`);
      content = generated && generated.split(/\s+/).length >= 800 ? generated : generateFallbackContent(selectedTopic, locale);
    } else {
      const prompt = buildTopicPrompt(selectedTopic, locale, inlineImages);
      const generated = await generate(prompt, `content-${locale}`);
      content = generated && generated.split(/\s+/).length >= 800 ? generated : generateFallbackContent(selectedTopic, locale);
    }

    console.log(`   ✅ ${content.split(/\s+/).length} words`);

    // Translate title for non-EN
    let localizedTitle = selectedTopic.title;
    if (locale !== 'en') {
      const titlePrompt = `Translate the following blog post title into ${locale === 'ru' ? 'Russian' : 'Uzbek'}: "${selectedTopic.title}". Only return the translated title, nothing else.`;
      const translated = await generate(titlePrompt, `title-${locale}`, 100);
      if (translated) localizedTitle = translated.trim().replace(/^"|"$/g, '');
    }

    // Translate meta for non-EN
    let localizedMeta = metaDesc;
    if (locale !== 'en') {
      const metaTranslatePrompt = `Translate this meta description into ${locale === 'ru' ? 'Russian' : 'Uzbek'}. Keep it under 160 characters. Return ONLY the translation.\n\n"${metaDesc}"`;
      const translatedMeta = await generate(metaTranslatePrompt, `meta-${locale}`, 200);
      if (translatedMeta) localizedMeta = translatedMeta.trim().replace(/^"|"$/g, '');
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
    console.log(`   💾 Saved: "${localizedTitle}" (${savedPost.slug})`);

    createdPosts.push({
      id: savedPost._id,
      title: savedPost.title,
      slug: savedPost.slug,
      locale: savedPost.locale,
    });
  }

  // --- Summary ------------------------------------------------------------

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏁 Done! Generated ${createdPosts.length} post(s)`);
  console.log(`   Group ID: ${generationGroupId}`);
  console.log(`   Topic: "${selectedTopic.title}"`);
  console.log(`   Format: ${selectedTopic.postFormat}`);
  console.log(`   Pillar: ${selectedTopic.servicePillar}`);

  for (const p of createdPosts) {
    console.log(`   → [${p.locale}] ${p.title}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
