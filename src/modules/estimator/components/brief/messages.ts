import type { AbstractIntlMessages } from 'next-intl';

/**
 * Messages the AI brief reads on the client: its own namespace plus the
 * slice of `estimator` it shares with the wizard (catalog labels, team roles,
 * engine settings). Handing it the whole `estimator` namespace would ship the
 * wizard's copy for nothing.
 *
 * Remember that a nested NextIntlClientProvider REPLACES its parent's
 * messages: wrap only the brief in a provider fed by this function.
 */
const ESTIMATOR_KEYS = [
  'feature',
  'integration',
  'subtype',
  'service',
  'team',
  'breakdown',
  'tier',
  'design',
  'approach',
  'urgency',
  'timeframe',
  'currencyLabel',
] as const;

export function pickAiBriefMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const estimator = (messages.estimator ?? {}) as AbstractIntlMessages;
  return {
    aiBrief: messages.aiBrief ?? {},
    estimator: Object.fromEntries(ESTIMATOR_KEYS.filter(key => key in estimator).map(key => [key, estimator[key]])),
  };
}
