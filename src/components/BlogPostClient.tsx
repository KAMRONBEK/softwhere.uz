'use client';

import { useBlogContext } from '@/contexts/BlogContext';
import { logger } from '@/core/logger';
import { trackEvent } from '@/utils/analytics';
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
  const { setCurrentPost } = useBlogContext();

  useEffect(() => {
    trackEvent('blog_post_view', {
      slug: post.slug,
      category,
      locale: post.locale,
      readingTime,
    });
  }, [post.slug, post.locale, category, readingTime]);

  useEffect(() => {
    const postContext = {
      generationGroupId: post.generationGroupId,
      locale: post.locale,
      slug: post.slug,
    };

    logger.info(
      `Setting current post in context: ${post.title} (${post.locale})`,
      {
        slug: post.slug,
        locale: post.locale,
        generationGroupId: post.generationGroupId,
      },
      'BLOG_POST_CLIENT'
    );

    setCurrentPost(postContext);

    // Cleanup when component unmounts
    return () => {
      logger.info('Clearing current post from context', undefined, 'BLOG_POST_CLIENT');
      setCurrentPost(null);
    };
  }, [post, setCurrentPost]);

  return <>{children}</>;
}
