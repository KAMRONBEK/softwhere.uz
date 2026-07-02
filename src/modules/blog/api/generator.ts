import type { ICoverImage } from '@/modules/blog/model/BlogPost';
import { listRecentTopicInfo } from '@/modules/blog/model/posts.repository';
import { safeGenerateContent, safeGenerateJSON } from '@/core/ai';
import type { FactSheet } from '@/modules/blog/api/research';
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

/** Locale-specific style guardrails appended to the system prompt. The ru
 *  list mirrors ru-Wikipedia's "signs of generated text"; the uz block exists
 *  because LLM Uzbek fails most on register (sen/siz) and script drift. */
function localeStyleBlock(locale: string): string {
  if (locale === 'ru') {
    return `
RUSSIAN STYLE (обязательно):
- Пишите как живой практик, разговорно-профессионально, без канцелярита.
- ЗАПРЕЩЕНО: "важно отметить", "стоит отметить", "играет ключевую/важную роль", "в современном мире", "является неотъемлемой частью", "подчеркивает важность", отдельный раздел "Заключение", заголовки С Заглавной Каждой Буквы.
- Обращение на "вы". Цены и примеры локализуйте (Ташкент, суммы в USD и при уместности в сумах).`;
  }
  if (locale === 'uz') {
    return `
UZBEK STYLE (majburiy):
- Faqat LOTIN yozuvida yozing (kirillcha emas). O'quvchiga doim "Siz" deb murojaat qiling — hech qachon "sen" emas.
- Terminlar lug'ati (aynan shu shakllarda ishlating): veb-sayt, mobil ilova, dastur, sun'iy intellekt, ma'lumotlar bazasi, xavfsizlik, integratsiya, loyiha.
- Qisqa, aniq gaplar yozing. Shakldan ishonchingiz komil bo'lmasa, soddaroq konstruktsiyani tanlang. Ruscha va inglizcha kalkalardan qoching.`;
  }
  return '';
}

/** The persona + hard quality/honesty rules — sent as the SYSTEM message. */
function buildSystemPrompt(locale: string, pillarName: string): string {
  const langLine = locale === 'ru' ? ' Вы пишете на русском языке.' : locale === 'uz' ? " Siz o'zbek tilida yozasiz." : '';
  return `You write as the senior engineer-founder of Softwhere.uz — a small product-engineering studio in Tashkent, Uzbekistan that ships mobile apps, web platforms, AI/RAG systems, Telegram bots, and CRM/ERP for businesses across Central Asia and internationally (${pillarName} is your focus here). First person plural ("we"). You have opinions from shipping real products: state at least one mild, defensible disagreement with common industry advice per post. Every abstract claim is followed by something concrete — an example, a number from the verified facts, or a named tool.${langLine}

NON-NEGOTIABLE RULES:
- Statistics, survey results, market sizes, and named studies may come ONLY from the VERIFIED FACTS block in the task (cite them as markdown links to their source URL). If no fact covers a point, describe it qualitatively or frame an example as clearly hypothetical ("a typical mid-size retailer might spend..."). NEVER invent numbers, sources, dates, client names, or URLs.
- The ONLY URLs allowed in the post: verified fact sources, the internal links provided, and the provided image URLs. No other links.
- Write from engineering experience and first-principles reasoning, not from summarizing the web.
- BANNED AI-slop words/patterns: delve, tapestry, testament, pivotal, crucial, underscore, vibrant, seamless, game-changer, "in today's world", "navigating the landscape", "unlock/unleash the power", "when it comes to", "it's worth noting", "in conclusion", the "not just X, but Y" construction, and mechanical rule-of-three lists. Prefer plain verbs (is, are, build, ship) over "serves as / stands as". Sentence-case headings only.
- Vary rhythm: mix paragraph lengths (1-6 sentences), allow an occasional one-sentence paragraph, don't overuse bold, em dashes, or bolded-colon bullet lists.
- Be concrete: name real technologies and realistic timelines/effort (in weeks), give worked examples, and answer the reader's actual question fast.${localeStyleBlock(locale)}`;
}

/** The grounding contract: the writer sees exactly which facts are citable. */
function factsBlock(factSheet: FactSheet | undefined): string {
  if (!factSheet || factSheet.facts.length === 0) {
    return `VERIFIED FACTS: none available for this topic. Therefore the post must contain ZERO statistics, market numbers, or named studies — write qualitatively, use clearly-hypothetical worked examples, and skip any "## Sources" section.`;
  }
  const lines = factSheet.facts.map(f => `- [${f.id}] ${f.statement}${f.year ? ` (${f.year})` : ''} — ${f.sourceName}: ${f.sourceUrl}`);
  return `VERIFIED FACTS — the ONLY statistics/studies you may cite. Use 2-5 of the most relevant ones, in your own words, each cited inline as [${'Source Name'}](url):
${lines.join('\n')}

End the post with a "## Sources" section listing ONLY the facts you actually cited (format: "- [Source Name](url) — what it supports"). Do not list uncited sources.`;
}

/** Answer-first skeleton — serves skimming humans and answer engines alike. */
const ANSWER_FIRST = `READER-FIRST STRUCTURE:
- First paragraph: answer the title's question directly in 2-3 sentences (no throat-clearing, no "in this article we will").
- Immediately after, a "**Key takeaways**" blockquote with 3-5 specific one-line takeaways (real numbers/decisions, not platitudes).
- Phrase H2 headings as the natural questions readers ask, where it fits.
- Include exactly one worked example with concrete figures (scope, timeline in weeks, cost range in USD) — clearly hypothetical unless supported by a verified fact.`;

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
  `Before finalizing, silently check the draft: answer front-loaded in the first 2-3 sentences? Key-takeaways box present? every statistic traceable to a VERIFIED FACT with its link (and zero invented numbers/URLs)? none of the banned AI-slop phrases? 2-3 real internal links present with descriptive anchors? entirely in ${langName}? Then output ONLY the final polished Markdown post (start with the H1 title) — no preamble, notes, or explanation.`;

// ---------------------------------------------------------------------------
// Source-based prompt
// ---------------------------------------------------------------------------

export function buildSourcePrompt(
  sourceText: string,
  classification: SourceClassification,
  locale: string,
  inlineImages: ICoverImage[],
  factSheet?: FactSheet
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

${factsBlock(factSheet)}

FORMAT: ${blueprint.name} — tone: ${blueprint.tone}
TARGET LENGTH: ${blueprint.wordRange[0]}–${blueprint.wordRange[1]} words (depth over padding).

FRONT-LOAD THE ANSWER: ${blueprint.openingInstruction}

${ANSWER_FIRST}

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
- Close with one natural CTA: the reader can get a project cost range in ~2 minutes with the estimator at /${locale}/estimator, or contact Softwhere.uz.
- Beyond the source material and verified facts, never state statistics or URLs.

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
  const recentPosts = await listRecentTopicInfo(30);

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

export function buildTopicPrompt(
  topic: TopicResult,
  locale: string,
  inlineImages: ICoverImage[],
  factSheet?: FactSheet
): { system: string; user: string } {
  const blueprint = getBlueprintForFormat(topic.postFormat as PostFormat);
  const year = getCurrentYear();
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const langName = LANG_NAME[locale] ?? 'English';

  const system = buildSystemPrompt(locale, topic.pillarName);

  const user = `${langInstructionFor(locale)}

Write a blog post in ${langName} about: "${topic.title}"

${factsBlock(factSheet)}

FORMAT: ${blueprint.name} — tone: ${blueprint.tone}
TARGET LENGTH: ${blueprint.wordRange[0]}–${blueprint.wordRange[1]} words (depth over padding).

FRONT-LOAD THE ANSWER: ${blueprint.openingInstruction}

${ANSWER_FIRST}

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
- Softwhere.uz are ${topic.pillarName} specialists — close with one natural CTA: get a project cost range in ~2 minutes with the estimator at /${locale}/estimator, or contact us.${imageInstructionFor(inlineImages, topic.primaryKeyword)}

${SELF_REVIEW(langName)}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Content generation
// ---------------------------------------------------------------------------

// Drafting itself lives in @/modules/blog/api/pipeline (producePostContent),
// which both the API route and the CLI share — this module only builds
// prompts and parses model output, so the two entry points cannot drift.

// ---------------------------------------------------------------------------
// Cross-model critique (deep pipeline only)
// ---------------------------------------------------------------------------

/**
 * Rubric for the critique pass. Run it on the OTHER provider than the one
 * that drafted (same-model self-refinement reward-hacks its own weaknesses).
 * Returns a JSON issue list the revision call can apply surgically.
 */
export function buildCritiquePrompt(draft: string, locale: string, factSheet?: FactSheet): { system: string; user: string } {
  const facts =
    factSheet && factSheet.facts.length > 0
      ? factSheet.facts.map(f => `- [${f.id}] ${f.statement} — ${f.sourceUrl}`).join('\n')
      : '(none — the draft must contain NO statistics or external citations at all)';

  const system = `You are a ruthless blog editor reviewing a draft for a software agency in Tashkent. You review against a fixed rubric and return JSON only. You are precise: you quote the exact problematic text and propose a concrete fix. You do NOT invent problems — an empty list is a valid answer.`;

  const user = `Review this ${LANG_NAME[locale] ?? 'English'} draft against the rubric. Return ONLY JSON:
{"issues":[{"type":"fabrication|slop|opening|vague|language","excerpt":"exact quoted text","fix":"concrete instruction"}]}

RUBRIC:
1. FABRICATION (most important): every statistic, market number, or named study must match one of the verified facts below (and link to its URL). Flag any number or citation that does not — unless it is clearly framed as hypothetical.
2. SLOP: generic AI phrasing, filler transitions, uniform paragraph rhythm, empty significance claims.
3. OPENING: the first paragraph must directly answer the title's question; flag throat-clearing.
4. VAGUE: abstract claims with no example, number, or named tool behind them (flag only the worst 2-3).
5. LANGUAGE: wrong language, mixed languages, or (for Uzbek) Cyrillic script or "sen" register.

VERIFIED FACTS:
${facts}

DRAFT:
---
${draft}
---

Max 8 issues, most severe first. JSON only.`;

  return { system, user };
}

export interface CritiqueIssue {
  type: string;
  excerpt: string;
  fix: string;
}

export function parseCritique(raw: string | null): CritiqueIssue[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.issues)) return [];
    return parsed.issues
      .filter((i: unknown): i is Record<string, unknown> => !!i && typeof i === 'object')
      .map((i: Record<string, unknown>) => ({
        type: String(i.type ?? 'other'),
        excerpt: String(i.excerpt ?? '').slice(0, 300),
        fix: String(i.fix ?? '').slice(0, 300),
      }))
      .filter((i: CritiqueIssue) => i.excerpt || i.fix)
      .slice(0, 8);
  } catch {
    logger.warn('Failed to parse critique JSON', undefined, 'BLOG');
    return [];
  }
}

/** Apply critique surgically — same contract as the lint revision. */
export function buildCritiqueRevisionPrompt(draft: string, issues: CritiqueIssue[], locale: string): string {
  const list = issues.map((i, n) => `${n + 1}. [${i.type}] "${i.excerpt}" → ${i.fix}`).join('\n');
  return `Revise the draft below by fixing ONLY these editor notes — do not restructure or rewrite anything else. Keep the language (${LANG_NAME[locale] ?? 'English'}), length, headings, links, and images intact except where a note requires a change. For fabrication notes: remove the number/citation or reframe as clearly hypothetical.

EDITOR NOTES:
${list}

DRAFT:
---
${draft}
---

Output ONLY the corrected, complete Markdown post (starting with the H1). No commentary.`;
}

// ---------------------------------------------------------------------------
// Meta description + localization
// ---------------------------------------------------------------------------

export async function generateMetaDescription(title: string, primaryKeyword: string, locale: string): Promise<string> {
  const prompt = `Write a 150-160 character meta description for a blog post titled "${title}". Include the keyword "${primaryKeyword}". Make it compelling and action-oriented. Write in ${LANG_NAME[locale] ?? 'English'}. Return ONLY the meta description.`;

  const result = await safeGenerateContent(prompt, `meta-desc-${locale}`, 200);
  // Google truncates around ~160 chars; clamp instead of shipping overlong.
  if (result) return result.trim().replace(/^"|"$/g, '').slice(0, 160);

  return `${title} — Expert insights and practical advice from Softwhere.uz`.slice(0, 160);
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
        metaDescription: str(p.metaDescription, en.metaDescription).slice(0, 160),
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
