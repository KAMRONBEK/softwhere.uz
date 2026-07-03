import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/core/logger';
import { safeGenerateJSONWithTimeout, type JsonSchemaSpec, type ProviderName } from '@/core/ai';
import { getClientIp, rateLimit } from '@/shared/utils/rateLimit';
import { BLENDED_RATE } from '@/modules/estimator/constants';
import { sanitizeEstimatorInput } from '@/modules/estimator/utils/sanitize';
import { calculateEstimate, clampAiRange } from '@/modules/estimator/utils/estimator';
import type { AiRefinement, EstimateApiResponse } from '@/modules/estimator/types';

// Route segment config (belt) + vercel.json entry (braces): the global 30s
// function cap would kill the AI call mid-flight in production.
export const maxDuration = 60;

const MAX_BODY_BYTES = 32 * 1024;
// Budget chain: 2 providers × 25s < maxDuration 60s < the client's 60s fetch
// timeout. At Kimi's ~43 tok/s, 900 tokens ≈ 23s — the payload (4 ints +
// short bullets) fits comfortably.
const AI_TIMEOUT_MS = 25_000;
const AI_MAX_TOKENS = 900;
const MAX_TEXT = 500;
const MAX_BULLETS = 3;
// Coarse per-instance daily circuit breaker on paid LLM calls. The per-IP rate
// limit is bypassable (rotating IPs, cold instances); this bounds the worst-
// case spend a single warm instance can generate in a day.
const AI_DAILY_BUDGET = 500;
let aiBudget = { day: '', used: 0 };

function aiBudgetAllows(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (aiBudget.day !== today) aiBudget = { day: today, used: 0 };
  if (aiBudget.used >= AI_DAILY_BUDGET) return false;
  aiBudget.used += 1;
  return true;
}

const LOCALE_LANGUAGE: Record<string, string> = {
  en: 'English',
  ru: 'Russian',
  uz: 'Uzbek (Latin script)',
};

/** MFJS-compliant strict schema for Kimi's response_format json_schema. */
const REFINEMENT_SCHEMA: JsonSchemaSpec = {
  name: 'estimate_refinement',
  schema: {
    type: 'object',
    properties: {
      costMin: { type: 'integer', description: 'Refined minimum development cost in USD' },
      costMax: { type: 'integer', description: 'Refined maximum development cost in USD' },
      weeksMin: { type: 'integer', description: 'Refined minimum timeline in weeks' },
      weeksMax: { type: 'integer', description: 'Refined maximum timeline in weeks' },
      summary: { type: 'string', description: '2-3 sentence assessment of the project scope and price drivers' },
      risks: { type: 'array', items: { type: 'string' }, description: 'Up to 3 short risk/attention bullets' },
      suggestions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 3 short scope suggestions (savings or valuable additions)',
      },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
    required: ['costMin', 'costMax', 'weeksMin', 'weeksMax', 'summary', 'risks', 'suggestions', 'confidence'],
    additionalProperties: false,
  },
};

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function clipList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(v => clip(v, MAX_TEXT))
    .filter(Boolean)
    .slice(0, MAX_BULLETS);
}

export async function POST(request: NextRequest) {
  try {
    // Unauthenticated endpoint that triggers a paid LLM call — throttle per IP.
    const { allowed, retryAfter } = rateLimit(`estimate:${getClientIp(request)}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ success: false, error: 'Request body too large' }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    const input = sanitizeEstimatorInput(body.input);
    if (!input) {
      return NextResponse.json({ success: false, error: 'Invalid estimator input' }, { status: 400 });
    }

    const locale = typeof body.locale === 'string' && Object.hasOwn(LOCALE_LANGUAGE, body.locale) ? body.locale : 'en';
    const formula = calculateEstimate(input);

    const prompt = `You are a senior software estimation expert at a Tashkent (Uzbekistan) software agency working at Central Asia market rates (blended ~$${BLENDED_RATE}/hr covering dev, design, QA, PM; IT Park tax regime).

Client's request (from our website estimator):
- Project: ${input.projectType} / ${input.subtype}
${input.projectType === 'mobile' ? `- Platforms: ${input.platforms.join(', ') || 'ios, android'} (${input.approach === 'native' ? 'native Swift/Kotlin' : 'cross-platform Flutter/React Native'})\n` : ''}- Tier: ${input.tier}
${input.screens > 0 ? `- Screens/pages: ${input.screens}\n` : ''}- Features: ${input.features.join(', ') || 'none selected'}
- Integrations: ${input.integrations.join(', ') || 'none selected'}
- Tech stack: ${input.autoTech || input.techStack.length === 0 ? 'agency picks' : input.techStack.join(', ')}
- Design: ${input.design}; UI languages: ${input.languages}; urgency: ${input.urgency}
${input.description ? `- Client's own description: "${input.description}"\n` : ''}
Our internal formula estimate: $${formula.cost.min}–$${formula.cost.max}, ${formula.weeks.min}–${formula.weeks.max} weeks, ${formula.hours.min}–${formula.hours.max} hours.

Market anchors (Tashkent quality-agency band, 2026): landing $300–700; corporate site $800–1500; web e-commerce $1200–3000; Telegram order bot $400–700 (with payments $700–1000); Telegram Mini App $900–3000; cross-platform mobile MVP $3000–8000; custom CRM $5000–10000. Payme/Click integration ≈ 2–5 days each; fiscal OFD receipts are mandatory for UZ e-commerce.

Task: refine the estimate. Adjust for feature interactions, the client's description (if it implies hidden scope), and realistic risk. Stay within a sane distance of the formula unless something is clearly mis-scoped. Keep bullets short (max ${MAX_BULLETS} each). Write summary, risks and suggestions in ${LOCALE_LANGUAGE[locale]}.

Return ONLY JSON with fields: costMin, costMax, weeksMin, weeksMax (integers, USD/weeks), summary (string), risks (array of strings), suggestions (array of strings), confidence ("low"|"medium"|"high").`;

    // Uzbek quality is markedly better on DeepSeek (UzLiB 0.709 vs 0.518).
    const prefer: ProviderName | undefined = locale === 'uz' ? 'deepseek' : undefined;

    let ai: AiRefinement | null = null;
    if (!aiBudgetAllows()) {
      logger.warn('AI daily budget exhausted; returning formula-only estimate', undefined, 'AI');
      return NextResponse.json({ success: true, data: { formula, ai: null } satisfies EstimateApiResponse });
    }
    const res = await safeGenerateJSONWithTimeout(prompt, 'estimate-refine', {
      timeout: AI_TIMEOUT_MS,
      maxTokens: AI_MAX_TOKENS,
      jsonSchema: REFINEMENT_SCHEMA,
      prefer,
      firstOnly: false,
    });

    if (res) {
      try {
        const parsed = JSON.parse(res.text) as Record<string, unknown>;
        // Reject rather than fabricate: an absent/garbage number would be
        // clamped up from 0 into a confident-looking range invented from no
        // data (the DeepSeek json_object fallback doesn't enforce fields).
        const numbers = [parsed.costMin, parsed.costMax, parsed.weeksMin, parsed.weeksMax].map(Number);
        const numbersValid = numbers.every(n => Number.isFinite(n) && n > 0);
        const clamped = clampAiRange({ costMin: numbers[0], costMax: numbers[1], weeksMin: numbers[2], weeksMax: numbers[3] }, formula);
        const summary = clip(parsed.summary, MAX_TEXT);
        if (summary && numbersValid) {
          ai = {
            ...clamped,
            summary,
            risks: clipList(parsed.risks),
            suggestions: clipList(parsed.suggestions),
            confidence: parsed.confidence === 'low' || parsed.confidence === 'high' ? parsed.confidence : 'medium',
            provider: res.provider,
          };
        }
      } catch (parseError) {
        logger.error('Failed to parse AI refinement', parseError, 'AI');
      }
    }

    const data: EstimateApiResponse = { formula, ai };
    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error('Estimate calculation failed', error, 'API');
    return NextResponse.json({ success: false, error: 'Failed to process estimate request' }, { status: 500 });
  }
}
