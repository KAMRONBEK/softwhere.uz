import { CoverImage } from '@/shared/types';
import { safeJsonLd } from '@/shared/utils/security';
import { clampMeta } from '@/modules/blog/utils/meta';
import { ENV } from '@/core/constants';

export interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published';
  locale: 'en' | 'ru' | 'uz';
  generationGroupId?: string;
  coverImage?: CoverImage;
  category?: string;
  postFormat?: string;
  primaryKeyword?: string;
  secondaryKeywords?: string[];
  metaDescription?: string;
  contentImages?: CoverImage[];
  createdAt: string;
  updatedAt: string;
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const FALLBACK_DESC: Record<string, string> = {
  en: 'Expert insights on software development from Softwhere.uz.',
  ru: 'Экспертные материалы о разработке программного обеспечения от Softwhere.uz.',
  uz: "Softwhere.uz'dan dasturiy ta'minot ishlab chiqish bo'yicha ekspert maqolalari.",
};

export function extractDescription(content: string, storedMeta?: string, locale: string = 'en'): string {
  if (storedMeta && storedMeta.trim()) return storedMeta.trim();
  const line = content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length > 50);
  // Guard: an unmatched find() would interpolate as `undefined...` (truthy).
  if (!line) return FALLBACK_DESC[locale] ?? FALLBACK_DESC.en;
  // Boundary-aware clamp shared with the generator (never cut mid-word).
  return clampMeta(line);
}

const FALLBACK_KEYWORDS: Record<string, string[]> = {
  en: ['mobile app development', 'web development', 'telegram bot', 'software development', 'uzbekistan'],
  ru: ['разработка мобильных приложений', 'веб-разработка', 'телеграм бот', 'разработка по', 'узбекистан'],
  uz: ['mobil ilova ishlab chiqish', 'veb-dasturlash', 'telegram bot', "dasturiy ta'minot", "o'zbekiston"],
};

export function getKeywords(post: BlogPost): string[] {
  if (post.primaryKeyword || post.secondaryKeywords?.length) {
    return [...(post.primaryKeyword ? [post.primaryKeyword] : []), ...(post.secondaryKeywords ?? []), 'softwhere.uz'];
  }
  const fallback = FALLBACK_KEYWORDS[post.locale] ?? FALLBACK_KEYWORDS.en;
  const contentLower = post.content.toLowerCase();
  const matched = fallback.filter(kw => contentLower.includes(kw));
  return matched.length ? matched : fallback.slice(0, 3);
}

export const PILLAR_LABELS: Record<string, string> = {
  'mobile-app-development': 'Mobile App Development',
  'mvp-startup': 'MVP & Startup Development',
  'ai-solutions': 'AI Solutions',
  'web-app-development': 'Web App Development',
  'telegram-bot-development': 'Telegram Bot Development',
  'crm-development': 'CRM Development',
  'business-automation': 'Business Automation',
  'saas-development': 'SaaS Development',
  outsourcing: 'Developer Outsourcing',
  'project-rescue': 'Project Rescue',
  ecommerce: 'E-commerce Development',
  'ui-ux-design': 'UI/UX Design',
  'maintenance-support': 'Maintenance & Support',
  cybersecurity: 'Cybersecurity',
};

// ---------------------------------------------------------------------------
// Structured data: BlogPosting + optional FAQ / HowTo
// ---------------------------------------------------------------------------

export function parseFAQPairs(content: string): Array<{ q: string; a: string }> {
  const pairs: Array<{ q: string; a: string }> = [];
  const lines = content.split('\n');
  let currentQ = '';
  let currentA = '';

  for (const line of lines) {
    const questionMatch = line.match(/^#{1,3}\s+(.+\?)\s*$/);
    if (questionMatch) {
      if (currentQ && currentA.trim()) {
        pairs.push({ q: currentQ, a: currentA.trim().slice(0, 300) });
      }
      currentQ = questionMatch[1];
      currentA = '';
    } else if (currentQ) {
      const clean = line
        .replace(/^[-*]\s+/, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .trim();
      if (clean) currentA += (currentA ? ' ' : '') + clean;
    }
  }
  if (currentQ && currentA.trim()) {
    pairs.push({ q: currentQ, a: currentA.trim().slice(0, 300) });
  }
  return pairs.slice(0, 10);
}

export function BlogPostSchema({ post }: { post: BlogPost }) {
  const baseUrl = ENV.BASE_URL;
  const locale = post.locale;
  const description = extractDescription(post.content, post.metaDescription, locale);
  const keywords = getKeywords(post);
  const articleSection = post.category ? (PILLAR_LABELS[post.category] ?? 'Technology') : 'Technology';
  // E-E-A-T: use a real named Person author when BLOG_AUTHOR_NAME is set
  // (Google rewards Person authors); otherwise fall back to the Organization.
  const authorName = process.env.BLOG_AUTHOR_NAME || process.env.NEXT_PUBLIC_BLOG_AUTHOR;
  const author = authorName
    ? { '@type': 'Person', name: authorName, url: `${baseUrl}/${locale}#contact` }
    : { '@type': 'Organization', name: 'SoftWhere.uz', url: baseUrl };

  const schemas: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description,
      image: post.coverImage?.url || `${baseUrl}/api/og?title=${encodeURIComponent(post.title)}&locale=${locale}`,
      author,
      publisher: {
        '@type': 'Organization',
        name: 'SoftWhere.uz',
        logo: { '@type': 'ImageObject', url: `${baseUrl}/icons/logo.svg` },
      },
      datePublished: post.createdAt,
      dateModified: post.updatedAt,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': `${baseUrl}/${locale}/blog/${post.slug}`,
      },
      articleSection,
      keywords: keywords.join(', '),
      wordCount: post.content.split(/\s+/).filter(Boolean).length,
      inLanguage: locale,
      isPartOf: { '@type': 'Blog', '@id': `${baseUrl}/${locale}/blog` },
    },
  ];

  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/${locale}` },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${baseUrl}/${locale}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title },
    ],
  });

  // FAQ schema for faq-format posts
  if (post.postFormat === 'faq' || post.postFormat === 'myth-buster') {
    const faqPairs = parseFAQPairs(post.content);
    if (faqPairs.length >= 3) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqPairs.map(({ q, a }) => ({
          '@type': 'Question',
          name: q,
          acceptedAnswer: { '@type': 'Answer', text: a },
        })),
      });
    }
  }

  return (
    <>
      {schemas.map((s, i) => (
        <script key={i} type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(s) }} />
      ))}
    </>
  );
}
