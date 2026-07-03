/**
 * Estimator calibration harness — prints the formula output for canonical
 * market scenarios next to the Tashkent-market target bands (July 2026
 * research). Run after touching pricing constants or the catalog:
 *
 *   yarn tsx scripts/estimator-calibration.ts
 *
 * Adjust constants in src/modules/estimator/constants.ts until every row
 * lands inside (or sensibly near) its target band.
 */
import { applySubtype, defaultInputFor } from '../src/modules/estimator/data/catalog';
import type { EstimatorInput, ProjectType } from '../src/modules/estimator/types';
import { calculateEstimate } from '../src/modules/estimator/utils/estimator';

function scenario(type: ProjectType, subtype: string, patch: Partial<EstimatorInput> = {}): EstimatorInput {
  return { ...applySubtype(defaultInputFor(type), subtype), ...patch };
}

const CASES: { label: string; target: string; input: EstimatorInput }[] = [
  { label: 'Landing (MVP, custom design, 2 langs)', target: '$300–700', input: scenario('web', 'landing') },
  { label: 'Corporate site (standard)', target: '$800–1500', input: scenario('web', 'corporate', { tier: 'standard' }) },
  {
    label: 'Web e-commerce + Payme/Click/OFD (MVP)',
    target: '$1200–3000',
    input: scenario('web', 'ecommerce', { integrations: ['payme', 'click', 'soliq_ofd'] }),
  },
  { label: 'SaaS MVP', target: '$2500–6000', input: scenario('web', 'saas') },
  { label: 'Custom CRM (standard)', target: '$5000–10000', input: scenario('web', 'crm', { tier: 'standard' }) },
  { label: 'Telegram info bot', target: '$250–400', input: scenario('telegram', 'info_bot') },
  { label: 'Telegram order bot', target: '$400–700', input: scenario('telegram', 'order_bot') },
  {
    label: 'Telegram order bot + Payme/Click',
    target: '$700–1000',
    input: scenario('telegram', 'order_bot', { integrations: ['payme', 'click'] }),
  },
  {
    label: 'Telegram Mini App + payments',
    target: '$1500–2500',
    input: scenario('telegram', 'miniapp', { integrations: ['payme', 'click'] }),
  },
  { label: 'Mobile business app MVP (cross, both)', target: '$3000–5000', input: scenario('mobile', 'business') },
  {
    label: 'Mobile e-commerce MVP (cross, both)',
    target: '$4000–8000',
    input: scenario('mobile', 'ecommerce', { integrations: ['payme', 'click', 'eskiz_sms'] }),
  },
  {
    label: 'Mobile e-comm FULL (standard, native both)',
    target: '$12000–25000',
    input: scenario('mobile', 'ecommerce', {
      tier: 'standard',
      approach: 'native',
      integrations: ['payme', 'click', 'uzum_bank', 'eskiz_sms', 'onec'],
      features: ['catalog', 'cart_checkout', 'orders', 'push', 'search', 'admin_panel', 'loyalty', 'promo', 'reviews', 'chat'],
    }),
  },
  {
    label: 'Delivery app MVP (cross) + maps/SMS',
    target: '$4000–8000',
    input: scenario('mobile', 'delivery', { integrations: ['payme', 'click', 'yandex_maps', 'eskiz_sms'] }),
  },
  { label: 'AI chatbot', target: '$830–1250', input: scenario('ai', 'chatbot') },
  { label: 'RAG knowledge base', target: '$1600–3000', input: scenario('ai', 'rag') },
];

for (const { label, target, input } of CASES) {
  const r = calculateEstimate(input);
  const cost = `$${r.cost.min.toLocaleString()}–$${r.cost.max.toLocaleString()}`;
  const weeks = `${r.weeks.min}–${r.weeks.max}w`;
  const hours = `${r.hours.min}–${r.hours.max}h`;
  // eslint-disable-next-line no-console
  console.log(`${label.padEnd(46)} ${cost.padEnd(18)} ${weeks.padEnd(8)} ${hours.padEnd(12)} target ${target}`);
}
