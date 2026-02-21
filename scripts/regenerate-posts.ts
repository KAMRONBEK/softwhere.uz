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
const TEMPERATURE = 0.9;
const CONTENT_MAX_TOKENS = 8192;
const FREQUENCY_PENALTY = 0.4;
const PRESENCE_PENALTY = 0.35;
const UNSPLASH_API = 'https://api.unsplash.com';

const DRY_RUN = process.argv.includes('--dry-run');
const ANALYZE_ONLY = process.argv.includes('--analyze-only');
const RESUME = process.argv.includes('--resume');
const FORCE = process.argv.includes('--force');

const MAX_ITERATIONS = (() => {
  const idx = process.argv.indexOf('--iterations');
  if (idx === -1 || idx + 1 >= process.argv.length) return 1;
  const n = parseInt(process.argv[idx + 1], 10);
  return Number.isNaN(n) ? 1 : Math.min(Math.max(n, 1), 3);
})();

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
  const isContent = label.startsWith('content-');
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await ai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: TEMPERATURE,
        max_tokens: maxTokens ?? (isContent ? CONTENT_MAX_TOKENS : undefined),
        frequency_penalty: isContent ? FREQUENCY_PENALTY : 0,
        presence_penalty: isContent ? PRESENCE_PENALTY : 0,
      });
      return res.choices[0]?.message?.content ?? null;
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
  'cost-guide': { name: 'Cost / Pricing Guide', wordRange: [3500, 5000], tone: 'transparent, helpful, and direct — like a consultant giving honest advice', openingInstruction: 'Start with "The short answer is $X–$Y. But the real answer depends on..." Give a quick range upfront, then explain why it varies.', structurePrompt: '1. Quick answer with price range upfront\n2. Factors that affect cost (with a markdown table showing Low/Mid/High tiers)\n3. Detailed breakdown by project phase\n4. Hidden costs most people forget\n5. How to reduce costs without sacrificing quality\n6. Real pricing examples with anonymized case studies\n7. Cost comparison by region (US, Europe, Central Asia)\n8. When to invest more vs when to save\n9. Negotiation tips and budget planning advice\n10. Call-to-action', formattingRules: 'Use markdown tables for pricing tiers. Use bold for dollar amounts. Use blockquotes for "pro tips" on saving money.', seoHint: 'Include long-tail cost keywords naturally. Answer "how much does X cost" directly.' },
  comparison: { name: 'X vs Y Comparison', wordRange: [3500, 5000], tone: 'analytical and fair — present both sides honestly before giving a recommendation', openingInstruction: 'Open with the core dilemma: "You need X, but should you go with A or B?"', structurePrompt: '1. Why this comparison matters for your business\n2. Option A deep dive with real-world use cases\n3. Option B deep dive with real-world use cases\n4. Side-by-side comparison table (features, cost, timeline, scalability, maintenance)\n5. Performance benchmarks and data\n6. Decision framework: "Choose A if... Choose B if..."\n7. Migration paths between options\n8. Our recommendation with reasoning\n9. Call-to-action', formattingRules: 'Must include at least two comparison tables. Use pros/cons lists. End with a clear verdict.', seoHint: 'Target "X vs Y" keywords. Include "which is better" variations.' },
  'how-to': { name: 'Step-by-Step How-To', wordRange: [4000, 6000], tone: 'instructional, confident, and encouraging', openingInstruction: 'Start with the end result: "By the end of this guide, you will have..."', structurePrompt: '1. What you\'ll achieve (outcome-first hook)\n2. Prerequisites and preparation\n3. Steps 1-10 (each as H2 with detailed sub-steps)\n4. Each step includes: what to do, why it matters, common mistakes, time estimate\n5. Real-world examples at each major step\n6. Timeline expectations\n7. Troubleshooting common problems\n8. Advanced tips and optimization\n9. Next steps and further resources\n10. Call-to-action', formattingRules: 'Number all major steps as H2. Use H3 for sub-steps. Include time estimates. Use blockquotes for warnings.', seoHint: 'Target "how to" keywords. Structure for HowTo rich snippets.' },
  listicle: { name: 'Numbered Listicle', wordRange: [3000, 4500], tone: 'engaging, punchy, and scannable', openingInstruction: 'Open with a bold hook backed by data: "We analyzed 50+ projects and found N patterns..."', structurePrompt: '1. Bold hook with count and why it matters\n2. Items 1-N as H2, each with:\n   - A compelling one-line summary in bold\n   - 3-4 paragraphs of explanation with real examples\n   - Data or statistics supporting the point\n   - Actionable takeaway\n3. Summary section with quick-reference list\n4. Call-to-action', formattingRules: 'Each item as H2 with number. Bold one-liner start. Include data. End each with actionable italic takeaway.', seoHint: 'Use the number in the title. Include "top", "best" variations.' },
  faq: { name: 'FAQ Article', wordRange: [3000, 4000], tone: 'conversational and helpful — like answering questions from a smart friend', openingInstruction: 'Start with: "These are the real questions we hear from business owners every week."', structurePrompt: '1. Brief intro establishing expertise\n2. 12-18 questions as H2 (mix basic and advanced)\n3. Each answer: 3-5 paragraphs with data, examples, and concrete advice\n4. Cross-references between related questions\n5. "Questions we wish more people asked" section\n6. "Still have questions?" call-to-action', formattingRules: 'Every H2 must be a question. Start with direct one-sentence answer, then elaborate with depth. Use bold for key terms.', seoHint: 'Questions should match "People Also Ask" queries. Format for FAQ rich snippets.' },
  'case-study': { name: 'Case Study', wordRange: [3500, 5000], tone: 'storytelling and results-focused — show, don\'t just tell', openingInstruction: 'Open with a specific pain point: "A [industry] company was losing $X/month because..."', structurePrompt: '1. The Client: industry, size, context, and initial situation\n2. The Challenge: specific problems with measurable pain\n3. Why Previous Solutions Failed\n4. Our Approach: methodology, team, and technology choices\n5. Implementation: detailed timeline with milestones and obstacles\n6. Results: metrics table with before/after data\n7. Long-term Impact (6-12 months later)\n8. Key Takeaways for similar businesses\n9. Call-to-action', formattingRules: 'Blockquotes for client perspective. Results table with before/after metrics. Bold all numbers and percentages. Timeline as numbered list.', seoHint: 'Target "[service] case study" and "[industry] success story" queries.' },
  'myth-buster': { name: 'Myth-Busting Article', wordRange: [3000, 4500], tone: 'confident and slightly provocative — challenge assumptions with evidence', openingInstruction: 'Open with the most dangerous myth stated as fact, then demolish it with data.', structurePrompt: '1. Hook: state the most harmful myth as truth, then flip it\n2. 7-10 myths, each with:\n   - H2: "Myth: [the myth]"\n   - H3: "Reality: [the truth]"\n   - Data and evidence\n   - Why this myth persists\n   - What to do instead\n3. "The biggest myth we didn\'t cover" teaser\n4. Summary of truths\n5. Call-to-action', formattingRules: 'H2 for myths, H3 for realities. Blockquotes for myth statements. Bold reality. Include data sources.', seoHint: 'Target "[topic] myths" and "misconceptions" keywords.' },
  checklist: { name: 'Checklist / Readiness Guide', wordRange: [2500, 3500], tone: 'practical and actionable — every sentence helps the reader DO something', openingInstruction: 'Open with "Before you [action], make sure you can check off every item. Missing even one can cost you thousands."', structurePrompt: '1. Why this checklist matters (with cost-of-failure data)\n2. The Checklist: 15-20 items grouped into 4-5 categories\n3. Each item: checkbox, one-line description, 2-3 sentences on why it matters, red-flag warnings\n4. Priority ranking within each category\n5. Scoring guide with clear thresholds\n6. "What to do if you\'re not ready" recovery plan\n7. Call-to-action', formattingRules: 'Checkbox-style items. Group under H2 categories. Include priority indicators. Bold critical items.', seoHint: 'Target "[topic] checklist" and "readiness assessment" keywords.' },
  'trend-report': { name: 'Trends & Predictions', wordRange: [4000, 6000], tone: 'forward-thinking and authoritative — position as industry insiders', openingInstruction: 'Open with a striking statistic that shifted in the last 12 months.', structurePrompt: '1. Market landscape overview with current data and charts\n2. Trends 1-8 as H2, each with:\n   - What\'s happening (with data)\n   - Why it matters for businesses\n   - How to prepare or take advantage\n   - Timeline for adoption\n3. Bold predictions for the next 2-3 years\n4. Central Asia and Uzbekistan specific context\n5. Action items ranked by priority\n6. Call-to-action', formattingRules: 'Statistics with source links. Bold numbers and percentages. Blockquotes for key predictions. Timeline table.', seoHint: 'Target "[topic] trends [year]" and "future of [topic]" keywords.' },
  'roi-analysis': { name: 'ROI / Business Case Analysis', wordRange: [3500, 5000], tone: 'data-driven and persuasive — speak the language of CFOs', openingInstruction: 'Open with: "Is [investment] really worth it? We ran the numbers on 20+ projects. Here\'s what we found."', structurePrompt: '1. The investment question framed as a business decision\n2. Comprehensive cost breakdown (direct, indirect, opportunity)\n3. Quantified returns with real data\n4. ROI calculation with step-by-step formula\n5. Payback timeline with monthly projections\n6. Risk factors and mitigation strategies\n7. 2-3 case examples with actual numbers\n8. Comparison: investment vs cost of inaction\n9. Decision framework for different budgets\n10. Call-to-action', formattingRules: 'Tables for cost/benefit. Bold all dollar amounts. Blockquote for key ROI figure. Include a calculation the reader can follow.', seoHint: 'Target "ROI of [topic]" and "is [topic] worth it" keywords.' },
  'beginner-guide': { name: 'Beginner-Friendly Explainer', wordRange: [3500, 5000], tone: 'friendly, patient, and jargon-free — like talking to a smart non-technical person', openingInstruction: 'Start with empathy and a relatable scenario from business life.', structurePrompt: '1. What is [topic]? (plain language with a real-world analogy)\n2. Why should you care? (business impact with numbers)\n3. How does it work? (simplified explanation with step-by-step)\n4. Common use cases (5-7 examples relevant to the reader)\n5. Complete glossary of key terms\n6. Common misconceptions debunked\n7. How to evaluate if you need it\n8. How to get started (concrete next steps)\n9. What to expect in the first 30/60/90 days\n10. Call-to-action', formattingRules: 'Use analogies and real-world examples. Define technical terms in bold on first use. Short paragraphs. H2 as questions.', seoHint: 'Target "what is [topic]" and "[topic] explained" keywords.' },
  'deep-dive': { name: 'Technical Deep Dive', wordRange: [5000, 7000], tone: 'expert and technical — for CTOs, tech leads, and senior developers', openingInstruction: 'Open with a real architectural dilemma that costs companies money when done wrong.', structurePrompt: '1. Technical context and problem statement\n2. Architecture overview with system design description\n3. Technology choices and detailed trade-off analysis\n4. Implementation patterns with code snippets\n5. Performance benchmarks and optimization strategies\n6. Security considerations and threat modeling\n7. Scalability analysis (horizontal vs vertical)\n8. Common anti-patterns with real failure stories\n9. Testing strategy and quality assurance\n10. Monitoring, alerting, and observability\n11. Migration and upgrade paths\n12. Call-to-action', formattingRules: 'Code blocks for technical examples. Multiple comparison tables. Bold key technical terms. Include architecture decision records.', seoHint: 'Target "[topic] architecture" and "[topic] best practices" keywords.' },
  'glossary': { name: 'Glossary / Term Reference', wordRange: [3000, 4500], tone: 'reference-style, clear, and authoritative — like an industry encyclopedia for business people', openingInstruction: 'Start with: "The world of [topic] comes with its own vocabulary. Misunderstanding even one term can lead to costly decisions."', structurePrompt: '1. Brief intro on why understanding these terms saves money\n2. 15-25 key terms as H2, each with:\n   - Bold term name\n   - Plain-language definition (2-3 sentences)\n   - Why it matters for your business decisions\n   - Real-world example or analogy\n   - Common misunderstanding about this term\n3. Quick-reference summary table (Term | Definition | Business Impact)\n4. "Terms you\'ll hear next" — emerging vocabulary\n5. Call-to-action', formattingRules: 'Each H2 is a term. Bold the term in definition. Include comprehensive summary table. Use analogies. Cross-reference related terms.', seoHint: 'Target "[topic] glossary", "[topic] terms explained", "what is [term]" keywords.' },
  'troubleshooting-guide': { name: 'Troubleshooting Guide', wordRange: [3500, 5000], tone: 'diagnostic and solution-focused — like a senior engineer walking you through fixes', openingInstruction: 'Start with: "Before you panic or call an expensive consultant, let\'s systematically diagnose what\'s going wrong."', structurePrompt: '1. How to approach troubleshooting (diagnostic mindset)\n2. 8-12 problems, each as H2 with:\n   - H3 "Symptom": exactly what you\'re seeing\n   - H3 "Root Cause": why it happens (with technical explanation)\n   - H3 "Fix": step-by-step resolution with commands/actions\n   - H3 "Prevention": how to make sure it never happens again\n   - Estimated fix time and difficulty level\n3. Quick-reference diagnostic table (Symptom | Likely Cause | Quick Fix)\n4. When DIY ends and you need expert help\n5. Emergency vs non-emergency classification\n6. Call-to-action', formattingRules: 'Each problem is H2. Use H3 for Symptom/Cause/Fix/Prevention. Comprehensive diagnostic table at end. Bold symptoms and fixes. Numbered steps in Fix sections. Include difficulty ratings.', seoHint: 'Target "[topic] troubleshooting", "[topic] common problems", "how to fix [topic]" keywords.' },
};

function getBlueprint(format: string): Blueprint {
  return BLUEPRINTS[format] ?? BLUEPRINTS['beginner-guide'];
}

// ---------------------------------------------------------------------------
// Format & theme pivots
// ---------------------------------------------------------------------------

const FORMAT_PIVOTS: Record<PostFormat, PostFormat[]> = {
  'beginner-guide': ['how-to', 'faq', 'listicle', 'glossary'],
  'how-to': ['beginner-guide', 'checklist', 'listicle', 'troubleshooting-guide'],
  'listicle': ['faq', 'checklist', 'beginner-guide', 'glossary'],
  'comparison': ['roi-analysis', 'cost-guide', 'deep-dive'],
  'cost-guide': ['roi-analysis', 'comparison', 'faq'],
  'faq': ['beginner-guide', 'checklist', 'listicle', 'glossary'],
  'case-study': ['roi-analysis', 'how-to', 'deep-dive'],
  'myth-buster': ['faq', 'beginner-guide', 'listicle'],
  'checklist': ['troubleshooting-guide', 'faq', 'listicle', 'how-to'],
  'trend-report': ['deep-dive', 'listicle', 'beginner-guide'],
  'roi-analysis': ['cost-guide', 'comparison', 'case-study'],
  'deep-dive': ['how-to', 'trend-report', 'troubleshooting-guide'],
  'glossary': ['beginner-guide', 'faq', 'checklist'],
  'troubleshooting-guide': ['how-to', 'checklist', 'faq'],
};

const CONTENT_ANGLES = [
  'cost and budget perspective for business owners',
  'technical implementation focus for CTOs and developers',
  'ROI and measurable business value',
  'Central Asia and Uzbekistan market context',
  'step-by-step practical walkthrough with examples',
  'myths, misconceptions, and reality checks',
  'decision-making framework for executives',
  'security and risk management angle',
] as const;

function pickPivotFormat(current: PostFormat, avoidFormats: PostFormat[] = []): PostFormat {
  const candidates = (FORMAT_PIVOTS[current] ?? []).filter(f => !avoidFormats.includes(f));
  if (candidates.length === 0) return current;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function pickContentAngle(avoidIndex?: number): string {
  let idx = Math.floor(Math.random() * CONTENT_ANGLES.length);
  if (idx === avoidIndex) idx = (idx + 1) % CONTENT_ANGLES.length;
  return CONTENT_ANGLES[idx];
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(
  topic: TopicInfo,
  locale: string,
  inlineImages: ICoverImage[],
  opts: { avoidTitles?: string[]; uniqueness?: boolean; contentAngle?: string } = {},
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
- Do NOT use generic blog-post openings like "In today's digital landscape..." or "In the ever-evolving world of...".
- Use a completely different section order and fresh examples compared to typical articles on this topic.
- Start with a fresh, original angle that surprises the reader.`;
    if (opts.contentAngle) {
      uniquenessBlock += `\n- CONTENT ANGLE: Write this article specifically from a "${opts.contentAngle}" perspective. Let this angle shape the structure, examples, and recommendations.`;
    }
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
  if (h2Indices.length >= 2) insertPoints.push(h2Indices[1] + 1);
  if (h2Indices.length >= 4 && images.length >= 2) insertPoints.push(h2Indices[3] + 1);

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
    const targetInlineCount = wordCount >= 4000 ? 4 : wordCount >= 2000 ? 3 : 1;
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

    // --- Step 5a: Format & angle pivot for uniqueness ---
    let contentAngle: string | undefined;
    if (group.similarContent || group.similarTitle) {
      const originalFormat = topic.postFormat;
      topic.postFormat = pickPivotFormat(originalFormat);
      contentAngle = pickContentAngle();
      console.log(`   🔄 Pivot: ${originalFormat} → ${topic.postFormat} | angle: "${contentAngle}"`);
    }

    for (const post of group.posts) {
      const locale = post.locale as string;
      const postIssues = group.issuesByPost.get(String(post._id)) ?? [];
      const updateFields: Record<string, unknown> = {};
      let contentChanged = false;

      // Classification fields always applied if was missing or pivoted
      if (group.needsClassification || group.similarContent || group.similarTitle) {
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
          contentAngle,
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
  console.log(`  Flags: ${[DRY_RUN && 'dry-run', ANALYZE_ONLY && 'analyze-only', RESUME && 'resume', FORCE && 'force', MAX_ITERATIONS > 1 && `iterations=${MAX_ITERATIONS}`].filter(Boolean).join(', ') || 'default (fix)'}`);

  console.log('\n🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI!);
  console.log('✅ Connected');

  let totalFixed = 0;

  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    if (MAX_ITERATIONS > 1) {
      console.log(`\n╔═══════════════════════════════════════════════════╗`);
      console.log(`║  ITERATION ${iteration} of ${MAX_ITERATIONS}${' '.repeat(37 - String(iteration).length - String(MAX_ITERATIONS).length)}║`);
      console.log(`╚═══════════════════════════════════════════════════╝`);
    }

    const analysis = await runAnalysis();
    printReport(analysis);

    if (ANALYZE_ONLY) {
      console.log('\n📊 Analyze-only mode, exiting.');
      await mongoose.disconnect();
      process.exit(0);
    }

    if (analysis.totalIssues === 0 && !FORCE) {
      console.log('\n🎉 All posts look healthy! Nothing to fix.');
      break;
    }

    const result = await fixGroups(analysis);
    totalFixed += result.fixed;

    console.log(`\n── Iteration ${iteration} summary ──`);
    console.log(`   Processed: ${result.processed} groups`);
    console.log(`   Skipped:   ${result.skipped} groups (healthy)`);
    console.log(`   Fixed:     ${result.fixed} post updates`);

    if (DRY_RUN) {
      console.log('   ⚠️  DRY RUN — no changes were saved');
      break;
    }

    if (result.fixed === 0) {
      console.log('   No fixes applied this iteration, stopping.');
      break;
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`🏁 Done! Total post updates: ${totalFixed}`);
  if (DRY_RUN) console.log('   ⚠️  DRY RUN — no changes were saved');
  console.log('═══════════════════════════════════════════════════');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
