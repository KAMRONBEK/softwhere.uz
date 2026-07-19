/**
 * Backfill cover images for published posts that have none.
 *
 * The generator treats the cover as optional: when Unsplash is unreachable (no
 * key, rate limit, API error) it logs a warning and stores the post without one
 * (`src/modules/blog/utils/unsplash.ts`). A whole batch generated during such a
 * window ends up cover-less — the list card then shows the gradient/initial
 * placeholder and the post page has no hero at all.
 *
 * Backfills one image per generation group, matching how the generator works:
 * the en/ru/uz siblings of a topic share a single cover. Keyword selection uses
 * the group's English title (Unsplash search is English-only), so ru/uz posts
 * get a relevant photo rather than one derived from a transliterated slug.
 *
 * Images already used by other posts are rejected and re-searched, since
 * duplicate covers across topics are a tracked audit issue
 * (`scripts/lib/similarity.ts` findDuplicateCovers).
 *
 * Usage:
 *   npx tsx scripts/backfill-covers.ts --list     # what's missing (no API calls)
 *   npx tsx scripts/backfill-covers.ts            # dry run — resolve images, write nothing
 *   npx tsx scripts/backfill-covers.ts --apply    # write to the database
 *   npx tsx scripts/backfill-covers.ts --apply --groups=<id>,<id>   # only these groups
 */

import { config } from 'dotenv';
// Match Next's precedence: .env.local wins, .env fills the gaps. Plain
// `dotenv/config` reads only .env, where UNSPLASH_ACCESS_KEY is not kept.
// dotenv never overwrites an already-set var, so load .env.local first.
config({ path: '.env.local' });
config();

import { listAll, updateFieldsById } from '../src/modules/blog/model/posts.repository';
import { getCoverImageForTopic } from '../src/modules/blog/utils/unsplash';
import type { ICoverImage } from '../src/modules/blog/model/BlogPost';

const APPLY = process.argv.includes('--apply');
const LIST_ONLY = process.argv.includes('--list');

/**
 * Read `--groups=a,b` or `--groups a,b`, splitting on commas OR whitespace.
 *
 * Both tolerances matter because the value arrives through a shell: an
 * unquoted "a, b" word-splits into separate argv entries, and only accepting
 * the `=` form would leave the flag silently unparsed. An unparsed filter is
 * the dangerous case — an empty set means "no filter", so a run meant for one
 * group would rewrite every cover-less post instead.
 */
function parseGroupFilter(argv: string[]): { requested: Set<string>; flagPresent: boolean } {
  const flagAt = argv.findIndex(a => a === '--groups' || a.startsWith('--groups='));
  if (flagAt === -1) return { requested: new Set(), flagPresent: false };
  const parts: string[] = [];
  const inline = argv[flagAt].startsWith('--groups=') ? argv[flagAt].slice('--groups='.length) : '';
  if (inline) parts.push(inline);
  // Trailing bare tokens belong to the flag until the next option.
  for (let i = flagAt + 1; i < argv.length && !argv[i].startsWith('--'); i++) parts.push(argv[i]);
  const requested = new Set(
    parts
      .join(',')
      .split(/[,\s]+/)
      .map(g => g.trim())
      .filter(Boolean)
  );
  return { requested, flagPresent: true };
}

const { requested: ONLY_GROUPS, flagPresent: GROUP_FILTER_ON } = parseGroupFilter(process.argv.slice(2));
if (GROUP_FILTER_ON && ONLY_GROUPS.size === 0) {
  throw new Error('--groups was given with no usable ids. Refusing to run: an empty filter would backfill every post.');
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
// --list only reads the database; the key is needed the moment we fetch.
if (!LIST_ONLY && !process.env.UNSPLASH_ACCESS_KEY) {
  throw new Error('UNSPLASH_ACCESS_KEY not set — required to fetch covers. Run with --list to see what is missing without it.');
}

interface Target {
  key: string;
  posts: Array<{ _id: string; title: string; slug: string; locale: string }>;
  /** English title when the group has one — the best Unsplash query. */
  queryTitle: string;
}

async function main() {
  const all = await listAll();
  const published = all.filter(p => p.status === 'published');

  // Every photo already on the blog — covers AND inline body illustrations.
  // contentImages matter: a post's own inline photo reappearing as its hero is
  // the duplicate a reader notices first.
  const usedUrls = new Set<string>();
  for (const p of published) {
    if (p.coverImage?.url) usedUrls.add(p.coverImage.url);
    for (const img of p.contentImages ?? []) if (img?.url) usedUrls.add(img.url);
  }

  // Group cover-less posts. Posts without a generationGroupId are their own
  // group (keyed by id) so they still get an individual cover.
  const groups = new Map<string, Target>();
  for (const p of published) {
    if (p.coverImage?.url) continue;
    const key = p.generationGroupId ?? `solo:${p._id}`;
    if (ONLY_GROUPS.size > 0 && !ONLY_GROUPS.has(key)) continue;
    const entry = groups.get(key) ?? { key, posts: [], queryTitle: '' };
    entry.posts.push({ _id: p._id, title: p.title, slug: p.slug, locale: p.locale });
    if (!entry.queryTitle || p.locale === 'en') entry.queryTitle = p.title;
    groups.set(key, entry);
  }

  // An id that matched nothing is an operator error — a typo, an already-covered
  // group, or a post id where a group id was meant. Saying "all covered" here
  // would report success for work that never ran.
  const unmatched = [...ONLY_GROUPS].filter(id => !groups.has(id));
  if (unmatched.length > 0) {
    console.error(`❌ No cover-less posts for: ${unmatched.join(', ')}`);
    console.error('   (already covered, mistyped, or a post id rather than a generationGroupId — check --list.)');
    process.exitCode = 1;
  }

  if (groups.size === 0) {
    if (!GROUP_FILTER_ON) console.log('✅ Every published post already has a cover image.');
    else console.log('Nothing to do for the requested group(s).');
    return;
  }

  const totalPosts = [...groups.values()].reduce((n, g) => n + g.posts.length, 0);
  const mode = LIST_ONLY ? '📋 Missing covers —' : APPLY ? '🖼️  Backfilling' : '🔍 Dry run —';
  console.log(`${mode} ${groups.size} group(s), ${totalPosts} post(s)\n`);

  if (LIST_ONLY) {
    for (const group of groups.values()) {
      console.log(`• ${group.queryTitle}`);
      console.log(`  group ${group.key}`);
      for (const p of group.posts) console.log(`    ${p.locale}  ${p.slug}`);
      console.log('');
    }
    console.log(`${totalPosts} post(s) across ${groups.size} group(s) would receive a cover.`);
    console.log('Run without --list (needs UNSPLASH_ACCESS_KEY) to resolve images, then --apply to save.');
    return;
  }

  let filled = 0;
  let failed = 0;

  for (const group of groups.values()) {
    const locales = group.posts
      .map(p => p.locale)
      .sort()
      .join('/');
    console.log(`• ${group.queryTitle}`);
    console.log(`  group ${group.key} · ${locales}`);

    // getCoverImageForTopic skips photos in usedUrls while searching, so one
    // call is enough. Re-querying used to be the retry, but the AI settles on
    // the same keyword for a generic title and the search returned the same
    // top hit each time — three attempts, one photo, always a duplicate.
    const image = await getCoverImageForTopic(group.queryTitle, undefined, usedUrls);

    if (!image) {
      console.log('  ❌ no usable image found — left without a cover\n');
      failed++;
      continue;
    }

    usedUrls.add(image.url);
    console.log(`  ✓ "${image.keyword}" — ${image.authorName}`);

    if (APPLY) {
      // updatedAt is maintained by the schema's $onUpdate hook — don't set it.
      for (const post of group.posts) {
        await updateFieldsById(post._id, { coverImage: image });
      }
      console.log(`  💾 applied to ${group.posts.length} post(s)\n`);
    } else {
      console.log(`  (dry run — would apply to ${group.posts.map(p => p.slug).join(', ')})\n`);
    }
    filled++;
  }

  console.log(`${APPLY ? 'Done' : 'Dry run complete'}: ${filled} group(s) covered, ${failed} unresolved.`);
  if (!APPLY && filled > 0) console.log('Re-run with --apply to write these to the database.');

  // Exit non-zero on any unresolved group: a green run that quietly left posts
  // cover-less is exactly the outcome this script exists to surface.
  if (failed > 0) {
    console.error(`\n${failed} group(s) still have no cover — see the ❌ lines above.`);
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
