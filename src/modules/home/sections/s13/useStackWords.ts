import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { buildTower, STACK_LAYERS, type StackLayer, type StackTool } from './stack';
import { buildToolbox, type KitId, type Market, type StackWords, type Toolbox } from './stack-data';

const KIT_IDS: readonly KitId[] = ['telegram', 'mobile', 'web', 'rag', 'crm'];

export interface StackText {
  toolbox: Toolbox;
  /** The four layers, bottom first, named in the page's language. */
  layers: readonly StackLayer[];
  /** A kit's tower (stable identity for the page's lifetime). */
  towerFor: (kit: KitId) => readonly StackTool[];
}

/**
 * The tower and the toolbox in the page's language: every word comes from
 * `home.stack-physics` (layers, kits, areas, tool lines), the structure and
 * the counts from stack.ts / stack-data.ts. Built once per locale and market.
 */
export function useStackWords(market: Market): StackText {
  const t = useTranslations('home.stack-physics');
  return useMemo(() => {
    const words: StackWords = {
      toolBlurb: id => t(`tools.${id}`),
      genericLabel: id => t(`labels.${id}`),
      trade: id => ({ name: t(`trades.${id}.name`), role: t(`trades.${id}.role`) }),
      kit: id => ({
        label: t(`kits.${id}.label`),
        subject: t(`kits.${id}.subject`),
        forSubject: t(`kits.${id}.forSubject`),
        headline: t(`kits.${id}.headline`),
        top: t(`kits.${id}.top`),
        rider: t(`kits.${id}.rider`),
      }),
    };
    const towers = new Map(KIT_IDS.map(kit => [kit, buildTower(kit, market, id => t(`tower.${id}`))] as const));
    return {
      toolbox: buildToolbox(market, words),
      layers: STACK_LAYERS.map(layer => ({ ...layer, name: t(`layers.${layer.id}.name`), role: t(`layers.${layer.id}.role`) })),
      towerFor: kit => towers.get(kit) ?? [],
    };
  }, [t, market]);
}
