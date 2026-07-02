/**
 * Read-only blog audit — replaces the old scripts/regenerate-posts.ts "fix"
 * pipeline, whose regeneration half embedded the pre-overhaul prompts
 * (fabricated-stats instruction, DeepSeek-only, English keyword stomping) and
 * would have UNDONE the July-2026 quality work if ever run in fix mode.
 *
 * This script only detects and reports: structural gaps (missing images/meta/
 * category, thin content) and cross-group similarity (duplicate covers,
 * near-duplicate titles/content). Fixing is a human decision in the admin —
 * or a targeted re-generation with scripts/generate-post.ts.
 *
 * Usage: npx tsx scripts/audit-posts.ts [--json]
 */

import 'dotenv/config';
import { appendFileSync } from 'node:fs';
import { listAll } from '../src/modules/blog/model/posts.repository';
import { analyzeGroup, countIssues, type GroupAnalysis, type PostDoc } from './lib/post-structure';
import { findDuplicateCovers, findSimilarTitles, findSimilarContent } from './lib/similarity';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');

function toDoc(post: Awaited<ReturnType<typeof listAll>>[number]): PostDoc {
  return {
    _id: post._id,
    title: post.title,
    slug: post.slug,
    content: post.content,
    status: post.status,
    locale: post.locale,
    generationGroupId: post.generationGroupId ?? undefined,
    coverImage: post.coverImage ?? undefined,
    contentImages: post.contentImages ?? undefined,
    category: post.category ?? undefined,
    postFormat: post.postFormat ?? undefined,
    primaryKeyword: post.primaryKeyword ?? undefined,
    secondaryKeywords: post.secondaryKeywords ?? undefined,
    metaDescription: post.metaDescription ?? undefined,
  };
}

async function main() {
  const asJson = process.argv.includes('--json');
  const posts = (await listAll()).map(toDoc);
  console.log(`🔍 Auditing ${posts.length} posts...`);

  // Group by generationGroupId (solo posts audit as their own group).
  const groups = new Map<string, PostDoc[]>();
  for (const post of posts) {
    const key = post.generationGroupId || `solo-${post._id}`;
    groups.set(key, [...(groups.get(key) ?? []), post]);
  }

  // Cross-group similarity on EN posts (same logic the old tool used).
  const enPosts = posts.filter(p => p.locale === 'en');
  const groupIdOf = (p: PostDoc) => p.generationGroupId || `solo-${p._id}`;

  // findDuplicateCovers returns URL -> groupIds; invert to a groupId set.
  const dupCoverGroups = new Set<string>();
  findDuplicateCovers(
    enPosts.map(p => ({ _id: String(p._id), generationGroupId: groupIdOf(p), coverUrl: p.coverImage?.url ?? '' }))
  ).forEach(groupIds => groupIds.forEach(gid => dupCoverGroups.add(gid)));

  const similarTitles = findSimilarTitles(
    enPosts.map(p => ({ _id: String(p._id), generationGroupId: groupIdOf(p), title: p.title ?? '', locale: 'en' }))
  );
  const similarContents = findSimilarContent(
    enPosts.map(p => ({ _id: String(p._id), generationGroupId: groupIdOf(p), content: p.content ?? '', locale: 'en' }))
  );

  const analyses: GroupAnalysis[] = [];
  for (const [groupId, groupPosts] of groups) {
    analyses.push(
      analyzeGroup(groupPosts, groupId, {
        duplicateCover: dupCoverGroups.has(groupId),
        similarTitle: similarTitles.has(groupId),
        similarContent: similarContents.has(groupId),
      })
    );
  }

  const flagged = analyses.filter(a => countIssues(a) > 0).sort((a, b) => countIssues(b) - countIssues(a));

  if (asJson) {
    console.log(
      JSON.stringify(
        flagged.map(a => ({
          groupId: a.groupId,
          issues: countIssues(a),
          titles: a.posts.map(p => `[${p.locale}] ${p.title}`),
          perPost: Object.fromEntries([...a.issuesByPost].filter(([, v]) => v.length > 0)),
          similarTitle: a.similarTitle,
          similarContent: a.similarContent,
          duplicateCover: a.duplicateCover,
        })),
        null,
        2
      )
    );
  } else {
    for (const a of flagged) {
      console.log(`\n📦 ${a.groupId} — ${countIssues(a)} issue(s)`);
      console.log(`   ${a.enPost?.title ?? a.posts[0]?.title ?? '(untitled)'}`);
      for (const post of a.posts) {
        const issues = a.issuesByPost.get(String(post._id)) ?? [];
        if (issues.length > 0) console.log(`   [${post.locale}] ${post.slug}: ${issues.join(', ')}`);
      }
      if (a.duplicateCover) console.log('   ⚠ cover image duplicated in another group');
      if (a.similarTitle) console.log('   ⚠ title similar to another group');
      if (a.similarContent) console.log('   ⚠ content similar to another group');
    }
  }

  const summary = [
    '### 🔍 Blog audit',
    '',
    `**Posts:** ${posts.length} in ${groups.size} groups — **${flagged.length} group(s) flagged**`,
    '',
    ...(flagged.length > 0
      ? [
          '| Group | Issues | Title |',
          '|---|---|---|',
          ...flagged.slice(0, 30).map(a => `| \`${a.groupId.slice(0, 18)}\` | ${countIssues(a)} | ${a.enPost?.title ?? a.posts[0]?.title ?? ''} |`),
        ]
      : ['✅ No structural or similarity issues found.']),
  ].join('\n');

  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
    } catch {
      /* best-effort */
    }
  }

  console.log(`\n🏁 ${flagged.length} of ${groups.size} groups have issues.`);
  process.exit(0);
}

main().catch(err => {
  console.error('💥 Audit failed:', err);
  process.exit(1);
});
