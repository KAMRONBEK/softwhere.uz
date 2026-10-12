'use client';

import { useTranslations } from 'next-intl';
import type { CSSProperties, ReactNode } from 'react';
import { useHomeFacts } from '../context/HomeFactsContext';
import type { LabSectionProps } from '../types';
import { SectionHeading } from './LabSection';
import SectionSkeleton, { skeletonShapeFor } from './SectionSkeleton';
import css from './SectionFallback.module.css';

interface SectionFallbackProps extends LabSectionProps {
  /** Replaces the plain `summary` message (e.g. a summary with links in it). */
  summary?: ReactNode;
  /** Extra static content under the summary: real links for crawlers and no-JS visitors. */
  children?: ReactNode;
}

/**
 * What a section shows before its code mounts, and the server HTML of every
 * section: its one heading (h1 for the hero) and summary, from
 * `home.<sectionId>.heading` / `.summary` (both required) (src/messages/home/<id>/<locale>.json).
 * This is what crawlers, no-JS visitors and the first paint get, so it must
 * stay light: no GSAP, WebGL or heavy imports. A section can register a richer
 * static fallback of its own in sections/registry.ts (FALLBACKS); it must
 * render the same SectionHeading id, usually by wrapping this one.
 *
 * `data-lab-standin` tells LazyMount's keyboard hand-off that the section's
 * code has not rendered yet (its controls are not in the DOM).
 *
 * Under the copy, a glowing skeleton of the section's stage
 * (SectionSkeleton) fills the rest of the first screen, so the slot never
 * reads as empty while the section's code is on the way.
 */
export default function SectionFallback({ meta, summary, children }: SectionFallbackProps) {
  const t = useTranslations(`home.${meta.id}` as const);
  const facts = useHomeFacts();
  const shape = skeletonShapeFor(meta.id);
  return (
    <div
      className={css.root}
      data-lab-standin=''
      style={{ minHeight: meta.minHeight, '--lab-fallback-h': meta.minHeight } as CSSProperties}
    >
      <div className={css.inner}>
        <SectionHeading meta={meta} as={meta.id === 'hero' ? 'h1' : 'h2'} className={css.heading}>
          {t('heading', facts)}
        </SectionHeading>
        <p className={css.summary}>{summary ?? t('summary', facts)}</p>
        {children}
        {shape ? <SectionSkeleton shape={shape} /> : null}
      </div>
    </div>
  );
}
