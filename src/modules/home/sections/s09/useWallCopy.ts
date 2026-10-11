'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { LabProject } from '../../media/portfolio';
import { useProjectDescriber } from '../../media/useProjectDescriber';

export interface WallLabels {
  /** "USA", "Узбекистан": the project's market in the visitor's language. */
  market: (project: LabProject) => string;
  /** The project's industry ("FinTech", "Финтех"). */
  category: (project: LabProject) => string;
  /** Screen-reader label of a tile: name, category, market and the action. */
  card: (project: LabProject) => string;
}

/** Per-project caption labels for the wall, the list and the lightbox. Real names stay as they are. */
export function useWallLabels(): WallLabels {
  const t = useTranslations('home.work-wall');
  const describer = useProjectDescriber();
  return useMemo(() => {
    const market = (project: LabProject) => describer.location(project);
    const category = (project: LabProject) => describer.industry(project);
    const card = (project: LabProject) => t('cardLabel', { name: project.name, category: category(project), market: market(project) });
    return { market, category, card };
  }, [t, describer]);
}
