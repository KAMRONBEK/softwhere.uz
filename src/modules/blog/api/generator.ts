import type { ICoverImage } from '@/modules/blog/model/BlogPost';
import { listRecentTopicInfo } from '@/modules/blog/model/posts.repository';
import { safeGenerateContent, safeGenerateJSON } from '@/core/ai';
import type { FactSheet } from '@/modules/blog/api/research';
import { logger } from '@/core/logger';
import { createSlug } from '@/shared/utils/slug';
import { clampMeta } from '@/modules/blog/utils/meta';
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

  const result = await safeGenerateJSON(prompt, 'source-classify', 600, undefined, { quality: true });

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

/** Structural section labels, localized. Hardcoded English labels ("Sources",
 *  "FAQ", "Key takeaways") leaked verbatim into published RU/UZ posts — the
 *  model copies whatever label the instruction hands it. */
const STRUCTURAL_LABELS: Record<string, { sources: string; faq: string; takeaways: string }> = {
  en: { sources: 'Sources', faq: 'FAQ', takeaways: 'Key takeaways' },
  ru: { sources: 'Источники', faq: 'Частые вопросы', takeaways: 'Ключевые выводы' },
  uz: { sources: 'Manbalar', faq: "Ko'p beriladigan savollar", takeaways: 'Asosiy xulosalar' },
};

const labelsFor = (locale: string) => STRUCTURAL_LABELS[locale] ?? STRUCTURAL_LABELS.en;

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
- Обращение на "вы". Цены и примеры локализуйте (Ташкент, суммы в USD и при уместности в сумах).
- НЕ выдумывайте статистику, проценты, множители или число выполненных проектов. Пример с цифрами явно помечайте как гипотетический ("предположим", "для примера").
- Ключевые термины и SEO-фразы пишите ПО-РУССКИ — не вставляйте английские фразы вроде "website speed optimization" в русский текст.`;
  }
  if (locale === 'uz') {
    return `
UZBEK STYLE (majburiy):
- Faqat LOTIN yozuvida yozing (kirillcha emas). O'quvchiga doim "Siz" deb murojaat qiling — hech qachon "sen" emas.
- Terminlar lug'ati (aynan shu shakllarda ishlating): veb-sayt, mobil ilova, dastur, sun'iy intellekt, ma'lumotlar bazasi, xavfsizlik, integratsiya, loyiha, tendensiya (tendentsiya EMAS), yechim (echim EMAS).
- Qisqa, aniq gaplar yozing. Shakldan ishonchingiz komil bo'lmasa, soddaroq konstruktsiyani tanlang. Ruscha va inglizcha kalkalardan qoching.
- Statistika, foizlar yoki bajarilgan loyihalar sonini O'YLAB TOPMANG. Raqamli misolni aniq faraziy deb belgilang ("faraz qilaylik", "misol uchun").
- Sarlavhalar oddiy gap ko'rinishida bo'lsin (Har So'z Bosh Harf Bilan EMAS) va sarlavhalarda inglizcha so'zlar ("vs", "Apps", "Cross-Platform") ishlatilmasin.
- Kompaniya, mahsulot va to'lov tizimlarining faqat REAL nomlarini yozing — O'zbekistonda to'lov tizimlari: Payme, Click, Uzum, Paynet.`;
  }
  return '';
}

/** The persona + hard quality/honesty rules — sent as the SYSTEM message. */
function buildSystemPrompt(locale: string, pillarName: string): string {
  const langLine = locale === 'ru' ? ' Вы пишете на русском языке.' : locale === 'uz' ? " Siz o'zbek tilida yozasiz." : '';
  // The everyday word for "AI" differs per language — an English "AI" left in
  // Cyrillic/Uzbek prose reads as un-localized AND misses the term natives
  // actually search (ИИ / sun'iy intellekt).
  const aiTerm =
    locale === 'ru'
      ? 'say "ИИ" (Cyrillic — never leave the Latin "AI" in Russian text)'
      : locale === 'uz'
        ? `say "sun'iy intellekt" (do not leave the English "AI" untranslated)`
        : 'say "AI"';
  return `You write as the senior engineer-founder of Softwhere.uz — a small product-engineering studio in Tashkent, Uzbekistan that ships mobile apps, web platforms, AI systems, Telegram bots, and CRM/ERP for businesses across Central Asia and internationally (${pillarName} is your focus here). First person plural ("we"). You have opinions from shipping real products: state at least one mild, defensible disagreement with common industry advice per post. Every abstract claim is followed by something concrete — an example, a number from the verified facts, or a named tool.${langLine}

NON-NEGOTIABLE RULES:
- Statistics, survey results, market sizes, and named studies may come ONLY from the VERIFIED FACTS block in the task (cite them as markdown links to their source URL). If no fact covers a point, describe it qualitatively or frame an example as clearly hypothetical ("a typical mid-size retailer might spend..."). NEVER invent numbers, sources, dates, client names, or URLs.
- Never tie a quality judgment to an absolute dollar floor ("below $X you're getting a thin wrapper") — such claims cannot be true for every market at once. Frame quality caveats by scope and team, not price.
- The ONLY URLs allowed in the post: verified fact sources, the internal links provided, and the provided image URLs. No other links.
- Write from engineering experience and first-principles reasoning, not from summarizing the web.
- BANNED AI-slop words/patterns: delve, tapestry, testament, pivotal, crucial, underscore, vibrant, seamless, game-changer, "in today's world", "navigating the landscape", "unlock/unleash the power", "when it comes to", "it's worth noting", "in conclusion", the "not just X, but Y" construction, and mechanical rule-of-three lists. Prefer plain verbs (is, are, build, ship) over "serves as / stands as". Sentence-case headings only.
- PLAIN LANGUAGE for a non-technical business audience: ${aiTerm} — never "LLM", "RAG", "GPT", "vector database", "embeddings", or similar insider terms. If a technical concept is genuinely needed, describe what it does in everyday words ("an AI assistant that answers from your company's own documents") instead of naming the technology. Framework/tool names (React, Telegram, 1C) are fine when relevant.
- Vary rhythm: mix paragraph lengths (1-6 sentences), allow an occasional one-sentence paragraph, don't overuse bold, em dashes, or bolded-colon bullet lists.
- Be concrete: name real technologies and realistic timelines/effort (in weeks), give worked examples, and answer the reader's actual question fast.${localeStyleBlock(locale)}`;
}

/** How the writer includes a data visualization: a fenced \`\`\`chart block of
 *  plain Chart.js v2 JSON. The pipeline converts it to a chart image
 *  deterministically — the model never URL-encodes anything itself (the old
 *  encode-it-yourself instruction produced zero charts in live posts). */
function chartBlockInstruction(sourceOfNumbers: string): string {
  return `DATA VISUALIZATION — REQUIRED (exactly one chart per post): visualize ${sourceOfNumbers} as a fenced code block:
\`\`\`chart
{"type":"bar","caption":"<one-line caption in the post's language>","data":{"labels":["..."],"datasets":[{"label":"...","data":[1,2,3]}]}}
\`\`\`
Rules: plain Chart.js v2 JSON (do NOT URL-encode) plus a "caption" key; it is converted to a chart image automatically. Pick the honest form for the data: "bar" for comparisons, "line" for trends over time, "doughnut" for shares of a whole (e.g. a cost breakdown). All labels and the caption in the post's language. Place it next to the section discussing those numbers — never at the very top or bottom. Only skip the chart if the post genuinely contains no comparable numbers at all (then use a markdown comparison table instead).`;
}

/** The grounding contract: the writer sees exactly which facts are citable. */
function factsBlock(factSheet: FactSheet | undefined, locale: string): string {
  const labels = labelsFor(locale);
  if (!factSheet || factSheet.facts.length === 0) {
    return `VERIFIED FACTS: none available for this topic. Therefore the post must contain ZERO statistics, market numbers, or named studies — write qualitatively, use clearly-hypothetical worked examples, and skip any "## ${labels.sources}" section.

${chartBlockInstruction("the worked example's own hypothetical figures (e.g. its cost breakdown as a doughnut, or timeline by phase as a bar chart); the caption MUST say it is an illustrative example, since there are no verified facts")}`;
  }
  const lines = factSheet.facts.map(f => `- [${f.id}] ${f.statement}${f.year ? ` (${f.year})` : ''} — ${f.sourceName}: ${f.sourceUrl}`);
  return `VERIFIED FACTS — the ONLY statistics/studies you may cite. Use 2-5 of the most relevant ones, in your own words, each cited inline as [${'Source Name'}](url):
${lines.join('\n')}

${chartBlockInstruction("the verified facts when 3+ share a comparable dimension (costs by tier, rates by region, shares by platform, adoption by year) — plot ONLY numbers from the verified facts and name the source(s) in the caption; if the facts do not chart, visualize the worked example's hypothetical figures instead with a caption saying it is an illustrative example")}

End the post with a "## ${labels.sources}" section listing ONLY the facts you actually cited (format: "- [Source Name](url) — what it supports"). Do not list uncited sources.`;
}

/** Answer-first skeleton — serves skimming humans and answer engines alike. */
const answerFirstBlock = (locale: string) => `READER-FIRST STRUCTURE:
- First paragraph: answer the title's question directly in 2-3 sentences (no throat-clearing, no "in this article we will").
- Immediately after, a "**${labelsFor(locale).takeaways}**" blockquote with 3-5 specific one-line takeaways (real numbers/decisions, not platitudes).
- Phrase H2 headings as the natural questions readers ask, where it fits.
- Include exactly one worked example with concrete figures (scope, timeline in weeks, cost range in USD) — clearly hypothetical unless supported by a verified fact.`;

/** Real internal links the model may use (locale-prefixed). No placeholders. */
function internalLinksBlock(locale: string): string {
  return `INTERNAL LINKS — include 2-3 where they genuinely fit the sentence, as real Markdown links with descriptive anchor text (NEVER placeholder text like "[related service]"):
- Project cost estimator: /${locale}/estimator
- Services overview: /${locale}#services
- AI solutions: /${locale}#ai
- Portfolio / past work: /${locale}#portfolio
- Blog: /${locale}/blog
- Get a quote / contact us: /${locale}#contact`;
}

function imageInstructionFor(inlineImages: ICoverImage[], locale: string): string {
  if (inlineImages.length === 0) return '';
  // The alt text renders as a VISIBLE figcaption, so it must be written in the
  // post's language — an English keyword caption on a RU/UZ page reads broken
  // and wastes the image-SEO signal.
  const langName = LANG_NAME[locale] ?? 'English';
  const imgList = inlineImages.map((img, i) => `${i + 1}. ${img.url}`).join('\n');
  return `\nINLINE IMAGES — insert these ${inlineImages.length} image(s) naturally between sections (after roughly the 2nd and 4th major section, never at the very top or bottom). For each, write YOUR OWN short 2-6 word ${langName} caption describing what the figure illustrates in context — it becomes the visible caption, so never paste an English keyword or the word "illustration":\n${imgList}\nFormat: ![your ${langName} caption](the image URL exactly as given)`;
}

const SELF_REVIEW = (locale: string) => {
  const langName = LANG_NAME[locale] ?? 'English';
  return `Before finalizing, silently check the draft: answer front-loaded in the first 2-3 sentences? "${labelsFor(locale).takeaways}" box present? exactly one \`\`\`chart block present (valid JSON, caption in ${langName})? every statistic traceable to a VERIFIED FACT with its link (and zero invented numbers/URLs)? none of the banned AI-slop phrases? 2-3 real internal links present with descriptive anchors? entirely in ${langName} (headings, image captions, and section labels included)? Then output ONLY the final polished Markdown post (start with the H1 title) — no preamble, notes, or explanation.`;
};

// ---------------------------------------------------------------------------
// Source-based prompt
// ---------------------------------------------------------------------------

export function buildSourcePrompt(
  sourceText: string,
  classification: SourceClassification,
  locale: string,
  inlineImages: ICoverImage[],
  factSheet?: FactSheet,
  anchor?: string
): { system: string; user: string } {
  const year = getCurrentYear();
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const blueprint = getBlueprintForFormat(classification.postFormat);
  const pillar = SERVICE_PILLARS.find(p => p.id === classification.category);
  const pillarName = pillar?.name ?? 'Software Development';
  const langName = LANG_NAME[locale] ?? 'English';
  const labels = labelsFor(locale);

  const system = buildSystemPrompt(locale, pillarName);

  const user = `${langInstructionFor(locale)}

Write an ORIGINAL blog post in ${langName} inspired by the source material below. Do NOT copy it — add your own expert analysis. Suggested title: "${classification.title}"

SOURCE MATERIAL (real, extracted from the web — you MAY cite specific facts from it, in your own words; do NOT invent facts beyond it):
---
${sourceText.slice(0, 3000)}
---

${factsBlock(factSheet, locale)}

FORMAT: ${blueprint.name} — tone: ${blueprint.tone}
TARGET LENGTH: ${blueprint.wordRange[0]}–${blueprint.wordRange[1]} words (depth over padding).

FRONT-LOAD THE ANSWER: ${blueprint.openingInstruction}

${answerFirstBlock(locale)}

STRUCTURE:
${blueprint.structurePrompt}

FORMATTING:
${blueprint.formattingRules}
- H1 for the title, H2 for major sections, H3 for subsections.
- Finish with a short "${labels.faq}" section (3-5 real questions readers ask) — each question an H3 ending in "?".

SEO:
- Primary keyword "${classification.primaryKeyword}" used naturally 3-5 times (in the title and first paragraph too).
- Secondary keywords: ${classification.secondaryKeywords.map(k => `"${k}"`).join(', ')} — each 1-2 times.
- ${blueprint.seoHint}

${internalLinksBlock(locale)}
${anchor ? `\n${anchor}\n` : ''}
GUIDELINES:
- Reference the source, but add YOUR expert analysis and concrete, actionable steps for business owners.
- Close with one natural CTA: the reader can get a project cost range in ~2 minutes with the estimator at /${locale}/estimator, or contact Softwhere.uz.
- Beyond the source material and verified facts, never state statistics or URLs.

CONTEXT: Today is ${date}, ${year}. Audience: business owners and decision-makers in Uzbekistan and Central Asia. Softwhere.uz are ${pillarName} specialists.${imageInstructionFor(inlineImages, locale)}

${SELF_REVIEW(locale)}`;

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
  factSheet?: FactSheet,
  anchor?: string
): { system: string; user: string } {
  const blueprint = getBlueprintForFormat(topic.postFormat as PostFormat);
  const year = getCurrentYear();
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const langName = LANG_NAME[locale] ?? 'English';
  const labels = labelsFor(locale);

  const system = buildSystemPrompt(locale, topic.pillarName);

  const user = `${langInstructionFor(locale)}

Write a blog post in ${langName} about: "${topic.title}"

${factsBlock(factSheet, locale)}

FORMAT: ${blueprint.name} — tone: ${blueprint.tone}
TARGET LENGTH: ${blueprint.wordRange[0]}–${blueprint.wordRange[1]} words (depth over padding).

FRONT-LOAD THE ANSWER: ${blueprint.openingInstruction}

${answerFirstBlock(locale)}

STRUCTURE:
${blueprint.structurePrompt}

FORMATTING:
${blueprint.formattingRules}
- H1 for the title, H2 for major sections, H3 for subsections.
- Finish with a short "${labels.faq}" section (3-5 real questions readers ask) — each question an H3 ending in "?".

SEO:
- Primary keyword "${topic.primaryKeyword}" used naturally 3-5 times (in the title and first paragraph too).
- Secondary keywords: ${topic.secondaryKeywords.map(k => `"${k}"`).join(', ')} — each 1-2 times.
- Answer these queries directly: ${topic.targetQueries.map(q => `"${q}"`).join(', ')}.
- ${blueprint.seoHint}

${internalLinksBlock(locale)}
${anchor ? `\n${anchor}\n` : ''}
CONTEXT:
- Today is ${date}, ${year}. Audience: business owners and decision-makers in Uzbekistan and Central Asia (some international).
- Softwhere.uz are ${topic.pillarName} specialists — close with one natural CTA: get a project cost range in ~2 minutes with the estimator at /${locale}/estimator, or contact us.${imageInstructionFor(inlineImages, locale)}

${SELF_REVIEW(locale)}`;

  return { system, user };
}

// ---------------------------------------------------------------------------
// Content generation
// ---------------------------------------------------------------------------

// Drafting itself lives in @/modules/blog/api/pipeline (producePostContent),
// which both the API route and the CLI share — this module only builds
// prompts and parses model output, so the two entry points cannot drift.

// ---------------------------------------------------------------------------
// Cross-locale anchor + continuation + proofread prompts
// ---------------------------------------------------------------------------

/**
 * Distill the (already-produced) EN draft into a structural anchor for the
 * ru/uz generations. Without it each locale is an independent article: live
 * posts diverged in sections, examples, POV — and quoted the same service at
 * 3-8× different prices across languages. The anchor carries the EN outline
 * plus every money figure so the localized variants adapt one piece instead
 * of inventing another.
 */
export function buildEnAnchorBlock(enContent: string): string {
  const headings = (enContent.match(/^#{2,3}\s+.+$/gm) ?? []).slice(0, 24);
  if (headings.length === 0) return '';
  const figureLines = enContent
    .split('\n')
    .filter(l => /\$\s?\d/.test(l) && !l.trim().startsWith('!'))
    .slice(0, 8)
    .map(l => `- ${l.trim().slice(0, 180)}`);
  return `CROSS-LOCALE CONSISTENCY — this post is the localized adaptation of an English original. Keep the SAME section structure (adapt the wording naturally — do NOT translate headings word-for-word), the SAME single worked example with the SAME figures, and the SAME stated opinions. Localize the context (language, local examples, payment providers like Payme/Click/Uzum where relevant) — never invent different numbers, drop sections, or change the article's position.
English outline:
${headings.join('\n')}${figureLines.length > 0 ? `\nKey figures from the original (keep these consistent):\n${figureLines.join('\n')}` : ''}`;
}

/**
 * One continuation call for a draft that hit the completion cap (DeepSeek
 * truncates silently at 8K — live UZ posts shipped ending mid-word). The
 * incomplete final fragment is passed as context to be rewritten in full.
 */
export function buildContinuationPrompt(completedBody: string, fragment: string, locale: string): string {
  const langName = LANG_NAME[locale] ?? 'English';
  const tail = completedBody.slice(-1200);
  return `The ${langName} Markdown blog post you are finishing was cut off mid-generation. Below are its final complete paragraphs${fragment ? ' and the incomplete fragment it stopped inside' : ''}.

Write ONLY the continuation, in ${langName}: ${fragment ? 'first rewrite the interrupted thought as full sentences, then ' : ''}finish the remaining sections (complete the FAQ if unfinished) and end with one short closing CTA paragraph. Do NOT repeat any earlier text, do NOT restart the post, no headings that already exist, no commentary.

POST ENDING (context — do not repeat):
---
${tail}
---
${fragment ? `\nINCOMPLETE FRAGMENT to rewrite in full:\n---\n${fragment}\n---` : ''}`;
}

/**
 * Final native-editor pass (deep mode): live posts shipped with spelling and
 * wrong-idiom errors in all three locales ("сентяблю", "топите воду",
 * "mijordan", "a isolated feature") that no deterministic lint can catch.
 */
export function buildProofreadPrompt(draft: string, locale: string): string {
  const langName = LANG_NAME[locale] ?? 'English';
  const uzNote = locale === 'uz' ? " Standard Uzbek orthography: 'tendensiya' (not 'tendentsiya'), 'yechim' (not 'echim'), 'mijoz'." : '';
  return `You are a meticulous native ${langName} proofreader. Correct ONLY spelling, grammar, typo, and wrong-idiom errors in the Markdown post below. PRESERVE the meaning, structure, headings, every URL and image reference, all facts and numbers, and the overall wording — do NOT rewrite, shorten, expand, or restyle anything that is not an outright language error.${uzNote}

POST:
---
${draft}
---

Output ONLY the corrected, complete Markdown post (starting with the H1). No commentary.`;
}

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
5. LANGUAGE: wrong language, mixed languages, or (for Uzbek) Cyrillic script or "sen" register.${
    locale === 'uz'
      ? `
6. UZBEK INTEGRITY: garbled or non-Uzbek words, meta-commentary scaffolding ("...keltiraman", "faraziy ravishda..." sentences that promise data and deliver none), and invented product/company names — the real local payment providers are Payme, Click, Uzum, Paynet only.`
      : ''
  }

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

  const result = await safeGenerateContent(prompt, `meta-desc-${locale}`, 200, undefined, { quality: true });
  // Google truncates around ~160 chars; clamp on a word/sentence boundary
  // instead of shipping a mid-word cut into the SERP snippet.
  if (result) return clampMeta(result.trim().replace(/^"|"$/g, ''));

  return clampMeta(`${title} — Expert insights and practical advice from Softwhere.uz`);
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
  const prompt = `Localize this blog metadata into ${langName} for a software company's blog. Adapt naturally (NOT word-for-word). Keep the title UNDER 60 characters with the primary keyword front-loaded (the page appends a " | SoftWhere.uz Blog" suffix, and search engines truncate longer titles). Write the metaDescription as 140-160 characters. Translate the SEO keywords to the phrases a ${langName}-speaking user would actually type into search. Return ONLY JSON:
{"title":"...","metaDescription":"...","primaryKeyword":"...","secondaryKeywords":["...","..."]}

English title: "${en.title}"
English metaDescription: "${en.metaDescription}"
English primaryKeyword: "${en.primaryKeyword}"
English secondaryKeywords: ${JSON.stringify(en.secondaryKeywords)}`;

  const raw = await safeGenerateJSON(prompt, `localize-meta-${locale}`, 500, undefined, { quality: true });
  if (raw) {
    try {
      const p = JSON.parse(raw);
      const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().replace(/^"|"$/g, '') : fallback);
      const title = str(p.title, en.title);
      if (title.length > 65) logger.warn(`Localized ${locale} title exceeds 60 chars (${title.length}): "${title}"`, undefined, 'BLOG');
      return {
        title,
        metaDescription: clampMeta(str(p.metaDescription, en.metaDescription)),
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
