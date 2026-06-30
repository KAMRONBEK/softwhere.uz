import { ESTIMATOR, HOURLY_RATE } from '@/modules/estimator/constants';
import { logger } from '@/core/logger';
import { EstimatorInput } from '@/modules/estimator/types';
import { calculateEstimate } from '@/modules/estimator/utils/estimator';
import { safeGenerateJSONWithTimeout } from '@/core/ai';
import { getClientIp, rateLimit } from '@/shared/utils/rateLimit';
import { NextRequest, NextResponse } from 'next/server';

const VALID_PROJECT_TYPES = ['mobile', 'web', 'telegram', 'ai', 'desktop', 'other'];
const VALID_COMPLEXITIES = ['mvp', 'standard', 'enterprise'];
const MAX_PAGES = 500;
const MAX_FEATURES = 50;
const MAX_BODY_BYTES = 32 * 1024; // 32 KB — the form never needs more
const MAX_ITEM_LENGTH = 80; // per free-text array element / subtype
const MAX_LIST_ITEMS = 50;

function extractNumber(value: unknown): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[^0-9.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/** Clamp a user-supplied string list so it can't inflate prompt size / cost. */
function sanitizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .slice(0, MAX_LIST_ITEMS)
    .map(v => v.slice(0, MAX_ITEM_LENGTH));
}

function sanitizeStr(value: unknown): string | undefined {
  return typeof value === 'string' ? value.slice(0, MAX_ITEM_LENGTH) : undefined;
}

export async function POST(request: NextRequest) {
  try {
    // Unauthenticated endpoint that triggers a paid LLM call — throttle per IP
    // to prevent cost-abuse / DoS via concurrent requests.
    const { allowed, retryAfter } = rateLimit(`estimate:${getClientIp(request)}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    // Reject oversized bodies before parsing — attackers could otherwise stuff
    // multi-MB strings into free-text fields to inflate token cost per call.
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
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

    // Bound every free-text field/list that gets interpolated into the prompt.
    const subtype = sanitizeStr(input.subtype);
    const platforms = sanitizeList(input.platforms);
    const features = sanitizeList(input.features);
    const techStack = sanitizeList(input.techStack);
    const languages = sanitizeList(input.languages);
    const integrations = sanitizeList(input.integrations);

    const formulaEstimate = calculateEstimate(input);

    const prompt = `
As an expert software development cost estimator, provide a json estimate for the following project:

Project Type: ${input.projectType}
${subtype ? `Subtype: ${subtype}` : ''}
${input.projectType === 'mobile' && platforms.length ? `Platforms: ${platforms.join(', ')}` : ''}
Complexity Level: ${input.complexity}
Features: ${features.join(', ') || 'None selected'}
Number of Pages/Screens: ${input.pages}
${techStack.length ? `Tech Stack: ${techStack.join(', ')}` : ''}
${languages.length ? `Languages: ${languages.join(', ')}` : ''}
${integrations.length ? `Integrations: ${integrations.join(', ')}` : ''}

Please return only a valid JSON object with the following fields:
- developmentCost (in USD as a number, not a string)
- deadlineWeeks (as a number)
- supportCost (in USD as a number, not a string)
- reasoning (brief explanation of how you arrived at the estimate)

Use $35/hr average rate for quality agencies in Uzbekistan, Kazakhstan, and Russia. Senior $18–28/hr, middle $9–18/hr, junior $4–9/hr.
Support cost: 10% of development for first year.
Reference: MVP mobile 13 screens ≈ 1200h (400h core, 300h payments, 300h video, 200h offline). Parallel iOS+Android ≈ 16 weeks.
Payment integrations: Stripe/Braintree for international; Payme, Click, Uzum, YooKassa, SberPay for Central Asia/Russia.

Important: All monetary values must be numbers, not strings with currency symbols.
    `.trim();

    const jsonText = await safeGenerateJSONWithTimeout(prompt, 'estimate', {
      timeout: 60_000,
      maxRetries: 0,
    });

    if (jsonText) {
      try {
        const aiEstimate = JSON.parse(jsonText);
        logger.info(`Parsed AI estimate: ${JSON.stringify(aiEstimate)}`, undefined, 'AI');

        const developmentCost = extractNumber(aiEstimate.developmentCost);
        const deadlineWeeks = extractNumber(aiEstimate.deadlineWeeks);
        const supportCost = extractNumber(aiEstimate.supportCost);

        if (developmentCost > 0 && deadlineWeeks > 0 && supportCost > 0) {
          logger.info(
            'AI estimation successful',
            {
              developmentCost: Math.round(developmentCost),
              deadlineWeeks: Math.round(deadlineWeeks),
              supportCost: Math.round(supportCost),
            },
            'AI'
          );

          return NextResponse.json({
            success: true,
            data: {
              developmentCost: Math.round(developmentCost),
              deadlineWeeks: Math.round(deadlineWeeks),
              supportCost: Math.round(supportCost),
              reasoning: aiEstimate.reasoning || 'AI-powered estimate based on project parameters.',
              source: 'ai',
              breakdown: {
                baseCost: (ESTIMATOR.BASE_HOURS[input.projectType] ?? ESTIMATOR.BASE_HOURS.other) * HOURLY_RATE,
                complexityMultiplier: ESTIMATOR.COMPLEXITY_MULTIPLIER[input.complexity],
                featuresCost: features.reduce((sum, feature) => sum + (ESTIMATOR.FEATURE_HOURS[feature] ?? 0) * HOURLY_RATE, 0),
                pagesCost: input.pages * ESTIMATOR.PAGE_HOURS * HOURLY_RATE,
                techAdjustmentFactor: 1.0,
                totalHours: 0,
                hourlyRate: HOURLY_RATE,
              },
            },
          });
        }
      } catch (parseError) {
        logger.error('Failed to parse AI response', parseError, 'AI');
      }
    }

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
