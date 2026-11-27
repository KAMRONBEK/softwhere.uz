/**
 * Apply hand-reviewed post edits from git to the live blog.
 *
 * Each edit is a pair in content/post-edits/:
 *   <locale>--<slug>.md    the full corrected body (markdown)
 *   <locale>--<slug>.json  { "baseSha256": "<sha256 of the body it was edited from>", "title"?: "..." }
 *
 * The edit is written only if the live body still hashes to baseSha256, so a
 * post that changed after the edit was made (a regeneration, an admin edit) is
 * never overwritten: the script refuses it and the edit has to be redone.
 * Every replaced row is saved to ./post-edit-backups/ first.
 *
 * Usage:
 *   npx tsx scripts/apply-post-edits.ts --files <name,name,...> [--dryRun]
 *   (names are file stems such as uz--my-slug; "all" applies every pair)
 *
 * Requires DATABASE_URL. API_SECRET (optional) refreshes the cached pages.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as postsRepo from '../src/modules/blog/model/posts.repository';
import { pingIndexNow } from '../src/modules/blog/utils/indexnow';

const DIR = 'content/post-edits';
const LOCALES = ['en', 'ru', 'uz'] as const;
type Locale = (typeof LOCALES)[number];

interface EditMeta {
  baseSha256: string;
  title?: string;
}

const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const baseUrl = () => (process.env.NEXT_PUBLIC_BASE_URL || 'https://softwhere.uz').replace(/\/+$/, '');

function parseArgs() {
  const args = process.argv.slice(2);
  const files = args[args.indexOf('--files') + 1];
  const dryRun = args.includes('--dryRun') && args[args.indexOf('--dryRun') + 1] !== 'false';
  if (!args.includes('--files') || !files || files.startsWith('--')) throw new Error('--files <name,name,...|all> is required');
  return { files, dryRun };
}

function stems(files: string): string[] {
  if (files.trim() === 'all') {
    return readdirSync(DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => f.slice(0, -3));
  }
  return files
    .split(',')
    .map(s => s.trim().replace(/\.(md|json)$/, ''))
    .filter(Boolean);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const { files, dryRun } = parseArgs();
  const updated: { locale: Locale; slug: string }[] = [];
  const refused: string[] = [];
  mkdirSync('post-edit-backups', { recursive: true });

  for (const stem of stems(files)) {
    const [locale, slug] = stem.split(/--(.*)/s) as [Locale, string];
    const mdPath = `${DIR}/${stem}.md`;
    const metaPath = `${DIR}/${stem}.json`;
    if (!LOCALES.includes(locale) || !slug || !existsSync(mdPath) || !existsSync(metaPath)) {
      refused.push(`${stem}: missing ${mdPath} / ${metaPath} or bad <locale>--<slug> name`);
      continue;
    }
    const content = readFileSync(mdPath, 'utf8');
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as EditMeta;

    const post = await postsRepo.getPublishedBySlug(slug, locale);
    if (!post) {
      refused.push(`${stem}: no published post`);
      continue;
    }
    const liveHash = sha256(post.content);
    if (liveHash !== meta.baseSha256) {
      refused.push(
        `${stem}: live body changed since the edit was made (live ${liveHash.slice(0, 12)}, edit base ${meta.baseSha256.slice(0, 12)})`
      );
      continue;
    }
    if (content.trim().length < 500) {
      refused.push(`${stem}: edited body is suspiciously short (${content.length} chars)`);
      continue;
    }

    const title = meta.title?.trim() || post.title;
    console.log(
      `${dryRun ? '🔎 [dry run]' : '✏️'} ${stem}: ${post.content.length} → ${content.length} chars${title !== post.title ? `, title "${post.title}" → "${title}"` : ''}`
    );
    if (dryRun) continue;

    writeFileSync(`post-edit-backups/${stem}.json`, JSON.stringify(post, null, 1));
    const saved = await postsRepo.updateById(post._id, { content, title });
    if (!saved) {
      refused.push(`${stem}: update matched no row`);
      continue;
    }
    updated.push({ locale, slug });
  }

  if (updated.length > 0) {
    await pingIndexNow(updated.map(p => `${baseUrl()}/${p.locale}/blog/${p.slug}`));
    if (process.env.API_SECRET) {
      const res = await fetch(`${baseUrl()}/api/admin/revalidate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.API_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: updated.map(p => `/${p.locale}/blog/${p.slug}`) }),
      }).catch(() => null);
      console.log(
        res?.ok ? '✅ Site caches revalidated' : `⚠️ Revalidate failed (${res?.status ?? 'network'}); pages update on the next deploy`
      );
    }
  }

  console.log(`\nUpdated ${updated.length}, refused ${refused.length}.`);
  for (const r of refused) console.log(`  ✗ ${r}`);
  if (refused.length > 0) process.exit(1);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
