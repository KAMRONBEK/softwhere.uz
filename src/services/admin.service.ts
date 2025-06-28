import { BlogManager } from '@/managers/blog.manager';
import { ValidationManager } from '@/managers/validation.manager';
import type { BlogPost as BlogPostType, Locale } from '@/types';
import { logger } from '@/utils/logger';

export interface AdminServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class AdminService {
  private blogManager: BlogManager;
  private validationManager: ValidationManager;

  constructor() {
    this.blogManager = new BlogManager();
    this.validationManager = new ValidationManager();
  }

  /**
   * Get all posts for admin dashboard
   * @returns Service result with all posts
   */
  async getAllPosts(): Promise<AdminServiceResult<BlogPostType[]>> {
    try {
      logger.info('Fetching all posts for admin', undefined, 'AdminService');

      const posts = await this.blogManager.getAllPosts();

      logger.info(`Successfully fetched ${posts.length} posts for admin`, undefined, 'AdminService');

      return {
        success: true,
        data: posts,
      };
    } catch (error) {
      logger.error('Failed to fetch posts for admin', error, 'AdminService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch posts',
      };
    }
  }

  /**
   * Get a single post by ID for admin
   * @param id - Post ID
   * @returns Service result with single post
   */
  async getPost(id: string): Promise<AdminServiceResult<BlogPostType>> {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'Valid post ID is required',
        };
      }

      logger.info(`Fetching post for admin: ${id}`, undefined, 'AdminService');

      const post = await this.blogManager.getPostById(id);
      if (!post) {
        return {
          success: false,
          error: 'Post not found',
        };
      }

      logger.info(`Successfully fetched post for admin: ${id}`, undefined, 'AdminService');

      return {
        success: true,
        data: post,
      };
    } catch (error) {
      logger.error(`Failed to fetch post for admin: ${id}`, error, 'AdminService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch post',
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
  }): Promise<AdminServiceResult<BlogPostType>> {
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

      logger.info(`Creating new post: ${postData.title}`, undefined, 'AdminService');

      const createdPost = await this.blogManager.createPost(postData);

      logger.info(`Successfully created post: ${createdPost._id}`, undefined, 'AdminService');

      return {
        success: true,
        data: createdPost,
      };
    } catch (error) {
      logger.error('Failed to create post', error, 'AdminService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create post',
      };
    }
  }

  /**
   * Update an existing blog post
   * @param id - Post ID
   * @param updateData - Data to update
   * @returns Service result with updated post
   */
  async updatePost(
    id: string,
    updateData: {
      title?: string;
      slug?: string;
      content?: string;
      status?: 'draft' | 'published';
      locale?: Locale;
      generationGroupId?: string;
    }
  ): Promise<AdminServiceResult<BlogPostType>> {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'Valid post ID is required',
        };
      }

      // If updating slug, check for collision
      if (updateData.slug && updateData.locale) {
        const existingPost = await this.blogManager.getPostBySlug(updateData.slug, updateData.locale);
        if (existingPost && existingPost._id !== id) {
          return {
            success: false,
            error: `Slug "${updateData.slug}" already exists for locale "${updateData.locale}"`,
          };
        }
      }

      logger.info(`Updating post: ${id}`, updateData, 'AdminService');

      const updatedPost = await this.blogManager.updatePost(id, updateData);
      if (!updatedPost) {
        return {
          success: false,
          error: 'Post not found or update failed',
        };
      }

      logger.info(`Successfully updated post: ${id}`, undefined, 'AdminService');

      return {
        success: true,
        data: updatedPost,
      };
    } catch (error) {
      logger.error(`Failed to update post: ${id}`, error, 'AdminService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update post',
      };
    }
  }

  /**
   * Delete a blog post
   * @param id - Post ID
   * @returns Service result indicating success
   */
  async deletePost(id: string): Promise<AdminServiceResult<{ deleted: boolean }>> {
    try {
      if (!id || typeof id !== 'string') {
        return {
          success: false,
          error: 'Valid post ID is required',
        };
      }

      logger.info(`Deleting post: ${id}`, undefined, 'AdminService');

      const deleted = await this.blogManager.deletePost(id);
      if (!deleted) {
        return {
          success: false,
          error: 'Post not found or deletion failed',
        };
      }

      logger.info(`Successfully deleted post: ${id}`, undefined, 'AdminService');

      return {
        success: true,
        data: { deleted: true },
      };
    } catch (error) {
      logger.error(`Failed to delete post: ${id}`, error, 'AdminService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete post',
      };
    }
  }

  /**
   * Publish a blog post
   * @param id - Post ID
   * @returns Service result with updated post
   */
  async publishPost(id: string): Promise<AdminServiceResult<BlogPostType>> {
    try {
      logger.info(`Publishing post: ${id}`, undefined, 'AdminService');

      const updatedPost = await this.blogManager.updatePostStatus(id, 'published');
      if (!updatedPost) {
        return {
          success: false,
          error: 'Post not found or publish failed',
        };
      }

      logger.info(`Successfully published post: ${id}`, undefined, 'AdminService');

      return {
        success: true,
        data: updatedPost,
      };
    } catch (error) {
      logger.error(`Failed to publish post: ${id}`, error, 'AdminService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to publish post',
      };
    }
  }

  /**
   * Unpublish a blog post (set to draft)
   * @param id - Post ID
   * @returns Service result with updated post
   */
  async unpublishPost(id: string): Promise<AdminServiceResult<BlogPostType>> {
    try {
      logger.info(`Unpublishing post: ${id}`, undefined, 'AdminService');

      const updatedPost = await this.blogManager.updatePostStatus(id, 'draft');
      if (!updatedPost) {
        return {
          success: false,
          error: 'Post not found or unpublish failed',
        };
      }

      logger.info(`Successfully unpublished post: ${id}`, undefined, 'AdminService');

      return {
        success: true,
        data: updatedPost,
      };
    } catch (error) {
      logger.error(`Failed to unpublish post: ${id}`, error, 'AdminService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unpublish post',
      };
    }
  }

  /**
   * Get dashboard statistics
   * @returns Service result with statistics
   */
  async getDashboardStats(): Promise<
    AdminServiceResult<{
      totalPosts: number;
      publishedPosts: number;
      draftPosts: number;
    }>
  > {
    try {
      logger.info('Fetching dashboard statistics', undefined, 'AdminService');

      const [totalPosts, publishedPosts, draftPosts] = await Promise.all([
        this.blogManager.getPostsCount(),
        this.blogManager.getPostsCount('published'),
        this.blogManager.getPostsCount('draft'),
      ]);

      const stats = {
        totalPosts,
        publishedPosts,
        draftPosts,
      };

      logger.info('Successfully fetched dashboard statistics', stats, 'AdminService');

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      logger.error('Failed to fetch dashboard statistics', error, 'AdminService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch statistics',
      };
    }
  }
}

// Export singleton instance
export const adminService = new AdminService();
