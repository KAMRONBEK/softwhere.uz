import { useRouter } from 'next/navigation';
import { BlogPost } from '@/types';
import { logger } from '@/utils/logger';

export const useBlogLanguageSwitch = (post: BlogPost | null) => {
  const router = useRouter();

  const switchLanguage = async (targetLocale: string) => {
    if (!post?.generationGroupId) {
      // If no generation group ID, fall back to regular language switching
      const pathname = window.location.pathname;
      const pathSegments = pathname.split('/').filter(Boolean);
      let newPath = '/';

      if (pathSegments.length > 0) {
        const routeWithoutLocale = pathSegments.slice(1).join('/');

        newPath = `/${targetLocale}/${routeWithoutLocale}`;
      } else {
        newPath = `/${targetLocale}`;
      }

      router.push(newPath);

      return;
    }

    try {
      // Try to find the related post in the target language
      const response = await fetch(
        `/api/blog/posts/related?generationGroupId=${post.generationGroupId}&locale=${targetLocale}`
      );

      if (response.ok) {
        const data = await response.json();

        // Navigate to the related post in the target language
        router.push(`/${targetLocale}/blog/${data.post.slug}`);
      } else {
        // If no related post found, redirect to blog listing in target language
        router.push(`/${targetLocale}/blog`);
      }
    } catch (error) {
      logger.error('Error switching language', error, 'BLOG_LANGUAGE_SWITCH');
      // Fall back to blog listing in target language
      router.push(`/${targetLocale}/blog`);
    }
  };

  return { switchLanguage };
};
