import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import TrackedCTALink from '@/shared/components/TrackedCTALink';
import { Arrow, Breadcrumbs, Container, CtaBand, Page, PageHero, Section, buttonClass } from '@/shared/components/site';
import { type BlogPost, PILLAR_LABELS } from '../lib/seo';
import { formatPostDate } from '../utils/postDate';
import ArticleCover from './ArticleCover';
import ArticleMarkdown from './ArticleMarkdown';
import css from './article.module.css';

// Routes a post's pillar to the commercial page that answers it, so every post
// in a mapped category emits one in-body link to a real service page. Before
// this, the only site-wide links to /services/* were footer boilerplate, and
// Googlebot left all six service URLs "Discovered - currently not indexed".
//
// Only confident mappings are listed: an off-topic link is worth less than no
// link, since anchor relevance is the whole point. Categories left out
// (ai-solutions, maintenance-support, ui-ux-design, cybersecurity,
// project-rescue, outsourcing) keep the original #contact CTA.
type ServiceLinkKey = 'link_webDevelopment' | 'link_mobileApps' | 'link_telegramBots';

const SERVICE_BY_CATEGORY: Record<string, { slug: string; labelKey: ServiceLinkKey }> = {
  'mobile-app-development': { slug: 'mobile-apps', labelKey: 'link_mobileApps' },
  'web-app-development': { slug: 'web-development', labelKey: 'link_webDevelopment' },
  'telegram-bot-development': { slug: 'telegram-bots', labelKey: 'link_telegramBots' },
  'business-automation': { slug: 'telegram-bots', labelKey: 'link_telegramBots' },
  ecommerce: { slug: 'web-development', labelKey: 'link_webDevelopment' },
  'saas-development': { slug: 'web-development', labelKey: 'link_webDevelopment' },
  'crm-development': { slug: 'web-development', labelKey: 'link_webDevelopment' },
  'mvp-startup': { slug: 'web-development', labelKey: 'link_webDevelopment' },
};

interface BlogArticleProps {
  post: BlogPost;
  readingTime: number;
  /** The related-posts section (the page streams it). */
  related?: ReactNode;
}

/** A post's page below the site header (server component; the route owns data, metadata and JSON-LD). */
export default async function BlogArticle({ post, readingTime, related }: BlogArticleProps) {
  const { locale } = post;
  const t = await getTranslations('blog');
  const tCat = await getTranslations('blog.categories');
  const tSvc = await getTranslations('servicePages.common');
  const tNav = await getTranslations('header');

  const relatedService = post.category ? SERVICE_BY_CATEGORY[post.category] : undefined;

  // Generated posts open with '# <title>' duplicating the page <h1> above the
  // article (two stacked H1s, often with diverging wording). Strip only that
  // first leading H1 line; section headings are already H2+.
  const articleMarkdown = post.content.replace(/^\s*#\s+.*(\r?\n|$)/, '');

  return (
    <Page>
      <article>
        <PageHero
          size='article'
          width='prose'
          breadcrumb={
            <Breadcrumbs
              label={t('backToBlog')}
              items={[{ label: tNav('home'), href: `/${locale}` }, { label: tNav('blog'), href: `/${locale}/blog` }, { label: post.title }]}
            />
          }
          eyebrow={post.category && PILLAR_LABELS[post.category] ? (tCat as (k: string) => string)(post.category) : undefined}
          title={post.title}
          meta={
            <>
              <time dateTime={post.createdAt}>{formatPostDate(post.createdAt, locale)}</time>
              <span>
                {readingTime} {t('readingTime')}
              </span>
              <span>{locale.toUpperCase()}</span>
            </>
          }
        />

        {post.coverImage?.url && <ArticleCover key={post.slug} cover={post.coverImage} alt={post.title} />}

        <Container width='prose' className={css.body}>
          <ArticleMarkdown markdown={articleMarkdown} locale={locale} />
        </Container>
      </article>

      <Section>
        <CtaBand
          title={t('cta.title')}
          body={t('cta.description')}
          actions={
            <>
              {/* Primary CTA is the service page that answers this post's
                  pillar; posts in an unmapped category keep #contact. */}
              <TrackedCTALink
                href={relatedService ? `/${locale}/services/${relatedService.slug}` : `/${locale}#contact`}
                type={relatedService ? 'service' : 'get_started'}
                slug={post.slug}
                className={buttonClass('primary')}
              >
                {relatedService ? tSvc(relatedService.labelKey) : t('cta.getStarted')}
              </TrackedCTALink>
              <TrackedCTALink href={`/${locale}/estimator`} type='estimate' slug={post.slug} className={buttonClass('secondary')}>
                {t('cta.estimate')}
              </TrackedCTALink>
              <TrackedCTALink href={`/${locale}#work-wall`} type='view_work' slug={post.slug} className={buttonClass('secondary')}>
                {t('cta.viewWork')}
              </TrackedCTALink>
            </>
          }
        />
      </Section>

      {related}

      <Section>
        <Link href={`/${locale}/blog`} className={css.back}>
          {t('readMoreArticles')}
          <Arrow />
        </Link>
      </Section>
    </Page>
  );
}
