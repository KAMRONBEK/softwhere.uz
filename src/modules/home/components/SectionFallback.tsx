'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useHomeFacts } from '../context/HomeFactsContext';
import type { LabSectionProps } from '../types';
import { SectionHeading } from './LabSection';
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
 */
export default function SectionFallback({ meta, summary, children }: SectionFallbackProps) {
  const t = useTranslations(`home.${meta.id}` as const);
  const facts = useHomeFacts();
  return (
    <div className={css.root} style={{ minHeight: meta.minHeight }}>
      <div className={css.inner}>
        <SectionHeading meta={meta} as={meta.id === 'hero' ? 'h1' : 'h2'} className={css.heading}>
          {t('heading', facts)}
        </SectionHeading>
        <p className={css.summary}>{summary ?? t('summary', facts)}</p>
        {children}
      </div>
    </div>
  );
}
