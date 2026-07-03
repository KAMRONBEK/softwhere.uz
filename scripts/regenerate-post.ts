/**
 * In-place blog post regeneration through the upgraded pipeline — re-drafts
 * the BODY (and localized meta) of existing posts while keeping their slug,
 * URL, status, images, and generation group intact, so indexed pages improve
 * instead of moving.
 *
 * Built for the 2026-07 content review: the worst RU/UZ posts (truncated
 * bodies, English keyword stuffing, missing charts, diverging outlines) get
 * re-produced with the EN sibling as the structural anchor, in deep mode
 * (lint → cross-model critique → native proofread), on the quality tier
 * (DeepSeek V4 Pro / Kimi K2.6).
 *
 * Usage:
 *   npx tsx scripts/regenerate-post.ts --groups <id,id,...> [options]
 *
 * Options:
 *   --groups <list>   Comma-separated generationGroupIds (required)
 *   --locales <list>  Locales to regenerate per group (default: ru,uz).
 *                     'en' is processed first and becomes the anchor for ru/uz.
 *   --dryRun          Produce content and write previews to ./regen-preview/
 *                     without touching the DB.
 *
 * Requires: DATABASE_URL, MOONSHOT_API_KEY (+ DEEPSEEK_API_KEY for the UZ
 * path and cross-model critique). Old rows are printed to the log and saved
 * to ./regen-backups/ before every update.
 */

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { appendFileSync } from 'node:fs';
import * as postsRepo from '../src/modules/blog/model/posts.repository';
import type { IBlogPost, ICoverImage } from '../src/modules/blog/model/BlogPost';
import { SERVICE_PILLARS, type PostFormat } from '../src/modules/blog/data/seo-topics';
import type { TopicResult } from '../src/modules/blog/api/generator';
import { producePostContent, type BlogLocale } from '../src/modules/blog/api/pipeline';
import { buildFactSheet, verifyFactUrls, EMPTY_FACT_SHEET, type FactSheet } from '../src/modules/blog/api/research';
import { normalizeUzbekApostrophes } from '../src/modules/blog/utils/normalize';
import { pingIndexNow } from '../src/modules/blog/utils/indexnow';
import { sendTelegramMessage, escapeTelegramHtml } from '../src/core/notify';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
if (!process.env.MOONSHOT_API_KEY && !process.env.KIMI_API_KEY && !process.env.DEEPSEEK_API_KEY) {
  throw new Error('No AI key set (MOONSHOT_API_KEY or DEEPSEEK_API_KEY)');
}

const ALLOWED: BlogLocale[] = ['en', 'ru', 'uz'];
// en first: a freshly regenerated EN body becomes the anchor for ru/uz.
const LOCALE_ORDER: Record<BlogLocale, number> = { en: 0, ru: 1, uz: 2 };

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
    groups: (opts.groups || '')
      .split(',')
      .map(g => g.trim())
      .filter(Boolean),
    locales: (opts.locales || 'ru,uz')
      .split(',')
      .map(l => l.trim())
      .filter((l): l is BlogLocale => ALLOWED.includes(l as BlogLocale))
      .sort((a, b) => LOCALE_ORDER[a] - LOCALE_ORDER[b]),
    dryRun: flags.has('dryRun') || opts.dryRun === 'true',
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
    /* summary is best-effort */
  }
}

/** Rebuild the pipeline's TopicResult from the stored EN post (same shape the
 *  generate route uses for its continuation mode). */
function topicFromEnPost(en: IBlogPost): TopicResult {
  const pillar = SERVICE_PILLARS.find(p => p.id === en.category);
  return {
    id: en.category ?? 'unknown',
    title: en.title,
    primaryKeyword: en.primaryKeyword ?? en.title.toLowerCase().slice(0, 60),
    secondaryKeywords: en.secondaryKeywords ?? [],
    searchIntent: 'informational',
    postFormat: (en.postFormat ?? 'beginner-guide') as PostFormat,
    targetQueries: [en.primaryKeyword ?? en.title.toLowerCase()],
    imageHints: [],
    servicePillar: en.category ?? 'web-app-development',
    pillarName: pillar?.name ?? 'Software Development',
  };
}

async function fullPostFor(groupSiblings: Array<{ slug: string; locale: BlogLocale }>, locale: BlogLocale): Promise<IBlogPost | null> {
  const sibling = groupSiblings.find(s => s.locale === locale);
  if (!sibling) return null;
  return postsRepo.getPublishedBySlug(sibling.slug, locale);
}

async function main() {
  const opts = parseArgs();
  if (opts.groups.length === 0) {
    console.error('❌ --groups is required (comma-separated generationGroupIds)');
    process.exit(1);
  }
  if (opts.locales.length === 0) {
    console.error('❌ No valid locales requested');
    process.exit(1);
  }
  console.log(
    `${opts.dryRun ? '🧪 DRY RUN — no DB writes' : '✍️  Regenerating in place'} | groups: ${opts.groups.length} | locales: ${opts.locales.join(', ')}`
  );

  mkdirSync('regen-backups', { recursive: true });
  if (opts.dryRun) mkdirSync('regen-preview', { recursive: true });

  const updated: Array<{ locale: string; slug: string; url: string; provider: string; words: number; warnings: number }> = [];
  const failed: string[] = [];

  for (const groupId of opts.groups) {
    console.log(`\n📦 Group ${groupId}`);
    const siblings = (await postsRepo.getGroupSiblings(groupId)) as Array<{ slug: string; locale: BlogLocale }>;
    if (siblings.length === 0) {
      console.error('   ❌ No posts found for this group — skipping');
      failed.push(`${groupId} (not found)`);
      continue;
    }

    const enPost = await fullPostFor(siblings, 'en');
    if (!enPost) {
      console.error('   ❌ No EN sibling (needed as topic source + anchor) — skipping group');
      failed.push(`${groupId} (no EN post)`);
      continue;
    }

    const topic = topicFromEnPost(enPost);
    console.log(`   📝 Topic: "${topic.title}" (${topic.servicePillar}/${topic.postFormat})`);

    // Fresh research per group (same as a scheduled run) — grounded facts
    // power citations and the required chart.
    let factSheet: FactSheet = EMPTY_FACT_SHEET;
    try {
      factSheet = await verifyFactUrls(await buildFactSheet(topic));
      console.log(`   🔬 ${factSheet.facts.length} verified fact(s) from ${factSheet.searches} search(es)`);
    } catch (err) {
      console.warn('   ⚠️ Research failed, regenerating ungrounded:', (err as Error).message);
    }

    // A freshly regenerated EN body (when 'en' is in --locales) replaces the
    // stored one as the anchor for ru/uz in the same run.
    let enContent = enPost.content;

    for (const locale of opts.locales) {
      const target = await fullPostFor(siblings, locale);
      if (!target) {
        console.log(`   ⏭️  No ${locale} post in this group — skipping locale`);
        continue;
      }

      console.log(`   🌐 Regenerating ${locale.toUpperCase()} "${target.slug}" (deep pipeline)...`);
      const inlineImages: ICoverImage[] = target.coverImage
        ? (target.contentImages ?? []).filter(img => img.url !== target.coverImage!.url)
        : (target.contentImages ?? []);

      try {
        const produced = await producePostContent({
          topic,
          locale,
          inlineImages,
          factSheet,
          mode: 'deep',
          enContent: locale === 'en' ? undefined : enContent,
          enMetaDescription: enPost.metaDescription ?? '',
        });

        if (!produced) {
          console.error(`   ❌ No acceptable ${locale} content — post left untouched`);
          failed.push(`${groupId}/${locale}`);
          continue;
        }
        if (locale === 'en') enContent = produced.content;

        // Meta: reuse the pipeline's localization (the body was written
        // against it); EN keeps its stored title/keywords. Slug NEVER changes.
        const isUz = locale === 'uz';
        const norm = (s: string) => (isUz ? normalizeUzbekApostrophes(s) : s);
        const fields: Record<string, unknown> = { content: produced.content };
        if (produced.localizedMeta) {
          fields.title = norm(produced.localizedMeta.title);
          fields.metaDescription = norm(produced.localizedMeta.metaDescription || target.metaDescription || '');
          fields.primaryKeyword = norm(produced.localizedMeta.primaryKeyword);
          fields.secondaryKeywords = produced.localizedMeta.secondaryKeywords.map(norm);
        }

        // Backup the old row (log + file) before overwriting — the only copy.
        const backup = JSON.stringify(target, null, 1);
        writeFileSync(`regen-backups/${locale}--${target.slug}.json`, backup);
        console.log(`   💾 Backed up old row (${target.content.length} chars) to regen-backups/${locale}--${target.slug}.json`);

        if (opts.dryRun) {
          writeFileSync(`regen-preview/${locale}--${target.slug}.md`, produced.content);
          console.log(`   🧪 Preview written to regen-preview/${locale}--${target.slug}.md — DB untouched`);
        } else {
          await postsRepo.updateFieldsById(target._id, fields);
          console.log(`   ✅ Updated in place (${produced.content.length} chars via ${produced.provider}, slug unchanged)`);
        }

        const words = produced.content.split(/\s+/).filter(Boolean).length;
        updated.push({
          locale,
          slug: target.slug,
          url: `${baseUrl()}/${locale}/blog/${encodeURIComponent(target.slug)}`,
          provider: produced.provider,
          words,
          warnings: produced.residualIssues.length,
        });
        if (produced.residualIssues.length > 0) {
          console.log(
            `   ⚠️ ${produced.residualIssues.length} residual lint warning(s): ${produced.residualIssues.map(i => i.detail).join(' | ')}`
          );
        }
      } catch (err) {
        console.error(`   ❌ ${locale} failed:`, (err as Error).message);
        failed.push(`${groupId}/${locale}`);
      }
    }
  }

  // --- Publish side effects ---------------------------------------------------
  if (!opts.dryRun && updated.length > 0) {
    console.log('\n📣 Notifying search engines + busting caches...');
    await pingIndexNow(updated.map(p => p.url));
    if (process.env.API_SECRET) {
      try {
        const res = await fetch(`${baseUrl()}/api/admin/revalidate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.API_SECRET}` },
        });
        console.log(res.ok ? '   ✅ Site caches revalidated' : `   ⚠️ Revalidate returned ${res.status}`);
      } catch {
        console.log('   ⚠️ Revalidate call failed — updates surface within ~1h (ISR)');
      }
    }
  }

  // --- Report -------------------------------------------------------------------
  const summaryLines = [
    `### ${opts.dryRun ? '🧪 Regeneration dry run' : '♻️ Posts regenerated in place'}`,
    '',
    '| Locale | Slug | Words | Provider | Lint warnings |',
    '|---|---|---|---|---|',
    ...updated.map(p => `| [${p.locale}](${p.url}) | ${p.slug} | ${p.words} | ${p.provider} | ${p.warnings} |`),
    ...(failed.length > 0 ? ['', `⚠️ Failed: ${failed.join(', ')} — those posts were left untouched.`] : []),
  ];
  writeStepSummary(summaryLines.join('\n'));

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🏁 Done: ${updated.length} regenerated, ${failed.length} failed`);

  if (!opts.dryRun && updated.length > 0) {
    const list = updated.map(p => `• <a href="${p.url}">[${p.locale}] ${escapeTelegramHtml(p.slug)}</a>`).join('\n');
    await sendTelegramMessage(
      `<b>♻️ ${updated.length} blog post${updated.length > 1 ? 's' : ''} regenerated in place</b>\n${list}${failed.length > 0 ? `\n⚠️ Failed: ${failed.join(', ')}` : ''}`
    ).catch(() => {});
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  writeStepSummary(`### ❌ Regeneration crashed\n\`\`\`\n${String(err?.stack ?? err).slice(0, 1500)}\n\`\`\``);
  process.exit(1);
});
