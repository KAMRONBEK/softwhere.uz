/**
 * One-time recovery of blog posts lost in the MongoDB → Neon migration.
 *
 * The old posts had slugs ending in a timestamp (`<root>-<epoch_ms>`); those
 * URLs still hold Google/Yandex demand but now 404. This script regenerates each
 * lost topic through the SAME deep pipeline the scheduled generator uses and
 * PINS the English slug to the old root, so the blog page's legacy resolver
 * (getCanonicalForLocale) 301-redirects every `<root>-<timestamp>` variant to
 * the fresh post. ru/uz siblings are regenerated with fresh localized slugs.
 *
 * It is idempotent and batched — designed to be driven by an hourly GitHub
 * Actions schedule that recovers a few topics per run until the list is
 * exhausted, staying under the Unsplash Demo budget (50 req/hr, ~5 req/topic).
 *
 *   npx tsx scripts/backfill-lost-posts.ts [--limit N] [--offset N] [--dry-run]
 */

import 'dotenv/config';
import { readFileSync, appendFileSync } from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { slugTaken } from '../src/modules/blog/model/posts.repository';
import { SERVICE_PILLARS, type PostFormat } from '../src/modules/blog/data/seo-topics';
import { generateMetaDescription, type TopicResult } from '../src/modules/blog/api/generator';
import { producePostContent, persistLocalePost, type BlogLocale } from '../src/modules/blog/api/pipeline';
import { buildFactSheet, verifyFactUrls, EMPTY_FACT_SHEET, type FactSheet } from '../src/modules/blog/api/research';
import { getCoverImageForTopic, getImagesForPost } from '../src/modules/blog/utils/unsplash';
import { pingIndexNow } from '../src/modules/blog/utils/indexnow';
import { sendTelegramMessage, escapeTelegramHtml } from '../src/core/notify';
import type { ICoverImage } from '../src/modules/blog/model/BlogPost';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
if (!process.env.MOONSHOT_API_KEY && !process.env.KIMI_API_KEY && !process.env.DEEPSEEK_API_KEY) {
  throw new Error('No AI key set (MOONSHOT_API_KEY or DEEPSEEK_API_KEY)');
}

const LOCALES: BlogLocale[] = ['en', 'ru', 'uz'];

interface LostTopic {
  slug: string;
  title: string;
  pillar: string;
  impressions: number;
}

// Read relative to the repo root (CI and local runs both invoke tsx from root).
const LOST_TOPICS: LostTopic[] = JSON.parse(readFileSync('scripts/data/lost-topics.json', 'utf8')).topics;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) continue;
    const key = args[i].slice(2);
    if (i + 1 < args.length && !args[i + 1].startsWith('--')) opts[key] = args[++i];
    else flags.add(key);
  }
  return {
    limit: Math.max(1, Number(opts.limit) || 4),
    offset: Math.max(0, Number(opts.offset) || 0),
    dryRun: flags.has('dry-run'),
  };
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || 'https://softwhere.uz').replace(/\/+$/, '');
}

function writeStepSummary(markdown: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  try {
    appendFileSync(file, `${markdown}\n`);
  } catch {
    /* best-effort */
  }
}

function setOutput(key: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  try {
    appendFileSync(file, `${key}=${value}\n`);
  } catch {
    /* best-effort */
  }
}

/** Best-effort ISR cache bust so recovered posts appear immediately. */
async function requestRevalidate(): Promise<boolean> {
  const secret = process.env.API_SECRET;
  if (!secret) return false;
  try {
    const res = await fetch(`${baseUrl()}/api/admin/revalidate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------

/** A topic is "done" once its pinned EN slug exists in any status. */
function isDone(topic: LostTopic): Promise<boolean> {
  return slugTaken(topic.slug, 'en');
}

function toTopicResult(t: LostTopic): TopicResult {
  const pillar = SERVICE_PILLARS.find(p => p.id === t.pillar);
  return {
    id: `restore-${t.slug}`,
    title: t.title,
    primaryKeyword: t.title.toLowerCase().slice(0, 60),
    secondaryKeywords: [],
    searchIntent: 'informational',
    postFormat: 'beginner-guide' as PostFormat,
    targetQueries: [t.title.toLowerCase()],
    imageHints: [],
    servicePillar: t.pillar,
    pillarName: pillar?.name ?? 'Software Development',
  };
}

interface RestoredPost {
  locale: string;
  title: string;
  slug: string;
  url: string;
}

async function restoreTopic(t: LostTopic): Promise<RestoredPost[]> {
  const topic = toTopicResult(t);
  const generationGroupId = uuidv4();
  console.log(`\n📦 Restoring "${topic.title}" (pinned EN slug: ${t.slug})`);

  const metaDesc = await generateMetaDescription(topic.title, topic.primaryKeyword, 'en');

  let factSheet: FactSheet = EMPTY_FACT_SHEET;
  try {
    factSheet = await verifyFactUrls(await buildFactSheet(topic));
    console.log(`   🔬 ${factSheet.facts.length} verified fact(s) from ${factSheet.searches} search(es)`);
  } catch (err) {
    console.warn('   ⚠️ Research failed, writing ungrounded:', (err as Error).message);
  }

  // Fetch images ONCE per topic (reused across locales) — the Unsplash cost unit.
  const coverImage = await getCoverImageForTopic(topic.title, topic.imageHints?.[0]);
  const inlineImages = await getImagesForPost(topic.imageHints, topic.title, coverImage?.url);
  const allContentImages: ICoverImage[] = [...(coverImage ? [coverImage] : []), ...inlineImages];

  const created: RestoredPost[] = [];
  let enContent: string | undefined;

  for (const locale of LOCALES) {
    try {
      const produced = await producePostContent({
        topic,
        locale,
        inlineImages,
        factSheet,
        mode: 'deep',
        enContent: locale === 'en' ? undefined : enContent,
        enMetaDescription: metaDesc,
      });
      if (!produced) {
        console.error(`   ❌ No acceptable ${locale} content — skipped`);
        continue;
      }
      if (locale === 'en') enContent = produced.content;

      const saved = await persistLocalePost({
        topic,
        locale,
        content: produced.content,
        generationGroupId,
        coverImage: coverImage ?? null,
        allContentImages,
        metaDescription: metaDesc,
        status: 'published',
        localizedMeta: produced.localizedMeta,
        // Pin ONLY the EN slug to the old root so legacy timestamped URLs 301 to it.
        ...(locale === 'en' ? { slug: t.slug } : {}),
      });

      const url = `${baseUrl()}/${locale}/blog/${encodeURIComponent(saved.slug)}`;
      created.push({ locale, title: saved.title, slug: saved.slug, url });
      console.log(`   💾 Published ${locale}: "${saved.title}" (${saved.slug}) via ${produced.provider}`);
    } catch (err) {
      console.error(`   ❌ ${locale} failed:`, (err as Error).message);
    }
  }
  return created;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs();

  // Compute the pending backlog (skip topics whose EN slug already exists).
  const pending: LostTopic[] = [];
  for (const t of LOST_TOPICS) {
    if (!(await isDone(t))) pending.push(t);
  }
  console.log(`📚 ${LOST_TOPICS.length} lost topics total; ${pending.length} still to recover.`);

  const batch = pending.slice(opts.offset, opts.offset + opts.limit);

  if (opts.dryRun) {
    console.log(`\n🔎 Dry run — next ${batch.length} topic(s) that WOULD be regenerated:`);
    batch.forEach((t, i) => console.log(`   ${i + 1}. ${t.slug}  (${t.impressions} impr)`));
    setOutput('remaining', String(pending.length));
    setOutput('done', pending.length === 0 ? 'true' : 'false');
    return;
  }

  if (batch.length === 0) {
    console.log('✅ Nothing to do — every lost topic has been recovered.');
    writeStepSummary('### ✅ Backfill complete\nEvery lost topic has been recovered.');
    setOutput('remaining', '0');
    setOutput('done', 'true');
    return;
  }

  const allCreated: RestoredPost[] = [];
  const failed: string[] = [];
  for (const t of batch) {
    const created = await restoreTopic(t);
    if (created.length > 0) allCreated.push(...created);
    else failed.push(t.slug);
  }

  // Publish side effects: notify search engines + bust the site's ISR caches.
  if (allCreated.length > 0) {
    await pingIndexNow(allCreated.map(p => p.url));
    const revalidated = await requestRevalidate();
    console.log(
      revalidated
        ? '\n📣 IndexNow pinged, caches revalidated — posts are live.'
        : '\n📣 IndexNow pinged (cache bust skipped/failed — visible within ~1h).'
    );
  }

  // Recount so the workflow knows when to stop scheduling itself.
  let remaining = 0;
  for (const t of LOST_TOPICS) if (!(await isDone(t))) remaining++;

  const summary = [
    `### 🔁 Lost-post backfill — ${allCreated.length} post(s) across ${batch.length} topic(s)`,
    '',
    '| Locale | Title | URL |',
    '|---|---|---|',
    ...allCreated.map(p => `| ${p.locale} | ${p.title} | [link](${p.url}) |`),
    ...(failed.length ? ['', `⚠️ Topics with no acceptable content: ${failed.join(', ')} (will retry next run).`] : []),
    '',
    `**Remaining topics to recover: ${remaining}** ${remaining === 0 ? '— backfill complete, disabling the hourly schedule.' : '— the hourly schedule will continue.'}`,
  ];
  writeStepSummary(summary.join('\n'));

  console.log(`\n🏁 Batch done: ${allCreated.length} post(s), ${failed.length} topic failure(s), ${remaining} topic(s) remaining.`);

  if (allCreated.length > 0) {
    const list = allCreated
      .filter(p => p.locale === 'en')
      .map(p => `• <a href="${p.url}">${escapeTelegramHtml(p.title)}</a>`)
      .join('\n');
    await sendTelegramMessage(
      `<b>🔁 Recovered ${batch.length} lost topic(s)</b>\n${list}\n\n<b>${remaining}</b> topic(s) left to recover.`
    ).catch(() => {});
  }

  setOutput('remaining', String(remaining));
  setOutput('done', remaining === 0 ? 'true' : 'false');

  // Non-zero exit if a topic produced nothing, so the run is visibly retried.
  if (failed.length > 0) process.exitCode = 1;
}

main().catch(async err => {
  console.error('💥 Backfill crashed:', err);
  writeStepSummary(`### ❌ Backfill crashed\n\`\`\`\n${String(err?.stack ?? err).slice(0, 1500)}\n\`\`\``);
  await sendTelegramMessage(`<b>💥 Lost-post backfill crashed</b>\n<pre>${escapeTelegramHtml(String(err).slice(0, 500))}</pre>`).catch(
    () => {}
  );
  process.exit(1);
});
