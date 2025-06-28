import { AIManager } from '@/managers/ai.manager';
import { EstimatorManager } from '@/managers/estimator.manager';
import { ValidationManager } from '@/managers/validation.manager';
import type { EstimateResult, EstimatorInput } from '@/types/estimator';
import { logger } from '@/utils/logger';

export interface EstimatorServiceResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface EstimateResponse extends EstimateResult {
  source: 'ai' | 'formula';
  reasoning?: string;
}

export class EstimatorService {
  private aiManager: AIManager;
  private validationManager: ValidationManager;
  private estimatorManager: EstimatorManager;

  constructor() {
    this.aiManager = new AIManager();
    this.validationManager = new ValidationManager();
    this.estimatorManager = new EstimatorManager();
  }

  /**
   * Get project estimate using AI or formula-based calculation
   * @param input - Estimator input data
   * @returns Service result with estimate
   */
  async getEstimate(input: EstimatorInput): Promise<EstimatorServiceResult<EstimateResponse>> {
    try {
      logger.info('Project estimation request started', input, 'EstimatorService');

      // Validate input
      const validation = this.validateEstimatorInput(input);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Get formula-based estimate as fallback
      const formulaEstimate = this.estimatorManager.calculateEstimate(input);

      // Try AI-powered estimate first
      const aiEstimate = await this.getAIEstimate(input);

      if (aiEstimate.success && aiEstimate.data && this.isValidEstimate(aiEstimate.data)) {
        logger.info('Using AI-powered estimate', aiEstimate.data, 'EstimatorService');

        return {
          success: true,
          data: {
            developmentCost: aiEstimate.data.developmentCost!,
            deadlineWeeks: aiEstimate.data.deadlineWeeks!,
            supportCost: aiEstimate.data.supportCost!,
            breakdown: formulaEstimate.breakdown,
            source: 'ai' as const,
            reasoning: aiEstimate.data.reasoning,
          },
        };
      }

      // Fall back to formula-based calculation
      logger.info('Using formula-based estimate', formulaEstimate, 'EstimatorService');

      return {
        success: true,
        data: {
          ...formulaEstimate,
          source: 'formula',
          reasoning: aiEstimate.error || 'Using formula-based calculation',
        },
      };
    } catch (error) {
      logger.error('Project estimation failed', error, 'EstimatorService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Estimation failed',
      };
    }
  }

  /**
   * Save quote request with user contact information
   * @param input - Estimator input with contact details
   * @returns Service result with quote ID
   */
  async saveQuote(
    input: EstimatorInput & {
      email?: string;
      name?: string;
      phone?: string;
    }
  ): Promise<EstimatorServiceResult<{ quoteId: string }>> {
    try {
      logger.info('Quote save request started', { email: input.email, name: input.name }, 'EstimatorService');

      // Validate input
      const validation = this.validateQuoteInput(input);
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      // Generate estimate
      const estimateResult = await this.getEstimate(input);
      if (!estimateResult.success) {
        return {
          success: false,
          error: `Failed to generate estimate: ${estimateResult.error}`,
        };
      }

      // Save quote to database/storage
      const quoteId = await this.estimatorManager.saveQuote({
        ...input,
        estimate: estimateResult.data!,
      });

      // Send notification email (if configured)
      try {
        await this.estimatorManager.sendQuoteNotification({
          quoteId,
          customerInfo: {
            name: input.name || 'Anonymous',
            email: input.email || '',
            phone: input.phone || '',
          },
          estimate: estimateResult.data!,
        });
      } catch (emailError) {
        logger.warn('Failed to send quote notification email', emailError, 'EstimatorService');
        // Don't fail the main operation if email fails
      }

      logger.info(`Quote saved successfully with ID: ${quoteId}`, undefined, 'EstimatorService');

      return {
        success: true,
        data: { quoteId },
      };
    } catch (error) {
      logger.error('Quote save failed', error, 'EstimatorService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save quote',
      };
    }
  }

  /**
   * Get AI-powered estimate
   * @param input - Estimator input
   * @returns AI estimate result
   */
  private async getAIEstimate(input: EstimatorInput): Promise<EstimatorServiceResult<Partial<EstimateResponse>>> {
    try {
      const result = await this.aiManager.generateProjectEstimate(input);
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'AI estimation failed',
        };
      }

      return {
        success: true,
        data: {
          developmentCost: result.data.developmentCost,
          deadlineWeeks: result.data.deadlineWeeks,
          supportCost: result.data.supportCost,
          reasoning: result.data.reasoning,
        },
      };
    } catch (error) {
      logger.error('AI estimation failed', error, 'EstimatorService');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'AI estimation failed',
      };
    }
  }

  /**
   * Validate estimator input
   * @param input - Estimator input
   * @returns Validation result
   */
  private validateEstimatorInput(input: EstimatorInput): { isValid: boolean; error?: string } {
    if (!input.projectType || typeof input.projectType !== 'string') {
      return {
        isValid: false,
        error: 'Project type is required',
      };
    }

    if (!['mobile', 'web', 'telegram', 'other'].includes(input.projectType)) {
      return {
        isValid: false,
        error: 'Invalid project type',
      };
    }

    if (!input.complexity || typeof input.complexity !== 'string') {
      return {
        isValid: false,
        error: 'Complexity level is required',
      };
    }

    if (!['simple', 'medium', 'complex'].includes(input.complexity)) {
      return {
        isValid: false,
        error: 'Invalid complexity level',
      };
    }

    if (typeof input.pages !== 'number' || input.pages < 1) {
      return {
        isValid: false,
        error: 'Number of pages/screens must be a positive number',
      };
    }

    if (input.pages > 100) {
      return {
        isValid: false,
        error: 'Number of pages/screens cannot exceed 100',
      };
    }

    if (input.features && !Array.isArray(input.features)) {
      return {
        isValid: false,
        error: 'Features must be an array',
      };
    }

    if (input.techStack && !Array.isArray(input.techStack)) {
      return {
        isValid: false,
        error: 'Tech stack must be an array',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate quote input with contact information
   * @param input - Quote input
   * @returns Validation result
   */
  private validateQuoteInput(input: EstimatorInput & { email?: string; name?: string; phone?: string }): {
    isValid: boolean;
    error?: string;
  } {
    // First validate the estimator input
    const estimatorValidation = this.validateEstimatorInput(input);
    if (!estimatorValidation.isValid) {
      return estimatorValidation;
    }

    // Validate contact information
    if (input.email) {
      const emailValidation = this.validationManager.validateEmail(input.email);
      if (!emailValidation.isValid) {
        return emailValidation;
      }
    }

    if (input.phone) {
      const phoneValidation = this.validationManager.validatePhone(input.phone);
      if (!phoneValidation.isValid) {
        return phoneValidation;
      }
    }

    if (input.name && (typeof input.name !== 'string' || input.name.trim().length === 0)) {
      return {
        isValid: false,
        error: 'Name must be a non-empty string if provided',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate if estimate data is reasonable
   * @param estimate - Estimate data
   * @returns Boolean indicating validity
   */
  private isValidEstimate(estimate?: Partial<EstimateResponse>): boolean {
    if (!estimate) return false;

    return (
      typeof estimate.developmentCost === 'number' &&
      estimate.developmentCost > 0 &&
      estimate.developmentCost < 1000000 && // Reasonable upper limit
      typeof estimate.deadlineWeeks === 'number' &&
      estimate.deadlineWeeks > 0 &&
      estimate.deadlineWeeks < 200 && // Reasonable upper limit
      typeof estimate.supportCost === 'number' &&
      estimate.supportCost >= 0
    );
  }
}

// Export singleton instance
export const estimatorService = new EstimatorService();
