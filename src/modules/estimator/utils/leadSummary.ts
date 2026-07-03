import type { AiRefinement, EstimateResult, EstimatorInput } from '@/modules/estimator/types';

/**
 * Owner-facing summary of an estimator lead (English labels — this goes to the
 * agency's Telegram/admin, not the client). Returns plain-text lines; the
 * Telegram route escapes and decorates them.
 */
export function buildLeadSummaryLines(input: EstimatorInput, formula: EstimateResult, ai: AiRefinement | null): string[] {
  const lines: string[] = [];

  const scope: string[] = [`Project: ${input.projectType} / ${input.subtype}`, `Tier: ${input.tier}`];
  if (input.projectType === 'mobile') {
    const platforms = input.platforms.length ? input.platforms.join('+') : 'ios+android';
    scope.push(`Platforms: ${platforms} (${input.approach === 'native' ? 'native' : 'cross-platform'})`);
  }
  lines.push(scope.join(' · '));

  const details: string[] = [];
  if (input.screens > 0) details.push(`Screens: ${input.screens}`);
  details.push(`Design: ${input.design}`, `Languages: ${input.languages}`, `Urgency: ${input.urgency}`);
  lines.push(details.join(' · '));

  if (input.features.length) lines.push(`Features (${input.features.length}): ${input.features.join(', ')}`);
  if (input.integrations.length) lines.push(`Integrations (${input.integrations.length}): ${input.integrations.join(', ')}`);
  lines.push(`Stack: ${input.autoTech || input.techStack.length === 0 ? 'agency picks' : input.techStack.join(', ')}`);
  // Collapse to one line: embedded newlines could forge extra fields in the
  // plain-text Telegram notification.
  if (input.description) lines.push(`Description: ${input.description.replace(/\s+/g, ' ').trim()}`);

  lines.push(
    `Estimate: $${formula.cost.min.toLocaleString('en-US')}–$${formula.cost.max.toLocaleString('en-US')} · ${formula.weeks.min}–${formula.weeks.max} weeks · ${formula.hours.min}–${formula.hours.max}h`
  );
  if (ai) {
    lines.push(
      `AI refinement (${ai.provider}, ${ai.confidence}): $${ai.cost.min.toLocaleString('en-US')}–$${ai.cost.max.toLocaleString('en-US')} · ${ai.weeks.min}–${ai.weeks.max} weeks`
    );
  }

  return lines;
}
