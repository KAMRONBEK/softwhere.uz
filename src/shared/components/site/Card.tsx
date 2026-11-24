import Link from 'next/link';
import type { ReactNode } from 'react';
import css from './Card.module.css';

/** The arrow the homepage's cards and links end with; moves a little on its card's hover. */
export function Arrow({ className }: { className?: string }) {
  return (
    <svg
      className={className ? `${css.arrow} ${className}` : css.arrow}
      viewBox='0 0 16 16'
      width='16'
      height='16'
      aria-hidden='true'
      focusable='false'
    >
      <path d='M3 8h10M9 4l4 4-4 4' fill='none' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  );
}

interface CardGridProps {
  children: ReactNode;
  /** Narrowest card (a CSS length): as many columns as fit. */
  min?: string;
  className?: string;
}

/** A list of cards; give it <Card> children. */
export function CardGrid({ children, min = '280px', className }: CardGridProps) {
  return (
    <ul
      className={className ? `${css.grid} ${className}` : css.grid}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}), 1fr))` }}
    >
      {children}
    </ul>
  );
}

interface CardProps {
  title: ReactNode;
  /** Makes the whole card a link, through its title (a stretched link). */
  href?: string;
  as?: 'h2' | 'h3';
  /** A small muted line above the title (a date, a category). */
  meta?: ReactNode;
  /** The card's text. */
  children?: ReactNode;
  /** Above everything, edge to edge (an image). */
  media?: ReactNode;
  className?: string;
}

/** A raised card, rendered as an <li> for <CardGrid>. */
export function Card({ title, href, as: Heading = 'h3', meta, children, media, className }: CardProps) {
  return (
    <li className={[css.card, href ? css.linked : '', className].filter(Boolean).join(' ')}>
      {media ? <div className={css.media}>{media}</div> : null}
      <div className={css.body}>
        {meta ? <p className={css.meta}>{meta}</p> : null}
        <Heading className={css.title}>
          {href ? (
            <Link href={href} className={css.link}>
              {title}
            </Link>
          ) : (
            title
          )}
        </Heading>
        {children ? <div className={css.text}>{children}</div> : null}
        {href ? <Arrow className={css.more} /> : null}
      </div>
    </li>
  );
}
