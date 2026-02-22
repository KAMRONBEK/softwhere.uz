/**
 * @deprecated Use src/app/api/estimate/route.ts instead.
 * This file is outside the App Router directory and is not reachable as an API route.
 */
import { ESTIMATOR, HOURLY_RATE } from '@/constants/estimator';
import { logger } from '@/core/logger';
import { EstimatorInput } from '@/types/estimator';
import { calculateEstimate } from '@/utils/estimator';
import { safeGenerateJSON } from '@/utils/ai';
import { NextRequest, NextResponse } from 'next/server';

interface AIEstimateResponse {
  developmentCost: number;
  deadlineWeeks: number;
  supportCost: number;
  reasoning?: string;
}

function extractNumber(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

async function getAIEstimate(input: EstimatorInput): Promise<AIEstimateResponse | null> {
  const prompt = `
As an expert software development cost estimator, provide a json estimate for the following project:

Project Type: ${input.projectType}
${input.projectType === 'mobile' && input.platforms ? `Platforms: ${input.platforms.join(', ')}` : ''}
Complexity Level: ${input.complexity}
Features: ${input.features.join(', ') || 'None selected'}
Number of Pages/Screens: ${input.pages}
${input.techStack ? `Tech Stack Preference: ${input.techStack.join(', ')}` : ''}

Please return only a valid JSON object with the following fields:
- developmentCost (in USD as a number, not a string)
- deadlineWeeks (as a number)
- supportCost (in USD as a number, not a string)
- reasoning (brief explanation of how you arrived at the estimate)

Base your pricing on industry standards for quality work done by professional developers.

Important: All monetary values must be numbers, not strings with currency symbols.
  `.trim();

  const jsonText = await safeGenerateJSON(prompt, 'estimate');
  if (!jsonText) return null;

  try {
    const raw = JSON.parse(jsonText);
    logger.info(`Parsed AI estimate: ${JSON.stringify(raw)}`, undefined, 'AI');

    const developmentCost = extractNumber(raw.developmentCost);
    const deadlineWeeks = extractNumber(raw.deadlineWeeks);
    const supportCost = extractNumber(raw.supportCost);

    if (developmentCost <= 0 || deadlineWeeks <= 0 || supportCost <= 0) return null;

    return {
      developmentCost: Math.round(developmentCost),
      deadlineWeeks: Math.round(deadlineWeeks),
      supportCost: Math.round(supportCost),
      reasoning: raw.reasoning || 'AI-powered estimate based on project parameters.',
    };
  } catch (parseError) {
    logger.error('Failed to parse AI response', parseError, 'AI');
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = body as EstimatorInput;

    if (!input.projectType || !input.complexity || input.pages === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const formulaEstimate = calculateEstimate(input);
    const aiEstimate = await getAIEstimate(input);

    if (aiEstimate && aiEstimate.developmentCost > 0 && aiEstimate.deadlineWeeks > 0 && aiEstimate.supportCost > 0) {
      return NextResponse.json({
        success: true,
        data: {
          ...aiEstimate,
          source: 'ai',
          breakdown: {
            baseCost: (ESTIMATOR.BASE_HOURS[input.projectType] ?? ESTIMATOR.BASE_HOURS.other) * HOURLY_RATE,
            complexityMultiplier: ESTIMATOR.COMPLEXITY_MULTIPLIER[input.complexity],
            featuresCost: (input.features ?? []).reduce((sum, feature) => sum + (ESTIMATOR.FEATURE_HOURS[feature] ?? 0) * HOURLY_RATE, 0),
            pagesCost: input.pages * ESTIMATOR.PAGE_HOURS * HOURLY_RATE,
            techAdjustmentFactor: 1.0,
            totalHours: 0,
            hourlyRate: HOURLY_RATE,
          },
        },
      });
    }

    logger.info('Using formula-based estimate', formulaEstimate, 'API');

    return NextResponse.json({
      success: true,
      data: {
        ...formulaEstimate,
        source: 'formula',
        reasoning: aiEstimate
          ? 'AI estimate contained invalid values, using formula-based calculation instead.'
          : 'Using formula-based calculation.',
      },
    });
  } catch (error) {
    logger.error('Estimate calculation failed', error, 'API');

    return NextResponse.json({ success: false, error: 'Failed to process estimate request' }, { status: 500 });
  }
}
