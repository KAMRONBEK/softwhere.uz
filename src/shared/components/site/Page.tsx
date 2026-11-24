import type { ReactNode } from 'react';
import css from './Page.module.css';

type Width = 'wide' | 'prose';

interface PageProps {
  children: ReactNode;
  className?: string;
}

/** A page's <main>: clears the fixed header and closes with the page's bottom rhythm. */
export function Page({ children, className }: PageProps) {
  return <main className={className ? `${css.page} ${className}` : css.page}>{children}</main>;
}

interface ContainerProps {
  children: ReactNode;
  /** 'wide': the homepage's 1320px column; 'prose': a 720px reading column on the same left edge rules, centred. */
  width?: Width;
  className?: string;
}

/** The site's gutters and column. */
export function Container({ children, width = 'wide', className }: ContainerProps) {
  return <div className={[css.container, width === 'prose' ? css.prose : '', className].filter(Boolean).join(' ')}>{children}</div>;
}

interface SectionProps {
  children?: ReactNode;
  id?: string;
  /** Rendered as an h2 in the display face. */
  heading?: ReactNode;
  /** A muted paragraph under the heading. */
  intro?: ReactNode;
  /** A link or button on the heading's line (right on desktop). */
  action?: ReactNode;
  /** A hairline above the section. */
  isRuled?: boolean;
  width?: Width;
  className?: string;
}

/** One block of a page: container, vertical rhythm and an optional h2 head. */
export function Section({ children, id, heading, intro, action, isRuled = false, width, className }: SectionProps) {
  const headingId = id && heading ? `${id}-heading` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={[css.section, isRuled ? css.ruled : '', className].filter(Boolean).join(' ')}>
      <Container width={width}>
        {heading || intro || action ? (
          <div className={css.sectionHead}>
            <div className={css.sectionTitle}>
              {heading ? (
                <h2 id={headingId} className={css.heading}>
                  {heading}
                </h2>
              ) : null}
              {intro ? <p className={css.intro}>{intro}</p> : null}
            </div>
            {action}
          </div>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
