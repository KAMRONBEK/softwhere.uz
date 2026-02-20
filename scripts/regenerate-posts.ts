/**
 * Regenerate all blog posts in production using current prompts/blueprints.
 *
 * Usage:
 *   1. Pull production env:  yarn env:pull:production
 *   2. Run:                  npx tsx scripts/regenerate-posts.ts
 *
 * - Processes groups sequentially (~15 min each, ~30 hours total for 41 groups)
 * - Keeps existing images, slugs, status, and dates
 * - Regenerates content, titles (translated), meta descriptions
 * - Classifies topic via DeepSeek for posts missing category/postFormat
 * - Safe to resume: skips groups whose EN post already has a `postFormat` field
 *   (remove the --resume flag logic if you want a full re-run)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MONGODB_URI = process.env.MONGODB_URI;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!MONGODB_URI) throw new Error('MONGODB_URI not set');
if (!DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY not set');

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

const ai = new OpenAI({ baseURL: 'https://api.deepseek.com', apiKey: DEEPSEEK_API_KEY });
const MODEL = 'deepseek-chat';
const TEMPERATURE = 0.7;
const UNSPLASH_API = 'https://api.unsplash.com';

const SKIP_ALREADY_DONE = process.argv.includes('--resume');

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
// Topic classification (for posts missing category/postFormat)
// ---------------------------------------------------------------------------

const SERVICE_PILLARS = [
  'mobile-app-development',
  'mvp-startup',
  'ai-solutions',
  'web-app-development',
  'telegram-bot-development',
  'crm-development',
  'business-automation',
  'saas-development',
  'outsourcing',
  'project-rescue',
  'ecommerce',
  'ui-ux-design',
  'maintenance-support',
  'cybersecurity',
];

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

const POST_FORMATS = [
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
] as const;

type PostFormat = (typeof POST_FORMATS)[number];

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
        postFormat: POST_FORMATS.includes(parsed.postFormat) ? (parsed.postFormat as PostFormat) : 'beginner-guide',
        primaryKeyword: parsed.primaryKeyword || title.toLowerCase().slice(0, 60),
        secondaryKeywords: Array.isArray(parsed.secondaryKeywords) ? parsed.secondaryKeywords.slice(0, 5) : [],
      };
    } catch {
      /* fall through */
    }
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
// Blueprint data (inlined from src/data/post-blueprints.ts)
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
// Prompt builder (mirrors route.ts buildPrompt)
// ---------------------------------------------------------------------------

function buildPrompt(topic: TopicInfo, locale: string, inlineImages: ICoverImage[]): string {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Unsplash image fetching
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

async function searchUnsplash(keyword: string): Promise<ICoverImage | null> {
  if (!UNSPLASH_ACCESS_KEY) return null;

  try {
    const params = new URLSearchParams({ query: keyword, per_page: '1', orientation: 'landscape' });
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

async function fetchImagesForTopic(title: string, primaryKeyword: string): Promise<{ cover: ICoverImage | null; inline: ICoverImage[]; all: ICoverImage[] }> {
  if (!UNSPLASH_ACCESS_KEY) {
    console.log('   ⚠️  UNSPLASH_ACCESS_KEY not set, skipping images');
    return { cover: null, inline: [], all: [] };
  }

  const coverKeyword = extractFallbackKeyword(title);
  const cover = await searchUnsplash(coverKeyword);

  const inlineKeyword = primaryKeyword.length > 3 ? primaryKeyword.split(/\s+/).slice(0, 2).join(' ') : coverKeyword;
  const inlineImg = await searchUnsplash(inlineKeyword);

  const inline = inlineImg ? [inlineImg] : [];
  const all = [...(cover ? [cover] : []), ...inline];

  return { cover, inline, all };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);
  console.log('✅ Connected\n');

  // Get all distinct generationGroupIds
  const groups: string[] = await BlogPost.distinct('generationGroupId');
  console.log(`📦 Found ${groups.length} generation groups (${groups.length * 3} posts)\n`);

  let processed = 0;
  let skipped = 0;

  for (const groupId of groups) {
    const posts = await BlogPost.find({ generationGroupId: groupId }).sort({ locale: 1 });
    const enPost = posts.find((p: any) => p.locale === 'en');

    if (!enPost) {
      console.log(`⚠️  Group ${groupId}: no EN post found, skipping`);
      skipped++;
      continue;
    }

    if (SKIP_ALREADY_DONE && enPost.postFormat && enPost.category) {
      console.log(`⏭️  Group ${groupId}: already has postFormat, skipping (--resume)`);
      skipped++;
      continue;
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📝 [${processed + 1}/${groups.length - skipped}] "${enPost.title}"`);
    console.log(`   Group: ${groupId}`);
    console.log(`   Posts in group: ${posts.length}`);

    // 1. Classify topic from English title
    console.log('   🔍 Classifying topic...');
    const topic = await classifyPost(enPost.title);
    console.log(`   → ${topic.category} / ${topic.postFormat} / "${topic.primaryKeyword}"`);

    // 2. Fetch images (or keep existing if present)
    let coverImage: ICoverImage | null = enPost.coverImage?.url ? enPost.coverImage : null;
    let allContentImages: ICoverImage[] = enPost.contentImages ?? [];
    let inlineImages: ICoverImage[];

    if (allContentImages.length > 0) {
      inlineImages = coverImage ? allContentImages.filter((img: ICoverImage) => img.url !== coverImage!.url) : allContentImages;
      console.log(`   🖼️  Using ${allContentImages.length} existing images`);
    } else {
      console.log('   🖼️  Fetching images from Unsplash...');
      const images = await fetchImagesForTopic(topic.title, topic.primaryKeyword);
      coverImage = images.cover;
      inlineImages = images.inline;
      allContentImages = images.all;
      console.log(`   🖼️  Got ${allContentImages.length} images`);
    }

    // 3. Generate EN meta description
    console.log('   📋 Generating meta description...');
    const metaPrompt = `Write a 150-160 character meta description for a blog post titled "${topic.title}". Include the keyword "${topic.primaryKeyword}". Make it compelling. Return ONLY the meta description.`;
    const metaDesc = (await generate(metaPrompt, 'meta-en', 200))?.trim().replace(/^"|"$/g, '') ?? `${topic.title} — Expert insights from Softwhere.uz`;

    // 4. Regenerate each locale
    for (const post of posts) {
      const locale = post.locale as string;
      console.log(`   🌐 Generating ${locale.toUpperCase()} content...`);

      // Generate content
      const prompt = buildPrompt(topic, locale, inlineImages);
      const content = await generate(prompt, `content-${locale}`);

      if (!content || content.split(/\s+/).length < 300) {
        console.log(`   ⚠️  ${locale}: content too short or failed, skipping this locale`);
        continue;
      }

      console.log(`   ✅ ${locale}: ${content.split(/\s+/).length} words`);

      // Translate title for non-EN
      let localizedTitle = topic.title;
      if (locale !== 'en') {
        const titlePrompt = `Translate the following blog post title into ${locale === 'ru' ? 'Russian' : 'Uzbek'}: "${topic.title}". Only return the translated title, nothing else.`;
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

      // Update the post with ALL new-structure fields
      const updateFields: Record<string, unknown> = {
        title: localizedTitle,
        content,
        category: topic.category,
        postFormat: topic.postFormat,
        primaryKeyword: topic.primaryKeyword,
        secondaryKeywords: topic.secondaryKeywords,
        metaDescription: localizedMeta,
        contentImages: allContentImages,
      };
      if (coverImage) updateFields.coverImage = coverImage;

      await BlogPost.updateOne({ _id: post._id }, { $set: updateFields });

      console.log(`   💾 ${locale}: saved "${localizedTitle}"`);
    }

    processed++;
    console.log(`   ✅ Group complete (${processed}/${groups.length})`);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🏁 Done! Processed: ${processed}, Skipped: ${skipped}`);

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
