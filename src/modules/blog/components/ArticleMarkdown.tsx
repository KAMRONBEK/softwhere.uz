import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import { Prose } from '@/shared/components/site';
import { parseQuickChartSrc } from '../utils/chart';
import BlogChart from './BlogChart';
import css from './article.module.css';

// Does this markdown node contain an <img> at any depth? Used to keep the
// image/chart <figure> out of a <p>, which is invalid HTML.
function containsImage(node: unknown): boolean {
  const el = node as { type?: string; tagName?: string; children?: unknown[] } | undefined;
  if (!el) return false;
  if (el.type === 'element' && el.tagName === 'img') return true;
  return Array.isArray(el.children) && el.children.some(containsImage);
}

/** A post's markdown in the site's reading styles (server component). */
export default async function ArticleMarkdown({ markdown, locale }: { markdown: string; locale: string }) {
  const t = await getTranslations('blog');

  return (
    <Prose className={css.article}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        // rehype-slug gives headings stable ids so sections are deep-linkable
        // (#faq etc.); a heading component added here must forward the id.
        rehypePlugins={[rehypeSlug, rehypeHighlight]}
        components={{
          p: ({ node, children }) => {
            // Markdown images are inline, so a `![…](…)` line arrives
            // wrapped in a paragraph — but our img override renders a
            // <figure> (and charts a whole card), which is invalid
            // inside <p> and triggers hydration errors. Use a <div>
            // for any paragraph containing an image. The search is
            // recursive: an image can sit under a link or emphasis
            // (`[![alt](src)](href)`), not just as a direct child.
            const Tag = containsImage(node) ? 'div' : 'p';
            return <Tag>{children}</Tag>;
          },
          // Focusable: long lines scroll sideways, and the keyboard needs a way in.
          pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
          a: ({ node: _node, href, children, ...rest }) => {
            // Some generated posts emit locale-relative internal links
            // ('uz/estimator', 'en#contact') that resolve under the post
            // path and 404 — normalize them to absolute paths.
            const normalizedHref = href && /^(en|ru|uz)([/#]|$)/.test(href) ? `/${href}` : href;
            const isExternal = normalizedHref?.startsWith('http');
            return (
              <a
                {...rest}
                href={normalizedHref}
                target={isExternal ? '_blank' : undefined}
                // nofollow: AI-cited sources are often competitor agency
                // blogs — don't pass them link equity from every post.
                rel={isExternal ? 'nofollow noopener noreferrer' : undefined}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) => {
            // Stored charts are QuickChart PNG URLs (white background,
            // default Chart.js styling). Decode the config back out of
            // the URL and render a themed SVG/HTML chart instead; the
            // PNG stays as the fallback for anything unparseable.
            const chart = typeof src === 'string' ? parseQuickChartSrc(src) : null;
            if (chart) {
              return (
                <BlogChart
                  chart={chart}
                  caption={alt || ''}
                  locale={locale}
                  viewDataLabel={t('chart.viewData')}
                  categoryLabel={t('chart.category')}
                  valueLabel={t('chart.value')}
                />
              );
            }
            return (
              <figure>
                {/* The pipeline only emits Unsplash images (allow-listed in
                    next.config), so serve them through next/image for AVIF/WebP
                    + responsive sizing; keep a plain-<img> fallback for any
                    other host (next/image would 400 on non-allow-listed hosts).
                    The 16:9 wrapper reserves space to eliminate layout shift (CLS). */}
                <span className={css.picture}>
                  {typeof src === 'string' && src.startsWith('https://images.unsplash.com/') ? (
                    <Image src={src} alt={alt || ''} fill sizes='(max-width: 768px) 100vw, 768px' />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={alt || ''} loading='lazy' decoding='async' />
                  )}
                </span>
                {alt && <figcaption>{alt}</figcaption>}
              </figure>
            );
          },
          table: ({ children }) => (
            <div className={css.tableScroll} tabIndex={0}>
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </Prose>
  );
}
