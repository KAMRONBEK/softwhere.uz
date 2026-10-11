import type { ElementType, ReactNode } from 'react';
import type { SectionMeta } from '../types';
import css from './LabSection.module.css';

export function sectionHeadingId(meta: Pick<SectionMeta, 'id'>): string {
  return `${meta.id}-heading`;
}

interface LabSectionProps {
  meta: SectionMeta;
  children: ReactNode;
}

/**
 * Full-bleed section frame the shell puts around every section: the DOM id
 * (jump target, ?only= value), a reserved min-height, and the founder-facing
 * badge ("03 · X-Ray") that stays pinned to the top while the section scrolls,
 * and optional fades that melt the section's edges into the page colour.
 */
export default function LabSection({ meta, children }: LabSectionProps) {
  return (
    <section
      id={meta.id}
      className={css.section}
      style={{ minHeight: meta.minHeight }}
      aria-labelledby={sectionHeadingId(meta)}
      data-section={meta.id}
    >
      <div className={css.badgeRail} aria-hidden='true'>
        <span className={css.badge}>
          {meta.number} · {meta.name}
        </span>
      </div>
      {children}
      {meta.fadeEdges.map(edge => (
        <div key={edge} className={`${css.fade} ${edge === 'top' ? css.fadeTop : css.fadeBottom}`} aria-hidden='true' />
      ))}
    </section>
  );
}

interface SectionHeadingProps {
  meta: Pick<SectionMeta, 'id' | 'name'>;
  /** h1 for the hero only; h2 everywhere else. */
  as?: Extract<ElementType, 'h1' | 'h2'>;
  className?: string;
  /** Keep the text for screen readers/SEO when the visual title lives in WebGL. */
  isVisuallyHidden?: boolean;
  /** Defaults to the section name. */
  children?: ReactNode;
}

/**
 * The section's real heading. Every section renders exactly one, as DOM text
 * (animate it with SplitText if you like, but never canvas-only text).
 */
export function SectionHeading({ meta, as: Tag = 'h2', className, isVisuallyHidden = false, children }: SectionHeadingProps) {
  const classes = [isVisuallyHidden ? css.srOnly : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <Tag id={sectionHeadingId(meta)} className={classes || undefined}>
      {children ?? meta.name}
    </Tag>
  );
}
