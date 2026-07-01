/**
 * Generate a new blog post group (en/ru/uz) and save directly to Neon Postgres.
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
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { createPost, slugTaken } from '../src/modules/blog/model/posts.repository';
import { SERVICE_PILLARS, getAllTopics, type PostFormat } from '../src/modules/blog/data/seo-topics';
import { getBlueprintForFormat } from '../src/modules/blog/data/post-blueprints';
// Shared logic consolidated from the blog library. tsx resolves these (and the
// library's transitive @/ imports) via tsconfig `paths`, so relative imports work.
import {
  MAX_SOURCE_TEXT_LENGTH,
  MAX_EXTRACTED_TEXT_LENGTH,
  POST_FORMATS,
  smartSelectTopic,
  type TopicResult,
  type SourceClassification,
} from '../src/modules/blog/api/generator';
import { createSlug } from '../src/shared/utils/slug';
import type { ICoverImage } from '../src/modules/blog/model/BlogPost';
import { sanitizeContent, assessContentQuality, QUALITY_RULES } from './lib/quality';
import { CATEGORY_IMAGE_KEYWORDS, GENERIC_FALLBACK_KEYWORDS } from './lib/image-keywords';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

if (!DATABASE_URL) throw new Error('DATABASE_URL not set');
if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not set');

const ai = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: DEEPSEEK_API_KEY });
const MODEL = 'deepseek-chat';
const TEMPERATURE = 0.7;
const UNSPLASH_API = 'https://api.unsplash.com';

// MAX_SOURCE_TEXT_LENGTH, MAX_EXTRACTED_TEXT_LENGTH, TopicResult and ICoverImage
// are imported from the blog library (single source of truth).

// ---------------------------------------------------------------------------
// Persistence goes through the shared Drizzle/Neon repository (createPost,
// slugTaken) — the same code path the app uses, so there is no separate model.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AI helper
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generate(prompt: string, label: string, maxTokens?: number, systemMsg?: string): Promise<string | null> {
  const isContent = label.startsWith('content-') || label.startsWith('blog-');
  const messages = systemMsg
    ? [
        { role: 'system' as const, content: systemMsg },
        { role: 'user' as const, content: prompt },
      ]
    : [{ role: 'user' as const, content: prompt }];
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await ai.chat.completions.create({
        model: MODEL,
        messages,
        temperature: TEMPERATURE,
        ...(maxTokens && { max_tokens: maxTokens }),
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

// NOTE: intentionally diverges from extractTextFromUrl in
// src/modules/blog/api/generator.ts. The library version adds an SSRF guard
// (assertFetchableUrl) and uses `redirect: 'error'`; this CLI version follows
// redirects and skips that guard. Kept separate to preserve current fetch
// behavior for arbitrary source URLs passed in CI.
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

// NOTE: intentionally diverges from classifySourceContent in
// src/modules/blog/api/generator.ts. The prompt text differs (the library adds
// "Security/hacking → cybersecurity ..." routing examples) and this version
// routes through the local `generate()` helper. Kept separate so the classified
// output is unchanged. SourceClassification/POST_FORMATS are shared imports.
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

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function fetchCoverWithFallback(keyword: string, category: string, imageHints: string[], title: string): Promise<ICoverImage | null> {
  const hash = simpleHash(title);

  const img = await searchUnsplash(keyword, (hash % 5) + 1);
  if (img) return img;

  for (const hint of imageHints.slice(1)) {
    const hintImg = await searchUnsplash(hint);
    if (hintImg) return hintImg;
  }

  const categoryKeywords = CATEGORY_IMAGE_KEYWORDS[category] || [];
  const catStart = hash % Math.max(categoryKeywords.length, 1);
  for (let i = 0; i < categoryKeywords.length; i++) {
    const catKw = categoryKeywords[(catStart + i) % categoryKeywords.length];
    const catImg = await searchUnsplash(catKw, (hash % 5) + 1);
    if (catImg) return catImg;
  }

  const genericKw = GENERIC_FALLBACK_KEYWORDS[hash % GENERIC_FALLBACK_KEYWORDS.length];
  return await searchUnsplash(genericKw, (hash % 8) + 1);
}

async function fetchImages(
  title: string,
  imageHints: string[],
  category?: string
): Promise<{ cover: ICoverImage | null; inline: ICoverImage[]; all: ICoverImage[] }> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.log('   ⚠️  UNSPLASH_ACCESS_KEY not set, skipping images');
    return { cover: null, inline: [], all: [] };
  }

  const coverKeyword = imageHints[0] || extractFallbackKeyword(title);
  const cover = await fetchCoverWithFallback(coverKeyword, category || '', imageHints, title);
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

// Smart topic selection (smartSelectTopic) is imported from the blog library —
// the inline copy was byte-identical (same DB query, scoring, and selection).

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

// NOTE: intentionally diverges from buildTopicPrompt in
// src/modules/blog/api/generator.ts. This version returns a {system, user}
// split (the library returns a single concatenated string), uses different
// system-prompt wording, appends QUALITY_RULES, and omits the internal-linking
// line. Kept separate so generated content is unchanged.
function buildTopicPrompt(topic: TopicResult, locale: string, inlineImages: ICoverImage[]): { system: string; user: string } {
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

  const system = `You are an expert content writer and SEO specialist for Softwhere.uz, a software development company in Uzbekistan. You produce impeccably formatted markdown articles. ${
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
${QUALITY_RULES}

Write a unique, valuable post. Every paragraph should teach something or persuade.`;

  return { system, user };
}

// NOTE: intentionally diverges from buildSourcePrompt in
// src/modules/blog/api/generator.ts. This version returns a {system, user}
// split, uses different system-prompt wording, appends QUALITY_RULES, and omits
// some guideline lines. Kept separate so generated content is unchanged.
function buildSourcePrompt(
  sourceText: string,
  classification: SourceClassification,
  locale: string,
  inlineImages: ICoverImage[]
): { system: string; user: string } {
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

  const system = `You are an expert content writer for Softwhere.uz, a software development company in Uzbekistan. You produce impeccably formatted markdown articles. You've been given source material to use as inspiration. Write a completely ORIGINAL blog post — do NOT copy the source.`;

  const user = `${langInstruction}

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
${QUALITY_RULES}

Write a unique, valuable post. Every paragraph should teach something or persuade.`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Fallback content
// ---------------------------------------------------------------------------

// NOTE: intentionally diverges from generateFallbackContent in
// src/modules/blog/api/generator.ts. This version emits fewer sections (no
// "Market Context"/"Next Steps") and shorter body copy. Kept separate so the
// fallback output is unchanged.
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

// Slug generation (createSlug) is imported from src/shared/utils/slug — the
// inline copy produced byte-identical output for every input.

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  console.log('🔌 Using Neon Postgres (DATABASE_URL)\n');

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
  } = await fetchImages(selectedTopic.title, selectedTopic.imageHints, selectedTopic.servicePillar);
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

    const label = resolvedSource ? `content-source-${locale}` : `content-${locale}`;
    const { system: sysMsg, user: userMsg } =
      resolvedSource && sourceClassification
        ? buildSourcePrompt(resolvedSource, sourceClassification, locale, inlineImages)
        : buildTopicPrompt(selectedTopic, locale, inlineImages);

    let generated = await generate(userMsg, label, undefined, sysMsg);

    if (generated && generated.split(/\s+/).length >= 300) {
      const quality = assessContentQuality(generated);
      if (!quality.pass) {
        console.log(`   ⚠️  Quality issues: ${quality.issues.join('; ')}`);
        console.log(`   🔄 Retrying generation...`);
        const retry = await generate(userMsg, label, undefined, sysMsg);
        if (retry && retry.split(/\s+/).length >= 300) {
          const retryQ = assessContentQuality(retry);
          if (retryQ.score > quality.score) generated = retry;
        }
      }
    }

    const content = generated && generated.split(/\s+/).length >= 300 ? generated : generateFallbackContent(selectedTopic, locale);

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

    // Localized, stable slug (no timestamp) with a per-locale collision suffix.
    const slugBase = createSlug(localizedTitle) || createSlug(selectedTopic.title) || `post-${generationGroupId.slice(0, 8)}`;
    let slug = slugBase;
    for (let n = 1; await slugTaken(slug, locale as 'en' | 'ru' | 'uz'); n += 1) {
      slug = `${slugBase}-${n}`;
    }

    const savedPost = await createPost({
      title: localizedTitle,
      slug,
      content,
      status: 'draft',
      locale: locale as 'en' | 'ru' | 'uz',
      generationGroupId,
      coverImage: coverImage ?? null,
      category: selectedTopic.servicePillar,
      postFormat: selectedTopic.postFormat,
      primaryKeyword: selectedTopic.primaryKeyword,
      secondaryKeywords: selectedTopic.secondaryKeywords,
      metaDescription: localizedMeta,
      contentImages: allContentImages,
    });
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

  process.exit(0);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
