'use client';

import { useBlogContext } from '@/contexts/BlogContext';
import { logger } from '@/core/logger';
import { trackEvent } from '@/utils/analytics';
import { useEffect } from 'react';

interface BlogPost {
  _id: string;
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published';
  locale: 'en' | 'ru' | 'uz';
  generationGroupId?: string;
  createdAt: string;
  updatedAt: string;
}

interface BlogPostClientProps {
  post: BlogPost;
  category?: string;
  children: React.ReactNode;
}

export default function BlogPostClient({ post, category, children }: BlogPostClientProps) {
  const { setCurrentPost } = useBlogContext();

  useEffect(() => {
    const readingTime = Math.ceil(post.content.split(/\s+/).length / 200);
    trackEvent('blog_post_view', {
      slug: post.slug,
      category: category,
      locale: post.locale,
      readingTime,
    });
  }, [post.slug, post.content, post.locale, category]);

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
