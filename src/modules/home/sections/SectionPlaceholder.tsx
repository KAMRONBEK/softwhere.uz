'use client';

import { SectionHeading } from '../components/LabSection';
import { useLabLogo } from '../logos';
import type { SectionMeta } from '../types';
import css from './SectionPlaceholder.module.css';

interface SectionPlaceholderProps {
  meta: SectionMeta;
  /** h1 for the hero only. */
  as?: 'h1' | 'h2';
  /** Show the logo selected in the panel above the title (the hero does). */
  showLogo?: boolean;
}

/** Stand-in each section file renders until its agent replaces it. */
export default function SectionPlaceholder({ meta, as = 'h2', showLogo = false }: SectionPlaceholderProps) {
  const { Logo } = useLabLogo();
  return (
    <div className={css.placeholder} style={{ minHeight: meta.minHeight }}>
      <span className={css.number} aria-hidden='true'>
        {meta.number}
      </span>
      {showLogo && <Logo className={css.logo} animate />}
      <SectionHeading meta={meta} as={as} className={css.title} />
      <p className={css.brief}>{meta.brief}</p>
      <p className={css.tag}>Placeholder</p>
    </div>
  );
}
