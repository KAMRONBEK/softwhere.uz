import dbConnect from '@/lib/db';
import BlogPost, { IBlogPost } from '@/models/BlogPost';
import type { BlogPost as BlogPostType, Locale } from '@/types';
import { logger } from '@/utils/logger';

export interface BlogQueryParams {
  locale?: string;
  generationGroupId?: string;
  limit?: number;
  status?: 'draft' | 'published';
}

export class BlogManager {
  /**
   * Get published posts with filtering options
   * @param params - Query parameters
   * @returns Array of published posts
   */
  async getPublishedPosts(params: BlogQueryParams = {}): Promise<BlogPostType[]> {
    await dbConnect();

    const { locale, generationGroupId, limit = 50, status = 'published' } = params;

    // Build query
    const query: any = { status };
    if (locale) query.locale = locale;
    if (generationGroupId) query.generationGroupId = generationGroupId;

    logger.dbOperation('find', 'BlogPost', 'BlogManager');

    const posts = await BlogPost.find(query)
      .sort({ createdAt: -1 })
      .select('title slug createdAt locale generationGroupId')
      .limit(limit)
      .lean<BlogPostType[]>();

    return posts;
  }

  /**
   * Get all posts for admin (including drafts)
   * @returns Array of all posts
   */
  async getAllPosts(): Promise<BlogPostType[]> {
    await dbConnect();

    logger.dbOperation('find all', 'BlogPost', 'BlogManager');

    const posts = await BlogPost.find({})
      .sort({ createdAt: -1 })
      .select('_id title slug content status locale generationGroupId createdAt updatedAt')
      .lean<BlogPostType[]>();

    return posts;
  }

  /**
   * Get a single post by slug and locale
   * @param slug - Post slug
   * @param locale - Post locale
   * @returns Single blog post or null
   */
  async getPostBySlug(slug: string, locale: string): Promise<BlogPostType | null> {
    await dbConnect();

    logger.dbOperation(`findOne: ${slug} (${locale})`, 'BlogPost', 'BlogManager');

    const post = await BlogPost.findOne({
      slug,
      locale,
      status: 'published',
    }).lean<BlogPostType>();

    return post;
  }

  /**
   * Get a post by ID (for admin operations)
   * @param id - Post ID
   * @returns Single blog post or null
   */
  async getPostById(id: string): Promise<BlogPostType | null> {
    await dbConnect();

    logger.dbOperation(`findById: ${id}`, 'BlogPost', 'BlogManager');

    const post = await BlogPost.findById(id).lean<BlogPostType>();

    return post;
  }

  /**
   * Get related post in different locale
   * @param generationGroupId - Generation group ID
   * @param locale - Target locale
   * @returns Related post or null
   */
  async getRelatedPost(generationGroupId: string, locale: string): Promise<BlogPostType | null> {
    await dbConnect();

    logger.dbOperation(`findRelated: ${generationGroupId} (${locale})`, 'BlogPost', 'BlogManager');

    const relatedPost = await BlogPost.findOne({
      generationGroupId,
      locale,
      status: 'published',
    })
      .select('slug locale')
      .lean<BlogPostType>();

    return relatedPost;
  }

  /**
   * Create a new blog post
   * @param postData - Post data
   * @returns Created blog post
   */
  async createPost(postData: {
    title: string;
    slug: string;
    content: string;
    status: 'draft' | 'published';
    locale: Locale;
    generationGroupId?: string;
  }): Promise<BlogPostType> {
    await dbConnect();

    logger.dbOperation(`create: ${postData.title}`, 'BlogPost', 'BlogManager');

    const newPost = new BlogPost(postData);
    const savedPost = await newPost.save();

    return savedPost.toObject() as unknown as BlogPostType;
  }

  /**
   * Update an existing blog post
   * @param id - Post ID
   * @param updateData - Data to update
   * @returns Updated blog post or null
   */
  async updatePost(id: string, updateData: Partial<IBlogPost>): Promise<BlogPostType | null> {
    await dbConnect();

    logger.dbOperation(`update: ${id}`, 'BlogPost', 'BlogManager');

    const updatedPost = await BlogPost.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).lean<BlogPostType>();

    return updatedPost;
  }

  /**
   * Delete a blog post
   * @param id - Post ID
   * @returns Boolean indicating success
   */
  async deletePost(id: string): Promise<boolean> {
    await dbConnect();

    logger.dbOperation(`delete: ${id}`, 'BlogPost', 'BlogManager');

    const result = await BlogPost.findByIdAndDelete(id);

    return !!result;
  }

  /**
   * Update post status (publish/unpublish)
   * @param id - Post ID
   * @param status - New status
   * @returns Updated post or null
   */
  async updatePostStatus(id: string, status: 'draft' | 'published'): Promise<BlogPostType | null> {
    return this.updatePost(id, { status });
  }

  /**
   * Get posts count by status
   * @param status - Post status
   * @returns Number of posts
   */
  async getPostsCount(status?: 'draft' | 'published'): Promise<number> {
    await dbConnect();

    const query = status ? { status } : {};

    logger.dbOperation(`count: ${status || 'all'}`, 'BlogPost', 'BlogManager');

    const count = await BlogPost.countDocuments(query);

    return count;
  }
}
