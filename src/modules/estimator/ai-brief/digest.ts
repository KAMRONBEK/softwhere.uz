import type { ProjectType } from '@/modules/estimator/types';
import type { BriefLocale, Device } from '@/modules/estimator/ai-brief/constants';
import { notPricedLabel } from '@/modules/estimator/ai-brief/labels';
import type { MappedScope } from '@/modules/estimator/ai-brief/mapping';
import type { BriefScope, ProductRef } from '@/modules/estimator/ai-brief/types';

/**
 * The FINAL priced scope, as the narrative and wireframe calls see it and as
 * their parsers check them against. Built from the engine inputs (after every
 * rule in `reconcile.ts` and `mapping.ts`), so "MVP" here means exactly what
 * the MVP price covers and "later" exactly what the full-vision price adds.
 * No numbers: the model never sees an hour, a week or a dollar.
 */
export interface PricedScope {
  product: ProductRef;
  /** Feature + integration ids priced in the MVP. */
  mvpRefs: string[];
  /** Feature + integration ids priced only in the full vision. */
  laterRefs: string[];
  /** Extra products (`type:subtype`), priced for the growth phase. */
  extraRefs: string[];
  hasGrowth: boolean;
  /** Needs outside every number: the model's unpriced items + scope the engine could not price. */
  unpriced: string[];
  /** Catalog ids the engine could not price for this product (also named in `unpriced`). Absent in runs saved before 2026-10 iteration 2. */
  unpricedRefs?: string[];
  frames: {
    /** The frame the product's own screens are drawn in. */
    primary: Device;
    /** Frames an MVP screen may use (primary + operator/admin web when priced). */
    mvp: Device[];
    /** Frames the one 'later' screen may use (adds the extra products' frames). */
    later: Device[];
  };
}

/** Frame a product's own screens are drawn in. */
export function primaryFrame(product: ProductRef): Device {
  switch (product.projectType) {
    case 'mobile':
      return 'phone';
    case 'telegram':
      return product.subtype === 'miniapp' || product.subtype === 'bot_miniapp' ? 'phone' : 'chat';
    case 'desktop':
      return 'desktop';
    default:
      return 'browser';
  }
}

const WEB_FIRST: readonly ProjectType[] = ['web', 'ai', 'other'];

/** The model's note per scope id (what the reader asked the item for). */
export function scopeNotes(scope: Pick<BriefScope, 'features' | 'integrations'>): Map<string, string> {
  return new Map([...scope.features, ...scope.integrations].map(i => [i.id, i.note]));
}

export function pricedScopeOf(scope: BriefScope, mapped: MappedScope, locale: BriefLocale): PricedScope {
  const mvpRefs = [...mapped.mvp.features, ...mapped.mvp.integrations];
  const mvpSet = new Set(mvpRefs);
  const laterRefs = [...mapped.full.features, ...mapped.full.integrations].filter(id => !mvpSet.has(id));
  const extraRefs = mapped.extras.map(e => `${e.input.projectType}:${e.input.subtype}`);

  const primary = primaryFrame(scope.product);
  const mvp = new Set<Device>([primary]);
  if (mvpSet.has('admin_panel') || WEB_FIRST.includes(scope.product.projectType)) mvp.add('browser');
  if (scope.product.subtype === 'bot_miniapp') mvp.add('chat');
  const later = new Set<Device>(mvp);
  for (const e of mapped.extras) later.add(primaryFrame({ projectType: e.input.projectType, subtype: e.input.subtype }));

  return {
    product: scope.product,
    mvpRefs,
    laterRefs,
    extraRefs,
    hasGrowth: mapped.hasLaterScope,
    unpriced: [...scope.unpricedItems, ...mapped.notOffered.map(id => notPricedLabel(id, scopeNotes(scope), locale))],
    unpricedRefs: mapped.notOffered,
    frames: { primary, mvp: Array.from(mvp), later: Array.from(later) },
  };
}
