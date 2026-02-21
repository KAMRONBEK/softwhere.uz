/**
 * Post structure validation.
 * Defines what a well-formed blog post must contain and detects missing parts.
 */

// ---------------------------------------------------------------------------
// Constants (duplicated from src/data/seo-topics to avoid @/ alias)
// ---------------------------------------------------------------------------

export const SERVICE_PILLARS = [
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

export const POST_FORMATS = [
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
] as const;

export type PostFormat = (typeof POST_FORMATS)[number];

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface CoverImage {
  url?: string;
  thumbUrl?: string;
  authorName?: string;
  authorUrl?: string;
  keyword?: string;
}

interface ContentImage {
  url?: string;
  thumbUrl?: string;
  authorName?: string;
  authorUrl?: string;
  keyword?: string;
}

export interface PostDoc {
  _id: string;
  title?: string;
  slug?: string;
  content?: string;
  status?: string;
  locale?: string;
  generationGroupId?: string;
  coverImage?: CoverImage;
  contentImages?: ContentImage[];
  category?: string;
  postFormat?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  metaDescription?: string;
}

// ---------------------------------------------------------------------------
// Issue types
// ---------------------------------------------------------------------------

export type PostIssue =
  | 'missing-cover-image'
  | 'missing-inline-images'
  | 'missing-category'
  | 'missing-post-format'
  | 'missing-primary-keyword'
  | 'missing-secondary-keywords'
  | 'missing-meta-description'
  | 'content-too-short'
  | 'content-no-inline-images'  // content has no ![...](...) markdown
  | 'invalid-category'
  | 'invalid-post-format';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function hasCoverImage(post: PostDoc): boolean {
  return !!(post.coverImage?.url && post.coverImage?.thumbUrl);
}

function hasInlineImages(post: PostDoc, minCount = 1): boolean {
  if (!post.contentImages || post.contentImages.length < minCount) return false;
  const validImages = post.contentImages.filter(img => img.url && img.thumbUrl);
  return validImages.length >= minCount;
}

function contentHasImageMarkdown(content: string): boolean {
  return /!\[.*?\]\(https?:\/\/.*?\)/.test(content);
}

function wordCount(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

export function getPostIssues(post: PostDoc): PostIssue[] {
  const issues: PostIssue[] = [];

  if (!hasCoverImage(post)) issues.push('missing-cover-image');

  const wc = wordCount(post.content ?? '');
  const minInline = wc >= 3000 ? 3 : wc >= 1500 ? 2 : 1;
  if (!hasInlineImages(post, minInline)) issues.push('missing-inline-images');

  if (!post.category) issues.push('missing-category');
  else if (!SERVICE_PILLARS.includes(post.category)) issues.push('invalid-category');

  if (!post.postFormat) issues.push('missing-post-format');
  else if (!(POST_FORMATS as readonly string[]).includes(post.postFormat)) issues.push('invalid-post-format');

  if (!post.primaryKeyword) issues.push('missing-primary-keyword');
  if (!post.secondaryKeywords || post.secondaryKeywords.length === 0) issues.push('missing-secondary-keywords');
  if (!post.metaDescription) issues.push('missing-meta-description');

  if (wc < 300) issues.push('content-too-short');

  if (post.content && !contentHasImageMarkdown(post.content)) issues.push('content-no-inline-images');

  return issues;
}

// ---------------------------------------------------------------------------
// Group-level analysis
// ---------------------------------------------------------------------------

export interface GroupAnalysis {
  groupId: string;
  posts: PostDoc[];
  enPost: PostDoc | null;
  issuesByPost: Map<string, PostIssue[]>;
  needsClassification: boolean;
  needsCover: boolean;
  needsInlineImages: boolean;
  needsMeta: boolean;
  needsContentRewrite: boolean;
  hasContentWithoutImages: boolean;
  duplicateCover: boolean;
  similarTitle: boolean;
  similarContent: boolean;
}

export function analyzeGroup(
  posts: PostDoc[],
  groupId: string,
  opts: { duplicateCover?: boolean; similarTitle?: boolean; similarContent?: boolean } = {},
): GroupAnalysis {
  const enPost = posts.find(p => p.locale === 'en') ?? null;
  const issuesByPost = new Map<string, PostIssue[]>();

  let needsClassification = false;
  let needsCover = false;
  let needsInlineImages = false;
  let needsMeta = false;
  let needsContentRewrite = false;
  let hasContentWithoutImages = false;

  for (const post of posts) {
    const issues = getPostIssues(post);
    issuesByPost.set(String(post._id), issues);

    if (issues.includes('missing-category') || issues.includes('missing-post-format') ||
        issues.includes('missing-primary-keyword') || issues.includes('invalid-category') ||
        issues.includes('invalid-post-format'))
      needsClassification = true;

    if (issues.includes('missing-cover-image')) needsCover = true;
    if (issues.includes('missing-inline-images')) needsInlineImages = true;
    if (issues.includes('missing-meta-description')) needsMeta = true;
    if (issues.includes('content-too-short')) needsContentRewrite = true;
    if (issues.includes('content-no-inline-images')) hasContentWithoutImages = true;
  }

  return {
    groupId,
    posts,
    enPost,
    issuesByPost,
    needsClassification,
    needsCover: needsCover || !!opts.duplicateCover,
    needsInlineImages,
    needsMeta,
    needsContentRewrite: needsContentRewrite || !!opts.similarContent,
    hasContentWithoutImages,
    duplicateCover: !!opts.duplicateCover,
    similarTitle: !!opts.similarTitle,
    similarContent: !!opts.similarContent,
  };
}

export function countIssues(analysis: GroupAnalysis): number {
  let total = 0;
  analysis.issuesByPost.forEach(issues => { total += issues.length; });
  if (analysis.duplicateCover) total++;
  if (analysis.similarTitle) total++;
  if (analysis.similarContent) total++;
  return total;
}
