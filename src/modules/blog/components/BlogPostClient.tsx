'use client';

import { trackEvent } from '@/shared/utils/analytics';
import { useEffect } from 'react';

// Only the small fields this client component actually needs. The full post —
// including the large markdown `content` — is NOT passed here; it is rendered
// server-side via ReactMarkdown, so this avoids serializing the article body
// into the client Flight payload a second time. Reading time is computed on the
// server and passed in as a number.
interface BlogPostSummary {
  title: string;
  slug: string;
  locale: 'en' | 'ru' | 'uz';
  generationGroupId?: string;
}

interface BlogPostClientProps {
  post: BlogPostSummary;
  category?: string;
  readingTime: number;
  children: React.ReactNode;
}

export default function BlogPostClient({ post, category, readingTime, children }: BlogPostClientProps) {
  useEffect(() => {
    trackEvent('blog_post_view', {
      slug: post.slug,
      category,
      locale: post.locale,
      readingTime,
    });
  }, [post.slug, post.locale, category, readingTime]);

  return <>{children}</>;
}
