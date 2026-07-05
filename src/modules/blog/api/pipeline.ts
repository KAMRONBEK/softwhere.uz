/**
 * The single content pipeline behind BOTH generation entry points:
 *  - the admin API route (mode 'fast': draft → lint → one revision)
 *  - the scheduled GitHub Action  (mode 'deep': draft → lint/revise → cross-model
 *    critique → revise), where wall-clock is free.
 *
 * Everything here degrades gracefully: no fact sheet → qualitative writing,
 * one provider configured → critique is skipped, revision fails → the draft
 * stands, fabricated links → revised away (deep) or deterministically
 * stripped rather than costing the locale.
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
  buildContinuationPrompt,
  buildEnAnchorBlock,
  buildProofreadPrompt,
  parseCritique,
  localizePostMeta,
  createSlug,
  WORD_FLOOR,
  type LocalizedMeta,
  type TopicResult,
  type SourceClassification,
} from '@/modules/blog/api/generator';
import { lintContent, buildRevisionInstruction, stripUnapprovedUrls, type LintIssue } from '@/modules/blog/api/quality';
import {
  normalizeInternalLinks,
  normalizeUzbekApostrophes,
  renderChartBlocks,
  unwrapDocumentFence,
  stripLeadingThematicBreak,
  stripSiteNameSuffix,
} from '@/modules/blog/utils/normalize';
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
  /** The already-produced EN body — anchors ru/uz to the same outline/figures. */
  enContent?: string;
  /** The EN metaDescription, localized together with title/keywords for ru/uz. */
  enMetaDescription?: string;
}

export interface ProducedContent {
  content: string;
  provider: string;
  /** Lint issues that remained after revision (never includes link issues). */
  residualIssues: LintIssue[];
  /** Pre-localized meta for ru/uz — pass to persistLocalePost so it is not re-localized. */
  localizedMeta?: LocalizedMeta;
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * A final PARAGRAPH that ends without terminal punctuation means the model was
 * cut off (live UZ posts shipped ending mid-word: "...bilan test q"). Headings,
 * list items, table rows, quotes, and fences can validly end bare, so only a
 * plain-text last line trips this.
 */
function looksTruncated(text: string): boolean {
  const lines = text.trimEnd().split('\n');
  const last = lines[lines.length - 1]?.trim() ?? '';
  if (!last) return false;
  if (/^(#{1,6}\s|[-*+]\s|\d+\.\s|\||>|```)/.test(last)) return false;
  return !/[.!?…:)"'»”’*_`\]]$/.test(last);
}

/** Split off the final incomplete paragraph so the continuation can rewrite it in full. */
function splitIncompleteTail(content: string): { body: string; fragment: string } {
  const idx = content.lastIndexOf('\n\n');
  if (idx === -1) return { body: content, fragment: '' };
  return { body: content.slice(0, idx).trimEnd(), fragment: content.slice(idx).trim() };
}

/** Deterministic content normalization — must re-run after ANY full re-emit
 *  by a model, since a revision regenerates chart fences/links/apostrophes. */
function normalizeContent(content: string, locale: BlogLocale): string {
  // Structural fixes first: unwrap a whole-document ```markdown fence and drop a
  // stray leading `---`, so the H1 the reader page strips is the real first line.
  let out = unwrapDocumentFence(content);
  out = stripLeadingThematicBreak(out);
  out = renderChartBlocks(out);
  out = normalizeInternalLinks(out);
  return locale === 'uz' ? normalizeUzbekApostrophes(out) : out;
}

function buildLintRevisionPrompt(issues: LintIssue[], content: string): string {
  return `${buildRevisionInstruction(issues)}

DRAFT:
---
${content}
---`;
}

function allowedUrlsFor(factSheet: FactSheet | undefined, images: ICoverImage[], source?: ProduceOptions['source']): string[] {
  const urls = [
    ...(factSheet?.facts.map(f => f.sourceUrl) ?? []),
    ...images.map(i => i.url),
    ...images.map(i => i.thumbUrl),
    'https://unsplash.com',
    'https://images.unsplash.com',
    // Chart images built from verified facts (see factsBlock in generator.ts).
    'https://quickchart.io',
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

  // --- Localize keywords BEFORE drafting ------------------------------------
  // localizePostMeta used to run only at persist time, so the ru/uz body was
  // generated against the ENGLISH keyword list — live RU posts spliced raw
  // "website speed optimization" into Russian prose. Localizing first gives the
  // writer native search phrases; persistLocalePost reuses the same result.
  let localizedMeta: LocalizedMeta | undefined;
  let promptTopic = topic;
  let promptSource = source;
  if (locale === 'ru' || locale === 'uz') {
    localizedMeta = await localizePostMeta(locale, {
      title: topic.title,
      metaDescription: opts.enMetaDescription ?? '',
      primaryKeyword: topic.primaryKeyword,
      secondaryKeywords: topic.secondaryKeywords,
    });
    // The localizer is told the app appends " | SoftWhere.uz Blog"; models
    // sometimes bake it in anyway. Strip it before it reaches the title/slug.
    localizedMeta.title = stripSiteNameSuffix(localizedMeta.title);
    promptTopic = {
      ...topic,
      title: localizedMeta.title,
      primaryKeyword: localizedMeta.primaryKeyword,
      secondaryKeywords: localizedMeta.secondaryKeywords,
      targetQueries: [localizedMeta.primaryKeyword],
    };
    if (source) {
      promptSource = {
        ...source,
        classification: {
          ...source.classification,
          title: localizedMeta.title,
          primaryKeyword: localizedMeta.primaryKeyword,
          secondaryKeywords: localizedMeta.secondaryKeywords,
        },
      };
    }
  }

  // Anchor ru/uz to the EN draft's outline/figures so the three locales are
  // adaptations of one article, not three diverging ones.
  const anchor = locale !== 'en' && opts.enContent ? buildEnAnchorBlock(opts.enContent) : undefined;

  const { system, user } = promptSource
    ? buildSourcePrompt(promptSource.text, promptSource.classification, locale, inlineImages, factSheet, anchor)
    : buildTopicPrompt(promptTopic, locale, inlineImages, factSheet, anchor);

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

  // --- Truncation guard ------------------------------------------------------
  // DeepSeek truncates silently at its 8K completion cap (finish_reason
  // 'length' was previously discarded) — live UZ posts shipped ending mid-word
  // with no FAQ end or CTA. One continuation call; if the result still looks
  // cut off, skip the locale rather than publish a broken post.
  if (drafted.finishReason === 'length' || looksTruncated(content)) {
    logger.warn(`Draft for ${locale} looks truncated (finish=${drafted.finishReason}) — requesting continuation`, undefined, CONTEXT);
    const { body, fragment } = looksTruncated(content) ? splitIncompleteTail(content) : { body: content, fragment: '' };
    const continued = await generateContentWithProvider(
      buildContinuationPrompt(body, fragment, locale),
      `blog-continue-${locale}`,
      undefined,
      system,
      extras
    );
    if (!continued || continued.finishReason === 'length') {
      logger.warn(`Continuation failed for ${locale} — skipping locale`, undefined, CONTEXT);
      return null;
    }
    content = `${body}\n\n${continued.text.trim()}`;
    if (looksTruncated(content)) {
      logger.warn(`Content still truncated after continuation for ${locale} — skipping locale`, undefined, CONTEXT);
      return null;
    }
  }

  // --- Deterministic lint + one surgical revision --------------------------
  let issues = lintContent(content, { locale, allowedUrls });
  if (issues.length > 0) {
    logger.info(`Lint found ${issues.length} issue(s) in ${locale} draft — revising`, undefined, CONTEXT);
    const revised = await generateContentWithProvider(
      buildLintRevisionPrompt(issues, content),
      `blog-revise-${locale}`,
      undefined,
      system,
      extras
    );
    // A revision is a full re-emit bounded by the same completion cap — accept
    // it only when it is not itself truncated.
    if (revised && wordCount(revised.text) >= WORD_FLOOR && revised.finishReason !== 'length' && !looksTruncated(revised.text)) {
      content = revised.text;
    }
  }

  // --- Cross-model critique (deep mode, needs both providers) --------------
  // Uzbek also gets it in fast mode: the weakest-provider path is where fake
  // entities ("Paste.uz") and garbled tokens slipped into live posts.
  if ((mode === 'deep' || locale === 'uz') && configuredProviders().length > 1) {
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
      if (revised && wordCount(revised.text) >= WORD_FLOOR && revised.finishReason !== 'length' && !looksTruncated(revised.text)) {
        content = revised.text;
      }
    }
  }

  // --- Native-editor proofread (deep mode — wall-clock is free there) -------
  // Deterministic lints cannot catch spelling/idiom errors ("сентяблю",
  // "топите воду", "mijordan") that shipped in live posts across all locales.
  if (mode === 'deep') {
    const proofed = await generateContentWithProvider(
      buildProofreadPrompt(content, locale),
      `blog-proofread-${locale}`,
      undefined,
      undefined,
      extras
    );
    if (proofed && wordCount(proofed.text) >= WORD_FLOOR && proofed.finishReason !== 'length' && !looksTruncated(proofed.text)) {
      content = proofed.text;
    }
  }

  // --- Deterministic normalization ------------------------------------------
  // Free fixes for defects observed live: ```chart fences become QuickChart
  // image URLs (the model can't be trusted to URL-encode configs itself),
  // locale-relative internal links that 404 (`](uz/estimator)`), and the UZ
  // apostrophe glyph lottery (U+0027 vs U+2018 vs U+2019 in one document).
  content = normalizeContent(content, locale);

  // --- Final gate -----------------------------------------------------------
  // Unapproved URLs here were introduced (or kept) by the critique/proofread
  // revisions, which re-emit the whole post AFTER the lint-revision pass — a
  // refusal-only gate silently dropped whole locales over 1-2 links (live RU
  // loss, 2026-07-03). Remediate instead: one surgical link-removal revision
  // (deep mode only — the fast route's 300s budget can't afford another
  // body-length call), then a deterministic strip. Invented sources still
  // never ship; now the prose survives them.
  issues = lintContent(content, { locale, allowedUrls });
  let linkIssues = issues.filter(i => i.type === 'link');
  if (linkIssues.length > 0 && mode === 'deep') {
    logger.warn(`${linkIssues.length} unapproved URL(s) in final ${locale} content — requesting link-removal revision`, undefined, CONTEXT);
    const revised = await generateContentWithProvider(
      buildLintRevisionPrompt(linkIssues, content),
      `blog-link-revise-${locale}`,
      undefined,
      system,
      extras
    );
    if (revised && wordCount(revised.text) >= WORD_FLOOR && revised.finishReason !== 'length' && !looksTruncated(revised.text)) {
      // Adopt the re-emit only if it actually reduced the link issues — the
      // premise of this gate is that revisions can ignore link instructions,
      // and swapping a known-good body for a re-roll with as many (or more)
      // fabricated URLs would only widen what the strip below has to cut.
      const candidate = normalizeContent(revised.text, locale);
      const candidateIssues = lintContent(candidate, { locale, allowedUrls });
      if (candidateIssues.filter(i => i.type === 'link').length < linkIssues.length) {
        content = candidate;
        issues = candidateIssues;
        linkIssues = issues.filter(i => i.type === 'link');
      }
    }
  }
  if (linkIssues.length > 0) {
    logger.warn(`Stripping ${linkIssues.length} unapproved URL(s) from ${locale} content`, undefined, CONTEXT);
    content = stripUnapprovedUrls(content, allowedUrls);
    issues = lintContent(content, { locale, allowedUrls });
    linkIssues = issues.filter(i => i.type === 'link');
  }
  if (linkIssues.length > 0) {
    // Should be unreachable (the strip removes every audited URL) — kept as
    // the hard backstop so invented sources can never slip through.
    logger.warn(`Refusing ${locale} content: ${linkIssues.length} unapproved URL(s) after remediation`, undefined, CONTEXT);
    return null;
  }

  return { content, provider: drafted.provider, residualIssues: issues, localizedMeta };
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
  /** 'draft' (default — admin route) or 'published' (scheduled auto-publish). */
  status?: 'draft' | 'published';
  /** Already-localized meta from producePostContent — avoids a second (drifting) localization call. */
  localizedMeta?: LocalizedMeta;
  /** Pin the slug instead of deriving it from the title — used by the legacy
   *  backfill to restore an old URL's exact slug-root so `<root>-<timestamp>`
   *  URLs 301 to it. Still de-duplicated per locale via resolveUniqueSlug. */
  slug?: string;
}

async function resolveUniqueSlug(baseSlug: string, locale: BlogLocale): Promise<string> {
  let candidate = baseSlug;
  for (let suffix = 1; await slugTaken(candidate, locale); suffix += 1) {
    candidate = `${baseSlug}-${suffix}`;
  }
  return candidate;
}

/** Localize meta for ru/uz, build a stable localized slug, persist. */
export async function persistLocalePost(opts: PersistOptions): Promise<IBlogPost> {
  const { topic, locale, content } = opts;

  let title = topic.title;
  let metaDescription = opts.metaDescription;
  let primaryKeyword = topic.primaryKeyword;
  let secondaryKeywords = topic.secondaryKeywords;

  if (locale === 'ru' || locale === 'uz') {
    // Prefer the meta already localized before drafting (the body was written
    // against those exact keywords); fall back to localizing here for callers
    // that didn't thread it through.
    const localized =
      opts.localizedMeta ??
      (await localizePostMeta(locale, {
        title: topic.title,
        metaDescription: opts.metaDescription,
        primaryKeyword: topic.primaryKeyword,
        secondaryKeywords: topic.secondaryKeywords,
      }));
    title = localized.title;
    metaDescription = localized.metaDescription || opts.metaDescription;
    primaryKeyword = localized.primaryKeyword;
    secondaryKeywords = localized.secondaryKeywords;
  }

  // Defensive: never persist a title carrying the site-name suffix the app
  // appends itself (applies to EN too, whose title comes straight from topic).
  title = stripSiteNameSuffix(title);

  if (locale === 'uz') {
    // Same glyph normalization the body got — meta/title/keywords must match
    // the body's apostrophes or exact-match search fragments.
    title = normalizeUzbekApostrophes(title);
    metaDescription = normalizeUzbekApostrophes(metaDescription);
    primaryKeyword = normalizeUzbekApostrophes(primaryKeyword);
    secondaryKeywords = secondaryKeywords.map(normalizeUzbekApostrophes);
  }

  const slugBase = opts.slug || createSlug(title) || createSlug(topic.title) || `post-${opts.generationGroupId.slice(0, 8)}`;
  const slug = await resolveUniqueSlug(slugBase, locale);

  return createPost({
    title,
    slug,
    content,
    status: opts.status ?? 'draft',
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
