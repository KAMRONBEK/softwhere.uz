import BlogPost, { ICoverImage } from '@/modules/blog/model/BlogPost';
import { safeGenerateContent, safeGenerateJSON } from '@/core/ai';
import { logger } from '@/core/logger';
import { createSlug } from '@/shared/utils/slug';
import { assertFetchableUrl } from '@/shared/utils/security';
import { SERVICE_PILLARS, getAllTopics, type SEOTopic, type PostFormat } from '@/modules/blog/data/seo-topics';
import { getBlueprintForFormat } from '@/modules/blog/data/post-blueprints';

const getCurrentYear = () => new Date().getFullYear();
export const MAX_SOURCE_TEXT_LENGTH = 5000;
export const MAX_EXTRACTED_TEXT_LENGTH = 4000;
export const ALLOWED_LOCALES = ['en', 'ru', 'uz'];
export const MAX_CUSTOM_TOPIC_LENGTH = 200;
// Minimum acceptable body length. Below this we treat generation as failed and
// return null (the route skips it) rather than persisting a thin/boilerplate post.
export const WORD_FLOOR = 500;

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

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// URL text extraction
// ---------------------------------------------------------------------------

export async function extractTextFromUrl(url: string): Promise<string> {
  // SSRF guard: reject non-http(s) schemes and private/loopback/metadata hosts
  // before issuing the server-side fetch. Throws on a blocked URL.
  const safeUrl = assertFetchableUrl(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(safeUrl, {
      signal: controller.signal,
      redirect: 'error', // don't follow redirects that could bounce to an internal host
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

  const result = await safeGenerateJSON(prompt, 'source-classify', 600);

  if (result) {
    try {
      const parsed = JSON.parse(result);
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
// Shared prompt building blocks
// ---------------------------------------------------------------------------

const LANG_NAME: Record<string, string> = { en: 'English', ru: 'Russian', uz: 'Uzbek' };

function langInstructionFor(locale: string): string {
  if (locale === 'ru') return 'ВАЖНО: Пишите ПОЛНОСТЬЮ на русском языке. Весь контент, заголовки и CTA на русском.';
  if (locale === 'uz') return "MUHIM: BUTUNLAY o'zbek tilida yozing. Barcha kontent, sarlavhalar va CTA o'zbek tilida.";
  return 'Write in English.';
}

/** The persona + hard quality/honesty rules — sent as the SYSTEM message. */
function buildSystemPrompt(locale: string, pillarName: string): string {
  const langLine = locale === 'ru' ? ' Вы пишете на русском языке.' : locale === 'uz' ? " Siz o'zbek tilida yozasiz." : '';
  return `You are a senior software consultant and content lead at Softwhere.uz — a product-engineering studio in Tashkent, Uzbekistan that ships mobile apps, web platforms, AI/RAG systems, Telegram bots, and CRM/ERP for businesses across Central Asia and internationally (${pillarName} is your focus here). You write like an experienced practitioner who has shipped real products: specific, opinionated, and genuinely useful — never generic.${langLine}

NON-NEGOTIABLE RULES:
- NEVER invent statistics, survey results, dates, client names, or citation URLs. Do not write "According to [Source](url), 73%..." with a fabricated source. If you lack a verifiable number, describe the trend qualitatively or frame an example as clearly hypothetical ("a typical mid-size retailer might spend...").
- Write from engineering experience and first-principles reasoning, not from summarizing the web.
- BANNED AI-slop words/patterns: delve, tapestry, testament, pivotal, crucial, underscore, vibrant, seamless, "in today's world", "navigating the landscape", "unlock/unleash the power", "when it comes to", "it's worth noting", the "not just X, but Y" construction, and mechanical rule-of-three lists. Prefer plain verbs (is, are, build, ship) over "serves as / stands as". Vary sentence length; don't overuse bold, em dashes, or bolded-colon lists.
- Be concrete: name real technologies and realistic timelines/effort (in weeks), give worked examples, and answer the reader's actual question fast.`;
}

/** Real internal links the model may use (locale-prefixed). No placeholders. */
function internalLinksBlock(locale: string): string {
  return `INTERNAL LINKS — include 2-3 where they genuinely fit the sentence, as real Markdown links with descriptive anchor text (NEVER placeholder text like "[related service]"):
- Project cost estimator: /${locale}/estimator
- Services overview: /${locale}#services
- AI & RAG solutions: /${locale}#ai
- Portfolio / past work: /${locale}#portfolio
- Blog: /${locale}/blog
- Get a quote / contact us: /${locale}#contact`;
}

function imageInstructionFor(inlineImages: ICoverImage[], keyword: string): string {
  if (inlineImages.length === 0) return '';
  const imgMarkdown = inlineImages.map((img, i) => `![${keyword} - illustration ${i + 1}](${img.url})`).join('\n');
  return `\nINLINE IMAGES — insert these naturally between sections (after roughly the 2nd and 4th major section, never at the very top or bottom):\n${imgMarkdown}`;
}

const SELF_REVIEW = (langName: string) =>
  `Before finalizing, silently check the draft: answer front-loaded in the first 2-3 sentences? ZERO invented statistics or fake URLs? none of the banned AI-slop phrases? 2-3 real internal links present with descriptive anchors? entirely in ${langName}? Then output ONLY the final polished Markdown post (start with the H1 title) — no preamble, notes, or explanation.`;

// ---------------------------------------------------------------------------
// Source-based prompt
// ---------------------------------------------------------------------------

export function buildSourcePrompt(
  sourceText: string,
  classification: SourceClassification,
  locale: string,
  inlineImages: ICoverImage[]
): { system: string; user: string } {
  const year = getCurrentYear();
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const blueprint = getBlueprintForFormat(classification.postFormat);
  const pillar = SERVICE_PILLARS.find(p => p.id === classification.category);
  const pillarName = pillar?.name ?? 'Software Development';
  const langName = LANG_NAME[locale] ?? 'English';

  const system = buildSystemPrompt(locale, pillarName);

  const user = `${langInstructionFor(locale)}

Write an ORIGINAL blog post in ${langName} inspired by the source material below. Do NOT copy it — add your own expert analysis. Suggested title: "${classification.title}"

SOURCE MATERIAL (real, extracted from the web — you MAY cite specific facts from it, in your own words; do NOT invent facts beyond it):
---
${sourceText.slice(0, 3000)}
---

FORMAT: ${blueprint.name} — tone: ${blueprint.tone}
TARGET LENGTH: ${blueprint.wordRange[0]}–${blueprint.wordRange[1]} words (depth over padding).

FRONT-LOAD THE ANSWER: ${blueprint.openingInstruction} Put the core takeaway in the first 2-3 sentences.

STRUCTURE:
${blueprint.structurePrompt}

FORMATTING:
${blueprint.formattingRules}
- H1 for the title, H2 for major sections, H3 for subsections.
- Finish with a short FAQ (3-5 real questions readers ask) — each question an H3 ending in "?".

SEO:
- Primary keyword "${classification.primaryKeyword}" used naturally 3-5 times (in the title and first paragraph too).
- Secondary keywords: ${classification.secondaryKeywords.map(k => `"${k}"`).join(', ')} — each 1-2 times.
- ${blueprint.seoHint}

${internalLinksBlock(locale)}

GUIDELINES:
- Reference the source, but add YOUR expert analysis and concrete, actionable steps for business owners.
- One subtle, natural CTA to work with Softwhere.uz.
- Only cite facts that appear in the source material above; never invent other statistics or URLs.

CONTEXT: Today is ${date}, ${year}. Audience: business owners and decision-makers in Uzbekistan and Central Asia. Softwhere.uz are ${pillarName} specialists.${imageInstructionFor(inlineImages, classification.primaryKeyword)}

${SELF_REVIEW(langName)}`;

  return { system, user };
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

export function buildTopicPrompt(topic: TopicResult, locale: string, inlineImages: ICoverImage[]): { system: string; user: string } {
  const blueprint = getBlueprintForFormat(topic.postFormat as PostFormat);
  const year = getCurrentYear();
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const langName = LANG_NAME[locale] ?? 'English';

  const system = buildSystemPrompt(locale, topic.pillarName);

  const user = `${langInstructionFor(locale)}

Write a blog post in ${langName} about: "${topic.title}"

FORMAT: ${blueprint.name} — tone: ${blueprint.tone}
TARGET LENGTH: ${blueprint.wordRange[0]}–${blueprint.wordRange[1]} words (depth over padding).

FRONT-LOAD THE ANSWER: ${blueprint.openingInstruction} Put the core answer/takeaway in the first 2-3 sentences.

STRUCTURE:
${blueprint.structurePrompt}

FORMATTING:
${blueprint.formattingRules}
- H1 for the title, H2 for major sections, H3 for subsections.
- Finish with a short FAQ (3-5 real questions readers ask) — each question an H3 ending in "?".

SEO:
- Primary keyword "${topic.primaryKeyword}" used naturally 3-5 times (in the title and first paragraph too).
- Secondary keywords: ${topic.secondaryKeywords.map(k => `"${k}"`).join(', ')} — each 1-2 times.
- Answer these queries directly: ${topic.targetQueries.map(q => `"${q}"`).join(', ')}.
- ${blueprint.seoHint}

${internalLinksBlock(locale)}

CONTEXT:
- Today is ${date}, ${year}. Audience: business owners and decision-makers in Uzbekistan and Central Asia (some international).
- Softwhere.uz are ${topic.pillarName} specialists — include one subtle, natural CTA to work with them.${imageInstructionFor(inlineImages, topic.primaryKeyword)}

${SELF_REVIEW(langName)}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Content generation
// ---------------------------------------------------------------------------

/** Returns the generated Markdown body, or null when generation fails / is too
 *  short (the caller then skips this locale — we never persist thin filler). */
export async function generateBlogContent(topic: TopicResult, locale: string, inlineImages: ICoverImage[]): Promise<string | null> {
  const { system, user } = buildTopicPrompt(topic, locale, inlineImages);

  logger.info(`Generating "${topic.postFormat}" content for "${topic.title}" in ${locale}`, undefined, 'BLOG');

  const content = await safeGenerateContent(user, `blog-${topic.postFormat}-${locale}`, undefined, system);
  const words = content ? wordCount(content) : 0;

  if (content && words >= WORD_FLOOR) {
    logger.info(`Generated ${words} words for ${locale}`, undefined, 'BLOG');
    return content;
  }

  logger.warn(`Content too short (${words}w) or missing for ${locale} — skipping locale`, undefined, 'BLOG');
  return null;
}

// ---------------------------------------------------------------------------
// Fallback content (kept for tooling; NOT auto-persisted by the route anymore)
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

The demand for ${topic.primaryKeyword} continues to grow, especially in emerging markets like Uzbekistan and Central Asia. Businesses investing in ${topic.pillarName.toLowerCase()} tend to see improvements in efficiency, customer engagement, and revenue.

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
// Meta description + localization
// ---------------------------------------------------------------------------

export async function generateMetaDescription(title: string, primaryKeyword: string, locale: string): Promise<string> {
  const prompt = `Write a 150-160 character meta description for a blog post titled "${title}". Include the keyword "${primaryKeyword}". Make it compelling and action-oriented. Write in ${LANG_NAME[locale] ?? 'English'}. Return ONLY the meta description.`;

  const result = await safeGenerateContent(prompt, `meta-desc-${locale}`, 200);
  if (result && result.length <= 200) return result.trim().replace(/^"|"$/g, '');

  return `${title} — Expert insights and practical advice from Softwhere.uz`;
}

export interface LocalizedMeta {
  title: string;
  metaDescription: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
}

/**
 * Localize title/meta/keywords for ru|uz in a SINGLE JSON call — adapting (not
 * word-for-word) and translating the keyword to what a native speaker would
 * actually search, so non-English posts target their own language's queries.
 */
export async function localizePostMeta(
  locale: 'ru' | 'uz',
  en: { title: string; metaDescription: string; primaryKeyword: string; secondaryKeywords: string[] }
): Promise<LocalizedMeta> {
  const langName = LANG_NAME[locale];
  const prompt = `Localize this blog metadata into ${langName} for a software company's blog. Adapt naturally (NOT word-for-word). Keep metaDescription under 160 characters. Translate the SEO keywords to the phrases a ${langName}-speaking user would actually type into search. Return ONLY JSON:
{"title":"...","metaDescription":"...","primaryKeyword":"...","secondaryKeywords":["...","..."]}

English title: "${en.title}"
English metaDescription: "${en.metaDescription}"
English primaryKeyword: "${en.primaryKeyword}"
English secondaryKeywords: ${JSON.stringify(en.secondaryKeywords)}`;

  const raw = await safeGenerateJSON(prompt, `localize-meta-${locale}`, 500);
  if (raw) {
    try {
      const p = JSON.parse(raw);
      const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().replace(/^"|"$/g, '') : fallback);
      return {
        title: str(p.title, en.title),
        metaDescription: str(p.metaDescription, en.metaDescription).slice(0, 180),
        primaryKeyword: str(p.primaryKeyword, en.primaryKeyword),
        secondaryKeywords: Array.isArray(p.secondaryKeywords)
          ? p.secondaryKeywords.filter((k: unknown): k is string => typeof k === 'string').slice(0, 6)
          : en.secondaryKeywords,
      };
    } catch {
      logger.warn(`Failed to parse localized meta for ${locale}`, undefined, 'BLOG');
    }
  }

  return {
    title: en.title,
    metaDescription: en.metaDescription,
    primaryKeyword: en.primaryKeyword,
    secondaryKeywords: en.secondaryKeywords,
  };
}

export { createSlug };
