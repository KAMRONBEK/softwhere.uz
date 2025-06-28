import { BLOG_CONFIG } from '@/constants';
import type { Locale } from '@/types';
import { logger } from '@/utils/logger';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface EmailValidationResult extends ValidationResult {
  isDisposable?: boolean;
  domain?: string;
}

export class ValidationManager {
  /**
   * Validate post query parameters
   * @param slug - Post slug
   * @param locale - Post locale
   * @returns Validation result
   */
  validatePostQuery(slug: string, locale: string): ValidationResult {
    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      return {
        isValid: false,
        error: 'Slug is required and must be a non-empty string',
      };
    }

    if (!locale || typeof locale !== 'string') {
      return {
        isValid: false,
        error: 'Locale is required and must be a string',
      };
    }

    if (!this.isValidLocale(locale)) {
      return {
        isValid: false,
        error: `Invalid locale. Must be one of: ${BLOG_CONFIG.SUPPORTED_LOCALES.join(', ')}`,
      };
    }

    return { isValid: true };
  }

  /**
   * Validate blog post data for creation/update
   * @param postData - Blog post data
   * @returns Validation result
   */
  validatePostData(postData: {
    title: string;
    slug: string;
    content: string;
    status: 'draft' | 'published';
    locale: Locale;
    generationGroupId?: string;
  }): ValidationResult {
    const { title, slug, content, status, locale, generationGroupId } = postData;

    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return {
        isValid: false,
        error: 'Title is required and must be a non-empty string',
      };
    }

    if (title.length > 200) {
      return {
        isValid: false,
        error: 'Title must not exceed 200 characters',
      };
    }

    // Validate slug
    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
      return {
        isValid: false,
        error: 'Slug is required and must be a non-empty string',
      };
    }

    if (!this.isValidSlug(slug)) {
      return {
        isValid: false,
        error: 'Slug must contain only lowercase letters, numbers, and hyphens',
      };
    }

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return {
        isValid: false,
        error: 'Content is required and must be a non-empty string',
      };
    }

    // Validate status
    if (!['draft', 'published'].includes(status)) {
      return {
        isValid: false,
        error: 'Status must be either "draft" or "published"',
      };
    }

    // Validate locale
    if (!this.isValidLocale(locale)) {
      return {
        isValid: false,
        error: `Invalid locale. Must be one of: ${BLOG_CONFIG.SUPPORTED_LOCALES.join(', ')}`,
      };
    }

    // Validate generationGroupId if provided
    if (generationGroupId && (typeof generationGroupId !== 'string' || generationGroupId.trim().length === 0)) {
      return {
        isValid: false,
        error: 'GenerationGroupId must be a non-empty string if provided',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate email address format and optionally check for disposable domains
   * @param email - Email address to validate
   * @param checkDisposable - Whether to check for disposable email domains
   * @returns Email validation result
   */
  validateEmail(email: string, checkDisposable: boolean = false): EmailValidationResult {
    const errors: string[] = [];

    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('Invalid email format');
    }

    // Length validation
    if (email.length > 254) {
      errors.push('Email address too long');
    }

    // Check for disposable domains if requested
    let isDisposable = false;
    let domain = '';

    if (email.includes('@')) {
      domain = email.split('@')[1].toLowerCase();

      if (checkDisposable) {
        isDisposable = this.isDisposableDomain(domain);
        if (isDisposable) {
          errors.push('Disposable email addresses are not allowed');
        }
      }
    }

    const result: EmailValidationResult = {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
      isDisposable,
      domain,
    };

    logger.debug('Email validation completed', result, 'ValidationManager');

    return result;
  }

  /**
   * Validate phone number format (international format)
   * @param phone - Phone number to validate
   * @returns Validation result
   */
  validatePhone(phone: string): ValidationResult {
    const errors: string[] = [];

    // Remove all non-digit characters for validation
    const cleanPhone = phone.replace(/\D/g, '');

    // Check if it's empty
    if (!cleanPhone) {
      errors.push('Phone number is required');
    }

    // Check length (international format: 7-15 digits)
    if (cleanPhone.length < 7 || cleanPhone.length > 15) {
      errors.push('Phone number must be between 7 and 15 digits');
    }

    // Check if it starts with valid international prefix
    if (cleanPhone.length >= 7) {
      const validPrefixes = ['998', '7', '1', '44', '49', '33', '39', '81', '86'];
      const hasValidPrefix = validPrefixes.some(prefix => cleanPhone.startsWith(prefix));

      if (!hasValidPrefix && !phone.startsWith('+')) {
        // Allow local numbers without country code validation
        logger.debug('Phone number without recognized country code', { phone: cleanPhone }, 'ValidationManager');
      }
    }

    const result: ValidationResult = {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };

    logger.debug('Phone validation completed', result, 'ValidationManager');

    return result;
  }

  /**
   * Validate pagination parameters
   * @param page - Page number
   * @param limit - Items per page
   * @returns Validation result
   */
  validatePagination(page: number, limit: number): ValidationResult {
    if (!Number.isInteger(page) || page < 1) {
      return {
        isValid: false,
        error: 'Page must be a positive integer',
      };
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return {
        isValid: false,
        error: 'Limit must be a positive integer not exceeding 100',
      };
    }

    return { isValid: true };
  }

  /**
   * Check if locale is valid
   * @param locale - Locale string
   * @returns Boolean indicating validity
   */
  private isValidLocale(locale: string): locale is Locale {
    return BLOG_CONFIG.SUPPORTED_LOCALES.includes(locale as Locale);
  }

  /**
   * Check if slug format is valid
   * @param slug - Slug string
   * @returns Boolean indicating validity
   */
  private isValidSlug(slug: string): boolean {
    // Allow lowercase letters, numbers, and hyphens
    const slugRegex = /^[a-z0-9-]+$/;
    return slugRegex.test(slug) && !slug.startsWith('-') && !slug.endsWith('-');
  }

  /**
   * Sanitize string input
   * @param input - Input string
   * @returns Sanitized string
   */
  sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/\s+/g, ' ');
  }

  /**
   * Generate slug from title
   * @param title - Post title
   * @returns Generated slug
   */
  generateSlug(title: string): string {
    return this.sanitizeString(title)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Check if domain is a known disposable email provider
   * @param domain - Domain to check
   * @returns True if disposable
   */
  private isDisposableDomain(domain: string): boolean {
    // Common disposable email domains
    const disposableDomains = [
      '10minutemail.com',
      'guerrillamail.com',
      'mailinator.com',
      'tempmail.org',
      'temp-mail.org',
      'throwaway.email',
      'yopmail.com',
      'trashmail.com',
      'mailnesia.com',
      'sharklasers.com',
    ];

    return disposableDomains.includes(domain.toLowerCase());
  }

  /**
   * Validate required string field
   * @param value - Value to validate
   * @param fieldName - Name of the field for error messages
   * @param minLength - Minimum length (default: 1)
   * @param maxLength - Maximum length (default: 500)
   * @returns Validation result
   */
  validateRequiredString(
    value: string | undefined | null,
    fieldName: string,
    minLength: number = 1,
    maxLength: number = 500
  ): ValidationResult {
    const errors: string[] = [];

    if (!value || typeof value !== 'string') {
      errors.push(`${fieldName} is required`);
    } else {
      const trimmedValue = value.trim();

      if (trimmedValue.length < minLength) {
        errors.push(`${fieldName} must be at least ${minLength} character${minLength > 1 ? 's' : ''} long`);
      }

      if (trimmedValue.length > maxLength) {
        errors.push(`${fieldName} cannot exceed ${maxLength} characters`);
      }
    }

    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * Validate URL format
   * @param url - URL to validate
   * @param allowRelative - Whether to allow relative URLs
   * @returns Validation result
   */
  validateUrl(url: string, allowRelative: boolean = false): ValidationResult {
    const errors: string[] = [];

    if (!url) {
      errors.push('URL is required');
    } else {
      try {
        // For relative URLs, prepend a dummy domain
        const testUrl = allowRelative && !url.startsWith('http') ? `https://example.com${url}` : url;
        new URL(testUrl);
      } catch {
        errors.push('Invalid URL format');
      }
    }

    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * Validate slug format (URL-friendly string)
   * @param slug - Slug to validate
   * @returns Validation result
   */
  validateSlug(slug: string): ValidationResult {
    const errors: string[] = [];

    if (!slug) {
      errors.push('Slug is required');
    } else {
      // Slug should only contain lowercase letters, numbers, and hyphens
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      if (!slugRegex.test(slug)) {
        errors.push('Slug must contain only lowercase letters, numbers, and hyphens');
      }

      if (slug.length < 3) {
        errors.push('Slug must be at least 3 characters long');
      }

      if (slug.length > 100) {
        errors.push('Slug cannot exceed 100 characters');
      }
    }

    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * Validate estimator input data
   * @param data - Estimator input data
   * @returns Validation result
   */
  validateEstimatorInput(data: any): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!data.projectType) {
      errors.push('Project type is required');
    }

    if (!data.complexity) {
      errors.push('Complexity level is required');
    }

    if (typeof data.pages !== 'number' || data.pages < 1) {
      errors.push('Pages must be a positive number');
    }

    // Optional validations
    if (data.features && !Array.isArray(data.features)) {
      errors.push('Features must be an array');
    }

    if (data.platforms && !Array.isArray(data.platforms)) {
      errors.push('Platforms must be an array');
    }

    if (data.techStack && !Array.isArray(data.techStack)) {
      errors.push('Tech stack must be an array');
    }

    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }

  /**
   * Validate blog post data
   * @param data - Blog post data
   * @returns Validation result
   */
  validateBlogPost(data: any): ValidationResult {
    const errors: string[] = [];

    // Title validation
    const titleValidation = this.validateRequiredString(data.title, 'Title', 5, 200);
    if (titleValidation.error) {
      errors.push(titleValidation.error);
    }

    // Slug validation
    if (data.slug) {
      const slugValidation = this.validateSlug(data.slug);
      if (slugValidation.error) {
        errors.push(slugValidation.error);
      }
    }

    // Content validation
    const contentValidation = this.validateRequiredString(data.content, 'Content', 100, 50000);
    if (contentValidation.error) {
      errors.push(contentValidation.error);
    }

    // Status validation
    if (!['draft', 'published'].includes(data.status)) {
      errors.push('Status must be either "draft" or "published"');
    }

    // Locale validation
    if (!['en', 'ru', 'uz'].includes(data.locale)) {
      errors.push('Locale must be one of: en, ru, uz');
    }

    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  }
}

// Export singleton instance
export const validationManager = new ValidationManager();
