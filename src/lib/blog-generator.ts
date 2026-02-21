import BlogPost, { IBlogPost, ICoverImage } from '@/models/BlogPost';
import { safeGenerateContent } from '@/utils/ai';
import { logger } from '@/utils/logger';
import { SERVICE_PILLARS, getAllTopics, type SEOTopic, type PostFormat } from '@/data/seo-topics';
import { getBlueprintForFormat } from '@/data/post-blueprints';

const getCurrentYear = () => new Date().getFullYear();
export const MAX_SOURCE_TEXT_LENGTH = 5000;
export const MAX_EXTRACTED_TEXT_LENGTH = 4000;
export const ALLOWED_LOCALES = ['en', 'ru', 'uz'];
export const MAX_CUSTOM_TOPIC_LENGTH = 200;

export const POST_FORMATS: PostFormat[] = [
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

export type TopicResult = SEOTopic & { servicePillar: string; pillarName: string };

export interface SourceClassification {
  title: string;
  category: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  postFormat: PostFormat;
  imageHints: string[];
}

// ---------------------------------------------------------------------------
// URL text extraction
// ---------------------------------------------------------------------------

export async function extractTextFromUrl(url: string): Promise<string> {
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

export async function classifySourceContent(sourceText: string): Promise<SourceClassification> {
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

Pick the category that best matches how Softwhere.uz would cover this topic. Security/hacking → cybersecurity. AI news → ai-solutions. App news → mobile-app-development. Etc.`;

  const result = await safeGenerateContent(prompt, 'source-classify', 500);

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
      logger.warn('Failed to parse source classification JSON', undefined, 'BLOG');
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
// Source-based prompt
// ---------------------------------------------------------------------------

export function buildSourcePrompt(
  sourceText: string,
  classification: SourceClassification,
  locale: string,
  inlineImages: ICoverImage[]
): string {
  const year = getCurrentYear();
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const blueprint = getBlueprintForFormat(classification.postFormat);
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
    const imgMarkdown = inlineImages.map((img, i) => `![${classification.primaryKeyword} - illustration ${i + 1}](${img.url})`).join('\n');
    imageInstruction = `\nINLINE IMAGES — Insert these images naturally between sections:\n${imgMarkdown}`;
  }

  return `You are an expert content writer for Softwhere.uz, a software development company in Uzbekistan. You've been given source material to use as inspiration. Write a completely ORIGINAL blog post — do NOT copy the source. Analyze the topic and write from Softwhere.uz's expert perspective with unique value and practical advice.

---

${langInstruction}

LANGUAGE: Write the ENTIRE post in ${langName}. Do not mix languages.

SOURCE MATERIAL (context/inspiration ONLY — do NOT copy):
---
${sourceText.slice(0, 3000)}
---

Write an original blog post. Suggested title: "${classification.title}"

FORMAT: ${blueprint.name}
TONE: ${blueprint.tone}
TARGET LENGTH: ${blueprint.wordRange[0]}–${blueprint.wordRange[1]} words

OPENING: ${blueprint.openingInstruction}

STRUCTURE:
${blueprint.structurePrompt}

FORMATTING RULES:
${blueprint.formattingRules}

SEO REQUIREMENTS:
- Primary keyword: "${classification.primaryKeyword}" — use 3-5 times naturally
- Secondary keywords: ${classification.secondaryKeywords.map(k => `"${k}"`).join(', ')} — use each 1-2 times
- ${blueprint.seoHint}
- Use H1 for the title, H2 for major sections, H3 for subsections

GUIDELINES:
- Reference the source news/event but add YOUR expert analysis
- Include actionable advice for business owners
- Subtle CTA tying back to how Softwhere.uz can help
- Add practical steps readers can take immediately
- Include 2-4 statistics from credible sources (${year - 2}–${year})

CONTEXT:
- Today is ${date}, we are in ${year}
- Target audience: business owners in Uzbekistan and Central Asia
- Company: Softwhere.uz — ${pillarName} specialists
${imageInstruction}

Write a unique, valuable post. Every paragraph should teach something or persuade.`;
}

// ---------------------------------------------------------------------------
// Smart topic selection
// ---------------------------------------------------------------------------

interface RecentPostInfo {
  category?: string;
  postFormat?: string;
  primaryKeyword?: string;
}

export async function smartSelectTopic(): Promise<TopicResult> {
  const recentPosts = await BlogPost.find({ locale: 'en' })
    .sort({ createdAt: -1 })
    .limit(30)
    .select('category postFormat primaryKeyword')
    .lean<RecentPostInfo[]>();

  const usedKeywords = new Set(recentPosts.map((p: RecentPostInfo) => p.primaryKeyword).filter(Boolean));
  const recentFormats = recentPosts
    .slice(0, 4)
    .map((p: RecentPostInfo) => p.postFormat)
    .filter(Boolean);
  const pillarUsage = new Map<string, number>();

  for (const p of recentPosts) {
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
// Topic-based prompt
// ---------------------------------------------------------------------------

export function buildTopicPrompt(topic: TopicResult, locale: string, inlineImages: ICoverImage[]): string {
  const blueprint = getBlueprintForFormat(topic.postFormat as PostFormat);
  const year = getCurrentYear();
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

// ---------------------------------------------------------------------------
// Content generation
// ---------------------------------------------------------------------------

export async function generateBlogContent(topic: TopicResult, locale: string, inlineImages: ICoverImage[]): Promise<string> {
  const prompt = buildTopicPrompt(topic, locale, inlineImages);

  logger.info(`Generating "${topic.postFormat}" content for "${topic.title}" in ${locale}`, undefined, 'BLOG');

  const content = await safeGenerateContent(prompt, `blog-${topic.postFormat}-${locale}`);

  if (content && content.split(/\s+/).length >= 300) {
    logger.info(`Generated ${content.split(/\s+/).length} words for ${locale}`, undefined, 'BLOG');
    return content;
  }

  logger.warn(`Content too short or missing for ${locale}, using fallback`, undefined, 'BLOG');
  return generateFallbackContent(topic, locale);
}

export async function generateSourceBasedContent(
  sourceText: string,
  classification: SourceClassification,
  topic: TopicResult,
  locale: string,
  inlineImages: ICoverImage[]
): Promise<string> {
  const prompt = buildSourcePrompt(sourceText, classification, locale, inlineImages);
  logger.info(`Generating source-based content for "${topic.title}" in ${locale}`, undefined, 'BLOG');
  const generated = await safeGenerateContent(prompt, `blog-source-${locale}`);
  return generated && generated.split(/\s+/).length >= 300 ? generated : generateFallbackContent(topic, locale);
}

// ---------------------------------------------------------------------------
// Fallback content
// ---------------------------------------------------------------------------

export function generateFallbackContent(topic: TopicResult, locale: string): string {
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
// Meta description
// ---------------------------------------------------------------------------

export async function generateMetaDescription(title: string, primaryKeyword: string, locale: string): Promise<string> {
  const prompt = `Write a 150-160 character meta description for a blog post titled "${title}". Include the keyword "${primaryKeyword}". Make it compelling and action-oriented. Write in ${locale === 'en' ? 'English' : locale === 'ru' ? 'Russian' : 'Uzbek'}. Return ONLY the meta description.`;

  const result = await safeGenerateContent(prompt, `meta-desc-${locale}`, 200);
  if (result && result.length <= 200) return result.trim().replace(/^"|"$/g, '');

  return `${title} — Expert insights and practical advice from Softwhere.uz`;
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

export function createSlug(title: string): string {
  return transliterate(title.toLowerCase())
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}
