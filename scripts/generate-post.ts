/**
 * Weekly blog generation CLI — a thin wrapper around the SAME pipeline the
 * admin API route uses (src/modules/blog/api/pipeline.ts), run from GitHub
 * Actions where wall-clock is free, so it uses the 'deep' mode (research →
 * draft → lint/revise → cross-model critique → revise).
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
 *   --force              Ignore the weekly idempotency check (scheduled runs)
 *
 * Scheduled runs (GITHUB_EVENT_NAME=schedule) use a deterministic group id
 * (weekly-<year>-W<week>): a duplicate cron fire or a re-run after partial
 * failure resumes the same group and only generates the missing locales.
 */

import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { appendFileSync } from 'node:fs';
import { getByGroupId, listGroupLocales } from '../src/modules/blog/model/posts.repository';
import { SERVICE_PILLARS, getAllTopics, type PostFormat } from '../src/modules/blog/data/seo-topics';
import {
  extractTextFromUrl,
  classifySourceContent,
  smartSelectTopic,
  generateMetaDescription,
  MAX_SOURCE_TEXT_LENGTH,
  type TopicResult,
  type SourceClassification,
} from '../src/modules/blog/api/generator';
import { producePostContent, persistLocalePost, type BlogLocale } from '../src/modules/blog/api/pipeline';
import { buildFactSheet, verifyFactUrls, EMPTY_FACT_SHEET, type FactSheet } from '../src/modules/blog/api/research';
import { getCoverImageForTopic, getImagesForPost } from '../src/modules/blog/utils/unsplash';
import { safeGenerateContent } from '../src/core/ai';
import { sendTelegramMessage, escapeTelegramHtml } from '../src/core/notify';
import type { ICoverImage } from '../src/modules/blog/model/BlogPost';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
if (!process.env.MOONSHOT_API_KEY && !process.env.KIMI_API_KEY && !process.env.DEEPSEEK_API_KEY) {
  throw new Error('No AI key set (MOONSHOT_API_KEY or DEEPSEEK_API_KEY)');
}

const ALLOWED: BlogLocale[] = ['en', 'ru', 'uz'];

// ---------------------------------------------------------------------------
// CLI arguments
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};
  const flags = new Set<string>();

  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) continue;
    const key = args[i].slice(2);
    if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
      opts[key] = args[++i];
    } else {
      flags.add(key);
    }
  }

  return {
    category: opts.category || '',
    customTopic: opts.customTopic || '',
    sourceUrl: opts.sourceUrl || '',
    sourceText: opts.sourceText || '',
    locales: (opts.locales || 'en,ru,uz')
      .split(',')
      .map(l => l.trim())
      .filter((l): l is BlogLocale => ALLOWED.includes(l as BlogLocale)),
    force: flags.has('force') || opts.force === 'true',
  };
}

// ---------------------------------------------------------------------------
// Idempotency: deterministic group id per ISO week for scheduled runs
// ---------------------------------------------------------------------------

function isoWeekId(date = new Date()): string {
  // ISO-8601 week number (UTC): Thursday of the current week decides the year.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `weekly-${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Run summary (console + $GITHUB_STEP_SUMMARY + Telegram)
// ---------------------------------------------------------------------------

interface CreatedPost {
  locale: string;
  title: string;
  slug: string;
  provider: string;
  words: number;
  warnings: number;
}

function writeStepSummary(markdown: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  try {
    appendFileSync(file, `${markdown}\n`);
  } catch {
    /* summary is best-effort */
  }
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || 'https://softwhere.uz').replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();
  const isScheduled = process.env.GITHUB_EVENT_NAME === 'schedule';
  if (opts.locales.length === 0) {
    console.error('❌ No valid locales requested');
    process.exit(1);
  }

  // --- Idempotency / continuation ------------------------------------------
  // Scheduled runs share one deterministic group per ISO week: a duplicate
  // cron fire is a no-op, and a re-run after partial failure fills only the
  // missing locales. --force opts out and generates a brand-new group.

  const useWeeklyGroup = isScheduled && !opts.force;
  const generationGroupId = useWeeklyGroup ? isoWeekId() : uuidv4();
  let existingTopic: TopicResult | null = null;
  let existingCover: ICoverImage | null = null;
  let existingImages: ICoverImage[] = [];
  let existingMeta: string | null = null;
  let locales = opts.locales;

  if (useWeeklyGroup) {
    const existing = await getByGroupId(generationGroupId);
    if (existing) {
      // Drafts count as done — resume must not duplicate unreviewed drafts.
      const done = new Set(await listGroupLocales(generationGroupId));
      locales = opts.locales.filter(l => !done.has(l));

      if (locales.length === 0) {
        const msg = `This week's group ${generationGroupId} already has all requested locales — nothing to do (dispatch with force=true for an extra post).`;
        console.log(`✅ ${msg}`);
        writeStepSummary(`### Weekly post already generated\n${msg}`);
        process.exit(0);
      }

      // Resume the interrupted group: reuse its topic, images, and meta.
      const pillar = SERVICE_PILLARS.find(p => p.id === existing.category);
      existingTopic = {
        id: existing.category ?? 'unknown',
        title: existing.title,
        primaryKeyword: existing.primaryKeyword ?? existing.title.toLowerCase().slice(0, 60),
        secondaryKeywords: existing.secondaryKeywords ?? [],
        searchIntent: 'informational',
        postFormat: (existing.postFormat ?? 'beginner-guide') as PostFormat,
        targetQueries: [existing.primaryKeyword ?? existing.title.toLowerCase()],
        imageHints: [],
        servicePillar: existing.category ?? 'web-app-development',
        pillarName: pillar?.name ?? 'Software Development',
      };
      existingCover = existing.coverImage ?? null;
      existingImages = existing.contentImages ?? [];
      existingMeta = existing.metaDescription ?? null;
      console.log(`♻️  Resuming group ${generationGroupId} for missing locales: ${locales.join(', ')}`);
    }
  }

  // --- Resolve source material ----------------------------------------------

  let resolvedSource: string | null = null;
  if (!existingTopic && opts.sourceUrl) {
    console.log(`🌐 Fetching source URL: ${opts.sourceUrl}`);
    resolvedSource = await extractTextFromUrl(opts.sourceUrl);
    console.log(`   Extracted ${resolvedSource.length} chars`);
  } else if (!existingTopic && opts.sourceText) {
    resolvedSource = opts.sourceText.trim().slice(0, MAX_SOURCE_TEXT_LENGTH);
    console.log(`📄 Using provided source text (${resolvedSource.length} chars)`);
  }

  // --- Select topic ----------------------------------------------------------

  let topic: TopicResult;
  let sourceClassification: SourceClassification | null = null;

  if (existingTopic) {
    topic = existingTopic;
  } else if (resolvedSource) {
    console.log('🔍 Classifying source content...');
    sourceClassification = await classifySourceContent(resolvedSource);
    const pillar = SERVICE_PILLARS.find(p => p.id === sourceClassification!.category);
    topic = {
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
  } else if (opts.customTopic) {
    console.log(`✍️  Custom topic: "${opts.customTopic}"`);
    const normalized = await safeGenerateContent(
      `You are a professional editor. Normalize this blog post topic by fixing spelling, improving grammar, and making it professional. Return ONLY the normalized topic.\n\nTopic: "${opts.customTopic}"`,
      'topic-normalize',
      100
    );
    const title = normalized ? normalized.trim().replace(/^"|"$/g, '') : opts.customTopic;
    topic = {
      id: `custom-${Date.now()}`,
      title,
      primaryKeyword: title.toLowerCase().slice(0, 60),
      secondaryKeywords: [],
      searchIntent: 'informational',
      postFormat: 'beginner-guide' as PostFormat,
      targetQueries: [title.toLowerCase()],
      imageHints: [],
      servicePillar: 'web-app-development',
      pillarName: 'Software Development',
    };
  } else if (opts.category && opts.category !== 'auto') {
    const valid = SERVICE_PILLARS.map(p => p.id);
    if (opts.category !== 'random' && !valid.includes(opts.category)) {
      console.error(`❌ Invalid category: ${opts.category}`);
      process.exit(1);
    }
    const pool = opts.category === 'random' ? getAllTopics() : getAllTopics().filter(t => t.servicePillar === opts.category);
    if (pool.length === 0) {
      console.error(`❌ No topics for category: ${opts.category}`);
      process.exit(1);
    }
    topic = pool[Math.floor(Math.random() * pool.length)];
  } else {
    console.log('🧠 Smart topic selection...');
    topic = await smartSelectTopic();
  }

  console.log(`\n📦 Group: ${generationGroupId}`);
  console.log(`📝 Topic: "${topic.title}" (${topic.servicePillar}/${topic.postFormat})`);

  // --- Images + meta (reused on resume) --------------------------------------

  let coverImage = existingCover;
  let inlineImages: ICoverImage[];
  let allContentImages: ICoverImage[];

  if (existingTopic) {
    allContentImages = existingImages;
    inlineImages = coverImage ? existingImages.filter(img => img.url !== coverImage!.url) : existingImages;
  } else {
    console.log('🖼️  Fetching images...');
    coverImage = await getCoverImageForTopic(topic.title, topic.imageHints?.[0]);
    inlineImages = await getImagesForPost(topic.imageHints, topic.title);
    allContentImages = [...(coverImage ? [coverImage] : []), ...inlineImages];
    console.log(`   Got ${allContentImages.length} image(s)`);
  }

  const metaDesc = existingMeta ?? (await generateMetaDescription(topic.title, topic.primaryKeyword, 'en'));

  // --- Research (real facts via web search) -----------------------------------

  console.log('\n🔬 Researching (web search)...');
  let factSheet: FactSheet = EMPTY_FACT_SHEET;
  try {
    factSheet = await verifyFactUrls(await buildFactSheet(topic));
    console.log(
      factSheet.facts.length > 0
        ? `   ${factSheet.facts.length} verified facts from ${factSheet.searches} search(es)`
        : '   No verified facts — posts will be written qualitatively (zero statistics)'
    );
  } catch (err) {
    console.warn('   ⚠️ Research failed, continuing ungrounded:', (err as Error).message);
  }

  // --- Generate per locale (deep mode) ----------------------------------------

  const created: CreatedPost[] = [];
  const failed: string[] = [];

  for (const locale of locales) {
    console.log(`\n🌐 Generating ${locale.toUpperCase()} (deep pipeline)...`);
    try {
      const produced = await producePostContent({
        topic,
        source: resolvedSource && sourceClassification ? { text: resolvedSource, classification: sourceClassification } : undefined,
        locale,
        inlineImages,
        factSheet,
        mode: 'deep',
      });

      if (!produced) {
        console.error(`   ❌ No acceptable ${locale} content — locale skipped`);
        failed.push(locale);
        continue;
      }

      const saved = await persistLocalePost({
        topic,
        locale,
        content: produced.content,
        generationGroupId,
        coverImage: coverImage ?? null,
        allContentImages,
        metaDescription: metaDesc,
      });

      const words = produced.content.split(/\s+/).filter(Boolean).length;
      created.push({
        locale,
        title: saved.title,
        slug: saved.slug,
        provider: produced.provider,
        words,
        warnings: produced.residualIssues.length,
      });
      console.log(`   💾 Saved draft "${saved.title}" (${saved.slug}) — ${words} words via ${produced.provider}`);
      if (produced.residualIssues.length > 0) {
        console.log(`   ⚠️ ${produced.residualIssues.length} residual lint warning(s): ${produced.residualIssues.map(i => i.detail).join(' | ')}`);
      }
    } catch (err) {
      console.error(`   ❌ ${locale} failed:`, (err as Error).message);
      failed.push(locale);
    }
  }

  // --- Report -----------------------------------------------------------------

  const adminUrl = `${baseUrl()}/en/admin/posts`;
  const summaryLines = [
    `### ${created.length > 0 ? '📝 Blog drafts generated' : '❌ Blog generation failed'}`,
    '',
    `**Topic:** ${topic.title}  `,
    `**Format/pillar:** ${topic.postFormat} / ${topic.servicePillar}  `,
    `**Group:** \`${generationGroupId}\`  `,
    `**Verified facts:** ${factSheet.facts.length} (${factSheet.searches} web searches)`,
    '',
    '| Locale | Title | Words | Provider | Lint warnings |',
    '|---|---|---|---|---|',
    ...created.map(p => `| ${p.locale} | ${p.title} | ${p.words} | ${p.provider} | ${p.warnings} |`),
    ...(failed.length > 0 ? ['', `⚠️ Failed locales: ${failed.join(', ')} — re-run the workflow to fill them in.`] : []),
    '',
    `Drafts await review in the [admin](${adminUrl}) — nothing publishes automatically.`,
  ];
  writeStepSummary(summaryLines.join('\n'));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏁 Done: ${created.length} draft(s), ${failed.length} failed locale(s)`);

  if (created.length > 0) {
    const list = created.map(p => `• [${p.locale}] ${escapeTelegramHtml(p.title)}`).join('\n');
    const failedLine = failed.length > 0 ? `\n⚠️ Failed locales: ${failed.join(', ')} — re-run the workflow to fill them.` : '';
    await sendTelegramMessage(
      `<b>📝 New blog draft${created.length > 1 ? 's' : ''} ready for review</b>\n${list}${failedLine}\n\n<a href="${adminUrl}">Review in admin</a>`
    );
  } else {
    await sendTelegramMessage(`<b>❌ Weekly blog generation produced no drafts</b>\nTopic: ${escapeTelegramHtml(topic.title)}`);
  }

  // Any failed locale exits non-zero so CI opens an issue — safe because a
  // scheduled re-run resumes the weekly group and fills only what's missing.
  process.exit(failed.length > 0 || created.length === 0 ? 1 : 0);
}

main().catch(async err => {
  console.error('💥 Fatal error:', err);
  writeStepSummary(`### ❌ Blog generation crashed\n\`\`\`\n${String(err?.stack ?? err).slice(0, 1500)}\n\`\`\``);
  await sendTelegramMessage(`<b>💥 Blog generation crashed</b>\n<pre>${escapeTelegramHtml(String(err).slice(0, 500))}</pre>`).catch(() => {});
  process.exit(1);
});
