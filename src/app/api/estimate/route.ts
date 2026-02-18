import { ESTIMATOR } from '@/constants/estimator';
import { env } from '@/core/env';
import { logger } from '@/core/logger';
import { EstimatorInput } from '@/types/estimator';
import { calculateEstimate } from '@/utils/estimator';
import { NextRequest, NextResponse } from 'next/server';

const VALID_PROJECT_TYPES = ['mobile', 'web', 'telegram', 'desktop', 'other'];
const VALID_COMPLEXITIES = ['mvp', 'standard', 'enterprise'];
const MAX_PAGES = 500;
const MAX_FEATURES = 50;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = body as EstimatorInput;

    if (!input.projectType || !input.complexity || input.pages === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!VALID_PROJECT_TYPES.includes(input.projectType)) {
      return NextResponse.json({ error: 'Invalid projectType' }, { status: 400 });
    }

    if (!VALID_COMPLEXITIES.includes(input.complexity)) {
      return NextResponse.json({ error: 'Invalid complexity' }, { status: 400 });
    }

    if (typeof input.pages !== 'number' || input.pages < 1 || input.pages > MAX_PAGES) {
      return NextResponse.json({ error: `pages must be between 1 and ${MAX_PAGES}` }, { status: 400 });
    }

    if (input.features && (!Array.isArray(input.features) || input.features.length > MAX_FEATURES)) {
      return NextResponse.json({ error: `features must be an array of up to ${MAX_FEATURES} items` }, { status: 400 });
    }

    // Calculate the formula-based estimate first as a fallback
    const formulaEstimate = calculateEstimate(input);

    // Try to get an AI-powered estimate using the implementation from src/api/estimate/route.ts
    if (env.GOOGLE_API_KEY) {
      try {
        const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';

        // Construct a detailed prompt based on the user input
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
        `;

        const response = await fetch(`${apiUrl}?key=${env.GOOGLE_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              topK: 32,
              topP: 0.95,
              responseFormat: { type: 'JSON' },
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (textContent) {
            logger.info(`Raw AI response: ${textContent.substring(0, 200)}...`, undefined, 'AI');

            // Find JSON in the response (Gemini might wrap it in markdown code blocks)
            let jsonStr = textContent;
            const jsonMatch = textContent.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);

            if (jsonMatch && jsonMatch[1]) {
              jsonStr = jsonMatch[1];
              logger.info(`Extracted JSON from code block: ${jsonStr.substring(0, 200)}...`, undefined, 'AI');
            }

            try {
              const aiEstimate = JSON.parse(jsonStr);

              // Log the parsed estimate
              logger.info(`Parsed AI estimate: ${JSON.stringify(aiEstimate)}`, undefined, 'AI');

              // Simple number extraction function
              const extractNumber = (value: any): number => {
                if (typeof value === 'number' && !isNaN(value)) {
                  return value;
                }

                if (typeof value === 'string') {
                  // Remove non-numeric characters except decimal point
                  const cleanedStr = value.replace(/[^0-9.]/g, '');
                  const parsedValue = parseFloat(cleanedStr);

                  return isNaN(parsedValue) ? 0 : parsedValue;
                }

                return 0;
              };

              // Process and validate the AI estimate
              const developmentCost = extractNumber(aiEstimate.developmentCost);
              const deadlineWeeks = extractNumber(aiEstimate.deadlineWeeks);
              const supportCost = extractNumber(aiEstimate.supportCost);

              // Final validation - if any value is invalid, use the formula estimate
              if (developmentCost <= 0 || deadlineWeeks <= 0 || supportCost <= 0) {
                // Return the formula-based estimate instead
                return NextResponse.json({
                  success: true,
                  data: {
                    ...formulaEstimate,
                    source: 'formula',
                    reasoning: 'AI estimate contained invalid values, using formula-based calculation instead.',
                  },
                });
              }

              // Round values to integers for consistency
              const roundedDevelopmentCost = Math.round(developmentCost);
              const roundedDeadlineWeeks = Math.round(deadlineWeeks);
              const roundedSupportCost = Math.round(supportCost);

              logger.info(
                'AI estimation successful with valid values',
                {
                  developmentCost: roundedDevelopmentCost,
                  deadlineWeeks: roundedDeadlineWeeks,
                  supportCost: roundedSupportCost,
                },
                'AI'
              );

              return NextResponse.json({
                success: true,
                data: {
                  developmentCost: roundedDevelopmentCost,
                  deadlineWeeks: roundedDeadlineWeeks,
                  supportCost: roundedSupportCost,
                  reasoning: aiEstimate.reasoning || 'AI-powered estimate based on project parameters.',
                  source: 'ai',
                  breakdown: {
                    // Basic breakdown still included for UI consistency
                    baseCost: ESTIMATOR.BASE_COST[input.projectType],
                    complexityMultiplier: ESTIMATOR.COMPLEXITY_MULTIPLIER[input.complexity],
                    featuresCost: input.features.reduce(
                      (sum, feature) => sum + (ESTIMATOR.FEATURE_PRICES[feature as keyof typeof ESTIMATOR.FEATURE_PRICES] || 0),
                      0
                    ),
                    pagesCost: input.pages * ESTIMATOR.PAGE_PRICE,
                    techAdjustmentFactor: 1.0,
                  },
                },
              });
            } catch (parseError) {
              logger.error('Failed to parse Gemini response', parseError, 'AI');
            }
          }
        }
      } catch (aiError) {
        logger.error('AI estimation failed', aiError, 'AI');
      }
    }

    // Fallback to the standard calculation logic
    logger.info('Using formula-based estimate', formulaEstimate, 'API');

    return NextResponse.json({
      success: true,
      data: {
        ...formulaEstimate,
        source: 'formula',
      },
    });
  } catch (error) {
    logger.error('Estimate calculation failed', error, 'API');

    return NextResponse.json({ success: false, error: 'Failed to process estimate request' }, { status: 500 });
  }
}
