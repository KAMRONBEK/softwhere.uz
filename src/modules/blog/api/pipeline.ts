/**
 * The single content pipeline behind BOTH generation entry points:
 *  - the admin API route (mode 'fast': draft → lint → one revision)
 *  - the weekly GitHub Action  (mode 'deep': draft → lint/revise → cross-model
 *    critique → revise), where wall-clock is free.
 *
 * Everything here degrades gracefully: no fact sheet → qualitative writing,
 * one provider configured → critique is skipped, revision fails → the draft
 * stands unless it still contains fabricated links (the one hard failure).
 */

import type { IBlogPost, ICoverImage } from '@/modules/blog/model/BlogPost';
import { createPost, slugTaken } from '@/modules/blog/model/posts.repository';
import { configuredProviders, generateContentWithProvider, safeGenerateJSON, type ProviderName } from '@/core/ai';
import { logger } from '@/core/logger';
import {
  buildTopicPrompt,
  buildSourcePrompt,
  buildCritiquePrompt,
  buildCritiqueRevisionPrompt,
  parseCritique,
  localizePostMeta,
  createSlug,
  WORD_FLOOR,
  type TopicResult,
  type SourceClassification,
} from '@/modules/blog/api/generator';
import { lintContent, buildRevisionInstruction, type LintIssue } from '@/modules/blog/api/quality';
import type { FactSheet } from '@/modules/blog/api/research';

const CONTEXT = 'BLOG';

export type PipelineMode = 'fast' | 'deep';
export type BlogLocale = 'en' | 'ru' | 'uz';

export interface ProduceOptions {
  topic: TopicResult;
  /** When set, the post is written from source material instead of the bare topic. */
  source?: { text: string; classification: SourceClassification };
  locale: BlogLocale;
  inlineImages: ICoverImage[];
  factSheet?: FactSheet;
  mode: PipelineMode;
}

export interface ProducedContent {
  content: string;
  provider: string;
  /** Lint issues that remained after revision (never includes link issues). */
  residualIssues: LintIssue[];
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function allowedUrlsFor(factSheet: FactSheet | undefined, images: ICoverImage[], source?: ProduceOptions['source']): string[] {
  const urls = [
    ...(factSheet?.facts.map(f => f.sourceUrl) ?? []),
    ...images.map(i => i.url),
    ...images.map(i => i.thumbUrl),
    'https://unsplash.com',
    'https://images.unsplash.com',
  ];
  void source;
  return urls;
}

/**
 * Draft, lint, and (in deep mode) critique-revise one locale's post body.
 * Returns null when nothing acceptable could be produced — the caller skips
 * the locale rather than persist filler.
 */
export async function producePostContent(opts: ProduceOptions): Promise<ProducedContent | null> {
  const { topic, source, locale, inlineImages, factSheet, mode } = opts;

  const { system, user } = source
    ? buildSourcePrompt(source.text, source.classification, locale, inlineImages, factSheet)
    : buildTopicPrompt(topic, locale, inlineImages, factSheet);

  const label = source ? `blog-source-${locale}` : `blog-${topic.postFormat}-${locale}`;
  const extras = {
    // Uzbek goes to DeepSeek first: Kimi's Uzbek is measurably weak (UzLiB).
    ...(locale === 'uz' && { prefer: 'deepseek' as const }),
    temperature: 1.3, // applies to DeepSeek only; Kimi sampling is fixed
  };

  const drafted = await generateContentWithProvider(user, label, undefined, system, extras);
  if (!drafted || wordCount(drafted.text) < WORD_FLOOR) {
    logger.warn(`Draft missing or under ${WORD_FLOOR} words for ${locale} — skipping locale`, undefined, CONTEXT);
    return null;
  }

  let content = drafted.text;
  const allowedUrls = allowedUrlsFor(factSheet, inlineImages, source);

  // --- Deterministic lint + one surgical revision --------------------------
  let issues = lintContent(content, { locale, allowedUrls });
  if (issues.length > 0) {
    logger.info(`Lint found ${issues.length} issue(s) in ${locale} draft — revising`, undefined, CONTEXT);
    const revisionPrompt = `${buildRevisionInstruction(issues)}

DRAFT:
---
${content}
---`;
    const revised = await generateContentWithProvider(revisionPrompt, `blog-revise-${locale}`, undefined, system, extras);
    if (revised && wordCount(revised.text) >= WORD_FLOOR) content = revised.text;
  }

  // --- Cross-model critique (deep mode, needs both providers) --------------
  if (mode === 'deep' && configuredProviders().length > 1) {
    const critic: ProviderName = drafted.provider === 'kimi' ? 'deepseek' : 'kimi';
    const critique = buildCritiquePrompt(content, locale, factSheet);
    const rawCritique = await safeGenerateJSON(critique.user, `blog-critique-${locale}`, 1500, critique.system, {
      prefer: critic,
      temperature: 1.0,
    });
    const critiqueIssues = parseCritique(rawCritique);
    if (critiqueIssues.length > 0) {
      logger.info(`Critique (${critic}) raised ${critiqueIssues.length} issue(s) for ${locale} — revising`, undefined, CONTEXT);
      const revised = await generateContentWithProvider(
        buildCritiqueRevisionPrompt(content, critiqueIssues, locale),
        `blog-critique-revise-${locale}`,
        undefined,
        system,
        extras
      );
      if (revised && wordCount(revised.text) >= WORD_FLOOR) content = revised.text;
    }
  }

  // --- Final gate -----------------------------------------------------------
  issues = lintContent(content, { locale, allowedUrls });
  const linkIssues = issues.filter(i => i.type === 'link');
  if (linkIssues.length > 0) {
    // Fabricated citations survived a revision pass: refuse the post rather
    // than publish invented sources. Everything else is a soft warning.
    logger.warn(`Refusing ${locale} content: ${linkIssues.length} unapproved URL(s) after revision`, undefined, CONTEXT);
    return null;
  }

  return { content, provider: drafted.provider, residualIssues: issues };
}

// ---------------------------------------------------------------------------
// Persistence (shared by route and CLI)
// ---------------------------------------------------------------------------

export interface PersistOptions {
  topic: TopicResult;
  locale: BlogLocale;
  content: string;
  generationGroupId: string;
  coverImage: ICoverImage | null;
  allContentImages: ICoverImage[];
  metaDescription: string;
}

async function resolveUniqueSlug(baseSlug: string, locale: BlogLocale): Promise<string> {
  let candidate = baseSlug;
  for (let suffix = 1; await slugTaken(candidate, locale); suffix += 1) {
    candidate = `${baseSlug}-${suffix}`;
  }
  return candidate;
}

/** Localize meta for ru/uz, build a stable localized slug, persist as draft. */
export async function persistLocalePost(opts: PersistOptions): Promise<IBlogPost> {
  const { topic, locale, content } = opts;

  let title = topic.title;
  let metaDescription = opts.metaDescription;
  let primaryKeyword = topic.primaryKeyword;
  let secondaryKeywords = topic.secondaryKeywords;

  if (locale === 'ru' || locale === 'uz') {
    const localized = await localizePostMeta(locale, {
      title: topic.title,
      metaDescription: opts.metaDescription,
      primaryKeyword: topic.primaryKeyword,
      secondaryKeywords: topic.secondaryKeywords,
    });
    title = localized.title;
    metaDescription = localized.metaDescription;
    primaryKeyword = localized.primaryKeyword;
    secondaryKeywords = localized.secondaryKeywords;
  }

  const slugBase = createSlug(title) || createSlug(topic.title) || `post-${opts.generationGroupId.slice(0, 8)}`;
  const slug = await resolveUniqueSlug(slugBase, locale);

  return createPost({
    title,
    slug,
    content,
    status: 'draft',
    locale,
    generationGroupId: opts.generationGroupId,
    coverImage: opts.coverImage,
    category: topic.servicePillar,
    postFormat: topic.postFormat,
    primaryKeyword,
    secondaryKeywords,
    metaDescription,
    contentImages: opts.allContentImages,
  });
}
