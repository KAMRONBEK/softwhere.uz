import { BlogManager } from '@/managers/blog.manager';
import { ValidationManager } from '@/managers/validation.manager';
import type { BlogPost as BlogPostType, Locale } from '@/types';
import { logger } from '@/utils/logger';

export interface BlogServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class BlogService {
  private blogManager: BlogManager;
  private validationManager: ValidationManager;

  constructor() {
    this.blogManager = new BlogManager();
    this.validationManager = new ValidationManager();
  }

  /**
   * Get published blog posts with optional filtering
   * @param params - Query parameters for filtering
   * @returns Service result with posts array
   */
  async getPosts(params?: { locale?: string; generationGroupId?: string; limit?: number }): Promise<BlogServiceResult<BlogPostType[]>> {
    try {
      logger.info('Fetching blog posts', params, 'BlogService');

      const posts = await this.blogManager.getPublishedPosts({
        locale: params?.locale,
        generationGroupId: params?.generationGroupId,
        limit: params?.limit || 50,
      });

      logger.info(`Successfully fetched ${posts.length} posts`, undefined, 'BlogService');

      return {
        success: true,
        data: posts,
      };
    } catch (error) {
      logger.error('Failed to fetch blog posts', error, 'BlogService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch posts',
      };
    }
  }

  /**
   * Get a single blog post by slug and locale
   * @param slug - Post slug
   * @param locale - Post locale
   * @returns Service result with single post
   */
  async getPost(slug: string, locale: string): Promise<BlogServiceResult<BlogPostType>> {
    try {
      // Validate inputs
      const validation = this.validationManager.validatePostQuery(slug, locale);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      logger.info(`Fetching post: ${slug} (${locale})`, undefined, 'BlogService');

      const post = await this.blogManager.getPostBySlug(slug, locale);
      if (!post) {
        return {
          success: false,
          error: 'Post not found',
        };
      }

      logger.info(`Successfully fetched post: ${slug}`, undefined, 'BlogService');

      return {
        success: true,
        data: post,
      };
    } catch (error) {
      logger.error(`Failed to fetch post: ${slug}`, error, 'BlogService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch post',
      };
    }
  }

  /**
   * Get related post in different locale
   * @param generationGroupId - Generation group ID
   * @param locale - Target locale
   * @returns Service result with related post info
   */
  async getRelatedPost(generationGroupId: string, locale: string): Promise<BlogServiceResult<{ slug: string; locale: string }>> {
    try {
      logger.info(`Fetching related post: ${generationGroupId} (${locale})`, undefined, 'BlogService');

      const relatedPost = await this.blogManager.getRelatedPost(generationGroupId, locale);
      if (!relatedPost) {
        return {
          success: false,
          error: 'Related post not found',
        };
      }

      return {
        success: true,
        data: {
          slug: relatedPost.slug,
          locale: relatedPost.locale,
        },
      };
    } catch (error) {
      logger.error(`Failed to fetch related post: ${generationGroupId}`, error, 'BlogService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch related post',
      };
    }
  }

  /**
   * Create a new blog post
   * @param postData - Blog post data
   * @returns Service result with created post
   */
  async createPost(postData: {
    title: string;
    slug: string;
    content: string;
    status: 'draft' | 'published';
    locale: Locale;
    generationGroupId?: string;
  }): Promise<BlogServiceResult<BlogPostType>> {
    try {
      // Validate post data
      const validation = this.validationManager.validatePostData(postData);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Check for slug collision
      const existingPost = await this.blogManager.getPostBySlug(postData.slug, postData.locale);
      if (existingPost) {
        return {
          success: false,
          error: `Slug "${postData.slug}" already exists for locale "${postData.locale}"`,
        };
      }

      logger.info(`Creating new post: ${postData.title}`, undefined, 'BlogService');

      const createdPost = await this.blogManager.createPost(postData);

      logger.info(`Successfully created post: ${createdPost._id}`, undefined, 'BlogService');

      return {
        success: true,
        data: createdPost,
      };
    } catch (error) {
      logger.error('Failed to create post', error, 'BlogService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create post',
      };
    }
  }
}

// Export singleton instance
export const blogService = new BlogService();
