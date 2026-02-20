/**
 * Fix & heal all blog posts: enforce structure, fill missing fields,
 * deduplicate covers/titles/content, inject inline images.
 *
 * Usage:
 *   1. Pull production env:  yarn env:pull:production
 *   2. Run:                  npx tsx scripts/regenerate-posts.ts [flags]
 *
 * Flags:
 *   --dry-run         Report issues without writing to DB
 *   --analyze-only    Only run analysis phase, print report, exit
 *   --resume          Skip groups that already have zero detected issues
 *   --force           Process every group even if it looks healthy
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import {
  findDuplicateCovers,
  findSimilarTitles,
  findSimilarContent,
} from './lib/similarity';
import {
  analyzeGroup,
  countIssues,
  type GroupAnalysis,
  type PostDoc,
  SERVICE_PILLARS,
  POST_FORMATS,
  type PostFormat,
} from './lib/post-structure';

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
const TEMPERATURE = 0.7;
const UNSPLASH_API = 'https://api.unsplash.com';

const DRY_RUN = process.argv.includes('--dry-run');
const ANALYZE_ONLY = process.argv.includes('--analyze-only');
const RESUME = process.argv.includes('--resume');
const FORCE = process.argv.includes('--force');

// ---------------------------------------------------------------------------
// Mongoose model (inline to avoid @/ alias issues)
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
  { timestamps: true },
);

const BlogPost = mongoose.models.BlogPost || mongoose.model('BlogPost', BlogPostSchema);

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generate(prompt: string, label: string, maxTokens?: number): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await ai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE,
        ...(maxTokens && { max_tokens: maxTokens }),
      });
      return res.choices[0]?.message?.content ?? null;
    } catch (err: unknown) {
      const status = (err as Record<string, unknown>).status;
      if (status === 429) {
        console.log(`  ⏳ Rate limited on ${label}, waiting 60s...`);
        await sleep(60_000);
        continue;
      }
      console.error(`  ❌ AI error (${attempt}/2) ${label}:`, (err as Error).message);
      if (attempt === 2) return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Topic classification
// ---------------------------------------------------------------------------

const PILLAR_NAMES: Record<string, string> = {
  'mobile-app-development': 'Mobile App Development',
  'mvp-startup': 'MVP & Startup Development',
  'ai-solutions': 'AI Solutions',
  'web-app-development': 'Web Application Development',
  'telegram-bot-development': 'Telegram Bot Development',
  'crm-development': 'CRM Development',
  'business-automation': 'Business Automation',
  'saas-development': 'SaaS Development',
  outsourcing: 'IT Outsourcing',
  'project-rescue': 'Project Rescue',
  ecommerce: 'E-commerce Solutions',
  'ui-ux-design': 'UI/UX Design',
  'maintenance-support': 'Maintenance & Support',
  cybersecurity: 'Cybersecurity',
};

interface TopicInfo {
  title: string;
  category: string;
  pillarName: string;
  postFormat: PostFormat;
  primaryKeyword: string;
  secondaryKeywords: string[];
}

async function classifyPost(title: string): Promise<TopicInfo> {
  const prompt = `Analyze this blog post title and classify it. Return ONLY valid JSON, no markdown fences.

Title: "${title}"

Return JSON:
{
  "category": "one of: ${SERVICE_PILLARS.join(', ')}",
  "postFormat": "one of: ${POST_FORMATS.join(', ')}",
  "primaryKeyword": "main SEO keyword (2-4 words)",
  "secondaryKeywords": ["kw1", "kw2", "kw3"]
}

Pick the category that best matches how a software development company would cover this topic.`;

  const result = await generate(prompt, 'classify', 500);
  if (result) {
    try {
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      const category = SERVICE_PILLARS.includes(parsed.category) ? parsed.category : 'web-app-development';
      return {
        title,
        category,
        pillarName: PILLAR_NAMES[category] ?? 'Software Development',
        postFormat: (POST_FORMATS as readonly string[]).includes(parsed.postFormat) ? (parsed.postFormat as PostFormat) : 'beginner-guide',
        primaryKeyword: parsed.primaryKeyword || title.toLowerCase().slice(0, 60),
        secondaryKeywords: Array.isArray(parsed.secondaryKeywords) ? parsed.secondaryKeywords.slice(0, 5) : [],
      };
    } catch { /* fall through */ }
  }
  return {
    title,
    category: 'web-app-development',
    pillarName: 'Software Development',
    postFormat: 'beginner-guide',
    primaryKeyword: title.toLowerCase().slice(0, 60),
    secondaryKeywords: [],
  };
}

// ---------------------------------------------------------------------------
// Blueprint data
// ---------------------------------------------------------------------------

interface Blueprint {
  name: string;
  wordRange: [number, number];
  tone: string;
  openingInstruction: string;
  structurePrompt: string;
  formattingRules: string;
  seoHint: string;
}

const BLUEPRINTS: Record<string, Blueprint> = {
  'cost-guide': { name: 'Cost / Pricing Guide', wordRange: [2000, 2500], tone: 'transparent, helpful, and direct — like a consultant giving honest advice', openingInstruction: 'Start with "The short answer is $X–$Y. But the real answer depends on..." Give a quick range upfront, then explain why it varies.', structurePrompt: '1. Quick answer with price range upfront\n2. Factors that affect cost (with a markdown table showing Low/Mid/High tiers)\n3. Detailed breakdown by project phase\n4. Hidden costs most people forget\n5. How to reduce costs without sacrificing quality\n6. Real pricing examples\n7. When to invest more vs when to save\n8. Call-to-action', formattingRules: 'Use markdown tables for pricing tiers. Use bold for dollar amounts. Use blockquotes for "pro tips" on saving money.', seoHint: 'Include long-tail cost keywords naturally. Answer "how much does X cost" directly.' },
  comparison: { name: 'X vs Y Comparison', wordRange: [2500, 3000], tone: 'analytical and fair — present both sides honestly before giving a recommendation', openingInstruction: 'Open with the core dilemma: "You need X, but should you go with A or B?"', structurePrompt: '1. Why this comparison matters\n2. Option A deep dive\n3. Option B deep dive\n4. Side-by-side comparison table\n5. Decision framework: "Choose A if... Choose B if..."\n6. Our recommendation\n7. Call-to-action', formattingRules: 'Must include at least one comparison table. Use pros/cons lists. End with a clear verdict.', seoHint: 'Target "X vs Y" keywords. Include "which is better" variations.' },
  'how-to': { name: 'Step-by-Step How-To', wordRange: [2500, 3500], tone: 'instructional, confident, and encouraging', openingInstruction: 'Start with the end result: "By the end of this guide, you will have..."', structurePrompt: '1. What you\'ll achieve\n2. Prerequisites\n3. Steps 1-8 (each as H2)\n4. Each step includes: what, why, common mistakes\n5. Timeline expectations\n6. Troubleshooting\n7. Next steps\n8. Call-to-action', formattingRules: 'Number all major steps as H2. Use H3 for sub-steps. Include time estimates.', seoHint: 'Target "how to" keywords. Structure for HowTo rich snippets.' },
  listicle: { name: 'Numbered Listicle', wordRange: [1800, 2500], tone: 'engaging, punchy, and scannable', openingInstruction: 'Open with a bold hook: the number itself.', structurePrompt: '1. Bold hook with count\n2. Items 1-N as H2 with explanation and takeaway\n3. Summary bullet list\n4. Call-to-action', formattingRules: 'Each item as H2 with number. Bold one-liner start. Short paragraphs.', seoHint: 'Use the number in the title. Include "top", "best" variations.' },
  faq: { name: 'FAQ Article', wordRange: [1500, 2000], tone: 'conversational and helpful', openingInstruction: 'Start with: "If you\'re reading this, you probably have questions about [topic]."', structurePrompt: '1. Brief intro\n2. 8-12 questions as H2\n3. Direct answers with elaboration\n4. "Still have questions?" call-to-action', formattingRules: 'Every H2 must be a question. Start with direct one-sentence answer.', seoHint: 'Questions should match "People Also Ask" queries. Format for FAQ rich snippets.' },
  'case-study': { name: 'Case Study', wordRange: [2000, 3000], tone: 'storytelling and results-focused', openingInstruction: 'Open with the client\'s situation and pain point.', structurePrompt: '1. The Client\n2. The Challenge\n3. Our Approach\n4. Implementation\n5. Results (metrics table)\n6. Key Takeaways\n7. Call-to-action', formattingRules: 'Blockquotes for client quotes. Results table with before/after. Bold numbers.', seoHint: 'Target "[service] case study" and "[industry] success story" queries.' },
  'myth-buster': { name: 'Myth-Busting Article', wordRange: [1800, 2500], tone: 'confident and slightly provocative', openingInstruction: 'Open with a widely believed myth, then flip it.', structurePrompt: '1. Hook myth\n2. 5-7 myths with H2 "Myth:" and H3 "Reality:"\n3. Summary of truths\n4. Call-to-action', formattingRules: 'H2 for myths, H3 for realities. Blockquotes for myth statements. Bold reality.', seoHint: 'Target "[topic] myths" and "misconceptions" keywords.' },
  checklist: { name: 'Checklist / Readiness Guide', wordRange: [1500, 2000], tone: 'practical and actionable', openingInstruction: 'Open with "Before you [action], make sure you can check off every item."', structurePrompt: '1. Why this checklist matters\n2. 10-15 items in 3-4 categories\n3. Scoring guide\n4. What to do if not ready\n5. Call-to-action', formattingRules: 'Checkbox-style items. Group under H2 categories. Keep short.', seoHint: 'Target "[topic] checklist" and "readiness assessment" keywords.' },
  'trend-report': { name: 'Trends & Predictions', wordRange: [2500, 3500], tone: 'forward-thinking and authoritative', openingInstruction: 'Open with a striking statistic or market shift.', structurePrompt: '1. Market landscape\n2. Trends 1-7 as H2\n3. Predictions\n4. Central Asia context\n5. Action items\n6. Call-to-action', formattingRules: 'Statistics with source links. Bold numbers. Blockquotes for predictions.', seoHint: 'Target "[topic] trends [year]" and "future of [topic]" keywords.' },
  'roi-analysis': { name: 'ROI / Business Case Analysis', wordRange: [2000, 3000], tone: 'data-driven and persuasive', openingInstruction: 'Open with the skeptic\'s question: "Is [investment] really worth it?"', structurePrompt: '1. Investment question\n2. Costs breakdown\n3. Returns with data\n4. ROI calculation\n5. Payback timeline\n6. Risks\n7. Case example\n8. Cost of inaction\n9. Call-to-action', formattingRules: 'Tables for cost/benefit. Bold dollar amounts. Blockquote for key ROI.', seoHint: 'Target "ROI of [topic]" and "is [topic] worth it" keywords.' },
  'beginner-guide': { name: 'Beginner-Friendly Explainer', wordRange: [2000, 3000], tone: 'friendly, patient, and jargon-free', openingInstruction: 'Start with empathy about not understanding the topic.', structurePrompt: '1. What is [topic]?\n2. Why care?\n3. How does it work?\n4. Use cases\n5. Glossary\n6. Misconceptions\n7. Getting started\n8. Call-to-action', formattingRules: 'Use analogies. Define terms in bold. Short paragraphs. H2 as questions.', seoHint: 'Target "what is [topic]" and "[topic] explained" keywords.' },
  'deep-dive': { name: 'Technical Deep Dive', wordRange: [3000, 4000], tone: 'expert and technical', openingInstruction: 'Open with a technical challenge about architecture decisions.', structurePrompt: '1. Technical context\n2. Architecture overview\n3. Technology trade-offs\n4. Implementation patterns\n5. Performance\n6. Security & scalability\n7. Anti-patterns\n8. Code examples\n9. Monitoring & testing\n10. Call-to-action', formattingRules: 'Code blocks for examples. Tables for tech comparisons. Bold key terms.', seoHint: 'Target "[topic] architecture" and "[topic] best practices" keywords.' },
};

function getBlueprint(format: string): Blueprint {
  return BLUEPRINTS[format] ?? BLUEPRINTS['beginner-guide'];
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(
  topic: TopicInfo,
  locale: string,
  inlineImages: ICoverImage[],
  opts: { avoidTitles?: string[]; uniqueness?: boolean } = {},
): string {
  const bp = getBlueprint(topic.postFormat);
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
    imageInstruction = `\nINLINE IMAGES — You MUST insert these images into the article between sections (after the 2nd and 4th H2). Do NOT skip them:\n${imgMd}`;
  }

  let uniquenessBlock = '';
  if (opts.uniqueness || (opts.avoidTitles && opts.avoidTitles.length > 0)) {
    uniquenessBlock = `\nUNIQUENESS REQUIREMENT:
- This blog MUST be completely unique in structure, opening, and phrasing.
- Do NOT use generic blog-post openings. Start with a fresh, original angle.`;
    if (opts.avoidTitles && opts.avoidTitles.length > 0) {
      uniquenessBlock += `\n- AVOID similarity to these existing titles:\n${opts.avoidTitles.map(t => `  • "${t}"`).join('\n')}`;
    }
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
- ${bp.seoHint}
- Use H1 for the title, H2 for major sections, H3 for subsections

CONTEXT:
- Today is ${date}, we are in ${year}
- Target audience: business owners in Uzbekistan and Central Asia
- Company: Softwhere.uz — ${topic.pillarName} specialists
${imageInstruction}
${uniquenessBlock}

CREDIBILITY:
- Include 2-4 statistics from credible sources (Statista, Gartner, McKinsey, etc.)
- Use recent data (${year - 2}–${year})

Write a unique, valuable post. Every paragraph should teach something or persuade.`;

  return `${system}\n\n---\n\n${user}`;
}

// ---------------------------------------------------------------------------
// Unsplash image fetching (with page support for variety)
// ---------------------------------------------------------------------------

function extractFallbackKeyword(title: string): string {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'vs', 'versus', 'what', 'how', 'why', 'when', 'where', 'which', 'that', 'this', 'it', 'is',
    'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'need', 'complete',
    'guide', 'ultimate', 'best', 'top', 'new', 'your', 'our',
  ]);
  const words = title
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));
  return words.slice(0, 3).join(' ') || 'technology';
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function searchUnsplash(keyword: string, page = 1): Promise<ICoverImage | null> {
  if (!UNSPLASH_ACCESS_KEY) return null;
  try {
    const params = new URLSearchParams({
      query: keyword,
      per_page: '1',
      page: String(page),
      orientation: 'landscape',
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${UNSPLASH_API}/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`   ⚠️  Unsplash returned ${res.status}`);
      return null;
    }

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

async function fetchFreshCover(
  title: string,
  primaryKeyword: string,
  slug: string,
  avoidUrls: Set<string>,
): Promise<ICoverImage | null> {
  const keyword = extractFallbackKeyword(title);
  const pageOffset = (simpleHash(slug) % 10) + 1;

  for (let attempt = 0; attempt < 3; attempt++) {
    const img = await searchUnsplash(keyword, pageOffset + attempt);
    if (img && !avoidUrls.has(img.url)) return img;
  }

  const altKeyword = primaryKeyword.split(/\s+/).slice(0, 2).join(' ');
  if (altKeyword !== keyword) {
    const img = await searchUnsplash(altKeyword, pageOffset);
    if (img && !avoidUrls.has(img.url)) return img;
  }

  return await searchUnsplash(keyword);
}

async function fetchInlineImages(
  title: string,
  primaryKeyword: string,
  secondaryKeywords: string[],
  existingUrls: Set<string>,
  count: number,
): Promise<ICoverImage[]> {
  if (!UNSPLASH_ACCESS_KEY) return [];
  const images: ICoverImage[] = [];

  const keywords = [
    primaryKeyword.split(/\s+/).slice(0, 2).join(' '),
    ...(secondaryKeywords.length > 0 ? [secondaryKeywords[0]] : []),
    extractFallbackKeyword(title) + ' technology',
  ];

  for (const kw of keywords) {
    if (images.length >= count) break;
    for (let page = 1; page <= 3 && images.length < count; page++) {
      const img = await searchUnsplash(kw, page);
      if (img && !existingUrls.has(img.url) && !images.some(i => i.url === img.url)) {
        images.push(img);
        existingUrls.add(img.url);
      }
    }
  }

  return images;
}

// ---------------------------------------------------------------------------
// Inline image injection into markdown content
// ---------------------------------------------------------------------------

function injectInlineImages(content: string, images: ICoverImage[], primaryKeyword: string): string {
  if (images.length === 0) return content;
  if (/!\[.*?\]\(https?:\/\/.*?\)/.test(content)) return content;

  const lines = content.split('\n');
  const h2Indices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) h2Indices.push(i);
  }

  if (h2Indices.length < 2) return content;

  const insertPoints: number[] = [];
  if (h2Indices.length >= 2) insertPoints.push(h2Indices[2] ?? h2Indices[h2Indices.length - 1]);
  if (h2Indices.length >= 4 && images.length >= 2) insertPoints.push(h2Indices[4] ?? h2Indices[h2Indices.length - 1]);

  let offset = 0;
  for (let i = 0; i < Math.min(insertPoints.length, images.length); i++) {
    const img = images[i];
    const markdown = `\n![${primaryKeyword} - illustration ${i + 1}](${img.url})\n`;
    lines.splice(insertPoints[i] + offset, 0, markdown);
    offset++;
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Phase 1: Analysis
// ---------------------------------------------------------------------------

interface AnalysisResult {
  groups: Map<string, GroupAnalysis>;
  duplicateCoverGroups: Map<string, string[]>;
  similarTitleGroups: Map<string, string[]>;
  similarContentGroups: Map<string, string[]>;
  totalIssues: number;
  stats: {
    totalGroups: number;
    totalPosts: number;
    groupsWithIssues: number;
    missingCover: number;
    missingInline: number;
    missingCategory: number;
    missingMeta: number;
    contentTooShort: number;
    duplicateCovers: number;
    similarTitles: number;
    similarContent: number;
    contentNoImages: number;
  };
}

async function runAnalysis(): Promise<AnalysisResult> {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  PHASE 1: ANALYSIS');
  console.log('═══════════════════════════════════════════════════\n');

  const allPosts = (await BlogPost.find({}).lean()) as PostDoc[];
  console.log(`📦 Loaded ${allPosts.length} posts from DB`);

  // Build indexes for duplicate/similarity detection
  const coverRefs = allPosts
    .filter((p: PostDoc) => p.coverImage && (p.coverImage as ICoverImage).url)
    .map((p: PostDoc) => ({
      _id: String(p._id),
      generationGroupId: p.generationGroupId!,
      coverUrl: (p.coverImage as ICoverImage).url,
    }));

  const titleRefs = allPosts.map((p: PostDoc) => ({
    _id: String(p._id),
    generationGroupId: p.generationGroupId!,
    title: p.title!,
    locale: p.locale!,
  }));

  const contentRefs = allPosts
    .filter((p: PostDoc) => p.locale === 'en')
    .map((p: PostDoc) => ({
      _id: String(p._id),
      generationGroupId: p.generationGroupId!,
      content: p.content!,
      locale: p.locale!,
    }));

  console.log('🔍 Detecting duplicate covers...');
  const duplicateCoverGroups = findDuplicateCovers(coverRefs);
  console.log(`   Found ${duplicateCoverGroups.size} duplicate cover URLs`);

  console.log('🔍 Detecting similar titles...');
  const similarTitleGroups = findSimilarTitles(titleRefs);
  console.log(`   Found ${similarTitleGroups.size} groups with similar titles`);

  console.log('🔍 Detecting similar content...');
  const similarContentGroups = findSimilarContent(contentRefs);
  console.log(`   Found ${similarContentGroups.size} groups with similar content`);

  // Invert duplicateCoverGroups: URL -> groupIds => groupId -> true/false
  const groupHasDupCover = new Set<string>();
  duplicateCoverGroups.forEach(groupIds => {
    for (const gid of groupIds) groupHasDupCover.add(gid);
  });

  // Group posts by generationGroupId
  const postsByGroup = new Map<string, PostDoc[]>();
  for (const post of allPosts) {
    if (!post.generationGroupId) continue;
    const arr = postsByGroup.get(post.generationGroupId) ?? [];
    arr.push(post);
    postsByGroup.set(post.generationGroupId, arr);
  }

  const groups = new Map<string, GroupAnalysis>();
  const stats = {
    totalGroups: postsByGroup.size,
    totalPosts: allPosts.length,
    groupsWithIssues: 0,
    missingCover: 0,
    missingInline: 0,
    missingCategory: 0,
    missingMeta: 0,
    contentTooShort: 0,
    duplicateCovers: 0,
    similarTitles: 0,
    similarContent: 0,
    contentNoImages: 0,
  };

  postsByGroup.forEach((posts, groupId) => {
    const ga = analyzeGroup(posts, groupId, {
      duplicateCover: groupHasDupCover.has(groupId),
      similarTitle: similarTitleGroups.has(groupId),
      similarContent: similarContentGroups.has(groupId),
    });
    groups.set(groupId, ga);

    const issues = countIssues(ga);
    if (issues > 0) stats.groupsWithIssues++;

    ga.issuesByPost.forEach(postIssues => {
      for (const issue of postIssues) {
        if (issue === 'missing-cover-image') stats.missingCover++;
        if (issue === 'missing-inline-images') stats.missingInline++;
        if (issue === 'missing-category' || issue === 'invalid-category') stats.missingCategory++;
        if (issue === 'missing-meta-description') stats.missingMeta++;
        if (issue === 'content-too-short') stats.contentTooShort++;
        if (issue === 'content-no-inline-images') stats.contentNoImages++;
      }
    });
    if (ga.duplicateCover) stats.duplicateCovers++;
    if (ga.similarTitle) stats.similarTitles++;
    if (ga.similarContent) stats.similarContent++;
  });

  let totalIssues = 0;
  groups.forEach(a => { totalIssues += countIssues(a); });

  return {
    groups,
    duplicateCoverGroups,
    similarTitleGroups,
    similarContentGroups,
    totalIssues,
    stats,
  };
}

function printReport(analysis: AnalysisResult) {
  const s = analysis.stats;
  console.log('\n┌──────────────────────────────────────────┐');
  console.log('│            ANALYSIS REPORT               │');
  console.log('├──────────────────────────────────────────┤');
  console.log(`│ Total groups:          ${String(s.totalGroups).padStart(6)} │`);
  console.log(`│ Total posts:           ${String(s.totalPosts).padStart(6)} │`);
  console.log(`│ Groups with issues:    ${String(s.groupsWithIssues).padStart(6)} │`);
  console.log('├──────────────────────────────────────────┤');
  console.log(`│ Missing cover image:   ${String(s.missingCover).padStart(6)} posts │`);
  console.log(`│ Missing inline images: ${String(s.missingInline).padStart(6)} posts │`);
  console.log(`│ No images in content:  ${String(s.contentNoImages).padStart(6)} posts │`);
  console.log(`│ Missing category:      ${String(s.missingCategory).padStart(6)} posts │`);
  console.log(`│ Missing meta desc:     ${String(s.missingMeta).padStart(6)} posts │`);
  console.log(`│ Content too short:     ${String(s.contentTooShort).padStart(6)} posts │`);
  console.log('├──────────────────────────────────────────┤');
  console.log(`│ Duplicate covers:      ${String(s.duplicateCovers).padStart(6)} groups │`);
  console.log(`│ Similar titles:        ${String(s.similarTitles).padStart(6)} groups │`);
  console.log(`│ Similar content:       ${String(s.similarContent).padStart(6)} groups │`);
  console.log('└──────────────────────────────────────────┘');

  if (s.duplicateCovers > 0) {
    console.log('\n📋 Duplicate cover image groups:');
    analysis.duplicateCoverGroups.forEach((groupIds, url) => {
      console.log(`   URL: ${url.slice(0, 80)}...`);
      console.log(`   Shared by ${groupIds.length} groups: ${groupIds.slice(0, 3).join(', ')}${groupIds.length > 3 ? '...' : ''}`);
    });
  }

  if (s.similarTitles > 0) {
    console.log('\n📋 Groups with similar titles:');
    analysis.similarTitleGroups.forEach((siblings, groupId) => {
      const group = analysis.groups.get(groupId);
      const title = group?.enPost?.title ?? '(unknown)';
      console.log(`   "${title}" ↔ ${siblings.length} similar group(s)`);
    });
  }
}

// ---------------------------------------------------------------------------
// Phase 2 & 3: Fix Strategy + Execute
// ---------------------------------------------------------------------------

async function fixGroups(analysis: AnalysisResult) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  PHASE 2-3: FIX & EXECUTE ${DRY_RUN ? '(DRY RUN)' : ''}`);
  console.log('═══════════════════════════════════════════════════\n');

  // Collect all existing cover URLs to avoid when fetching fresh ones
  const allCoverUrls = new Set<string>();
  analysis.groups.forEach(group => {
    for (const post of group.posts) {
      const coverUrl = (post.coverImage as ICoverImage | undefined)?.url;
      if (coverUrl) allCoverUrls.add(coverUrl);
    }
  });

  // Collect titles for "avoid" hints when fixing similar titles
  const titlesByGroup = new Map<string, string>();
  analysis.groups.forEach((group, gid) => {
    if (group.enPost?.title) titlesByGroup.set(gid, group.enPost.title);
  });

  let processed = 0;
  let skipped = 0;
  let fixed = 0;

  const sortedGroups: Array<[string, GroupAnalysis]> = [];
  analysis.groups.forEach((group, groupId) => { sortedGroups.push([groupId, group]); });
  sortedGroups.sort((a, b) => countIssues(b[1]) - countIssues(a[1]));

  for (const [groupId, group] of sortedGroups) {
    const issues = countIssues(group);

    if (RESUME && issues === 0) {
      skipped++;
      continue;
    }

    if (!FORCE && issues === 0) {
      skipped++;
      continue;
    }

    const enPost = group.enPost;
    if (!enPost) {
      console.log(`⚠️  Group ${groupId}: no EN post, skipping`);
      skipped++;
      continue;
    }

    processed++;
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📝 [${processed}/${sortedGroups.length - skipped}] "${enPost.title}"`);
    console.log(`   Group: ${groupId}  |  Issues: ${issues}`);

    const flags: string[] = [];
    if (group.duplicateCover) flags.push('DUP_COVER');
    if (group.similarTitle) flags.push('SIM_TITLE');
    if (group.similarContent) flags.push('SIM_CONTENT');
    if (group.needsClassification) flags.push('CLASSIFY');
    if (group.needsCover) flags.push('COVER');
    if (group.needsInlineImages) flags.push('INLINE_IMG');
    if (group.needsMeta) flags.push('META');
    if (group.needsContentRewrite) flags.push('REWRITE');
    if (group.hasContentWithoutImages) flags.push('INJECT_IMG');
    console.log(`   Actions: [${flags.join(', ')}]`);

    if (DRY_RUN) {
      group.issuesByPost.forEach((postIssues, postId) => {
        if (postIssues.length > 0) {
          const post = group.posts.find(p => String(p._id) === String(postId));
          console.log(`   ${(post?.locale ?? '??').toUpperCase()}: ${postIssues.join(', ')}`);
        }
      });
      continue;
    }

    // --- Step 1: Classify if needed ---
    let topic: TopicInfo;
    if (group.needsClassification) {
      console.log('   🔍 Classifying topic...');
      topic = await classifyPost(enPost.title!);
      console.log(`   → ${topic.category} / ${topic.postFormat} / "${topic.primaryKeyword}"`);
    } else {
      topic = {
        title: enPost.title!,
        category: enPost.category!,
        pillarName: PILLAR_NAMES[enPost.category!] ?? 'Software Development',
        postFormat: enPost.postFormat as PostFormat,
        primaryKeyword: enPost.primaryKeyword!,
        secondaryKeywords: enPost.secondaryKeywords ?? [],
      };
    }

    // --- Step 2: Fix cover image ---
    let coverImage: ICoverImage | null = (enPost.coverImage as ICoverImage | undefined)?.url
      ? (enPost.coverImage as ICoverImage)
      : null;

    if (group.needsCover) {
      console.log(`   🖼️  Fetching ${group.duplicateCover ? 'fresh (dedup)' : 'missing'} cover image...`);
      const newCover = await fetchFreshCover(
        topic.title,
        topic.primaryKeyword,
        enPost.slug!,
        group.duplicateCover ? allCoverUrls : new Set(),
      );
      if (newCover) {
        coverImage = newCover;
        allCoverUrls.add(newCover.url);
        console.log(`   🖼️  Got cover: "${newCover.keyword}"`);
      } else {
        console.log('   ⚠️  Could not fetch cover image');
      }
    }

    // --- Step 3: Fix inline images ---
    let contentImages: ICoverImage[] = (enPost as PostDoc).contentImages?.filter(
      (img): img is ICoverImage => !!(img as ICoverImage).url,
    ) ?? [];

    const existingImageUrls = new Set(contentImages.map(i => i.url));
    if (coverImage) existingImageUrls.add(coverImage.url);

    const wordCount = (enPost.content ?? '').split(/\s+/).length;
    const targetInlineCount = wordCount >= 2000 ? 3 : 1;
    const inlineShortfall = Math.max(0, targetInlineCount - contentImages.length);

    if (group.needsInlineImages && inlineShortfall > 0) {
      console.log(`   🖼️  Fetching ${inlineShortfall} inline image(s)...`);
      const newInline = await fetchInlineImages(
        topic.title,
        topic.primaryKeyword,
        topic.secondaryKeywords,
        existingImageUrls,
        inlineShortfall,
      );
      contentImages = [...contentImages, ...newInline];
      console.log(`   🖼️  Total inline images: ${contentImages.length}`);
    }

    const allContentImages = [
      ...(coverImage ? [coverImage] : []),
      ...contentImages.filter(img => img.url !== coverImage?.url),
    ];
    const inlineImages = contentImages.filter(img => img.url !== coverImage?.url);

    // --- Step 4: Meta description ---
    let metaDesc: string | null = null;
    if (group.needsMeta || group.needsContentRewrite || group.similarTitle) {
      console.log('   📋 Generating meta description...');
      const metaPrompt = `Write a 150-160 character meta description for a blog post titled "${topic.title}". Include the keyword "${topic.primaryKeyword}". Make it compelling. Return ONLY the meta description.`;
      metaDesc = (await generate(metaPrompt, 'meta-en', 200))?.trim().replace(/^"|"$/g, '') ?? null;
    }

    // --- Step 5: Content & title per locale ---
    const avoidTitles: string[] = [];
    if (group.similarTitle) {
      const siblingGroupIds = analysis.similarTitleGroups.get(groupId) ?? [];
      for (const sibGid of siblingGroupIds) {
        const t = titlesByGroup.get(sibGid);
        if (t) avoidTitles.push(t);
      }
    }

    const needsContentRegen = group.needsContentRewrite || group.similarContent || group.similarTitle;

    for (const post of group.posts) {
      const locale = post.locale as string;
      const postIssues = group.issuesByPost.get(String(post._id)) ?? [];
      const updateFields: Record<string, unknown> = {};
      let contentChanged = false;

      // Classification fields always applied if was missing
      if (group.needsClassification) {
        updateFields.category = topic.category;
        updateFields.postFormat = topic.postFormat;
        updateFields.primaryKeyword = topic.primaryKeyword;
        updateFields.secondaryKeywords = topic.secondaryKeywords;
      }

      // Cover image
      if (coverImage && (postIssues.includes('missing-cover-image') || group.duplicateCover)) {
        updateFields.coverImage = coverImage;
      }

      // Content images array
      if (group.needsInlineImages || group.needsCover || group.duplicateCover) {
        updateFields.contentImages = allContentImages;
      }

      // Content regeneration (similar/short/dup)
      if (needsContentRegen || postIssues.includes('content-too-short')) {
        console.log(`   🌐 Regenerating ${locale.toUpperCase()} content...`);
        const prompt = buildPrompt(topic, locale, inlineImages, {
          avoidTitles: locale === 'en' ? avoidTitles : undefined,
          uniqueness: group.similarContent || group.similarTitle,
        });
        const content = await generate(prompt, `content-${locale}`);

        if (content && content.split(/\s+/).length >= 300) {
          let finalContent = content;
          if (inlineImages.length > 0 && !/!\[.*?\]\(https?:\/\/.*?\)/.test(finalContent)) {
            finalContent = injectInlineImages(finalContent, inlineImages, topic.primaryKeyword);
          }
          updateFields.content = finalContent;
          contentChanged = true;
          console.log(`   ✅ ${locale}: ${content.split(/\s+/).length} words`);
        } else {
          console.log(`   ⚠️  ${locale}: content generation failed/too short, keeping existing`);
        }

        // Regenerate title for similar-title groups
        if (group.similarTitle) {
          let localizedTitle = topic.title;
          if (locale === 'en') {
            const titlePrompt = `Generate a unique, compelling blog post title about "${topic.primaryKeyword}" in the "${topic.postFormat}" format. It should be different from:\n${avoidTitles.map(t => `- "${t}"`).join('\n')}\nReturn ONLY the title.`;
            const newTitle = await generate(titlePrompt, 'unique-title-en', 100);
            if (newTitle) localizedTitle = newTitle.trim().replace(/^"|"$/g, '');
          } else {
            const titlePrompt = `Translate the following blog post title into ${locale === 'ru' ? 'Russian' : 'Uzbek'}: "${topic.title}". Only return the translated title, nothing else.`;
            const translated = await generate(titlePrompt, `title-${locale}`, 100);
            if (translated) localizedTitle = translated.trim().replace(/^"|"$/g, '');
          }
          updateFields.title = localizedTitle;
        }
      } else if (!contentChanged && group.hasContentWithoutImages && postIssues.includes('content-no-inline-images')) {
        // Just inject images into existing content
        if (inlineImages.length > 0 && post.content) {
          const injected = injectInlineImages(post.content, inlineImages, topic.primaryKeyword);
          if (injected !== post.content) {
            updateFields.content = injected;
            console.log(`   💉 ${locale}: injected inline images into existing content`);
          }
        }
      }

      // Meta description
      if (metaDesc && (postIssues.includes('missing-meta-description') || needsContentRegen)) {
        if (locale === 'en') {
          updateFields.metaDescription = metaDesc;
        } else {
          const metaTranslatePrompt = `Translate this meta description into ${locale === 'ru' ? 'Russian' : 'Uzbek'}. Keep it under 160 characters. Return ONLY the translation.\n\n"${metaDesc}"`;
          const translatedMeta = await generate(metaTranslatePrompt, `meta-${locale}`, 200);
          updateFields.metaDescription = translatedMeta
            ? translatedMeta.trim().replace(/^"|"$/g, '')
            : metaDesc;
        }
      }

      // Apply updates
      if (Object.keys(updateFields).length > 0) {
        await BlogPost.updateOne({ _id: post._id }, { $set: updateFields });
        const changedKeys = Object.keys(updateFields).join(', ');
        console.log(`   💾 ${locale}: updated [${changedKeys}]`);
        fixed++;
      }
    }

    console.log(`   ✅ Group complete`);
  }

  return { processed, skipped, fixed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║  BLOG POST FIXER - Structure, Fill & Deduplicate ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log(`  Flags: ${[DRY_RUN && 'dry-run', ANALYZE_ONLY && 'analyze-only', RESUME && 'resume', FORCE && 'force'].filter(Boolean).join(', ') || 'default (fix)'}`);

  console.log('\n🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);
  console.log('✅ Connected');

  const analysis = await runAnalysis();
  printReport(analysis);

  if (ANALYZE_ONLY) {
    console.log('\n📊 Analyze-only mode, exiting.');
    await mongoose.disconnect();
    process.exit(0);
  }

  if (analysis.totalIssues === 0 && !FORCE) {
    console.log('\n🎉 All posts look healthy! Nothing to fix.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const result = await fixGroups(analysis);

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`🏁 Done!`);
  console.log(`   Processed: ${result.processed} groups`);
  console.log(`   Skipped:   ${result.skipped} groups (healthy)`);
  console.log(`   Fixed:     ${result.fixed} post updates`);
  if (DRY_RUN) console.log('   ⚠️  DRY RUN — no changes were saved');
  console.log('═══════════════════════════════════════════════════');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
