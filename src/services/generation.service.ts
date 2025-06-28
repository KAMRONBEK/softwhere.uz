import { AIManager } from '@/managers/ai.manager';
import { BlogManager } from '@/managers/blog.manager';
import { ValidationManager } from '@/managers/validation.manager';
import type { Locale } from '@/types';
import { logger } from '@/utils/logger';

export interface GenerationServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface GenerationRequest {
  category: string;
  customTopic?: string;
  locales: Locale[];
}

export interface GenerationResponse {
  message: string;
  generationGroupId: string;
  posts: Array<{
    id: string;
    title: string;
    slug: string;
    locale: Locale;
    status: string;
  }>;
}

export class GenerationService {
  private blogManager: BlogManager;
  private validationManager: ValidationManager;
  private aiManager: AIManager;

  constructor() {
    this.blogManager = new BlogManager();
    this.validationManager = new ValidationManager();
    this.aiManager = new AIManager();
  }

  /**
   * Generate blog posts for multiple locales
   * @param request - Generation request with category, topic, and locales
   * @returns Service result with generation details
   */
  async generatePosts(request: GenerationRequest): Promise<GenerationServiceResult<GenerationResponse>> {
    try {
      logger.info('Blog generation request started', request, 'GenerationService');

      // Validate request
      const validation = this.validateGenerationRequest(request);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      const { category, customTopic, locales } = request;

      // Generate unique group ID for related posts
      const generationGroupId = this.generateGroupId();

      // Determine topic to use
      const topic = customTopic || this.aiManager.getRandomTopicForCategory(category);
      if (!topic) {
        return {
          success: false,
          error: `No topics available for category: ${category}`,
        };
      }

      logger.info(`Generating posts for topic: "${topic}" in locales: ${locales.join(', ')}`, undefined, 'GenerationService');

      // Generate content for each locale
      const generatedPosts = [];
      const errors = [];

      for (const locale of locales) {
        try {
          logger.info(`Generating content for locale: ${locale}`, undefined, 'GenerationService');

          // Generate content using AI
          const contentResult = await this.aiManager.generateBlogContent(topic, locale);
          if (!contentResult.success || !contentResult.data) {
            errors.push(`Failed to generate content for ${locale}: ${contentResult.error}`);
            continue;
          }

          const { title, content } = contentResult.data;

          // Generate slug
          const slug = this.validationManager.generateSlug(title);

          // Create post in database
          const postResult = await this.blogManager.createPost({
            title,
            slug,
            content,
            status: 'draft', // Always create as draft initially
            locale,
            generationGroupId,
          });

          generatedPosts.push({
            id: postResult._id,
            title: postResult.title,
            slug: postResult.slug,
            locale: postResult.locale,
            status: postResult.status,
          });

          logger.info(`Successfully generated post for ${locale}: ${title}`, undefined, 'GenerationService');
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Error generating for ${locale}: ${errorMsg}`);
          logger.error(`Failed to generate post for ${locale}`, error, 'GenerationService');
        }
      }

      // Check if any posts were generated
      if (generatedPosts.length === 0) {
        return {
          success: false,
          error: `Failed to generate any posts. Errors: ${errors.join('; ')}`,
        };
      }

      // Log partial success if some locales failed
      if (errors.length > 0) {
        logger.warn(`Partial generation success. Errors: ${errors.join('; ')}`, undefined, 'GenerationService');
      }

      const response: GenerationResponse = {
        message: `Successfully generated ${generatedPosts.length} blog post(s) for ${generatedPosts.map(p => p.locale).join(', ')}`,
        generationGroupId,
        posts: generatedPosts,
      };

      logger.info(`Blog generation completed successfully`, response, 'GenerationService');

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      logger.error('Blog generation failed', error, 'GenerationService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Blog generation failed',
      };
    }
  }

  /**
   * Get available categories for blog generation
   * @returns Service result with categories
   */
  async getCategories(): Promise<GenerationServiceResult<string[]>> {
    try {
      const categories = this.aiManager.getAvailableCategories();
      return {
        success: true,
        data: categories,
      };
    } catch (error) {
      logger.error('Failed to get categories', error, 'GenerationService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get categories',
      };
    }
  }

  /**
   * Get available topics for a specific category
   * @param category - Category name
   * @returns Service result with topics
   */
  async getTopicsForCategory(category: string): Promise<GenerationServiceResult<string[]>> {
    try {
      const topics = this.aiManager.getTopicsForCategory(category);
      if (!topics) {
        return {
          success: false,
          error: `Category "${category}" not found`,
        };
      }

      return {
        success: true,
        data: topics,
      };
    } catch (error) {
      logger.error(`Failed to get topics for category: ${category}`, error, 'GenerationService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get topics',
      };
    }
  }

  /**
   * Validate generation request
   * @param request - Generation request
   * @returns Validation result
   */
  private validateGenerationRequest(request: GenerationRequest): { isValid: boolean; error?: string } {
    if (!request.category || typeof request.category !== 'string') {
      return {
        isValid: false,
        error: 'Category is required and must be a string',
      };
    }

    if (!request.locales || !Array.isArray(request.locales) || request.locales.length === 0) {
      return {
        isValid: false,
        error: 'At least one locale is required',
      };
    }

    // Validate each locale
    for (const locale of request.locales) {
      if (!['en', 'ru', 'uz'].includes(locale)) {
        return {
          isValid: false,
          error: `Invalid locale: ${locale}. Must be one of: en, ru, uz`,
        };
      }
    }

    // Validate custom topic if provided
    if (request.customTopic) {
      if (typeof request.customTopic !== 'string' || request.customTopic.trim().length === 0) {
        return {
          isValid: false,
          error: 'Custom topic must be a non-empty string if provided',
        };
      }

      if (request.customTopic.length > 200) {
        return {
          isValid: false,
          error: 'Custom topic must not exceed 200 characters',
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Generate a unique group ID for related posts
   * @returns Unique group ID
   */
  private generateGroupId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const generationService = new GenerationService();
